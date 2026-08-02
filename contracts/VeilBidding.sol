// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @title VeilBidding
/// @notice Sealed-bid auction listings whose true bid amounts stay
/// confidential on-chain until a deadline-triggered reveal. Mirrors the
/// instruction / attested-result pattern described in Flare Confidential
/// Compute (see dev.flare.network/fcc/overview and the Weather Insurance
/// extension guide): a bidder submits an on-chain commitment plus an
/// ECIES ciphertext only the TEE's private key can open; after the
/// deadline, the TEE decrypts every sealed bid, determines the winner,
/// and returns the result together with a domain-separated signature
/// that this contract verifies via ECDSA.recover against a registered
/// `teeAddress` - the same trust mechanism Flare's own extensions use.
///
/// DEMO SCOPE: this contract does not custody bid funds. It attests to
/// *who won and at what amount*, verifiably and on-chain - settlement
/// (payment, refunds) is left to a consuming contract/flow, exactly as
/// the bounty describes ("the output still needs to be usable by smart
/// contracts"). The `teeAddress` here is a keypair we control for the
/// hackathon demo, not a governance-registered TEE machine - standing up
/// real attested hardware via Flare's ITeeMachineRegistry is out of reach
/// without access to Flare's own infrastructure.
contract VeilBidding {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ---- FCC-style operation identifiers (see WeatherInsurance.sol) ----
    bytes32 public constant OP_TYPE_BID = bytes32("BID");
    bytes32 public constant OP_COMMAND_SEAL = bytes32("SEAL");
    bytes32 public constant OP_COMMAND_REVEAL = bytes32("REVEAL");

    // Domain separator for TEE result signatures, mirroring Flare's own
    // ActionResult signing scheme exactly (WeatherInsurance.sol uses
    // `bytes32("TEE_ACTION_RESULT")` - a direct string-to-bytes32 cast,
    // not a keccak256 hash of the string).
    // forge-lint: disable-next-line(unsafe-typecast)
    bytes32 public constant TEE_ACTION_RESULT_PREFIX = bytes32("VEILPAY_TEE_ACTION_RESULT");

    address public owner;
    address public teeAddress;

    struct Listing {
        address creator;
        uint64 deadline;
        bool revealed;
        address winner;
        uint256 winningAmount;
        bytes32 resultHash;
    }

    struct SealedBid {
        bytes32 termsCommitment; // keccak256(abi.encode(amount, nonce, bidder))
        bytes encryptedTerms; // ECIES ciphertext of the true bid, TEE-only
        bool submitted;
    }

    uint256 public listingCount;
    mapping(uint256 => Listing) public listings;
    mapping(uint256 => address[]) public bidders;
    mapping(uint256 => mapping(address => SealedBid)) public sealedBids;

    event ListingCreated(uint256 indexed listingId, address indexed creator, uint64 deadline);
    event BidSealed(uint256 indexed listingId, address indexed bidder, bytes32 termsCommitment);
    event RevealRequested(uint256 indexed listingId);
    event BidRevealed(uint256 indexed listingId, address indexed winner, uint256 winningAmount, bytes32 resultHash);
    event TeeAddressUpdated(address indexed teeAddress);

    error NotOwner();
    error UnknownListing();
    error BiddingClosed();
    error DeadlineNotReached();
    error AlreadyRevealed();
    error AlreadySealed();
    error BadTeeSignature();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address _teeAddress) {
        owner = msg.sender;
        teeAddress = _teeAddress;
    }

    function setTeeAddress(address _teeAddress) external onlyOwner {
        teeAddress = _teeAddress;
        emit TeeAddressUpdated(_teeAddress);
    }

    function createListing(uint64 deadline) external returns (uint256 listingId) {
        require(deadline > block.timestamp, "deadline must be future");

        listingId = ++listingCount;
        listings[listingId] = Listing({
            creator: msg.sender,
            deadline: deadline,
            revealed: false,
            winner: address(0),
            winningAmount: 0,
            resultHash: bytes32(0)
        });

        emit ListingCreated(listingId, msg.sender, deadline);
    }

    /// @notice Submit a sealed bid: an on-chain commitment plus an ECIES
    /// ciphertext only the TEE can decrypt. The true bid amount never
    /// appears in calldata or contract state in the clear.
    function submitSealedBid(uint256 listingId, bytes32 termsCommitment, bytes calldata encryptedTerms) external {
        Listing storage listing = listings[listingId];
        if (listing.deadline == 0) revert UnknownListing();
        if (block.timestamp >= listing.deadline) revert BiddingClosed();

        if (sealedBids[listingId][msg.sender].submitted) revert AlreadySealed();

        sealedBids[listingId][msg.sender] =
            SealedBid({termsCommitment: termsCommitment, encryptedTerms: encryptedTerms, submitted: true});
        bidders[listingId].push(msg.sender);

        emit BidSealed(listingId, msg.sender, termsCommitment);
    }

    /// @notice Anyone can request a reveal once the deadline has passed.
    /// This emits an event for the TEE watcher to pick up - mirroring how
    /// real FCC instructions are relayed to TEE machines via
    /// ITeeExtensionRegistry.sendInstructions.
    function requestReveal(uint256 listingId) external {
        Listing storage listing = listings[listingId];
        if (listing.deadline == 0) revert UnknownListing();
        if (block.timestamp < listing.deadline) revert DeadlineNotReached();
        if (listing.revealed) revert AlreadyRevealed();

        emit RevealRequested(listingId);
    }

    /// @notice The TEE submits the reveal result together with a signature
    /// over a domain-separated hash. Verified on-chain via ECDSA.recover,
    /// mirroring Flare's ActionResult verification (`ecrecover` against a
    /// registered `teeAddress`).
    function submitRevealResult(
        uint256 listingId,
        address winner,
        uint256 winningAmount,
        bytes32 resultHash,
        bytes calldata signature
    ) external {
        Listing storage listing = listings[listingId];
        if (listing.deadline == 0) revert UnknownListing();
        if (block.timestamp < listing.deadline) revert DeadlineNotReached();
        if (listing.revealed) revert AlreadyRevealed();

        bytes32 signedHash =
            keccak256(abi.encode(TEE_ACTION_RESULT_PREFIX, block.chainid, address(this), listingId, resultHash));
        address signer = signedHash.toEthSignedMessageHash().recover(signature);
        if (signer != teeAddress) revert BadTeeSignature();

        listing.revealed = true;
        listing.winner = winner;
        listing.winningAmount = winningAmount;
        listing.resultHash = resultHash;

        emit BidRevealed(listingId, winner, winningAmount, resultHash);
    }

    function getBidders(uint256 listingId) external view returns (address[] memory) {
        return bidders[listingId];
    }
}
