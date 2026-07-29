export const transferStats = {
    totalSent: "£42,860",
    transfers: 126,
    pending: 4,
    avgExecution: "2.1s",
  };
  
  export const transfers = [
    {
      id: "TRF-001",
      recipient: "0x82A1...91D4",
      amount: "500",
      token: "FLR",
      status: "Settled",
      createdAt: "2 mins ago",
      txHash: "0x71af...c192",
    },
    {
      id: "TRF-002",
      recipient: "0xAB22...77EE",
      amount: "120",
      token: "USDC",
      status: "Executing",
      createdAt: "18 mins ago",
      txHash: "0x83da...aa91",
    },
    {
      id: "TRF-003",
      recipient: "0x91CD...113A",
      amount: "980",
      token: "FLR",
      status: "Queued",
      createdAt: "1 hour ago",
      txHash: "0x119d...ef11",
    },
  ];