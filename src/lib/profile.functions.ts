import { createServerFn } from "@tanstack/react-start";

export interface ApiProfile {
  userId: string;
  telegramId: string;
  name: string;
  username: string | null;
  photoUrl: string | null;
  points: number;
  lifetimeStars: number;
  totalOrders: number;
  completedOrders: number;
  premiumOrders: number;
  premiumMonths: number;
  totalSpentUzs: number;
  level: { key: string; name: string; emoji: string; multiplier: number; threshold: number; gradient: string };
  nextLevel: { key: string; name: string; emoji: string; threshold: number } | null;
  progressToNext: number;
}

export const getMyProfile = createServerFn({ method: "GET" }).handler(async (): Promise<ApiProfile> => {
  const core = await import("./server/core.server");
  const user = await core.requireUser();

  const [{ data: points }, { data: progress }, { data: levels }, { data: orders }] = await Promise.all([
    core.db.rpc("user_points", { _user_id: user.id }),
    core.db.rpc("user_progress_value", { _user_id: user.id }),
    core.db.from("loyalty_levels").select("*").order("sort_order"),
    core.db.from("orders").select("status, amount_uzs, product_type, quantity").eq("user_id", user.id),
  ]);

  const lifetime = Number(progress ?? 0);
  const sorted = levels ?? [];
  const current = [...sorted].reverse().find((l) => lifetime >= l.threshold) ?? sorted[0];
  const next = sorted.find((l) => l.threshold > lifetime) ?? null;
  const span = next ? next.threshold - (current?.threshold ?? 0) : 0;
  const progressToNext = next && span > 0 ? Math.min(100, ((lifetime - (current?.threshold ?? 0)) / span) * 100) : 100;

  const rows = orders ?? [];
  const completed = rows.filter((o) => o.status === "completed");

  return {
    userId: user.id,
    telegramId: String(user.telegram_id),
    name: [user.first_name, user.last_name].filter(Boolean).join(" ") || `@${user.username ?? user.telegram_id}`,
    username: user.username,
    photoUrl: user.photo_url,
    points: Number(points ?? 0),
    lifetimeStars: lifetime,
    totalOrders: rows.length,
    completedOrders: completed.length,
    premiumOrders: completed.filter((o) => o.product_type !== "stars").length,
    premiumMonths: completed
      .filter((o) => o.product_type !== "stars")
      .reduce((sum, o) => sum + o.quantity, 0),
    totalSpentUzs: completed.reduce((sum, o) => sum + o.amount_uzs, 0),
    level: {
      key: current?.key ?? "bronze",
      name: current?.name ?? "Bronze",
      emoji: current?.emoji ?? "🥉",
      multiplier: Number(current?.multiplier ?? 1),
      threshold: current?.threshold ?? 0,
      gradient: current?.gradient ?? "",
    },
    nextLevel: next ? { key: next.key, name: next.name, emoji: next.emoji, threshold: next.threshold } : null,
    progressToNext,
  };
});
