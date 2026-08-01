import { useEffect, useState } from "react";
import { hexlify } from "ethers";
import {
  Alert,
  Badge,
  Button,
  Divider,
  Group,
  NumberInput,
  PasswordInput,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { LuBot, LuTrash2, LuPlay, LuTriangleAlert } from "react-icons/lu";

import { useWallet } from "../context/useWallet";
import { getBrowserSigner, isContractConfigured } from "../contracts/VeilBidding";
import { eciesEncryptForTee } from "../lib/tee/goEcies";
import { fetchLiveTeePublicKey } from "../lib/tee/ecies";
import { isProxyConfigured } from "../lib/tee/proxy";
import { createAgent, getAgent, updateAgent, deleteAgent as deleteAgentApi, runAgentNow } from "../lib/tee/agentProxy";
import { toChainAmount, fromChainAmount } from "../utils/sealedBid";
import { ITEM_TYPES } from "../utils/bids";

const STATIC_TEE_PUBLIC_KEY = import.meta.env.VITE_TEE_PUBLIC_KEY;

const ITEM_TYPE_OPTIONS = [{ value: "", label: "Any item type" }, ...ITEM_TYPES.map((t) => ({ value: t.value, label: t.label }))];

export default function Agents() {
  const { address } = useWallet();

  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  const [privateKey, setPrivateKey] = useState("");
  const [keyword, setKeyword] = useState("");
  const [itemType, setItemType] = useState("");
  const [maxAmount, setMaxAmount] = useState();

  useEffect(() => {
    if (!address) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const rec = await getAgent(address);
        if (cancelled) return;
        setAgent(rec);
        if (rec) {
          setKeyword(rec.keyword ?? "");
          setItemType(rec.itemType ?? "");
          setMaxAmount(fromChainAmount(BigInt(rec.maxAmount || "0")));
        }
      } catch (err) {
        if (!cancelled) setError(err?.message ?? "Failed to load agent status.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [address]);

  const encryptPrivateKey = async (rawKey) => {
    let teePublicKey = STATIC_TEE_PUBLIC_KEY;
    if (isProxyConfigured()) {
      teePublicKey = await fetchLiveTeePublicKey();
    }
    if (!teePublicKey) {
      throw new Error("No TEE public key available — set VITE_EXT_PROXY_URL (real TEE) or VITE_TEE_PUBLIC_KEY (demo).");
    }
    const ciphertext = await eciesEncryptForTee(teePublicKey, new TextEncoder().encode(rawKey));
    return hexlify(ciphertext);
  };

  const register = async () => {
    if (!address) return;
    setError(null);
    if (!privateKey.trim()) {
      setError("Paste the private key of the wallet you want the agent to bid as.");
      return;
    }
    setSaving(true);
    try {
      const encryptedPrivateKey = await encryptPrivateKey(privateKey.trim());
      const signer = await getBrowserSigner();
      const rec = await createAgent(signer, address, {
        encryptedPrivateKey,
        keyword: keyword.trim(),
        itemType,
        maxAmount: toChainAmount(maxAmount ?? 0).toString(),
      });
      setAgent(rec);
    } catch (err) {
      setError(err?.message ?? "Failed to register agent.");
    } finally {
      setSaving(false);
      setPrivateKey(""); // scrub from component state regardless of outcome
    }
  };

  const saveCriteria = async () => {
    if (!agent) return;
    setSaving(true);
    setError(null);
    try {
      const signer = await getBrowserSigner();
      const rec = await updateAgent(signer, address, {
        keyword: keyword.trim(),
        itemType,
        maxAmount: toChainAmount(maxAmount ?? 0).toString(),
      });
      setAgent(rec);
    } catch (err) {
      setError(err?.message ?? "Failed to update agent.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async () => {
    if (!agent) return;
    setSaving(true);
    setError(null);
    try {
      const signer = await getBrowserSigner();
      const rec = await updateAgent(signer, address, { active: !agent.active });
      setAgent(rec);
    } catch (err) {
      setError(err?.message ?? "Failed to toggle agent.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!agent) return;
    setDeleting(true);
    setError(null);
    try {
      const signer = await getBrowserSigner();
      await deleteAgentApi(signer, address);
      setAgent(null);
      setKeyword("");
      setItemType("");
      setMaxAmount(undefined);
    } catch (err) {
      setError(err?.message ?? "Failed to delete agent.");
    } finally {
      setDeleting(false);
    }
  };

  const runNow = async () => {
    if (!agent) return;
    setRunning(true);
    setError(null);
    try {
      const signer = await getBrowserSigner();
      const rec = await runAgentNow(signer, address);
      setAgent(rec);
    } catch (err) {
      setError(err?.message ?? "Failed to run agent.");
    } finally {
      setRunning(false);
    }
  };

  if (!address) {
    return (
      <Stack gap="md">
        <Title order={2}>Auto-Bidding Agent</Title>
        <Text className="caption">Connect your wallet to set up an agent.</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="xl" maw={640}>
      <div>
        <Title order={2}>Auto-Bidding Agent</Title>
        <Text className="caption" mt={4}>
          Bids automatically on invite-only listings matching your criteria — checks once a day, or on demand.
        </Text>
      </div>

      {!isContractConfigured() && <Alert color="red">VeilBidding contract isn't configured.</Alert>}

      <Alert icon={<LuTriangleAlert />} color="amber" title="This key can do anything your wallet can do">
        The agent signs as the real wallet you give it — the same address must already be invited to the listings
        you want it to bid on. Use a wallet dedicated to bidding with a small balance, not your primary wallet.
        Browser wallets never expose their private key programmatically, so you'll need to export it manually
        (e.g. MetaMask → Account details → Show private key) and paste it below. It's ECIES-encrypted in your
        browser before it ever leaves this page, and this process only decrypts it in memory for as long as it
        takes to sign one bid.
      </Alert>

      {error && (
        <Text size="sm" style={{ color: "var(--danger)" }}>
          {error}
        </Text>
      )}

      {loading ? (
        <Text className="caption">Loading agent status…</Text>
      ) : (
        <div className="panel" style={{ padding: 20 }}>
          <Group justify="space-between" align="center" mb="md">
            <Group gap={8}>
              <LuBot size={18} />
              <Text fw={600}>{agent ? "Agent" : "No agent registered"}</Text>
            </Group>

            {agent && (
              <Badge color={agent.active ? "signal" : "gray"}>{agent.active ? "Active" : "Inactive"}</Badge>
            )}
          </Group>

          {!agent && (
            <PasswordInput
              label="Wallet private key"
              placeholder="0x…"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.currentTarget.value)}
              mb="sm"
            />
          )}

          <TextInput
            label="Keyword"
            description="Only bid on listings whose title contains this — leave blank to match any title."
            placeholder="e.g. concept art"
            value={keyword}
            onChange={(e) => setKeyword(e.currentTarget.value)}
            mb="sm"
          />

          <Select
            label="Item type"
            data={ITEM_TYPE_OPTIONS}
            value={itemType}
            onChange={(v) => setItemType(v ?? "")}
            mb="sm"
          />

          <NumberInput
            label="Max bid amount"
            description="If the recommended bid exceeds this, the agent skips the listing rather than bidding your max."
            value={maxAmount}
            onChange={setMaxAmount}
            thousandSeparator=","
            min={0}
            mb="md"
          />

          {!agent ? (
            <Button onClick={register} loading={saving} disabled={!isContractConfigured()}>
              Enable Auto-Bidding Agent
            </Button>
          ) : (
            <>
              <Group gap="sm">
                <Button onClick={saveCriteria} loading={saving} variant="light">
                  Save Criteria
                </Button>
                <Button leftSection={<LuPlay size={14} />} onClick={runNow} loading={running} variant="light">
                  Run Now
                </Button>
                <Switch
                  label={agent.active ? "Active" : "Inactive"}
                  checked={agent.active}
                  onChange={toggleActive}
                  disabled={saving}
                />
              </Group>

              <Divider my="md" />

              <Stack gap={4} mb="md">
                <Text size="xs" className="ink-dim">
                  Last run: {agent.lastRunAt ? new Date(agent.lastRunAt).toLocaleString() : "never"}
                </Text>
                {agent.lastOutcome && (
                  <Text size="xs" className="ink-dim">
                    Outcome: {agent.lastOutcome}
                  </Text>
                )}
              </Stack>

              <Button
                leftSection={<LuTrash2 size={14} />}
                color="red"
                variant="subtle"
                onClick={remove}
                loading={deleting}
              >
                Delete Agent
              </Button>
            </>
          )}
        </div>
      )}
    </Stack>
  );
}
