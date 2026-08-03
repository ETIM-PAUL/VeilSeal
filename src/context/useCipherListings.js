import { useContext } from "react";

import { CipherListingsContext } from "./cipher-listings-context";

export function useCipherListings() {
  const ctx = useContext(CipherListingsContext);
  if (!ctx) throw new Error("useCipherListings must be used within a CipherListingsProvider");
  return ctx;
}
