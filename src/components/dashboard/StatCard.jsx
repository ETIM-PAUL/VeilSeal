import { Group } from "@mantine/core";

export default function StatCard({ title, value, icon: Icon, description }) {
  return (
    <div className="panel" style={{ padding: "18px 20px" }}>
      <Group justify="space-between" mb={14} wrap="nowrap" align="flex-start">
        <span className="label-micro">{title}</span>

        {Icon && <Icon size={15} className="ink-faint" />}
      </Group>

      <div className="num-xl">{value}</div>

      {description && (
        <div className="caption" style={{ marginTop: 6 }}>
          {description}
        </div>
      )}
    </div>
  );
}
