import { createServerFn } from "@tanstack/react-start";

export interface ApiLevel {
  key: string;
  name: string;
  emoji: string;
  threshold: number;
  multiplier: number;
  stars: number;
  gradient: string;
}

export interface ApiReward {
  id: string;
  cost: number;
  stars: number;
}

export interface ApiLedgerEntry {
  id: string;
  createdAt: string;
  type: "earn" | "referral" | "mission" | "redeem" | "refund" | "adjust";
  points: number;
  note: string;
}

export interface ApiRewardRequest {
  id: string;
  requestNo: number;
  createdAt: string;
  updatedAt: string;
  cost: number;
  stars: number;
  levelName: string | null;
  levelEmoji: string | null;
  status: "pending" | "approved" | "completed" | "rejected";
}

export const getLoyaltyConfig = createServerFn({ method: "GET" }).handler(async () => {
  const core = await import("./server/core.server");
  const [{ data: levels }, { data: rewards }, loyalty] = await Promise.all([
    core.db.from("loyalty_levels").select("*").order("sort_order"),
    core.db.from("rewards").select("*").eq("active", true).order("cost_points"),
    core.getSetting("loyalty", core.DEFAULT_LOYALTY),
  ]);
  return {
    levels: (levels ?? []).map<ApiLevel>((l) => ({
      key: l.key,
      name: l.name,
      emoji: l.emoji,
      threshold: l.threshold,
      multiplier: Number(l.multiplier),
      stars: l.stars,
      gradient: l.gradient,
    })),
    rewards: (rewards ?? []).map<ApiReward>((r) => ({ id: r.id, cost: r.cost_points, stars: r.output_stars })),
    settings: loyalty,
  };
});

export const getMyLedger = createServerFn({ method: "GET" }).handler(async (): Promise<ApiLedgerEntry[]> => {
  const core = await import("./server/core.server");
  const user = await core.requireUser();
  const { data } = await core.db
    .from("points_ledger")
    .select("id, created_at, type, points, note")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []).map((e) => ({
    id: e.id,
    createdAt: e.created_at,
    type: e.type,
    points: e.points,
    note: e.note,
  }));
});

export const getMyRewardRequests = createServerFn({ method: "GET" }).handler(
  async (): Promise<ApiRewardRequest[]> => {
    const core = await import("./server/core.server");
    const user = await core.requireUser();
    const { data } = await core.db
      .from("reward_requests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    return (data ?? []).map((r) => ({
      id: r.id,
      requestNo: r.request_no,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      cost: r.cost_points,
      stars: r.output_stars,
      levelName: r.level_name,
      levelEmoji: r.level_emoji,
      status: r.status,
    }));
  },
);

/** Atomic: balance check, points debit and reward request in a single transaction. */
export const redeemReward = createServerFn({ method: "POST" })
  .inputValidator((input: { rewardId: string }) => ({ rewardId: String(input.rewardId) }))
  .handler(async ({ data }) => {
    const core = await import("./server/core.server");
    const user = await core.requireUser();
    const { data: req, error } = await core.db.rpc("redeem_reward", {
      _user_id: user.id,
      _reward_id: data.rewardId,
    });
    if (error) {
      const msg = error.message || "";
      const code = ["insufficient", "cooldown", "unknown_reward"].find((c) => msg.includes(c));
      throw new core.AppError(code ?? "redeem_failed");
    }
    return { ok: true, requestId: (req as { id: string } | null)?.id ?? null };
  });
