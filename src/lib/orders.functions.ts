import { createServerFn } from "@tanstack/react-start";

export type ApiProductType = "stars" | "premium_3" | "premium_6" | "premium_12";
export type ApiOrderStatus =
  | "draft"
  | "awaiting_payment"
  | "processing"
  | "completed"
  | "cancelled"
  | "expired";
export type ApiPaymentStatus = "pending" | "submitted" | "verified" | "rejected";

export interface ApiOrder {
  id: string;
  orderNo: number;
  recipientUsername: string;
  productType: ApiProductType;
  quantity: number;
  unitPriceUzs: number;
  amountUzs: number;
  status: ApiOrderStatus;
  paymentStatus: ApiPaymentStatus | null;
  rejectReason: string | null;
  createdAt: string;
  expiresAt: string;
  completedAt: string | null;
}

/** Server-side price + validity rules. The client price is never trusted. */
export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((input: { recipientUsername: string; productType: ApiProductType; quantity: number }) => {
    const username = String(input.recipientUsername ?? "").trim().replace(/^@/, "");
    if (!/^[a-zA-Z][a-zA-Z0-9_]{2,31}$/.test(username)) throw new Error("invalid_username");
    const allowed: ApiProductType[] = ["stars", "premium_3", "premium_6", "premium_12"];
    if (!allowed.includes(input.productType)) throw new Error("invalid_product");
    const quantity = Math.floor(Number(input.quantity));
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("invalid_quantity");
    return { recipientUsername: username, productType: input.productType, quantity };
  })
  .handler(async ({ data }): Promise<ApiOrder> => {
    const core = await import("./server/core.server");
    const user = await core.requireUser();
    const pricing = await core.getSetting("pricing", core.DEFAULT_PRICING);
    const paymentCfg = await core.getSetting("payment", core.DEFAULT_PAYMENT);

    let unitPrice: number;
    let quantity = data.quantity;
    if (data.productType === "stars") {
      if (quantity < pricing.minStars || quantity > pricing.maxStars) throw new core.AppError("invalid_quantity");
      unitPrice = pricing.starPriceUzs;
    } else {
      const months = Number(data.productType.replace("premium_", ""));
      quantity = months;
      unitPrice = pricing.premium[String(months)] ?? 0;
      if (!unitPrice) throw new core.AppError("invalid_product");
    }

    const baseAmount = unitPrice * (data.productType === "stars" ? quantity : 1);
    const expiresAt = new Date(Date.now() + paymentCfg.orderExpireMinutes * 60_000).toISOString();

    // Unique payable amount so manual transfers can be matched. Retries on collision.
    for (let attempt = 0; attempt < 40; attempt++) {
      const amount = baseAmount + 1 + Math.floor(Math.random() * 200);
      const { data: row, error } = await core.db
        .from("orders")
        .insert({
          user_id: user.id,
          recipient_username: data.recipientUsername,
          product_type: data.productType,
          quantity,
          unit_price_uzs: unitPrice,
          base_amount_uzs: baseAmount,
          amount_uzs: amount,
          status: "awaiting_payment",
          expires_at: expiresAt,
        })
        .select()
        .single();

      if (!error && row) {
        return {
          id: row.id,
          orderNo: row.order_no,
          recipientUsername: row.recipient_username,
          productType: row.product_type,
          quantity: row.quantity,
          unitPriceUzs: row.unit_price_uzs,
          amountUzs: row.amount_uzs,
          status: row.status,
          paymentStatus: null,
          rejectReason: null,
          createdAt: row.created_at,
          expiresAt: row.expires_at,
          completedAt: row.completed_at,
        };
      }
      if (error && error.code !== "23505") throw new core.AppError("order_create_failed");
    }
    throw new core.AppError("order_create_failed");
  });

export const listMyOrders = createServerFn({ method: "GET" }).handler(async (): Promise<ApiOrder[]> => {
  const core = await import("./server/core.server");
  const user = await core.requireUser();
  await core.db.rpc("expire_stale_orders");

  const { data, error } = await core.db
    .from("orders")
    .select("*, payments(status, reject_reason, created_at)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new core.AppError("orders_read_failed");

  return (data ?? []).map((row) => {
    const payments = (row.payments ?? []) as { status: ApiPaymentStatus; reject_reason: string | null; created_at: string }[];
    const latest = [...payments].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
    return {
      id: row.id,
      orderNo: row.order_no,
      recipientUsername: row.recipient_username,
      productType: row.product_type,
      quantity: row.quantity,
      unitPriceUzs: row.unit_price_uzs,
      amountUzs: row.amount_uzs,
      status: row.status,
      paymentStatus: latest?.status ?? null,
      rejectReason: latest?.reject_reason ?? null,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      completedAt: row.completed_at,
    };
  });
});

export const getMyOrder = createServerFn({ method: "POST" })
  .inputValidator((input: { orderId: string }) => ({ orderId: String(input.orderId) }))
  .handler(async ({ data }): Promise<ApiOrder | null> => {
    const core = await import("./server/core.server");
    const user = await core.requireUser();
    await core.db.rpc("expire_stale_orders");

    const { data: row } = await core.db
      .from("orders")
      .select("*, payments(status, reject_reason, created_at)")
      .eq("id", data.orderId)
      .eq("user_id", user.id) // ownership is enforced server-side
      .maybeSingle();
    if (!row) return null;

    const payments = (row.payments ?? []) as { status: ApiPaymentStatus; reject_reason: string | null; created_at: string }[];
    const latest = [...payments].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0];
    return {
      id: row.id,
      orderNo: row.order_no,
      recipientUsername: row.recipient_username,
      productType: row.product_type,
      quantity: row.quantity,
      unitPriceUzs: row.unit_price_uzs,
      amountUzs: row.amount_uzs,
      status: row.status,
      paymentStatus: latest?.status ?? null,
      rejectReason: latest?.reject_reason ?? null,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      completedAt: row.completed_at,
    };
  });

export const cancelOrder = createServerFn({ method: "POST" })
  .inputValidator((input: { orderId: string }) => ({ orderId: String(input.orderId) }))
  .handler(async ({ data }) => {
    const core = await import("./server/core.server");
    const user = await core.requireUser();

    const { data: row } = await core.db
      .from("orders")
      .select("id, status")
      .eq("id", data.orderId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!row) throw new core.AppError("order_not_found");
    if (row.status !== "awaiting_payment") throw new core.AppError("order_not_cancellable");

    const { error } = await core.db
      .from("orders")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancel_reason: "user_cancelled" })
      .eq("id", row.id)
      .eq("user_id", user.id);
    if (error) throw new core.AppError("order_cancel_failed");
    return { ok: true };
  });
