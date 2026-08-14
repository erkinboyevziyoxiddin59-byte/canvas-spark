// Simple localStorage-backed order store for the mock Mini App.

export type OrderType = "stars" | "premium_3" | "premium_6" | "premium_12";
export type OrderStatus = "active" | "paid" | "delivered" | "expired";

export interface Order {
  id: number;
  targetUsername: string;
  type: OrderType;
  quantity: number; // stars count or months
  amountUzs: number;
  status: OrderStatus;
  createdAt: number; // epoch ms
  expiresAt: number; // epoch ms
}

const KEY = "starkerak.orders.v1";
const BASE_AMOUNT = 10_750;
export const STAR_PRICE_UZS = 200;
export const PREMIUM_PRICES: Record<3 | 6 | 12, number> = {
  3: 55_000,
  6: 95_000,
  12: 170_000,
};
export const ORDER_EXPIRE_MINUTES = 10;

/* ---------------- admin-configurable pricing ---------------- */

export interface Pricing {
  starPriceUzs: number;
  premium: Record<3 | 6 | 12, number>;
}

export const DEFAULT_PRICING: Pricing = {
  starPriceUzs: STAR_PRICE_UZS,
  premium: { ...PREMIUM_PRICES },
};

const PRICING_KEY = "starkerak.pricing.v1";

export function getPricing(): Pricing {
  if (typeof window === "undefined") return DEFAULT_PRICING;
  try {
    const raw = window.localStorage.getItem(PRICING_KEY);
    if (!raw) return DEFAULT_PRICING;
    const parsed = JSON.parse(raw) as Partial<Pricing>;
    return {
      starPriceUzs: Number(parsed.starPriceUzs) > 0 ? Number(parsed.starPriceUzs) : DEFAULT_PRICING.starPriceUzs,
      premium: { ...DEFAULT_PRICING.premium, ...(parsed.premium ?? {}) },
    };
  } catch {
    return DEFAULT_PRICING;
  }
}

export function savePricing(next: Pricing) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PRICING_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("orders:changed"));
}

export function resetPricing() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PRICING_KEY);
  window.dispatchEvent(new CustomEvent("orders:changed"));
}

/* ---------------- maintenance mode ---------------- */

export interface Maintenance {
  enabled: boolean;
  message: string;
}

export const DEFAULT_MAINTENANCE: Maintenance = { enabled: false, message: "" };

const MAINTENANCE_KEY = "starkerak.maintenance.v1";

export function getMaintenance(): Maintenance {
  if (typeof window === "undefined") return DEFAULT_MAINTENANCE;
  try {
    const raw = window.localStorage.getItem(MAINTENANCE_KEY);
    if (!raw) return DEFAULT_MAINTENANCE;
    const parsed = JSON.parse(raw) as Partial<Maintenance>;
    return { enabled: Boolean(parsed.enabled), message: String(parsed.message ?? "") };
  } catch {
    return DEFAULT_MAINTENANCE;
  }
}

export function saveMaintenance(next: Maintenance) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MAINTENANCE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("orders:changed"));
}

export const CARD_NUMBER = "9860 1666 5354 5375";
export const CARD_HOLDER = "E. Z.";

function read(): Order[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Order[]) : [];
  } catch {
    return [];
  }
}

function write(orders: Order[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(orders));
  window.dispatchEvent(new CustomEvent("orders:changed"));
}

export function getOrders(): Order[] {
  const now = Date.now();
  const orders = read().map((o) =>
    o.status === "active" && o.expiresAt < now ? { ...o, status: "expired" as OrderStatus } : o,
  );
  return orders.sort((a, b) => b.createdAt - a.createdAt);
}

export function getOrder(id: number): Order | undefined {
  return getOrders().find((o) => o.id === id);
}

/** Random surcharge (1–200 UZS) so each pending order has a unique, trackable amount. */
function uniqueAmount(base: number, existing: Order[]): number {
  const taken = new Set(
    existing.filter((o) => o.status === "active" || o.status === "paid").map((o) => o.amountUzs),
  );
  for (let i = 0; i < 60; i++) {
    const amount = base + 1 + Math.floor(Math.random() * 200);
    if (!taken.has(amount)) return amount;
  }
  let amount = base + 1;
  while (taken.has(amount)) amount += 1;
  return amount;
}

export function createOrder(input: {
  targetUsername: string;
  type: OrderType;
  quantity: number;
  basePrice: number;
}): Order {
  const existing = read();
  const nextId = (existing.reduce((m, o) => Math.max(m, o.id), 0) || 1000) + 1;
  const now = Date.now();
  const order: Order = {
    id: nextId,
    targetUsername: input.targetUsername,
    type: input.type,
    quantity: input.quantity,
    amountUzs: uniqueAmount(input.basePrice, existing),
    status: "active",
    createdAt: now,
    expiresAt: now + ORDER_EXPIRE_MINUTES * 60 * 1000,
  };
  write([order, ...existing]);
  return order;
}

export function markPaid(id: number) {
  const orders = read().map((o) => (o.id === id ? { ...o, status: "paid" as OrderStatus } : o));
  write(orders);
  // Simulate delivery after a short delay
  setTimeout(() => {
    const next = read().map((o) =>
      o.id === id ? { ...o, status: "delivered" as OrderStatus } : o,
    );
    write(next);
  }, 2500);
}

export function cancelOrder(id: number) {
  const orders = read().map((o) => (o.id === id ? { ...o, status: "expired" as OrderStatus } : o));
  write(orders);
}

export function formatAmount(n: number): string {
  return n.toLocaleString("en-US").replace(/,/g, " ");
}

export function typeLabel(t: OrderType): string {
  if (t === "stars") return "Telegram Stars";
  const m = t.replace("premium_", "");
  return `Telegram Premium · ${m} oy`;
}

export function typeIcon(t: OrderType): "star" | "premium" {
  return t === "stars" ? "star" : "premium";
}

export function BASE_UNIQUE_AMOUNT(price: number) {
  // for stars we anchor to BASE_AMOUNT for uniqueness demo
  return price < BASE_AMOUNT ? BASE_AMOUNT : price;
}

export const CONST = { BASE_AMOUNT };
