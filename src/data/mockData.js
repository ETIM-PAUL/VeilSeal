export const dashboardStats = [

    {
    title:"Treasuries",
    value:"4",
    description:"Across 3 confidential vaults"
    },
    
    {
    title:"Confidential Operations",
    value:"146",
    description:"Processed this month"
    },
    
    {
    title:"Pending TEE Jobs",
    value:"7",
    description:"Currently active"
    },
    
    {
    title:"Attestations",
    value:"139",
    description:"Across organizations"
    }
    
    ];
    
    
    export const mockActivity=[
    
    {
    id:1,
    title:"Treasury contribution received",
    time:"2 minutes ago",
    status:"Completed"
    },
    
    {
    id:2,
    title:"Private transfer sent",
    time:"35 minutes ago",
    status:"Completed"
    },
    
    {
    id:3,
    title:"DAO payout awaiting approval",
    time:"1 hour ago",
    status:"Pending"
    },
    
    {
    id:4,
    title:"Sealed bid submitted",
    time:"Yesterday",
    status:"Completed"
    }
    
    ];

    export const treasuries = [
        {
          id: "eng-dao",
          name: "Engineering DAO",
          type: "DAO",
          balance: "£21,480",
          members: 12,
          operations: 4,
          lastAttestation: "2 mins ago",
          status: "Healthy"
        },
        {
          id: "marketing",
          name: "Marketing Treasury",
          type: "Department",
          balance: "£9,210",
          members: 7,
          operations: 1,
          lastAttestation: "18 mins ago",
          status: "Healthy"
        },
        {
          id: "community",
          name: "Community Grants",
          type: "Community",
          balance: "£15,920",
          members: 18,
          operations: 6,
          lastAttestation: "1 min ago",
          status: "Healthy"
        }
      ];

      export const treasuryContributions = {
        "eng-dao": [
          {
            id: 1,
            wallet: "0x82A1...91D4",
            amount: "£500",
            token: "FLR",
            status: "Settled",
            txHash: "0x71af...4e92",
            time: "2 mins ago",
          },
          {
            id: 2,
            wallet: "0x4FD2...A991",
            amount: "£150",
            token: "USDC",
            status: "Attested",
            txHash: "0x21bb...9ad1",
            time: "18 mins ago",
          },
          {
            id: 3,
            wallet: "0xA991...781B",
            amount: "£950",
            token: "FLR",
            status: "Executing",
            txHash: "0x8dd2...ce44",
            time: "1 hour ago",
          },
          {
            id: 4,
            wallet: "0x92AA...BB13",
            amount: "£320",
            token: "ETH",
            status: "Queued",
            txHash: "0x7ab3...99ef",
            time: "Just now",
          },
        ],
      };

      export const transfers = [
        {
          id: "TRF-001",
          recipient: "0x82A1...91D4",
          amount: "250",
          token: "FLR",
          status: "Settled",
          time: "2 mins ago",
          txHash: "0x71af...c192",
        },
        {
          id: "TRF-002",
          recipient: "0xAB22...77EE",
          amount: "120",
          token: "USDC",
          status: "Executing",
          time: "18 mins ago",
          txHash: "0x83da...aa91",
        },
        {
          id: "TRF-003",
          recipient: "0x91CD...113A",
          amount: "980",
          token: "FLR",
          status: "Queued",
          time: "1 hour ago",
          txHash: "0x119d...ef11",
        },
      ];