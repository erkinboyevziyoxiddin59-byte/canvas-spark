// Pure presentation helpers shared by the screens (no data access).

export type ProductType = "stars" | "premium_3" | "premium_6" | "premium_12";

/** 1234567 -> "1 234 567" */
export function formatAmount(n: number): string {
  return Number(n || 0).toLocaleString("en-US").replace(/,/g, " ");
}

export function typeLabel(t: ProductType): string {
  if (t === "stars") return "Telegram Stars";
  return `Telegram Premium · ${t.replace("premium_", "")} oy`;
}

export function typeIcon(t: ProductType): "star" | "premium" {
  return t === "stars" ? "star" : "premium";
}

/** UI status vocabulary kept from the original mock UI. */
export type UiOrderStatus = "active" | "paid" | "delivered" | "expired";

/** Maps the database order status onto the badge vocabulary the UI renders. */
export function uiStatus(status: string): UiOrderStatus {
  switch (status) {
    case "awaiting_payment":
    case "draft":
      return "active";
    case "processing":
      return "paid";
    case "completed":
      return "delivered";
    default:
      return "expired";
  }
}
