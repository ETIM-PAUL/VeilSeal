// The wallet treated as "connected" for this mock — matches the address
// used elsewhere in the app (contributions, transfers) as the demo user.
export const MY_WALLET = "0x82A1...91D4";

const hoursFromNow = (h) => new Date(Date.now() + h * 60 * 60 * 1000).toISOString();

export const bids = [
  {
    id: "BID-101",
    title: "Genesis Punk #142",
    description: "Rare 1-of-1 generative artwork, minted on Flare and held in escrow for the auction window.",
    itemType: "image",
    ipfsHash: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
    deadline: hoursFromNow(72),
    minBid: 100,
    token: "FLR",
    creator: "0x92AA...BB13",
    participants: [
      { id: 1, wallet: MY_WALLET, amount: 180, submittedAt: "2 hours ago", mine: true, withdrawn: false },
      { id: 2, wallet: "0x4FD2...A991", amount: 210, submittedAt: "40 mins ago", mine: false, withdrawn: false },
    ],
  },
  {
    id: "BID-102",
    title: "Studio Session Masters",
    description: "Unreleased multitrack session masters, sealed until the highest bidder is confirmed.",
    itemType: "audio",
    ipfsHash: "bafybeih3rr4jqjq3nqjyqf3nzzljxq7bxq3s5w4d3g4k2vqjqf3nzzljxq",
    deadline: hoursFromNow(5),
    minBid: 250,
    token: "USDC",
    creator: "0xA991...781B",
    participants: [
      { id: 1, wallet: "0x71fa...4e92", amount: 300, submittedAt: "1 hour ago", mine: false, withdrawn: false },
    ],
  },
  {
    id: "BID-103",
    title: "Rare Manuscript Scan",
    description: "High-resolution scan of a private first-edition manuscript.",
    itemType: "file",
    ipfsHash: "bafybeicn5v4qjqf3nzzljxq7bxq3s5w4d3g4k2vqjqf3nzzljxq7bxq3s5",
    deadline: hoursFromNow(-48),
    minBid: 500,
    token: "FLR",
    creator: "0x21bb...9ad1",
    participants: [
      { id: 1, wallet: MY_WALLET, amount: 520, submittedAt: "3 days ago", mine: true, withdrawn: false },
      { id: 2, wallet: "0x8dd2...ce44", amount: 890, submittedAt: "3 days ago", mine: false, withdrawn: false },
      { id: 3, wallet: "0x7ab3...99ef", amount: 610, submittedAt: "2 days ago", mine: false, withdrawn: false },
      { id: 4, wallet: "0x119d...ef11", amount: 540, submittedAt: "2 days ago", mine: false, withdrawn: true },
    ],
  },
  {
    id: "BID-104",
    title: "Founder Keynote Reel",
    description: "Director's cut of the founder keynote, licensed for a single private screening.",
    itemType: "video",
    ipfsHash: "bafybeigqf3nzzljxq7bxq3s5w4d3g4k2vqjqf3nzzljxq7bxq3s5w4d3g4",
    deadline: hoursFromNow(-24),
    minBid: 300,
    token: "USDC",
    creator: "0x83da...aa91",
    participants: [
      { id: 1, wallet: MY_WALLET, amount: 750, submittedAt: "2 days ago", mine: true, withdrawn: false },
      { id: 2, wallet: "0x91cd...113a", amount: 640, submittedAt: "2 days ago", mine: false, withdrawn: false },
    ],
  },
  {
    id: "BID-105",
    title: "Untitled Composition No. 7",
    description: "Original score, sealed bidding open until the deadline.",
    itemType: "audio",
    ipfsHash: "bafybeixq3s5w4d3g4k2vqjqf3nzzljxq7bxq3s5w4d3g4k2vqjqf3nzzlj",
    deadline: hoursFromNow(28),
    minBid: 50,
    token: "FLR",
    creator: "0x119d...ef11",
    participants: [],
  },
];
