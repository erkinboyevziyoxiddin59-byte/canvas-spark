import { useEffect, useState } from "react";
import { DEFAULT_PRICING, getPricing, type Pricing } from "../lib/mock-store";

/** Reactive access to the admin-configurable prices. */
export function usePricing(): Pricing {
  const [pricing, setPricing] = useState<Pricing>(DEFAULT_PRICING);

  useEffect(() => {
    const refresh = () => setPricing(getPricing());
    refresh();
    window.addEventListener("orders:changed", refresh);
    return () => window.removeEventListener("orders:changed", refresh);
  }, []);

  return pricing;
}
