import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Link2, Send } from "lucide-react";
import { AppHeader } from "../components/AppHeader";
import { MiniStat } from "../components/StatBits";
import { formatAmount } from "../lib/format";
import { useT } from "../lib/language";
import { getMyReferrals, type ApiReferralSummary } from "../lib/referrals.functions";

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

function shareReferralLink(link: string, text: string) {
  const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
  const tg = (window as unknown as { Telegram?: { WebApp?: { openTelegramLink?: (u: string) => void } } }).Telegram
    ?.WebApp;
  if (tg?.openTelegramLink) tg.openTelegramLink(url);
  else window.open(url, "_blank", "noopener");
}

function ReferralPage() {
  const t = useT();
  const [copied, setCopied] = useState(false);

  const refQuery = useQuery<ApiReferralSummary>({
    queryKey: ["referrals"],
    queryFn: () => getMyReferrals(),
  });
  const data = refQuery.data;

  const copyLink = useCallback(() => {
    if (!data) return;
    navigator.clipboard?.writeText(data.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }, [data]);

  return (
    <>
      <AppHeader title={t.referral} />
      <main className="px-4 pb-8 pt-4">
        {refQuery.isLoading ? (
          <div className="h-64 animate-pulse rounded-2xl bg-card" />
        ) : refQuery.error || !data ? (
          <div className="mt-10 text-center">
            <p className="text-sm text-muted-foreground">{(refQuery.error as Error | null)?.message ?? "—"}</p>
            <button
              onClick={() => refQuery.refetch()}
              className="mt-4 rounded-full px-5 py-2.5 text-sm font-semibold btn-primary-glow no-tap-highlight"
            >
              {t.retry}
            </button>
          </div>
        ) : (
          <>
            <section className="rounded-2xl border border-border bg-card p-4">
              <h2 className="text-sm font-semibold">{t.referralLink}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{t.referralIntro(data.pointsPerReferral)}</p>

              <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-input px-3 py-2">
                <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-xs">{data.link}</span>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  onClick={() => shareReferralLink(data.link, t.shareText)}
                  className="no-tap-highlight flex items-center justify-center gap-2 rounded-full py-2.5 text-xs font-semibold btn-primary-glow"
                >
                  <Send className="h-4 w-4" />
                  {t.shareTelegram}
                </button>
                <button
                  onClick={copyLink}
                  className="no-tap-highlight flex items-center justify-center gap-2 rounded-full border border-border py-2.5 text-xs font-semibold"
                >
                  {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  {t.copyLink}
                </button>
              </div>

              <div className="mt-3 flex items-center justify-between rounded-xl border border-border bg-input px-3 py-2">
                <span className="text-xs text-muted-foreground">{t.referralCode}</span>
                <span className="text-sm font-semibold">{data.code}</span>
              </div>
            </section>

            <section className="mt-4 grid grid-cols-3 gap-2 text-center">
              <MiniStat label={t.invited} value={String(data.total)} />
              <MiniStat label={t.purchased} value={String(data.qualified)} />
              <MiniStat label={t.earned} value={formatAmount(data.pointsEarned)} />
            </section>

            <section className="mt-5">
              <h3 className="mb-2 text-sm font-semibold">{t.invited}</h3>
              <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                {data.entries.length === 0 ? (
                  <p className="px-4 py-4 text-xs text-muted-foreground">{t.noFriends}</p>
                ) : (
                  data.entries.map((f) => (
                    <div key={f.id} className="flex items-center justify-between px-4 py-3">
                      <span className="min-w-0 truncate text-sm">{f.name}</span>
                      <span className="ml-3 shrink-0 text-[11px] font-medium">
                        {f.status === "rewarded"
                          ? `${t.friendAwarded} +${formatAmount(f.pointsAwarded)}`
                          : t.friendPending}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}
