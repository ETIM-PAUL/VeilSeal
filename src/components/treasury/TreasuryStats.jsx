import { SimpleGrid } from "@mantine/core";

export default function TreasuryStats({ treasury }) {
  const stats = [
    { label: "Treasury Balance", value: treasury.balance },
    { label: "Members", value: treasury.members },
    { label: "Pending Operations", value: treasury.operations },
    { label: "Last Attestation", value: treasury.lastAttestation },
  ];

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
      {stats.map((stat) => (
        <div key={stat.label} className="panel" style={{ padding: "16px 18px" }}>
          <div className="label-micro">{stat.label}</div>
          <div className="num-lg" style={{ marginTop: 6 }}>
            {stat.value}
          </div>
        </div>
      ))}
    </SimpleGrid>
  );
}
