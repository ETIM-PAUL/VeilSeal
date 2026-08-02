import { Stack, Text, Group } from "@mantine/core";

import {
  LuLayoutDashboard,
  LuWallet,
  LuArrowLeftRight,
  LuGavel,
  LuLockKeyhole,
  LuActivity,
  LuShieldCheck,
  LuBot,
} from "react-icons/lu";

import { NavLink } from "react-router-dom";

import { useWallet } from "../../context/useWallet";

const baseLinks = [
  { name: "Dashboard", path: "/", icon: LuLayoutDashboard },
  { name: "Treasuries", path: "/treasuries", icon: LuWallet },
  { name: "P2P Transfers", path: "/p2p-transfers", icon: LuArrowLeftRight },
  { name: "Standard Listings", path: "/listings", icon: LuGavel },
  { name: "Agent", path: "/agents", icon: LuBot },
  { name: "Operations", path: "/operations", icon: LuActivity },
];

// Stealth Listings is only reachable by hashed ID anyway (nothing here is
// browsable without one), so the nav entry itself only shows once a wallet
// is connected - no point advertising it to a visitor who can't do anything
// with it yet.
const STEALTH_LINK = { name: "Stealth Listings", path: "/stealth-listings", icon: LuLockKeyhole };

export default function Sidebar() {
  const { isConnected } = useWallet();
  const listingsIndex = baseLinks.findIndex((l) => l.path === "/listings");
  const links = isConnected
    ? [...baseLinks.slice(0, listingsIndex + 1), STEALTH_LINK, ...baseLinks.slice(listingsIndex + 1)]
    : baseLinks;

  return (
    <Stack gap={0} h="100%">
      <Group
        gap={10}
        px="md"
        py="lg"
        className="hairline-bottom"
        wrap="nowrap"
      >
        <LuShieldCheck size={20} color="var(--signal)" />

        <div>
          <Text
            fw={600}
            style={{ fontFamily: "var(--font-display)", lineHeight: 1.1 }}
          >
            VeilPay
          </Text>

          <Text className="label-micro" style={{ fontSize: 10 }}>
            Confidential Finance
          </Text>
        </div>
      </Group>

      <Stack gap={2} p="sm" style={{ flex: 1 }}>
        {links.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink key={item.path} to={item.path} end={item.path === "/"}>
              {({ isActive }) => (
                <Group
                  gap={10}
                  px="sm"
                  py={9}
                  wrap="nowrap"
                  style={{
                    borderRadius: 4,
                    borderLeft: `2px solid ${isActive ? "var(--signal)" : "transparent"}`,
                    background: isActive ? "var(--signal-bg)" : "transparent",
                    color: isActive ? "var(--ink)" : "var(--ink-dim)",
                    transition: "background .12s ease, color .12s ease",
                  }}
                  className="sidebar-link"
                >
                  <Icon size={16} />

                  <Text
                    size="sm"
                    fw={isActive ? 600 : 500}
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {item.name}
                  </Text>
                </Group>
              )}
            </NavLink>
          );
        })}
      </Stack>

      <Group px="md" py="md" className="hairline-top" justify="space-between">
        <Text className="label-micro" style={{ fontSize: 10 }}>
          Network
        </Text>
        <Text className="num" size="xs" fw={500}>
          Coston2
        </Text>
      </Group>
    </Stack>
  );
}
