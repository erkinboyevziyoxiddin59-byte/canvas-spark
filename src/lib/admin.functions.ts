import { createServerFn } from "@tanstack/react-start";

export interface AdminOrderRow {
  id: string;
  orderNo: number;
  createdAt: string;
  user: { id: string; telegramId: string; name: string; username: string | null };
  recipientUsername: string;
  productType: string;
  quantity: number;
  amountUzs: number;
  status: string;
  paymentId: string | null;
  paymentStatus: string | null;
  payerNote: string | null;
}

export interface AdminRequestRow {
  id: string;
  requestNo: number;
  createdAt: string;
  user: { id: string; telegramId: string; name: string; username: string | null };
  cost: number;
  stars: number;
  status: string;
}

export interface AdminUserRow {
  id: string;
  telegramId: string;
  name: string;
  username: string | null;
  points: number;
  isBlocked: boolean;
  isAdmin: boolean;
  createdAt: string;
  lastSeenAt: string | null;
}

function displayName(u: { first_name: string | null; last_name: string | null; username: string | null; telegram_id: number }) {
  return [u.first_name, u.last_name].filter(Boolean).join(" ") || `@${u.username ?? u.telegram_id}`;
}

export const getAdminStats = createServerFn({ method: "GET" }).handler(async () => {
  const core = await import("./server/core.server");
  await core.requireAdmin();
  await core.db.rpc("expire_stale_orders");

  const [users, orders, pendingPayments, pendingRequests] = await Promise.all([
    core.db.from("users").select("id", { count: "exact", head: true }),
    core.db.from("orders").select("status, amount_uzs"),
    core.db.from("payments").select("id", { count: "exact", head: true }).eq("status", "submitted"),
    core.db.from("reward_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  const rows = orders.data ?? [];
  const completed = rows.filter((o) => o.status === "completed");
  return {
    totalUsers: users.count ?? 0,
    totalOrders: rows.length,
    completedOrders: completed.length,
    revenueUzs: completed.reduce((s, o) => s + o.amount_uzs, 0),
    pendingPayments: pendingPayments.count ?? 0,
    pendingRequests: pendingRequests.count ?? 0,
  };
});

export const listAdminOrders = createServerFn({ method: "POST" })
  .inputValidator((input: { status?: string | null; search?: string | null; limit?: number }) => ({
    status: input.status ?? null,
    search: input.search ? String(input.search).slice(0, 64) : null,
    limit: Math.min(Math.max(Number(input.limit ?? 100), 1), 200),
  }))
  .handler(async ({ data }): Promise<AdminOrderRow[]> => {
    const core = await import("./server/core.server");
    await core.requireAdmin();
    await core.db.rpc("expire_stale_orders");

    let query = core.db
      .from("orders")
      .select("*, users!orders_user_id_fkey(id, telegram_id, first_name, last_name, username), payments(id, status, payer_note, created_at)")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.status) query = query.eq("status", data.status as never);
    if (data.search) query = query.ilike("recipient_username", `%${data.search.replace(/^@/, "")}%`);

    const { data: rows, error } = await query;
    if (error) throw new core.AppError("orders_read_failed");

    return (rows ?? []).map((row) => {
      const u = row.users as unknown as { id: string; telegram_id: number; first_name: string | null; last_name: string | null; username: string | null };
      const payments = ((row.payments ?? []) as { id: string; status: string; payer_note: string | null; created_at: string }[]).sort(
        (a, b) => (a.created_at < b.created_at ? 1 : -1),
      );
      const latest = payments[0];
      return {
        id: row.id,
        orderNo: row.order_no,
        createdAt: row.created_at,
        user: { id: u.id, telegramId: String(u.telegram_id), name: displayName(u), username: u.username },
        recipientUsername: row.recipient_username,
        productType: row.product_type,
        quantity: row.quantity,
        amountUzs: row.amount_uzs,
        status: row.status,
        paymentId: latest?.id ?? null,
        paymentStatus: latest?.status ?? null,
        payerNote: latest?.payer_note ?? null,
      };
    });
  });

/** Verifies a manual transfer and completes the order atomically (points, level, referral). */
export const verifyPayment = createServerFn({ method: "POST" })
  .inputValidator((input: { paymentId: string }) => ({ paymentId: String(input.paymentId) }))
  .handler(async ({ data }) => {
    const core = await import("./server/core.server");
    const admin = await core.requireAdmin();

    const { data: payment } = await core.db
      .from("payments")
      .select("id, order_id, status")
      .eq("id", data.paymentId)
      .maybeSingle();
    if (!payment) throw new core.AppError("payment_not_found");
    if (payment.status === "verified") return { ok: true, already: true };

    const { error: upErr } = await core.db
      .from("payments")
      .update({ status: "verified", verified_at: new Date().toISOString(), verified_by: admin.id, reject_reason: null })
      .eq("id", payment.id)
      .eq("status", "submitted");
    if (upErr) throw new core.AppError("payment_verify_failed");

    const { error } = await core.db.rpc("complete_order", { _order_id: payment.order_id, _actor: admin.id });
    if (error) throw new core.AppError("order_complete_failed");

    await core.audit(admin.id, "payment.verify", "payments", payment.id, { order_id: payment.order_id });
    return { ok: true, already: false };
  });

export const rejectPayment = createServerFn({ method: "POST" })
  .inputValidator((input: { paymentId: string; reason?: string | null }) => ({
    paymentId: String(input.paymentId),
    reason: input.reason ? String(input.reason).slice(0, 300) : null,
  }))
  .handler(async ({ data }) => {
    const core = await import("./server/core.server");
    const admin = await core.requireAdmin();

    const { data: payment } = await core.db
      .from("payments")
      .select("id, order_id, status")
      .eq("id", data.paymentId)
      .maybeSingle();
    if (!payment) throw new core.AppError("payment_not_found");
    if (payment.status === "verified") throw new core.AppError("payment_already_verified");

    await core.db
      .from("payments")
      .update({ status: "rejected", reject_reason: data.reason, verified_by: admin.id })
      .eq("id", payment.id);
    await core.db
      .from("orders")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancel_reason: data.reason ?? "payment_rejected" })
      .eq("id", payment.order_id)
      .neq("status", "completed");

    await core.audit(admin.id, "payment.reject", "payments", payment.id, { reason: data.reason });
    return { ok: true };
  });

