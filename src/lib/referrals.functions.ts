import { createServerFn } from "@tanstack/react-start";

export interface ApiReferralEntry {
  id: string;
  name: string;
  joinedAt: string;
  status: "pending" | "qualified" | "rewarded";
  pointsAwarded: number;
}

export interface ApiReferralSummary {
  code: string;
  link: string;
  total: number;
  qualified: number;
  pointsEarned: number;
  pointsPerReferral: number;
  entries: ApiReferralEntry[];
}

function maskName(first: string | null, username: string | null, telegramId: number) {
  const base = first || username || `user${telegramId}`;
  return base.length <= 2 ? base : `${base.slice(0, 2)}${"*".repeat(Math.min(6, base.length - 2))}`;
}

export const getMyReferrals = createServerFn({ method: "GET" }).handler(
  async (): Promise<ApiReferralSummary> => {
    const core = await import("./server/core.server");
    const user = await core.requireUser();
    const loyalty = await core.getSetting("loyalty", core.DEFAULT_LOYALTY);
    const bot = await core.getSetting<{ username: string }>("bot", { username: "StarKerakBot" });

    const { data } = await core.db
      .from("referrals")
      .select("id, created_at, status, points_awarded, referred:users!referrals_referred_id_fkey(first_name, username, telegram_id)")
      .eq("referrer_id", user.id)
      .order("created_at", { ascending: false });

    const rows = (data ?? []) as unknown as {
      id: string;
      created_at: string;
      status: ApiReferralEntry["status"];
      points_awarded: number;
      referred: { first_name: string | null; username: string | null; telegram_id: number } | null;
    }[];

    return {
      code: user.referral_code,
      link: `https://t.me/${bot.username}?start=${user.referral_code}`,
      total: rows.length,
      qualified: rows.filter((r) => r.status !== "pending").length,
      pointsEarned: rows.reduce((sum, r) => sum + r.points_awarded, 0),
      pointsPerReferral: loyalty.referralPoints,
      entries: rows.map((r) => ({
        id: r.id,
        // Referred users' identities are masked; only the referrer's own row is theirs.
        name: maskName(r.referred?.first_name ?? null, r.referred?.username ?? null, r.referred?.telegram_id ?? 0),
        joinedAt: r.created_at,
        status: r.status,
        pointsAwarded: r.points_awarded,
      })),
    };
  },
);
