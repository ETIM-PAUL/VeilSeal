import { SimpleGrid } from "@mantine/core";

export default function TransferStats() {
  const stats = [
    { title: "Private Transfers", value: "126" },
    { title: "Pending TEE Jobs", value: "4" },
    { title: "Settled", value: "122" },
    { title: "Total Volume", value: "£42,860" },
  ];

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }}>
      {stats.map((item) => (
        <div key={item.title} className="panel" style={{ padding: "16px 18px" }}>
          <div className="label-micro">{item.title}</div>
          <div className="num-lg" style={{ marginTop: 6 }}>
            {item.value}
          </div>
        </div>
      ))}
    </SimpleGrid>
  );
}
