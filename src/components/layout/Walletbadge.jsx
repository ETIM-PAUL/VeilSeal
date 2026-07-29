import { Badge } from "@mantine/core";

import { LuWallet } from "react-icons/lu";

export default function WalletBadge() {
  return (
    <Badge
      variant="outline"
      color="slate"
      leftSection={<LuWallet size={12} />}
      style={{ fontFamily: "var(--font-mono)", textTransform: "none" }}
    >
      0x82...91A
    </Badge>
  );
}
