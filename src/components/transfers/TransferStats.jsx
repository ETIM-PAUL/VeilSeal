import { SimpleGrid } from "@mantine/core";

export default function TransferStats({ stats }) {
  const cards = [
    { title: "Total Sent", value: stats.totalSent },
    { title: "Transfers", value: stats.transfers },
    { title: "Pending", value: stats.pending },
    { title: "Avg TEE Time", value: stats.avgExecution },
  ];

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
      {cards.map((card) => (
        <div key={card.title} className="panel" style={{ padding: "16px 18px" }}>
          <div className="label-micro">{card.title}</div>
          <div className="num-lg" style={{ marginTop: 6 }}>
            {card.value}
          </div>
        </div>
      ))}
    </SimpleGrid>
  );
}
