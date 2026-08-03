import { useCallback, useEffect, useMemo, useState } from "react";

import { COSTON2_CHAIN_ID_HEX, COSTON2_PARAMS } from "../utils/network";
import { WalletContext } from "./wallet-context";

const DISCONNECTED_FLAG = "veilseal:wallet-disconnected";

export function WalletProvider({ children }) {
  const [address, setAddress] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);

  const provider = typeof window !== "undefined" ? window.ethereum : undefined;
  const hasProvider = Boolean(provider);
  const isCorrectNetwork = chainId === COSTON2_CHAIN_ID_HEX;

  const switchToCoston2 = useCallback(async () => {
    if (!provider) return;

    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: COSTON2_CHAIN_ID_HEX }],
      });
    } catch (switchError) {
      // 4902 = chain not yet added to the wallet
      if (switchError?.code === 4902) {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [COSTON2_PARAMS],
        });
      } else {
        throw switchError;
      }
    }
  }, [provider]);

  const connect = useCallback(async () => {
    if (!provider) {
      setError("No wallet detected. Install MetaMask or a compatible wallet.");
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const accounts = await provider.request({ method: "eth_requestAccounts" });
      setAddress(accounts[0] ?? null);

      await switchToCoston2();

      const currentChainId = await provider.request({ method: "eth_chainId" });
      setChainId(currentChainId);

      localStorage.removeItem(DISCONNECTED_FLAG);
    } catch (connectError) {
      if (connectError?.code === 4001) {
        setError("Connection request was rejected.");
      } else {
        setError(connectError?.message ?? "Failed to connect wallet.");
      }
    } finally {
      setIsConnecting(false);
    }
  }, [provider, switchToCoston2]);

  const disconnect = useCallback(async () => {
    if (provider?.request) {
      try {
        // EIP-2255 permission revocation - supported by some wallets, silently
        // ignored by those that don't implement it.
        await provider.request({
          method: "wallet_revokePermissions",
          params: [{ eth_accounts: {} }],
        });
      } catch {
        // No-op: falls back to clearing local state only.
      }
    }

    localStorage.setItem(DISCONNECTED_FLAG, "1");
    setAddress(null);
    setChainId(null);
    setError(null);
  }, [provider]);

  // Restore an already-authorized session on load, without prompting,
  // unless the user explicitly disconnected last time.
  useEffect(() => {
    if (!provider || localStorage.getItem(DISCONNECTED_FLAG)) return;
    let cancelled = false;

    (async () => {
      try {
        const accounts = await provider.request({ method: "eth_accounts" });
        if (cancelled || !accounts?.[0]) return;

        setAddress(accounts[0]);
        const currentChainId = await provider.request({ method: "eth_chainId" });
        if (!cancelled) setChainId(currentChainId);
      } catch {
        // No-op: session restore is best-effort.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [provider]);

  useEffect(() => {
    if (!provider?.on) return;

    const handleAccountsChanged = (accounts) => {
      setAddress(accounts[0] ?? null);
      if (!accounts[0]) localStorage.setItem(DISCONNECTED_FLAG, "1");
    };

    const handleChainChanged = (newChainId) => setChainId(newChainId);

    provider.on("accountsChanged", handleAccountsChanged);
    provider.on("chainChanged", handleChainChanged);

    return () => {
      provider.removeListener?.("accountsChanged", handleAccountsChanged);
      provider.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [provider]);

  const value = useMemo(
    () => ({
      address,
      chainId,
      isConnected: Boolean(address),
      isCorrectNetwork,
      isConnecting,
      hasProvider,
      error,
      connect,
      disconnect,
      switchToCoston2,
    }),
    [address, chainId, isCorrectNetwork, isConnecting, hasProvider, error, connect, disconnect, switchToCoston2]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}