export const listAdminRequests = createServerFn({ method: "POST" })
  .inputValidator((input: { status?: string | null }) => ({ status: input.status ?? null }))
  .handler(async ({ data }): Promise<AdminRequestRow[]> => {
    const core = await import("./server/core.server");
    await core.requireAdmin();

    let query = core.db
      .from("reward_requests")
      .select("*, users!reward_requests_user_id_fkey(id, telegram_id, first_name, last_name, username)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status) query = query.eq("status", data.status as never);

    const { data: rows } = await query;
    return (rows ?? []).map((r) => {
      const u = r.users as unknown as { id: string; telegram_id: number; first_name: string | null; last_name: string | null; username: string | null };
      return {
        id: r.id,
        requestNo: r.request_no,
        createdAt: r.created_at,
        user: { id: u.id, telegramId: String(u.telegram_id), name: displayName(u), username: u.username },
        cost: r.cost_points,
        stars: r.output_stars,
        status: r.status,
      };
    });
  });

export const updateRewardRequest = createServerFn({ method: "POST" })
  .inputValidator((input: { requestId: string; action: "approve" | "complete" | "reject"; reason?: string | null }) => {
    if (!["approve", "complete", "reject"].includes(input.action)) throw new Error("invalid_action");
    return {
      requestId: String(input.requestId),
      action: input.action,
      reason: input.reason ? String(input.reason).slice(0, 300) : null,
    };
  })
  .handler(async ({ data }) => {
    const core = await import("./server/core.server");
    const admin = await core.requireAdmin();

    if (data.action === "reject") {
      // Refunds the spent points in the same transaction.
      const { error } = await core.db.rpc("reject_reward_request", {
        _request_id: data.requestId,
        _actor: admin.id,
        _reason: data.reason ?? "rejected",
      });
      if (error) throw new core.AppError("request_reject_failed");
    } else {
      const { error } = await core.db
        .from("reward_requests")
        .update({ status: data.action === "approve" ? "approved" : "completed", handled_by: admin.id })
        .eq("id", data.requestId)
        .in("status", data.action === "approve" ? ["pending"] : ["pending", "approved"]);
      if (error) throw new core.AppError("request_update_failed");
    }

    await core.audit(admin.id, `reward_request.${data.action}`, "reward_requests", data.requestId, {
      reason: data.reason,
    });
    return { ok: true };
  });

export const listAdminUsers = createServerFn({ method: "POST" })
  .inputValidator((input: { search?: string | null }) => ({
    search: input.search ? String(input.search).slice(0, 64) : null,
  }))
  .handler(async ({ data }): Promise<AdminUserRow[]> => {
    const core = await import("./server/core.server");
    await core.requireAdmin();

    let query = core.db.from("users").select("*").order("created_at", { ascending: false }).limit(200);
    if (data.search) {
      const term = data.search.replace(/^@/, "");
      query = query.or(`username.ilike.%${term}%,first_name.ilike.%${term}%,telegram_id.eq.${Number(term) || 0}`);
    }
    const { data: rows } = await query;
    const ids = (rows ?? []).map((u) => u.id);
    const { data: roles } = await core.db.from("user_roles").select("user_id, role").in("user_id", ids);
    const adminIds = new Set((roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id));

    const points = await Promise.all(
      (rows ?? []).map((u) => core.db.rpc("user_points", { _user_id: u.id }).then((res) => Number(res.data ?? 0))),
    );

    return (rows ?? []).map((u, i) => ({
      id: u.id,
      telegramId: String(u.telegram_id),
      name: displayName(u),
      username: u.username,
      points: points[i] ?? 0,
      isBlocked: u.is_blocked,
      isAdmin: adminIds.has(u.id),
      createdAt: u.created_at,
      lastSeenAt: u.last_seen_at,
    }));
  });

export const setUserBlocked = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string; blocked: boolean }) => ({
    userId: String(input.userId),
    blocked: Boolean(input.blocked),
  }))
  .handler(async ({ data }) => {
    const core = await import("./server/core.server");
    const admin = await core.requireAdmin();
    if (data.userId === admin.id) throw new core.AppError("cannot_block_self");

    await core.db.from("users").update({ is_blocked: data.blocked }).eq("id", data.userId);
    await core.audit(admin.id, data.blocked ? "user.block" : "user.unblock", "users", data.userId, {});
    return { ok: true };
  });

