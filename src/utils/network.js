// Flare Coston2 testnet — https://dev.flare.network/network/overview
export const COSTON2_CHAIN_ID_DEC = 114;
export const COSTON2_CHAIN_ID_HEX = "0x72";

export const COSTON2_PARAMS = {
  chainId: COSTON2_CHAIN_ID_HEX,
  chainName: "Flare Testnet Coston2",
  nativeCurrency: {
    name: "Coston2 Flare",
    symbol: "C2FLR",
    decimals: 18,
  },
  rpcUrls: ["https://coston2-api.flare.network/ext/C/rpc"],
  blockExplorerUrls: ["https://coston2-explorer.flare.network"],
};

export function truncateAddress(address) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function explorerAddressUrl(address) {
  return `${COSTON2_PARAMS.blockExplorerUrls[0]}/address/${address}`;
}
