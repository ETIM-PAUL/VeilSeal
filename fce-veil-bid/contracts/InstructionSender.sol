// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

// TODO: Replace local interfaces with imports from flare-smart-contracts-v2 once published as a package.
import { ITeeExtensionRegistry } from "./interfaces/ITeeExtensionRegistry.sol";
import { ITeeMachineRegistry } from "./interfaces/ITeeMachineRegistry.sol";

/// @title VeilBidding
/// @author VeilPay
/// @notice Sealed-bid auctions settled by a Flare Confidential Compute (FCC)
/// TEE extension. A bidder commits an on-chain hash of their true bid plus an
/// ECIES ciphertext only the TEE can decrypt — the amount never appears in
/// the clear on-chain. After a listing's deadline, anyone calls
/// `requestReveal`, which routes every sealed bid for that listing to the
/// TEE in one instruction; the TEE decrypts each ciphertext, determines the
/// winner, and signs the result. `submitRevealResult` verifies that
/// signature on-chain (ecrecover against the registered TEE address) before
/// recording the winner — losing bid amounts are never revealed on-chain,
/// only the winner and winning amount.
///
/// This contract also doubles as the FCC InstructionSender: it owns the
/// extension registration and routes BID/REVEAL instructions through the
/// Flare TEE Manager diamond.
///
/// DO NOT MODIFY: the registry wiring in the constructor, setExtensionId(),
/// and _getExtensionId().
contract VeilBidding {
    // --- FCC operation identifiers (must match internal/config/config.go) ---

    /// @notice Operation type for sealed-bid actions.
    // forge-lint: disable-next-line(unsafe-typecast)
    bytes32 public constant OP_TYPE_BID = bytes32("BID");

    /// @notice Command to reveal every sealed bid for a listing (TEE decrypts + picks winner).
    // forge-lint: disable-next-line(unsafe-typecast)
    bytes32 public constant OP_COMMAND_REVEAL = bytes32("REVEAL");

    /// @notice Domain-separation prefix the TEE node signs ActionResult hashes
    /// under: keccak256(abi.encode(TEE_ACTION_RESULT_PREFIX, chainId, ActionResult.Hash())),
    /// wrapped with the EIP-191 personal-sign prefix. Must match go-flare-common's
    /// `signing.TEEActionResult` (github.com/flare-foundation/go-flare-common/pkg/signing).
    // forge-lint: disable-next-line(unsafe-typecast)
    bytes32 private constant TEE_ACTION_RESULT_PREFIX = bytes32("TEE_ACTION_RESULT");

    // --- Registries ---

    /// @notice Reference to the TEE extension registry contract.
    ITeeExtensionRegistry public immutable TEE_EXTENSION_REGISTRY;
    /// @notice Reference to the TEE machine registry contract.
    ITeeMachineRegistry public immutable TEE_MACHINE_REGISTRY;

    /// @notice First public extension ID. The registry reserves IDs below this
    /// for system/reserved extensions; public extensions are assigned from here up.
    uint256 private constant FIRST_PUBLIC_EXTENSION_ID = 0x10000; // 65536

    uint256 private _extensionId;

    // --- Listing state ---

    /// @notice A sealed-bid auction listing.
    struct Listing {
        address creator;
        uint64 deadline;      // bidding closes, reveal opens
        bool revealed;
        address winner;
        uint256 winningAmount; // only the winning amount is ever revealed on-chain
    }

    /// @notice A bidder's sealed bid: an on-chain commitment plus an ECIES
    /// ciphertext only the TEE can decrypt.
    struct SealedBid {
        bytes32 termsCommitment; // keccak256(abi.encode(amount, nonce, bidder))
        bytes encryptedTerms;    // ECIES ciphertext, TEE-only
        bool submitted;
    }

    /// @notice ABI payload of a REVEAL instruction (decoded by the TEE).
    struct RevealMessage {
        uint256 listingId;
        address contractAddr;      // this contract — echoed back so the result binds to it
        address[] bidders;
        bytes32[] termsCommitments;
        bytes[] encryptedTerms;
    }

    address public owner;
    address public teeAddress;

    uint256 public listingCount;
    mapping(uint256 => Listing) public listings;
    mapping(uint256 => address[]) public bidders;
    mapping(uint256 => mapping(address => SealedBid)) public sealedBids;

    event ListingCreated(uint256 indexed listingId, address indexed creator, uint64 deadline);
    event BidSealed(uint256 indexed listingId, address indexed bidder, bytes32 termsCommitment);
    event RevealRequested(uint256 indexed listingId, bytes32 instructionId);
    event BidRevealed(uint256 indexed listingId, address indexed winner, uint256 winningAmount);
    event TeeAddressSet(address indexed teeAddress);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    /// @notice Initializes the contract with registry addresses.
    /// @param _teeExtensionRegistry Address of the TEE extension registry.
    /// @param _teeMachineRegistry Address of the TEE machine registry.
    constructor(ITeeExtensionRegistry _teeExtensionRegistry, ITeeMachineRegistry _teeMachineRegistry) {
        require(address(_teeExtensionRegistry) != address(0), "TeeExtensionRegistry cannot be zero address");
        require(address(_teeMachineRegistry) != address(0), "TeeMachineRegistry cannot be zero address");
        require(address(_teeExtensionRegistry).code.length > 0, "TeeExtensionRegistry has no code");
        require(address(_teeMachineRegistry).code.length > 0, "TeeMachineRegistry has no code");
        TEE_EXTENSION_REGISTRY = _teeExtensionRegistry;
        TEE_MACHINE_REGISTRY = _teeMachineRegistry;
        owner = msg.sender;
    }

    /// @notice Finds and sets this contract's extension id. Can only be set once.
    /// DO NOT MODIFY this function.
    function setExtensionId() external {
        require(_extensionId == 0, "Extension ID already set.");

        uint256 c = TEE_EXTENSION_REGISTRY.nextPublicExtensionId();
        for (uint256 i = FIRST_PUBLIC_EXTENSION_ID; i < c; ++i) {
            if (TEE_EXTENSION_REGISTRY.getTeeExtensionInstructionsSender(i) == address(this)) {
                _extensionId = i;
                return;
            }
        }
        revert("Extension ID not found.");
    }

    /// @notice Register the active TEE signing address (read off TeeMachineRegistry).
    function setTeeAddress(address _teeAddress) external onlyOwner {
        require(_teeAddress != address(0), "zero TEE address");
        teeAddress = _teeAddress;
        emit TeeAddressSet(_teeAddress);
    }

    // --- Listing lifecycle ---

    /// @notice Create a sealed-bid listing with a bidding deadline.
    function createListing(uint64 _deadline) external returns (uint256 listingId) {
        require(_deadline > block.timestamp, "deadline must be future");

        listingId = ++listingCount;
        listings[listingId] = Listing({
            creator: msg.sender,
            deadline: _deadline,
            revealed: false,
            winner: address(0),
            winningAmount: 0
        });

        emit ListingCreated(listingId, msg.sender, _deadline);
    }

    /// @notice Submit a sealed bid: an on-chain commitment plus an ECIES
    /// ciphertext only the TEE can decrypt. Pure on-chain bookkeeping — no TEE
    /// round-trip needed since committing an already-computed hash requires no
    /// confidential compute; the TEE only gets involved at reveal time.
    function submitSealedBid(uint256 _listingId, bytes32 _termsCommitment, bytes calldata _encryptedTerms) external {
        Listing storage listing = listings[_listingId];
        require(listing.deadline != 0, "unknown listing");
        require(block.timestamp < listing.deadline, "bidding closed");
        require(!sealedBids[_listingId][msg.sender].submitted, "already sealed");

        sealedBids[_listingId][msg.sender] =
            SealedBid({ termsCommitment: _termsCommitment, encryptedTerms: _encryptedTerms, submitted: true });
        bidders[_listingId].push(msg.sender);

        emit BidSealed(_listingId, msg.sender, _termsCommitment);
    }

    /// @notice Route every sealed bid for this listing to the TEE for
    /// decryption and winner determination in one instruction.
    /// @dev Payable — forwards the FCC instruction fee to the registry.
    function requestReveal(uint256 _listingId) external payable returns (bytes32 instructionId) {
        Listing storage listing = listings[_listingId];
        require(listing.deadline != 0, "unknown listing");
        require(block.timestamp >= listing.deadline, "deadline not reached");
        require(!listing.revealed, "already revealed");

        address[] memory bidderList = bidders[_listingId];
        bytes32[] memory commitments = new bytes32[](bidderList.length);
        bytes[] memory ciphertexts = new bytes[](bidderList.length);
        for (uint256 i = 0; i < bidderList.length; i++) {
            SealedBid storage sb = sealedBids[_listingId][bidderList[i]];
            commitments[i] = sb.termsCommitment;
            ciphertexts[i] = sb.encryptedTerms;
        }

        bytes memory message = abi.encode(
            RevealMessage({
                listingId: _listingId,
                contractAddr: address(this),
                bidders: bidderList,
                termsCommitments: commitments,
                encryptedTerms: ciphertexts
            })
        );

        address[] memory teeIds = TEE_MACHINE_REGISTRY.getRandomTeeIds(_getExtensionId(), 1);
        address[] memory cosigners = new address[](0);

        ITeeExtensionRegistry.TeeInstructionParams memory params = ITeeExtensionRegistry.TeeInstructionParams({
            opType: OP_TYPE_BID,
            opCommand: OP_COMMAND_REVEAL,
            message: message,
            cosigners: cosigners,
            cosignersThreshold: 0,
            claimBackAddress: msg.sender
        });

        instructionId = TEE_EXTENSION_REGISTRY.sendInstructions{value: msg.value}(teeIds, params);
        emit RevealRequested(_listingId, instructionId);
    }

    /// @notice Finalize a listing with a TEE-signed reveal result.
    /// @dev The TEE node signs `keccak256(abi.encode(TEE_ACTION_RESULT_PREFIX, chainId,
    ///      ActionResult.Hash()))` with its registered key using the EIP-191 personal-sign
    ///      prefix. We reconstruct that hash from the result fields the proxy returned and
    ///      recover the signer, requiring it to equal `teeAddress`. `_resultData` is the
    ///      exact bytes the TEE returned in ActionResult.Data:
    ///      abi.encode(uint256 listingId, address contractAddr, address winner, uint256 winningAmount).
    function submitRevealResult(
        bytes calldata _resultData,
        bytes32 _actionId,
        string calldata _submissionTag,
        uint8 _status,
        bytes calldata _signature
    ) external {
        require(teeAddress != address(0), "TEE address not set");
        require(_status == 1, "TEE reported failure");

        // Reconstruct ActionResult.Hash() = keccak256(keccak256(data) || id || keccak256(tag) || status).
        bytes32 resultHash = keccak256(
            abi.encodePacked(keccak256(_resultData), _actionId, keccak256(bytes(_submissionTag)), _status)
        );

        // The TEE node signs a domain-separated payload over resultHash, not resultHash
        // directly — see TEE_ACTION_RESULT_PREFIX above.
        bytes32 payloadHash = keccak256(abi.encode(TEE_ACTION_RESULT_PREFIX, block.chainid, resultHash));

        address signer = _recover(_ethSigned(payloadHash), _signature);
        require(signer == teeAddress, "bad TEE signature");

        (uint256 listingId, address contractAddr, address winner, uint256 winningAmount) =
            abi.decode(_resultData, (uint256, address, address, uint256));
        require(contractAddr == address(this), "reveal not for this contract");

        Listing storage listing = listings[listingId];
        require(listing.deadline != 0, "unknown listing");
        require(!listing.revealed, "already revealed");
        require(block.timestamp >= listing.deadline, "deadline not reached");

        listing.revealed = true;
        listing.winner = winner;
        listing.winningAmount = winningAmount;

        emit BidRevealed(listingId, winner, winningAmount);
    }

    // --- Views ---

    function getBidders(uint256 _listingId) external view returns (address[] memory) {
        return bidders[_listingId];
    }

    // --- Internal ---

    /// @notice Returns the cached extension ID, reverting if not set.
    function _getExtensionId() internal view returns (uint256) {
        require(_extensionId != 0, "Extension ID is not set.");
        return _extensionId;
    }

    /// @notice EIP-191 personal-sign hash of a 32-byte digest.
    function _ethSigned(bytes32 _hash) private pure returns (bytes32) {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", _hash));
    }

    /// @notice Recover the signer of a 65-byte [r||s||v] secp256k1 signature.
    function _recover(bytes32 _digest, bytes calldata _sig) private pure returns (address) {
        require(_sig.length == 65, "bad signature length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(_sig.offset)
            s := calldataload(add(_sig.offset, 32))
            v := byte(0, calldataload(add(_sig.offset, 64)))
        }
        if (v < 27) {
            v += 27;
        }
        require(v == 27 || v == 28, "bad signature v");
        address signer = ecrecover(_digest, v, r, s);
        require(signer != address(0), "invalid signature");
        return signer;
    }
}