export const adjustUserPoints = createServerFn({ method: "POST" })
  .inputValidator((input: { userId: string; points: number; note?: string | null }) => {
    const points = Math.trunc(Number(input.points));
    if (!Number.isFinite(points) || points === 0) throw new Error("invalid_points");
    return { userId: String(input.userId), points, note: input.note ? String(input.note).slice(0, 200) : null };
  })
  .handler(async ({ data }) => {
    const core = await import("./server/core.server");
    const admin = await core.requireAdmin();

    const { error } = await core.db.from("points_ledger").insert({
      user_id: data.userId,
      type: "adjust",
      points: data.points,
      note: data.note ?? "admin adjustment",
    });
    if (error) throw new core.AppError("adjust_failed");
    await core.audit(admin.id, "points.adjust", "users", data.userId, { points: data.points, note: data.note });
    return { ok: true };
  });

export const getAdminSettings = createServerFn({ method: "GET" }).handler(async () => {
  const core = await import("./server/core.server");
  await core.requireAdmin();
  const { data } = await core.db.from("app_settings").select("key, value");
  const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
  return {
    pricing: (map["pricing"] as unknown as typeof core.DEFAULT_PRICING) ?? core.DEFAULT_PRICING,
    payment: (map["payment"] as unknown as typeof core.DEFAULT_PAYMENT) ?? core.DEFAULT_PAYMENT,
    loyalty: (map["loyalty"] as unknown as typeof core.DEFAULT_LOYALTY) ?? core.DEFAULT_LOYALTY,
    maintenance: (map["maintenance"] as unknown as typeof core.DEFAULT_MAINTENANCE) ?? core.DEFAULT_MAINTENANCE,
  };
});

export const updateAdminSetting = createServerFn({ method: "POST" })
  .inputValidator((input: { key: string; value: unknown }) => {
    const allowed = ["pricing", "payment", "loyalty", "maintenance", "bot"];
    if (!allowed.includes(input.key)) throw new Error("invalid_setting");
    return { key: input.key, value: input.value };
  })
  .handler(async ({ data }) => {
    const core = await import("./server/core.server");
    const admin = await core.requireAdmin();
    const { error } = await core.db
      .from("app_settings")
      .upsert({ key: data.key, value: data.value as never, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw new core.AppError("settings_update_failed");
    await core.audit(admin.id, "settings.update", "app_settings", data.key, { value: data.value as never });
    return { ok: true };
  });

export const listAuditLog = createServerFn({ method: "GET" }).handler(async () => {
  const core = await import("./server/core.server");
  await core.requireAdmin();
  const { data } = await core.db
    .from("admin_audit_log")
    .select("*, users!admin_audit_log_actor_id_fkey(first_name, last_name, username, telegram_id)")
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []).map((r) => {
    const u = r.users as unknown as { first_name: string | null; last_name: string | null; username: string | null; telegram_id: number } | null;
    return {
      id: r.id,
      createdAt: r.created_at,
      actor: u ? displayName(u) : "system",
      action: r.action,
      entity: r.entity,
      entityId: r.entity_id,
      payload: r.payload,
    };
  });
});
