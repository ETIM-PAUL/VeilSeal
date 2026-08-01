import { useContext } from "react";

import { BidsContext } from "./bids-context";

export function useBids() {
  const ctx = useContext(BidsContext);
  if (!ctx) throw new Error("useBids must be used within a BidsProvider");
  return ctx;
}
