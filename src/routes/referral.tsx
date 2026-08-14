import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Link2, Send } from "lucide-react";
import { AppHeader } from "../components/AppHeader";
import { MiniStat } from "../components/StatBits";
import { useTelegramUser } from "../hooks/useTelegramUser";
import { formatAmount } from "../lib/mock-store";
import { useT } from "../lib/language";
import { getLoyaltyStats, type LoyaltyStats } from "../lib/loyalty";
import {
  captureStartParam,
  getInvitedBy,
  referralCodeFor,
  referralLink,
  shareReferralLink,
} from "../lib/referrals";

export const Route = createFileRoute("/referral")({
  head: () => ({
    meta: [
      { title: "Do‘st taklif qilish — Starbbot" },
      {
        name: "description",
        content: "Havolangizni ulashing va do‘stingiz birinchi xaridida Star Points oling.",
      },
      { property: "og:title", content: "Do‘st taklif qilish — Starbbot" },
      {
        property: "og:description",
        content: "Havolangizni ulashing va do‘stingiz birinchi xaridida Star Points oling.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReferralPage,
});

function ReferralPage() {
  const t = useT();
  const [stats, setStats] = useState<LoyaltyStats | null>(null);
  const [copied, setCopied] = useState(false);
  const tg = useTelegramUser();
  const refCode = referralCodeFor(tg.telegramId);
  const refLink = referralLink(refCode);
  const invitedBy = typeof window !== "undefined" ? getInvitedBy() : null;

  useEffect(() => {
    captureStartParam();
    const refresh = () => setStats(getLoyaltyStats());
    refresh();
    window.addEventListener("orders:changed", refresh);
    return () => window.removeEventListener("orders:changed", refresh);
  }, []);

  const copyLink = useCallback(() => {
    navigator.clipboard?.writeText(refLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }, [refLink]);

  return (
    <>
      <AppHeader title={t.referral} />
      <main className="px-4 pb-8 pt-4">
        {!stats ? (
          <div className="h-64 animate-pulse rounded-2xl bg-card" />
        ) : (
          <>
            <section className="rounded-2xl border border-border bg-card p-4">
              <h2 className="text-sm font-semibold">{t.referralLink}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {t.referralIntro(stats.settings.referralPoints)}
              </p>

              <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-input px-3 py-2">
                <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-xs">{refLink}</span>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  onClick={() => shareReferralLink(refLink, t.shareText)}
                  className="no-tap-highlight flex items-center justify-center gap-2 rounded-full py-2.5 text-xs font-semibold btn-primary-glow"
                >
                  <Send className="h-4 w-4" />
                  {t.shareTelegram}
                </button>
                <button
                  onClick={copyLink}
                  className="no-tap-highlight flex items-center justify-center gap-2 rounded-full border border-border py-2.5 text-xs font-semibold"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {t.copyLink}
                </button>
              </div>

              <div className="mt-3 flex items-center justify-between rounded-xl border border-border bg-input px-3 py-2">
                <span className="text-xs text-muted-foreground">{t.referralCode}</span>
                <span className="text-sm font-semibold">{refCode}</span>
              </div>
            </section>

            <section className="mt-4 grid grid-cols-3 gap-2 text-center">
              <MiniStat label={t.invited} value={String(stats.referralCount)} />
              <MiniStat label={t.purchased} value={String(stats.referralPurchasedCount)} />
              <MiniStat label={t.earned} value={formatAmount(stats.referralPoints)} />
            </section>

            <section className="mt-5">
              <h3 className="mb-2 text-sm font-semibold">{t.invited}</h3>
              <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                {stats.friends.length === 0 ? (
                  <p className="px-4 py-4 text-xs text-muted-foreground">{t.noFriends}</p>
                ) : (
                  stats.friends.map((f) => (
                    <div key={f.id} className="flex items-center justify-between px-4 py-3">
                      <span className="min-w-0 truncate text-sm">
                        {f.username ? `@${f.username}` : f.name}
                      </span>
                      <span className="ml-3 shrink-0 text-[11px] font-medium">
                        {f.awardedAt
                          ? `${t.friendAwarded} +${formatAmount(f.awardedPoints)}`
                          : t.friendPending}
                      </span>
                    </div>
                  ))
                )}
              </div>
              {invitedBy && (
                <p className="mt-2 text-[11px] text-muted-foreground">{t.invitedByYou(invitedBy)}</p>
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}
