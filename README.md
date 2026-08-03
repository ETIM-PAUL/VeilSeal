# VeilSeal

VeilSeal is a confidential sealed-bid auction platform built on Flare Confidential Compute. Bidders commit an encrypted, sealed amount on-chain; a TEE only decrypts sealed bids after a listing's deadline, determines the winner, and signs the result for on-chain verification - so nobody, including VeilSeal itself, ever sees a bid amount before it's revealed.

Two listing types:

- **Standard Listings** - publicly browsable, gated either by a TEE-verified minimum wallet signal score or by an explicit invite list.
- **Stealth Listings** - encrypted end to end (title, description, minimum bid included), discoverable only via a hashed ID the creator shares directly with invited bidders - nothing about them is ever visible on-chain, even after the winner is revealed.

Also includes P2P Transfers (private payments) and an Operations feed of real on-chain bid, reveal, and withdrawal activity.
