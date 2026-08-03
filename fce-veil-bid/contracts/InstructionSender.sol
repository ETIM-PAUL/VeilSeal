// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

// TODO: Replace local interfaces with imports from flare-smart-contracts-v2 once published as a package.
import { ITeeExtensionRegistry } from "./interfaces/ITeeExtensionRegistry.sol";
import { ITeeMachineRegistry } from "./interfaces/ITeeMachineRegistry.sol";

/// @title VeilBidding
/// @author VeilPay
/// @notice Sealed-bid auctions settled by a Flare Confidential Compute (FCC)
/// TEE extension. A bidder commits an on-chain hash of their true bid plus an
/// ECIES ciphertext only the TEE can decrypt - the amount never appears in
/// the clear on-chain. After a listing's deadline, anyone calls
/// `requestReveal`, which routes every sealed bid for that listing to the
/// TEE in one instruction; the TEE decrypts each ciphertext, determines the
/// winner, and signs the result. `submitRevealResult` verifies that
/// signature on-chain (ecrecover against the registered TEE address) before
/// recording the winner - losing bid amounts are never revealed on-chain,
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

    /// @notice Command to privately score a wallet's bid eligibility for a listing.
    // forge-lint: disable-next-line(unsafe-typecast)
    bytes32 public constant OP_COMMAND_SCORE = bytes32("SCORE");

    /// @notice Command for a wallet to privately learn its own signal score -
    /// informational only, no listing/threshold involved, no relay needed.
    // forge-lint: disable-next-line(unsafe-typecast)
    bytes32 public constant OP_COMMAND_MY_SCORE = bytes32("MY_SCORE");

    /// @notice Command to reveal every sealed bid for a stealth listing -
    /// identical job to OP_COMMAND_REVEAL, kept as its own command because the
    /// message/result payloads key off bytes32 hashedId instead of uint256
    /// listingId and must not be ABI-confused with the regular reveal shape.
    // forge-lint: disable-next-line(unsafe-typecast)
    bytes32 public constant OP_COMMAND_STEALTH_REVEAL = bytes32("STEALTH_REVEAL");

    /// @notice Operation type for Cipher Listing actions - a skill-based
    /// challenge, not a bid, so it gets its own OPType rather than being
    /// folded into OP_TYPE_BID.
    // forge-lint: disable-next-line(unsafe-typecast)
    bytes32 public constant OP_TYPE_CIPHER = bytes32("CIPHER");

    /// @notice Command to reveal a Cipher listing: the TEE generates a fresh
    /// reordering of the word list, decrypts every sealed guess, and picks
    /// the closest match.
    // forge-lint: disable-next-line(unsafe-typecast)
    bytes32 public constant OP_COMMAND_CIPHER_REVEAL = bytes32("CIPHER_REVEAL");

    /// @notice Score bounds the TEE's formula operates within (internal/extension/chain.go).
    uint256 public constant MIN_SCORE_THRESHOLD = 5;
    uint256 public constant MAX_SCORE = 100;

    /// @notice Flat fee (native token) charged to cancel a still-open sealed
    /// bid before the listing's deadline. Accumulates in this contract and is
    /// only withdrawable by owner - discourages frivolous cancel/resubmit
    /// cycling without blocking a genuine change of mind.
    uint256 public constant CANCEL_FEE = 0.1 ether;

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

    /// @notice A sealed-bid auction listing. Item metadata (title, description,
    /// type, IPFS link, minimum bid) is stored on-chain so any client can
    /// render a listing from chain state alone - no off-chain index required.
    struct Listing {
        address creator;
        uint64 deadline;      // bidding closes, reveal opens
        bool revealed;
        address winner;
        uint256 winningAmount; // only the winning amount is ever revealed on-chain
        string title;
        string description;
        string itemType;      // "image" | "video" | "audio" | "file"
        string ipfsHash;      // Pinata/IPFS CID of the uploaded item
        uint256 minBid;
        uint256 minScore;     // only meaningful when !inviteOnly - TEE-verified score gate
        bool inviteOnly;      // true = only isParticipant addresses may bid, score is never checked
    }

    /// @notice A TEE-signed attestation that a wallet cleared a listing's
    /// minScore AND that its sealed bid clears minBid, without ever revealing
    /// the wallet's actual score or bid amount. Produced by requestScoreCheck()
    /// + the TEE's SCORE handler, verified inline by submitSealedBid - no
    /// separate on-chain relay transaction needed. Bound to a specific
    /// termsCommitment so it can't be replayed against a different bid amount.
    struct EligibilityAttestation {
        bytes data;             // abi.encode(listingId, bidder, termsCommitment, eligible)
        bytes32 actionId;
        string submissionTag;
        uint8 status;
        bytes signature;
    }

    /// @notice ABI payload of a SCORE instruction (decoded by the TEE). Carries
    /// the bid's ciphertext so the TEE can check the wallet's score AND the
    /// bid amount against minBid in a single round-trip - the TEE reads
    /// minScore/minBid itself from chain state, only the bidder-supplied
    /// ciphertext needs to travel in the message.
    struct ScoreCheckMessage {
        uint256 listingId;
        address bidder;
        address contractAddr;
        bytes32 termsCommitment;
        bytes encryptedTerms;
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
        address contractAddr;      // this contract - echoed back so the result binds to it
        address[] bidders;
        bytes32[] termsCommitments;
        bytes[] encryptedTerms;
    }

    /// @notice A stealth-mode sealed-bid listing: identical lifecycle to
    /// Listing, but title/description/itemType/ipfsHash/minBid live only
    /// inside encryptedDetails (ECIES ciphertext under the TEE's key) rather
    /// than as plaintext fields - nothing about what's being auctioned is
    /// ever readable on-chain. Always invite-gated (no open or score-gated
    /// mode) since there's no public listing to browse into in the first
    /// place - you have to already hold the hashedId. Keyed by a hash instead
    /// of a sequential id so listings aren't trivially enumerable from a
    /// public counter.
    struct StealthListing {
        address creator;
        uint64 deadline;       // bidding closes, reveal opens - the one field kept public, so it's trustlessly checkable on-chain
        bool revealed;
        address winner;
        uint256 winningAmount; // only the winning amount is ever revealed on-chain
        bytes encryptedDetails; // ECIES ciphertext: title/description/itemType/ipfsHash/minBid/nonce
    }

    /// @notice ABI payload of a STEALTH_REVEAL instruction (decoded by the TEE).
    struct StealthRevealMessage {
        bytes32 hashedId;
        address contractAddr;      // this contract - echoed back so the result binds to it
        address[] bidders;
        bytes32[] termsCommitments;
        bytes[] encryptedTerms;
    }

    /// @notice A Cipher Listing: a skill-based challenge rather than a bid.
    /// The creator's word list is public (see cipherWords) - only
    /// participation is invite-gated. Array-typed fields (words, the two
    /// revealed arrangements) live in separate top-level mappings rather than
    /// on this struct, since Solidity's auto-generated public getter for a
    /// mapping silently omits any array-typed struct member.
    struct CipherListing {
        address creator;
        uint64 deadline;
        bool revealed;
        address winner;
        uint8 wordCount; // 12 or 24, validated at creation
    }

    /// @notice A participant's sealed guess: an on-chain commitment plus an
    /// ECIES ciphertext only the TEE can decrypt. Same shape as SealedBid.
    struct SealedGuess {
        bytes32 guessCommitment; // keccak256(abi.encode(uint8[] arrangement, bytes32 nonce, address guesser))
        bytes encryptedGuess;    // ECIES ciphertext, TEE-only
        bool submitted;
    }

    /// @notice ABI payload of a CIPHER_REVEAL instruction (decoded by the
    /// TEE). Deliberately does not carry the word strings - the TEE only
    /// needs wordCount to generate its reordering of index positions; the
    /// words themselves are already public (see cipherWords), the frontend
    /// maps words[arrangement[i]] client-side.
    struct CipherRevealMessage {
        uint256 listingId;
        address contractAddr;      // this contract - echoed back so the result binds to it
        uint8 wordCount;
        address[] guessers;
        bytes32[] guessCommitments;
        bytes[] encryptedGuesses;
    }

    address public owner;
    address public teeAddress;

    uint256 public listingCount;
    mapping(uint256 => Listing) public listings;
    mapping(uint256 => address[]) public bidders;
    mapping(uint256 => mapping(address => SealedBid)) public sealedBids;

    /// @notice Addresses the listing creator has explicitly invited - bypasses
    /// the minScore gate entirely for that listing.
    mapping(uint256 => mapping(address => bool)) public isParticipant;

    /// @notice Lifetime count of sealed bids a wallet has placed across every
    /// listing - one of the signals the TEE factors into a wallet's score.
    mapping(address => uint256) public totalBidsPlaced;

    // --- Stealth listing state ---

    mapping(bytes32 => StealthListing) public stealthListings;
    mapping(bytes32 => address[]) public stealthBidders;
    mapping(bytes32 => mapping(address => SealedBid)) public stealthSealedBids;

    /// @notice Addresses the stealth listing creator has invited - the sole
    /// admission control for stealth listings (bidding AND detail viewing),
    /// since there is no score-gated mode for stealth listings.
    mapping(bytes32 => mapping(address => bool)) public isStealthParticipant;

    /// @notice Per-creator counter mixed into the hashedId derivation so two
    /// stealth listings from the same creator never collide, without relying
    /// on a shared/global counter that would make the id front-runnable.
    mapping(address => uint256) public creatorStealthNonce;

    // --- Cipher listing state ---

    uint256 public cipherListingCount;
    mapping(uint256 => CipherListing) public cipherListings;
    mapping(uint256 => string[]) public cipherWords;
    mapping(uint256 => address[]) public cipherGuessers;
    mapping(uint256 => mapping(address => SealedGuess)) public cipherSealedGuesses;

    /// @notice Addresses the Cipher listing creator has invited - the sole
    /// admission control, since there is no score-gated mode for Cipher
    /// listings (only the participant list, exactly like stealth listings).
    mapping(uint256 => mapping(address => bool)) public isCipherParticipant;

    /// @notice Set once at reveal: the winner's own submitted guess and the
    /// TEE's true reordering, both public from that point on. Everyone
    /// else's guess stays sealed forever.
    mapping(uint256 => uint8[]) public cipherWinnerArrangement;
    mapping(uint256 => uint8[]) public cipherTrueArrangement;

    event ListingCreated(
        uint256 indexed listingId,
        address indexed creator,
        uint64 deadline,
        string title,
        string description,
        string itemType,
        string ipfsHash,
        uint256 minBid,
        uint256 minScore,
        bool inviteOnly
    );
    event ParticipantsAdded(uint256 indexed listingId, address[] participants);
    event BidSealed(uint256 indexed listingId, address indexed bidder, bytes32 termsCommitment);
    event BidCancelled(uint256 indexed listingId, address indexed bidder, uint256 fee);
    event ScoreCheckRequested(uint256 indexed listingId, address indexed bidder, bytes32 instructionId);
    event MyScoreRequested(address indexed wallet, bytes32 instructionId);
    event RevealRequested(uint256 indexed listingId, bytes32 instructionId);
    event BidRevealed(uint256 indexed listingId, address indexed winner, uint256 winningAmount);
    event TeeAddressSet(address indexed teeAddress);

    event StealthListingCreated(bytes32 indexed hashedId, address indexed creator, uint64 deadline);
    event StealthParticipantsAdded(bytes32 indexed hashedId, address[] participants);
    event StealthBidSealed(bytes32 indexed hashedId, address indexed bidder, bytes32 termsCommitment);
    event StealthRevealRequested(bytes32 indexed hashedId, bytes32 instructionId);
    event StealthBidRevealed(bytes32 indexed hashedId, address indexed winner, uint256 winningAmount);

    event CipherListingCreated(
        uint256 indexed listingId, address indexed creator, uint64 deadline, uint8 wordCount, string[] words
    );
    event CipherParticipantsAdded(uint256 indexed listingId, address[] participants);
    event CipherGuessSealed(uint256 indexed listingId, address indexed guesser, bytes32 guessCommitment);
    event CipherRevealRequested(uint256 indexed listingId, bytes32 instructionId);
    event CipherListingRevealed(
        uint256 indexed listingId, address indexed winner, uint8[] winnerArrangement, uint8[] trueArrangement
    );

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

    /// @notice Create a sealed-bid listing with its item metadata and an access
    /// mode: either score-gated (_minScore must be MIN_SCORE_THRESHOLD..MAX_SCORE,
    /// TEE-verified per bidder) or invite-only (_inviteOnly=true, _minScore is
    /// ignored entirely, bidding requires at least one initial participant).
    function createListing(
        string calldata _title,
        string calldata _description,
        string calldata _itemType,
        string calldata _ipfsHash,
        uint256 _minBid,
        uint256 _minScore,
        bool _inviteOnly,
        uint64 _deadline,
        address[] calldata _initialParticipants
    ) external returns (uint256 listingId) {
        require(_deadline > block.timestamp, "deadline must be future");
        require(bytes(_title).length > 0, "title required");

        if (_inviteOnly) {
            require(_initialParticipants.length > 0, "invite-only listings need at least one participant");
        } else {
            require(_minScore >= MIN_SCORE_THRESHOLD && _minScore <= MAX_SCORE, "minScore out of range");
        }

        listingId = ++listingCount;
        uint256 storedMinScore = _inviteOnly ? 0 : _minScore;
        listings[listingId] = Listing({
            creator: msg.sender,
            deadline: _deadline,
            revealed: false,
            winner: address(0),
            winningAmount: 0,
            title: _title,
            description: _description,
            itemType: _itemType,
            ipfsHash: _ipfsHash,
            minBid: _minBid,
            minScore: storedMinScore,
            inviteOnly: _inviteOnly
        });

        emit ListingCreated(
            listingId, msg.sender, _deadline, _title, _description, _itemType, _ipfsHash, _minBid, storedMinScore, _inviteOnly
        );

        if (_initialParticipants.length > 0) {
            _addParticipants(listingId, _initialParticipants);
        }
    }

    /// @notice Invite additional addresses. For invite-only listings this is
    /// the entire access control; for score-gated listings it's an override
    /// that bypasses the score check. Callable by the creator only, and only
    /// while bidding is still open.
    function addParticipants(uint256 _listingId, address[] calldata _participants) external {
        Listing storage listing = listings[_listingId];
        require(listing.deadline != 0, "unknown listing");
        require(msg.sender == listing.creator, "not listing creator");
        require(block.timestamp < listing.deadline, "bidding closed");

        _addParticipants(_listingId, _participants);
    }

    function _addParticipants(uint256 _listingId, address[] calldata _participants) internal {
        for (uint256 i = 0; i < _participants.length; i++) {
            isParticipant[_listingId][_participants[i]] = true;
        }
        emit ParticipantsAdded(_listingId, _participants);
    }

    /// @notice Submit a sealed bid: an on-chain commitment plus an ECIES
    /// ciphertext only the TEE can decrypt. Pure on-chain bookkeeping - no TEE
    /// round-trip needed at submission time for the bid itself; the TEE only
    /// decrypts at reveal time. Invite-only listings check nothing but the
    /// participant list - score is never considered. Score-gated listings
    /// check the participant list first (bypass), then require _attestation
    /// to carry a valid TEE-signed eligibility result (see requestScoreCheck)
    /// - pass a zeroed/empty EligibilityAttestation when it isn't needed.
    function submitSealedBid(
        uint256 _listingId,
        bytes32 _termsCommitment,
        bytes calldata _encryptedTerms,
        EligibilityAttestation calldata _attestation
    ) external {
        Listing storage listing = listings[_listingId];
        require(listing.deadline != 0, "unknown listing");
        require(block.timestamp < listing.deadline, "bidding closed");
        require(!sealedBids[_listingId][msg.sender].submitted, "already sealed");

        if (listing.inviteOnly) {
            require(isParticipant[_listingId][msg.sender], "invite only: not on participant list");
        } else if (listing.minScore > 0 && !isParticipant[_listingId][msg.sender]) {
            _verifyEligibility(_listingId, _termsCommitment, _attestation);
        }

        sealedBids[_listingId][msg.sender] =
            SealedBid({ termsCommitment: _termsCommitment, encryptedTerms: _encryptedTerms, submitted: true });
        bidders[_listingId].push(msg.sender);
        totalBidsPlaced[msg.sender] += 1;

        emit BidSealed(_listingId, msg.sender, _termsCommitment);
    }

    /// @notice Cancel a still-open sealed bid before the listing's deadline,
    /// for a flat CANCEL_FEE. Works identically whether the bid was placed
    /// directly or by an auto-bidding agent signing as this same wallet -
    /// bids are always recorded under the real bidder's address either way.
    function cancelSealedBid(uint256 _listingId) external payable {
        Listing storage listing = listings[_listingId];
        require(listing.deadline != 0, "unknown listing");
        require(block.timestamp < listing.deadline, "bidding closed");
        require(!listing.revealed, "already revealed");
        require(msg.value == CANCEL_FEE, "incorrect cancel fee");
        require(sealedBids[_listingId][msg.sender].submitted, "no active bid to cancel");

        delete sealedBids[_listingId][msg.sender];
        _removeBidder(_listingId, msg.sender);

        emit BidCancelled(_listingId, msg.sender, msg.value);
    }

    /// @notice Sweep accumulated cancellation fees. Owner-only.
    function withdrawFees(address payable _to) external onlyOwner {
        require(_to != address(0), "zero address");
        (bool ok,) = _to.call{ value: address(this).balance }("");
        require(ok, "transfer failed");
    }

    /// @notice Request a private TEE-computed eligibility check for this
    /// listing, covering both the wallet's signal score AND the sealed bid's
    /// amount against minBid in one round-trip. The TEE independently reads
    /// the caller's wallet signals and this listing's minScore/minBid from
    /// chain, decrypts _encryptedTerms to check the amount, and signs back
    /// only a boolean bound to _termsCommitment - neither the wallet's actual
    /// score nor the bid amount is ever revealed on-chain. If either check
    /// fails the TEE reports failure with a message identifying which one.
    /// @dev Payable - forwards the FCC instruction fee to the registry.
    function requestScoreCheck(uint256 _listingId, bytes32 _termsCommitment, bytes calldata _encryptedTerms)
        external
        payable
        returns (bytes32 instructionId)
    {
        Listing storage listing = listings[_listingId];
        require(listing.deadline != 0, "unknown listing");
        require(block.timestamp < listing.deadline, "bidding closed");

        bytes memory message = abi.encode(
            ScoreCheckMessage({
                listingId: _listingId,
                bidder: msg.sender,
                contractAddr: address(this),
                termsCommitment: _termsCommitment,
                encryptedTerms: _encryptedTerms
            })
        );

        address[] memory teeIds = TEE_MACHINE_REGISTRY.getRandomTeeIds(_getExtensionId(), 1);
        address[] memory cosigners = new address[](0);

        ITeeExtensionRegistry.TeeInstructionParams memory params = ITeeExtensionRegistry.TeeInstructionParams({
            opType: OP_TYPE_BID,
            opCommand: OP_COMMAND_SCORE,
            message: message,
            cosigners: cosigners,
            cosignersThreshold: 0,
            claimBackAddress: msg.sender
        });

        instructionId = TEE_EXTENSION_REGISTRY.sendInstructions{value: msg.value}(teeIds, params);
        emit ScoreCheckRequested(_listingId, msg.sender, instructionId);
    }

    /// @notice Request a private, informational read of the caller's own
    /// signal score - no listing, no threshold, nothing ever posted back
    /// on-chain. The frontend polls the proxy directly for the TEE's
    /// response and displays it only to the requesting wallet.
    /// @dev Payable - forwards the FCC instruction fee to the registry.
    function requestMyScore() external payable returns (bytes32 instructionId) {
        bytes memory message = abi.encode(msg.sender);

        address[] memory teeIds = TEE_MACHINE_REGISTRY.getRandomTeeIds(_getExtensionId(), 1);
        address[] memory cosigners = new address[](0);

        ITeeExtensionRegistry.TeeInstructionParams memory params = ITeeExtensionRegistry.TeeInstructionParams({
            opType: OP_TYPE_BID,
            opCommand: OP_COMMAND_MY_SCORE,
            message: message,
            cosigners: cosigners,
            cosignersThreshold: 0,
            claimBackAddress: msg.sender
        });

        instructionId = TEE_EXTENSION_REGISTRY.sendInstructions{value: msg.value}(teeIds, params);
        emit MyScoreRequested(msg.sender, instructionId);
    }

    /// @notice Route every sealed bid for this listing to the TEE for
    /// decryption and winner determination in one instruction.
    /// @dev Payable - forwards the FCC instruction fee to the registry.
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
        // directly - see TEE_ACTION_RESULT_PREFIX above.
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

    // --- Stealth listing lifecycle ---

    /// @notice Create a stealth listing: every human-readable field is
    /// pre-encrypted client-side (ECIES, under the TEE's key) into
    /// _encryptedDetails before it ever reaches this call - the contract
    /// never sees plaintext title/description/minBid. Always invite-gated;
    /// at least one initial participant is required since there's no other
    /// way to reach this listing at all without already being invited.
    /// Returns hashedId via the StealthListingCreated event (mined-tx return
    /// values aren't otherwise retrievable), the identifier the creator
    /// shares out-of-band with invited bidders.
    function createStealthListing(
        bytes calldata _encryptedDetails,
        uint64 _deadline,
        address[] calldata _initialParticipants
    ) external returns (bytes32 hashedId) {
        require(_deadline > block.timestamp, "deadline must be future");
        require(_initialParticipants.length > 0, "stealth listings need at least one participant");

        uint256 nonce = ++creatorStealthNonce[msg.sender];
        hashedId =
            keccak256(abi.encode(address(this), block.chainid, msg.sender, keccak256(_encryptedDetails), nonce));
        require(stealthListings[hashedId].deadline == 0, "hash collision, retry");

        stealthListings[hashedId] = StealthListing({
            creator: msg.sender,
            deadline: _deadline,
            revealed: false,
            winner: address(0),
            winningAmount: 0,
            encryptedDetails: _encryptedDetails
        });

        emit StealthListingCreated(hashedId, msg.sender, _deadline);

        _addStealthParticipants(hashedId, _initialParticipants);
    }

    /// @notice Invite additional addresses to a stealth listing - the entire
    /// access control, for both bidding and viewing its decrypted details.
    /// Creator-only, and only while bidding is still open.
    function addStealthParticipants(bytes32 _hashedId, address[] calldata _participants) external {
        StealthListing storage listing = stealthListings[_hashedId];
        require(listing.deadline != 0, "unknown listing");
        require(msg.sender == listing.creator, "not listing creator");
        require(block.timestamp < listing.deadline, "bidding closed");

        _addStealthParticipants(_hashedId, _participants);
    }

    function _addStealthParticipants(bytes32 _hashedId, address[] calldata _participants) internal {
        for (uint256 i = 0; i < _participants.length; i++) {
            isStealthParticipant[_hashedId][_participants[i]] = true;
        }
        emit StealthParticipantsAdded(_hashedId, _participants);
    }

    /// @notice Submit a sealed bid on a stealth listing. Same commitment +
    /// ciphertext shape as submitSealedBid - only participants may bid, no
    /// score path exists for stealth listings.
    function submitStealthSealedBid(bytes32 _hashedId, bytes32 _termsCommitment, bytes calldata _encryptedTerms)
        external
    {
        StealthListing storage listing = stealthListings[_hashedId];
        require(listing.deadline != 0, "unknown listing");
        require(block.timestamp < listing.deadline, "bidding closed");
        require(isStealthParticipant[_hashedId][msg.sender], "not a participant of this stealth listing");
        require(!stealthSealedBids[_hashedId][msg.sender].submitted, "already sealed");

        stealthSealedBids[_hashedId][msg.sender] =
            SealedBid({ termsCommitment: _termsCommitment, encryptedTerms: _encryptedTerms, submitted: true });
        stealthBidders[_hashedId].push(msg.sender);
        totalBidsPlaced[msg.sender] += 1;

        emit StealthBidSealed(_hashedId, msg.sender, _termsCommitment);
    }

    /// @notice Route every sealed bid for this stealth listing to the TEE for
    /// decryption and winner determination in one instruction. Mirrors
    /// requestReveal exactly, keyed by hashedId instead of listingId.
    /// @dev Payable - forwards the FCC instruction fee to the registry.
    function requestStealthReveal(bytes32 _hashedId) external payable returns (bytes32 instructionId) {
        StealthListing storage listing = stealthListings[_hashedId];
        require(listing.deadline != 0, "unknown listing");
        require(block.timestamp >= listing.deadline, "deadline not reached");
        require(!listing.revealed, "already revealed");

        address[] memory bidderList = stealthBidders[_hashedId];
        bytes32[] memory commitments = new bytes32[](bidderList.length);
        bytes[] memory ciphertexts = new bytes[](bidderList.length);
        for (uint256 i = 0; i < bidderList.length; i++) {
            SealedBid storage sb = stealthSealedBids[_hashedId][bidderList[i]];
            commitments[i] = sb.termsCommitment;
            ciphertexts[i] = sb.encryptedTerms;
        }

        bytes memory message = abi.encode(
            StealthRevealMessage({
                hashedId: _hashedId,
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
            opCommand: OP_COMMAND_STEALTH_REVEAL,
            message: message,
            cosigners: cosigners,
            cosignersThreshold: 0,
            claimBackAddress: msg.sender
        });

        instructionId = TEE_EXTENSION_REGISTRY.sendInstructions{value: msg.value}(teeIds, params);
        emit StealthRevealRequested(_hashedId, instructionId);
    }

    /// @notice Finalize a stealth listing with a TEE-signed reveal result.
    /// Mirrors submitRevealResult exactly, keyed by hashedId instead of
    /// listingId - the winner's address and winning amount become public,
    /// same as a regular listing; encryptedDetails is untouched and stays
    /// encrypted forever, there is no "unlock everything" step.
    function submitStealthRevealResult(
        bytes calldata _resultData,
        bytes32 _actionId,
        string calldata _submissionTag,
        uint8 _status,
        bytes calldata _signature
    ) external {
        require(teeAddress != address(0), "TEE address not set");
        require(_status == 1, "TEE reported failure");

        bytes32 resultHash = keccak256(
            abi.encodePacked(keccak256(_resultData), _actionId, keccak256(bytes(_submissionTag)), _status)
        );
        bytes32 payloadHash = keccak256(abi.encode(TEE_ACTION_RESULT_PREFIX, block.chainid, resultHash));

        address signer = _recover(_ethSigned(payloadHash), _signature);
        require(signer == teeAddress, "bad TEE signature");

        (bytes32 hashedId, address contractAddr, address winner, uint256 winningAmount) =
            abi.decode(_resultData, (bytes32, address, address, uint256));
        require(contractAddr == address(this), "reveal not for this contract");

        StealthListing storage listing = stealthListings[hashedId];
        require(listing.deadline != 0, "unknown listing");
        require(!listing.revealed, "already revealed");
        require(block.timestamp >= listing.deadline, "deadline not reached");

        listing.revealed = true;
        listing.winner = winner;
        listing.winningAmount = winningAmount;

        emit StealthBidRevealed(hashedId, winner, winningAmount);
    }

    // --- Cipher listing lifecycle ---

    /// @notice Create a Cipher listing: a skill-based challenge, not a bid.
    /// The word list is public (unlike stealth) but always invite-gated
    /// (unlike standard, no score-gated mode exists here) - at least one
    /// initial participant is required. The TEE is never invoked at creation
    /// - it generates its reordering fresh at reveal time.
    function createCipherListing(
        string[] calldata _words,
        uint64 _deadline,
        address[] calldata _initialParticipants
    ) external returns (uint256 listingId) {
        require(_deadline > block.timestamp, "deadline must be future");
        require(_words.length == 12 || _words.length == 24, "word list must be 12 or 24 words");
        require(_initialParticipants.length > 0, "cipher listings need at least one participant");

        listingId = ++cipherListingCount;
        cipherListings[listingId] = CipherListing({
            creator: msg.sender,
            deadline: _deadline,
            revealed: false,
            winner: address(0),
            wordCount: uint8(_words.length)
        });
        cipherWords[listingId] = _words;

        emit CipherListingCreated(listingId, msg.sender, _deadline, uint8(_words.length), _words);

        _addCipherParticipants(listingId, _initialParticipants);
    }

    /// @notice Invite additional addresses to a Cipher listing - the entire
    /// access control (participation only; the word list itself is already
    /// public). Creator-only, and only while guessing is still open.
    function addCipherParticipants(uint256 _listingId, address[] calldata _participants) external {
        CipherListing storage listing = cipherListings[_listingId];
        require(listing.deadline != 0, "unknown listing");
        require(msg.sender == listing.creator, "not listing creator");
        require(block.timestamp < listing.deadline, "guessing closed");

        _addCipherParticipants(_listingId, _participants);
    }

    function _addCipherParticipants(uint256 _listingId, address[] calldata _participants) internal {
        for (uint256 i = 0; i < _participants.length; i++) {
            isCipherParticipant[_listingId][_participants[i]] = true;
        }
        emit CipherParticipantsAdded(_listingId, _participants);
    }

    /// @notice Submit a sealed guess: an on-chain commitment plus an ECIES
    /// ciphertext only the TEE can decrypt. Pure on-chain bookkeeping - the
    /// TEE only decrypts and scores at reveal time. Only invited participants
    /// may guess, once each.
    function submitCipherGuess(uint256 _listingId, bytes32 _guessCommitment, bytes calldata _encryptedGuess)
        external
    {
        CipherListing storage listing = cipherListings[_listingId];
        require(listing.deadline != 0, "unknown listing");
        require(block.timestamp < listing.deadline, "guessing closed");
        require(isCipherParticipant[_listingId][msg.sender], "not a participant of this cipher listing");
        require(!cipherSealedGuesses[_listingId][msg.sender].submitted, "already sealed");

        cipherSealedGuesses[_listingId][msg.sender] =
            SealedGuess({ guessCommitment: _guessCommitment, encryptedGuess: _encryptedGuess, submitted: true });
        cipherGuessers[_listingId].push(msg.sender);

        emit CipherGuessSealed(_listingId, msg.sender, _guessCommitment);
    }

    /// @notice Route every sealed guess for this Cipher listing to the TEE:
    /// it generates a fresh reordering of the word list, decrypts every
    /// guess, and picks the closest match in one instruction.
    /// @dev Payable - forwards the FCC instruction fee to the registry.
    function requestCipherReveal(uint256 _listingId) external payable returns (bytes32 instructionId) {
        CipherListing storage listing = cipherListings[_listingId];
        require(listing.deadline != 0, "unknown listing");
        require(block.timestamp >= listing.deadline, "deadline not reached");
        require(!listing.revealed, "already revealed");

        address[] memory guesserList = cipherGuessers[_listingId];
        bytes32[] memory commitments = new bytes32[](guesserList.length);
        bytes[] memory ciphertexts = new bytes[](guesserList.length);
        for (uint256 i = 0; i < guesserList.length; i++) {
            SealedGuess storage sg = cipherSealedGuesses[_listingId][guesserList[i]];
            commitments[i] = sg.guessCommitment;
            ciphertexts[i] = sg.encryptedGuess;
        }

        bytes memory message = abi.encode(
            CipherRevealMessage({
                listingId: _listingId,
                contractAddr: address(this),
                wordCount: listing.wordCount,
                guessers: guesserList,
                guessCommitments: commitments,
                encryptedGuesses: ciphertexts
            })
        );

        address[] memory teeIds = TEE_MACHINE_REGISTRY.getRandomTeeIds(_getExtensionId(), 1);
        address[] memory cosigners = new address[](0);

        ITeeExtensionRegistry.TeeInstructionParams memory params = ITeeExtensionRegistry.TeeInstructionParams({
            opType: OP_TYPE_CIPHER,
            opCommand: OP_COMMAND_CIPHER_REVEAL,
            message: message,
            cosigners: cosigners,
            cosignersThreshold: 0,
            claimBackAddress: msg.sender
        });

        instructionId = TEE_EXTENSION_REGISTRY.sendInstructions{value: msg.value}(teeIds, params);
        emit CipherRevealRequested(_listingId, instructionId);
    }

    /// @notice Finalize a Cipher listing with a TEE-signed reveal result.
    /// Mirrors submitRevealResult's signature-verification scheme exactly.
    /// _resultData is abi.encode(uint256 listingId, address contractAddr,
    /// address winner, uint8[] winnerArrangement, uint8[] trueArrangement) -
    /// unlike a bid reveal, no match-count field is carried on-chain; the
    /// frontend diffs the two revealed arrangements itself.
    function submitCipherRevealResult(
        bytes calldata _resultData,
        bytes32 _actionId,
        string calldata _submissionTag,
        uint8 _status,
        bytes calldata _signature
    ) external {
        require(teeAddress != address(0), "TEE address not set");
        require(_status == 1, "TEE reported failure");

        bytes32 resultHash = keccak256(
            abi.encodePacked(keccak256(_resultData), _actionId, keccak256(bytes(_submissionTag)), _status)
        );
        bytes32 payloadHash = keccak256(abi.encode(TEE_ACTION_RESULT_PREFIX, block.chainid, resultHash));

        address signer = _recover(_ethSigned(payloadHash), _signature);
        require(signer == teeAddress, "bad TEE signature");

        (uint256 listingId, address contractAddr, address winner, uint8[] memory winnerArrangement, uint8[] memory trueArrangement)
        = abi.decode(_resultData, (uint256, address, address, uint8[], uint8[]));
        require(contractAddr == address(this), "reveal not for this contract");

        CipherListing storage listing = cipherListings[listingId];
        require(listing.deadline != 0, "unknown listing");
        require(!listing.revealed, "already revealed");
        require(block.timestamp >= listing.deadline, "deadline not reached");

        listing.revealed = true;
        listing.winner = winner;
        cipherWinnerArrangement[listingId] = winnerArrangement;
        cipherTrueArrangement[listingId] = trueArrangement;

        emit CipherListingRevealed(listingId, winner, winnerArrangement, trueArrangement);
    }

    // --- Views ---

    function getBidders(uint256 _listingId) external view returns (address[] memory) {
        return bidders[_listingId];
    }

    function getStealthBidders(bytes32 _hashedId) external view returns (address[] memory) {
        return stealthBidders[_hashedId];
    }

    function getCipherWords(uint256 _listingId) external view returns (string[] memory) {
        return cipherWords[_listingId];
    }

    function getCipherGuessers(uint256 _listingId) external view returns (address[] memory) {
        return cipherGuessers[_listingId];
    }

    function getCipherWinnerArrangement(uint256 _listingId) external view returns (uint8[] memory) {
        return cipherWinnerArrangement[_listingId];
    }

    function getCipherTrueArrangement(uint256 _listingId) external view returns (uint8[] memory) {
        return cipherTrueArrangement[_listingId];
    }

    /// @notice Convenience getter so off-chain callers (the TEE's score
    /// handler) don't need to decode the full Listing tuple just for this field.
    function listingMinScore(uint256 _listingId) external view returns (uint256) {
        return listings[_listingId].minScore;
    }

    /// @notice Convenience getter so off-chain callers (the TEE's combined
    /// score/min-amount handler) don't need to decode the full Listing tuple
    /// just for this field.
    function listingMinBid(uint256 _listingId) external view returns (uint256) {
        return listings[_listingId].minBid;
    }

    // --- Internal ---

    /// @notice Verifies a TEE-signed eligibility attestation for _listingId
    /// and _termsCommitment against msg.sender, using the same ActionResult
    /// hash/signature scheme as submitRevealResult - checked inline so no
    /// separate relay tx is needed. Binding to _termsCommitment stops an
    /// attestation for one bid amount being replayed against a different one.
    function _verifyEligibility(uint256 _listingId, bytes32 _termsCommitment, EligibilityAttestation calldata _a)
        internal
        view
    {
        require(teeAddress != address(0), "TEE address not set");
        require(_a.status == 1, "eligibility check failed");

        bytes32 resultHash = keccak256(
            abi.encodePacked(keccak256(_a.data), _a.actionId, keccak256(bytes(_a.submissionTag)), _a.status)
        );
        bytes32 payloadHash = keccak256(abi.encode(TEE_ACTION_RESULT_PREFIX, block.chainid, resultHash));

        address signer = _recover(_ethSigned(payloadHash), _a.signature);
        require(signer == teeAddress, "bad TEE signature");

        (uint256 listingId, address bidder, bytes32 termsCommitment, bool eligible) =
            abi.decode(_a.data, (uint256, address, bytes32, bool));
        require(listingId == _listingId, "attestation listing mismatch");
        require(bidder == msg.sender, "attestation bidder mismatch");
        require(termsCommitment == _termsCommitment, "attestation commitment mismatch");
        require(eligible, "not eligible");
    }

    /// @notice Removes `_bidder` from bidders[_listingId] via swap-pop (order
    /// doesn't matter - requestReveal just needs every remaining bidder once).
    function _removeBidder(uint256 _listingId, address _bidder) internal {
        address[] storage list = bidders[_listingId];
        uint256 len = list.length;
        for (uint256 i = 0; i < len; i++) {
            if (list[i] == _bidder) {
                list[i] = list[len - 1];
                list.pop();
                break;
            }
        }
    }

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
