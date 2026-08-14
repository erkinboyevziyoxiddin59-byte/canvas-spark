import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Gift } from "lucide-react";
import { AppHeader } from "../components/AppHeader";
import { Progress } from "../components/StatBits";
import { formatAmount } from "../lib/mock-store";
import { useT } from "../lib/language";
import {
  STATUS_LABELS,
  getLoyaltyStats,
  redeemReward,
  type LoyaltyStats,
} from "../lib/loyalty";

export const Route = createFileRoute("/points")({
  head: () => ({
    meta: [
      { title: "Star Points va darajalar — Starbbot" },
      {
        name: "description",
        content: "Star Points balansi, mukofotlar, darajalar va ballar tarixi.",
      },
      { property: "og:title", content: "Star Points va darajalar — Starbbot" },
      {
        property: "og:description",
        content: "Star Points balansi, mukofotlar, darajalar va ballar tarixi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PointsPage,
});

function PointsPage() {
  const t = useT();
  const [stats, setStats] = useState<LoyaltyStats | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setStats(getLoyaltyStats());
    refresh();
    window.addEventListener("orders:changed", refresh);
    return () => window.removeEventListener("orders:changed", refresh);
  }, []);

  const claim = useCallback((rewardId: string) => {
    const res = redeemReward(rewardId);
    setStats(getLoyaltyStats());
    setToast(
      res.ok
        ? t.requestCreated
        : res.reason === "cooldown"
          ? t.cooldown
          : t.redeemNeed(""),
    );
    setTimeout(() => setToast(null), 2600);
  }, [t]);

  return (
    <>
      <AppHeader title={`⭐ ${t.starPoints}`} />
      <main className="px-4 pb-8 pt-4">
        {!stats ? (
          <div className="h-64 animate-pulse rounded-2xl bg-card" />
        ) : (
          <>
            {/* Balance + rewards */}
            <section className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-end justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  ⭐ {t.starPoints}
                </p>
                <p className="text-2xl font-bold leading-none">{formatAmount(stats.points)}</p>
              </div>
              <Progress value={stats.rewardProgress} />
              <p className="mt-2 text-xs text-muted-foreground">
                {stats.nextReward && stats.pointsToNextReward > 0 ? (
                  <>
                    <span className="font-semibold text-foreground">
                      {formatAmount(stats.pointsToNextReward)}
                    </span>{" "}
                    {t.pointsUntil("", stats.nextReward.stars)}
                  </>
                ) : (
                  t.rewardUnlocked(stats.nextReward?.stars ?? 0)
                )}
              </p>

              <div className="mt-4 grid gap-2">
                {[...stats.settings.rewards]
                  .sort((a, b) => a.cost - b.cost)
                  .map((r) => (
                    <button
                      key={r.id}
                      onClick={() => claim(r.id)}
                      disabled={stats.points < r.cost}
                      className="no-tap-highlight flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold btn-primary-glow disabled:opacity-40"
                    >
                      <Gift className="h-4 w-4" />
                      {t.redeem(formatAmount(r.cost), r.stars)}
                    </button>
                  ))}
              </div>
              {toast && <p className="mt-2 text-center text-[11px] text-muted-foreground">{toast}</p>}
            </section>

            {/* Reward requests */}
            <section className="mt-5">
              <h3 className="mb-2 text-sm font-semibold">{t.rewards}</h3>
              <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                {stats.requests.length === 0 ? (
                  <p className="px-4 py-4 text-xs text-muted-foreground">{t.noRewards}</p>
                ) : (
                  stats.requests.map((r) => (
                    <div key={r.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold">{r.stars} Stars</p>
                        <p className="text-[11px] text-muted-foreground">
                          −{formatAmount(r.cost)} {t.points} · #{r.id}
                        </p>
                      </div>
                      <span className="text-xs font-medium">
                        {STATUS_LABELS[r.status].dot} {t[STATUS_LABELS[r.status].key]}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Level ladder */}
            <section className="mt-5">
              <h3 className="mb-2 text-sm font-semibold">{t.levels}</h3>
              <div className="rounded-2xl border border-border bg-card p-2">
                {stats.settings.levels.map((l) => {
                  const active = l.key === stats.level.key;
                  const reached = stats.progressValue >= l.threshold;
                  return (
                    <div
                      key={l.key}
                      className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${active ? "bg-secondary" : ""}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={reached ? "" : "opacity-40"}>{l.emoji}</span>
                        <span className={`text-sm font-medium ${reached ? "" : "text-muted-foreground"}`}>
                          {l.name}
                        </span>
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary-glow">
                          ×{l.multiplier}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {l.threshold === 0 ? "0" : formatAmount(l.threshold)}
                      </span>
                    </div>
                  );
                })}
              </div>
              {stats.next && (
                <>
                  <Progress value={stats.levelProgress} />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t.nextLevel}: {stats.next.emoji} {stats.next.name} —{" "}
                    <span className="font-semibold text-foreground">
                      {formatAmount(stats.toNextLevel)}
                    </span>{" "}
                    {t.remaining("")}
                  </p>
                </>
              )}
            </section>

            {/* Points history */}
            <section className="mt-5">
              <h3 className="mb-2 text-sm font-semibold">{t.history}</h3>
              <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                {stats.ledger.slice(0, 12).map((e) => (
                  <div key={e.id} className="flex items-center justify-between px-4 py-2.5">
                    <span className="mr-3 truncate text-xs text-muted-foreground">{e.note}</span>
                    <span
                      className={`text-sm font-semibold ${e.points >= 0 ? "text-success" : "text-muted-foreground"}`}
                    >
                      {e.points >= 0 ? "+" : "−"}
                      {formatAmount(Math.abs(e.points))}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}
