// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { Test } from "forge-std/Test.sol";
import { VeilBidding } from "../InstructionSender.sol";
import { ITeeExtensionRegistry } from "../interfaces/ITeeExtensionRegistry.sol";
import { ITeeMachineRegistry } from "../interfaces/ITeeMachineRegistry.sol";

/// @notice Minimal registry stand-ins - VeilBidding's constructor only
/// requires these addresses to hold code; the Cipher Listing tests below
/// don't exercise requestCipherReveal (and therefore never call into these),
/// only creation/participation/reveal-result verification.
contract MockTeeExtensionRegistry is ITeeExtensionRegistry {
    function sendInstructions(address[] calldata, TeeInstructionParams calldata)
        external
        payable
        returns (bytes32)
    {
        return bytes32(0);
    }

    function nextPublicExtensionId() external pure returns (uint256) {
        return 0x10000;
    }

    function getTeeExtensionInstructionsSender(uint256) external pure returns (address) {
        return address(0);
    }
}

contract MockTeeMachineRegistry is ITeeMachineRegistry {
    function getRandomTeeIds(uint256, uint256 _count) external pure returns (address[] memory ids) {
        ids = new address[](_count);
    }
}

contract CipherListingTest is Test {
    VeilBidding bidding;
    address creator = address(0xC12EA70A);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address outsider = address(0x0FF1DE);

    uint256 teePrivateKey = 0xA11CE5EED;
    address teeAddress;

    string[] words12;
    string[] words7;

    function setUp() public {
        bidding = new VeilBidding(new MockTeeExtensionRegistry(), new MockTeeMachineRegistry());

        teeAddress = vm.addr(teePrivateKey);
        bidding.setTeeAddress(teeAddress);

        words12 = new string[](12);
        for (uint256 i = 0; i < 12; i++) {
            words12[i] = string(abi.encodePacked("word", vm.toString(i)));
        }
        words7 = new string[](7);
        for (uint256 i = 0; i < 7; i++) {
            words7[i] = string(abi.encodePacked("word", vm.toString(i)));
        }
    }

    function _participants() internal view returns (address[] memory p) {
        p = new address[](2);
        p[0] = alice;
        p[1] = bob;
    }

    /// @dev Cipher listings carry the same item metadata as a standard
    /// listing (see the item-metadata correction to CipherListing) - this
    /// helper fills in placeholder title/description/itemType/ipfsHash so
    /// the word-count/access-control/reveal tests below can focus on what
    /// they're actually testing.
    function _createCipherListing(string[] memory words, uint64 deadline, address[] memory participants)
        internal
        returns (uint256 listingId)
    {
        return bidding.createCipherListing(
            "Mystery Prize", "Auctioned via word-arrangement challenge", "image", "QmTestHash", words, deadline, participants
        );
    }

    // --- Word count validation ---

    function test_createCipherListing_accepts12Words() public {
        vm.prank(creator);
        uint256 id = _createCipherListing(words12, uint64(block.timestamp + 1 days), _participants());
        (address listedCreator,,,, uint8 wordCount,,,,) = bidding.cipherListings(id);
        assertEq(listedCreator, creator);
        assertEq(wordCount, 12);
    }

    function test_createCipherListing_rejectsWrongWordCount() public {
        vm.prank(creator);
        vm.expectRevert("word list must be 12 or 24 words");
        _createCipherListing(words7, uint64(block.timestamp + 1 days), _participants());
    }

    function test_createCipherListing_rejectsPastDeadline() public {
        vm.warp(1000);
        vm.prank(creator);
        vm.expectRevert("deadline must be future");
        _createCipherListing(words12, uint64(block.timestamp), _participants());
    }

    function test_createCipherListing_rejectsNoParticipants() public {
        vm.prank(creator);
        vm.expectRevert("cipher listings need at least one participant");
        _createCipherListing(words12, uint64(block.timestamp + 1 days), new address[](0));
    }

    // --- Access control ---

    function test_addCipherParticipants_onlyCreator() public {
        vm.prank(creator);
        uint256 id = _createCipherListing(words12, uint64(block.timestamp + 1 days), _participants());

        address[] memory more = new address[](1);
        more[0] = outsider;

        vm.prank(outsider);
        vm.expectRevert("not listing creator");
        bidding.addCipherParticipants(id, more);
    }

    function test_submitCipherGuess_onlyParticipant() public {
        vm.prank(creator);
        uint256 id = _createCipherListing(words12, uint64(block.timestamp + 1 days), _participants());

        vm.prank(outsider);
        vm.expectRevert("not a participant of this cipher listing");
        bidding.submitCipherGuess(id, bytes32(uint256(1)), hex"1234");
    }

    function test_submitCipherGuess_rejectsDoubleSubmit() public {
        vm.prank(creator);
        uint256 id = _createCipherListing(words12, uint64(block.timestamp + 1 days), _participants());

        vm.prank(alice);
        bidding.submitCipherGuess(id, bytes32(uint256(1)), hex"1234");

        vm.prank(alice);
        vm.expectRevert("already sealed");
        bidding.submitCipherGuess(id, bytes32(uint256(2)), hex"5678");
    }

    function test_submitCipherGuess_recordsGuesserAndCommitment() public {
        vm.prank(creator);
        uint256 id = _createCipherListing(words12, uint64(block.timestamp + 1 days), _participants());

        vm.prank(alice);
        bidding.submitCipherGuess(id, bytes32(uint256(42)), hex"cafe");

        address[] memory guessers = bidding.getCipherGuessers(id);
        assertEq(guessers.length, 1);
        assertEq(guessers[0], alice);

        (bytes32 commitment,, bool submitted) = bidding.cipherSealedGuesses(id, alice);
        assertEq(commitment, bytes32(uint256(42)));
        assertTrue(submitted);
    }

    // --- Reveal-result decode/signature path ---

    /// @dev Mirrors the contract's own ActionResult.Hash() reconstruction and
    /// TEE_ACTION_RESULT_PREFIX domain separation exactly, so this test
    /// fabricates a signature the same way the real TEE node would.
    function _signResult(bytes memory resultData, bytes32 actionId, string memory tag, uint8 status)
        internal
        view
        returns (bytes memory signature)
    {
        bytes32 resultHash = keccak256(abi.encodePacked(keccak256(resultData), actionId, keccak256(bytes(tag)), status));
        bytes32 payloadHash = keccak256(abi.encode(bytes32("TEE_ACTION_RESULT"), block.chainid, resultHash));
        bytes32 ethSigned = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", payloadHash));

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(teePrivateKey, ethSigned);
        signature = abi.encodePacked(r, s, v);
    }

    function test_submitCipherRevealResult_acceptsValidSignatureAndStoresArrangements() public {
        vm.prank(creator);
        uint256 id = _createCipherListing(words12, uint64(block.timestamp + 1 days), _participants());

        vm.prank(alice);
        bidding.submitCipherGuess(id, bytes32(uint256(1)), hex"1234");

        vm.warp(block.timestamp + 2 days);

        uint8[] memory winnerArrangement = new uint8[](12);
        uint8[] memory trueArrangement = new uint8[](12);
        for (uint8 i = 0; i < 12; i++) {
            winnerArrangement[i] = i;
            trueArrangement[i] = 11 - i;
        }

        bytes memory resultData =
            abi.encode(id, address(bidding), alice, winnerArrangement, trueArrangement);
        bytes32 actionId = bytes32(uint256(777));
        string memory tag = "cipher-reveal-1";
        bytes memory signature = _signResult(resultData, actionId, tag, 1);

        bidding.submitCipherRevealResult(resultData, actionId, tag, 1, signature);

        (,, bool revealed, address winner,,,,,) = bidding.cipherListings(id);
        assertTrue(revealed);
        assertEq(winner, alice);

        uint8[] memory storedWinner = bidding.getCipherWinnerArrangement(id);
        uint8[] memory storedTrue = bidding.getCipherTrueArrangement(id);
        assertEq(storedWinner.length, 12);
        assertEq(storedTrue[0], 11);
    }

    function test_submitCipherRevealResult_rejectsBadSignature() public {
        vm.prank(creator);
        uint256 id = _createCipherListing(words12, uint64(block.timestamp + 1 days), _participants());
        vm.warp(block.timestamp + 2 days);

        uint8[] memory arr = new uint8[](12);
        for (uint8 i = 0; i < 12; i++) {
            arr[i] = i;
        }

        bytes memory resultData = abi.encode(id, address(bidding), alice, arr, arr);
        bytes32 actionId = bytes32(uint256(1));
        string memory tag = "tag";

        // Signed with the wrong key.
        uint256 wrongKey = 0xBAD;
        bytes32 resultHash =
            keccak256(abi.encodePacked(keccak256(resultData), actionId, keccak256(bytes(tag)), uint8(1)));
        bytes32 payloadHash = keccak256(abi.encode(bytes32("TEE_ACTION_RESULT"), block.chainid, resultHash));
        bytes32 ethSigned = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", payloadHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongKey, ethSigned);
        bytes memory badSignature = abi.encodePacked(r, s, v);

        vm.expectRevert("bad TEE signature");
        bidding.submitCipherRevealResult(resultData, actionId, tag, 1, badSignature);
    }

    function test_submitCipherRevealResult_rejectsBeforeDeadline() public {
        vm.prank(creator);
        uint256 id = _createCipherListing(words12, uint64(block.timestamp + 1 days), _participants());

        uint8[] memory arr = new uint8[](12);
        for (uint8 i = 0; i < 12; i++) {
            arr[i] = i;
        }
        bytes memory resultData = abi.encode(id, address(bidding), alice, arr, arr);
        bytes32 actionId = bytes32(uint256(1));
        string memory tag = "tag";
        bytes memory signature = _signResult(resultData, actionId, tag, 1);

        vm.expectRevert("deadline not reached");
        bidding.submitCipherRevealResult(resultData, actionId, tag, 1, signature);
    }
}
