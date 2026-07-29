import Sidebar from "../components/layout/Sidebar";
import Navbar from "../components/layout/Navbar";

import { AppShell } from "@mantine/core";

import { useDisclosure } from "@mantine/hooks";

export default function AppLayout({ children }) {
  const [opened, { toggle }] = useDisclosure();

  return (
    <AppShell
      navbar={{
        width: 252,
        breakpoint: "sm",
        collapsed: { mobile: !opened },
      }}
      header={{ height: 60 }}
      padding="xl"
      styles={{
        navbar: { borderColor: "var(--line)", background: "var(--panel)" },
        header: { borderColor: "var(--line)", background: "var(--panel)" },
        main: { background: "var(--canvas)" },
      }}
    >
      <AppShell.Navbar>
        <Sidebar />
      </AppShell.Navbar>

      <AppShell.Header>
        <Navbar opened={opened} toggle={toggle} />
      </AppShell.Header>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
