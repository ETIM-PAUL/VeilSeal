import { useState } from "react";

import { Group, TextInput, Avatar, Menu, ActionIcon, Burger, Text, Button, Tooltip } from "@mantine/core";

import {
  LuSearch,
  LuBell,
  LuWallet,
  LuCopy,
  LuExternalLink,
  LuLogOut,
  LuTriangleAlert,
} from "react-icons/lu";

import { useWallet } from "../../context/useWallet";
import { truncateAddress, explorerAddressUrl } from "../../utils/network";

export default function Navbar({ opened, toggle }) {
  const {
    address,
    isConnected,
    isCorrectNetwork,
    isConnecting,
    hasProvider,
    error,
    connect,
    disconnect,
    switchToCoston2,
  } = useWallet();

  const [copied, setCopied] = useState(false);
  const [switchError, setSwitchError] = useState(null);
  const [switching, setSwitching] = useState(false);

  const copyAddress = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSwitchNetwork = async () => {
    setSwitching(true);
    setSwitchError(null);

    try {
      await switchToCoston2();
    } catch (err) {
      setSwitchError(err?.code === 4001 ? "Network switch was rejected." : "Failed to switch network.");
    } finally {
      setSwitching(false);
    }
  };

  return (
    <Group justify="space-between" h="100%" px="md" wrap="nowrap">
      <Group wrap="nowrap">
        <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />

        <TextInput
          placeholder="Search VeilPay"
          leftSection={<LuSearch size={15} />}
          w={300}
          styles={{ input: { fontSize: 14 } }}
        />
      </Group>

      <Group gap="sm" wrap="nowrap">
        <ActionIcon variant="subtle" color="ink">
          <LuBell size={17} />
        </ActionIcon>

        {!isConnected && (
          <Tooltip
            label={hasProvider ? (error ?? "") : "No wallet detected"}
            disabled={!error && hasProvider}
          >
            <Button
              size="sm"
              leftSection={<LuWallet size={15} />}
              onClick={connect}
              loading={isConnecting}
              disabled={!hasProvider}
            >
              Connect Wallet
            </Button>
          </Tooltip>
        )}

        {isConnected && !isCorrectNetwork && (
          <Tooltip label={switchError ?? ""} disabled={!switchError}>
            <Button
              size="sm"
              color="amber"
              leftSection={<LuTriangleAlert size={15} />}
              onClick={handleSwitchNetwork}
              loading={switching}
            >
              Switch to Coston2
            </Button>
          </Tooltip>
        )}

        {isConnected && isCorrectNetwork && (
          <Menu position="bottom-end">
            <Menu.Target>
              <Group gap={8} style={{ cursor: "pointer" }} wrap="nowrap">
                <Avatar radius="sm" size={30} color="signal" variant="light">
                  <LuWallet size={15} />
                </Avatar>

                <Text className="num" size="xs" visibleFrom="sm">
                  {truncateAddress(address)}
                </Text>
              </Group>
            </Menu.Target>

            <Menu.Dropdown>
              <Menu.Item leftSection={<LuCopy size={14} />} onClick={copyAddress}>
                {copied ? "Copied" : "Copy Address"}
              </Menu.Item>

              <Menu.Item
                component="a"
                href={explorerAddressUrl(address)}
                target="_blank"
                rel="noreferrer"
                leftSection={<LuExternalLink size={14} />}
              >
                View on Explorer
              </Menu.Item>

              <Menu.Divider />

              <Menu.Item color="danger" leftSection={<LuLogOut size={14} />} onClick={disconnect}>
                Disconnect
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        )}
      </Group>
    </Group>
  );
}
