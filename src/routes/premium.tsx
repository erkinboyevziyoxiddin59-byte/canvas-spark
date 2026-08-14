import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Crown, AtSign, Check } from "lucide-react";
import { AppHeader } from "../components/AppHeader";
import { useTelegramUser } from "../hooks/useTelegramUser";
import { createOrder, formatAmount } from "../lib/mock-store";
import { usePricing } from "../hooks/usePricing";
import { useT } from "../lib/language";

export const Route = createFileRoute("/premium")({
  head: () => ({
    meta: [
      { title: "Premium sotib olish — Starbbot" },
      { name: "description", content: "Telegram Premium 3, 6 yoki 12 oyga." },
    ],
  }),
  component: PremiumPage,
});

const PLANS: { months: 3 | 6 | 12; badge?: "badgePopular" | "badgeBest" }[] = [
  { months: 3 },
  { months: 6, badge: "badgePopular" },
  { months: 12, badge: "badgeBest" },
];

function PremiumPage() {
  const navigate = useNavigate();
  const t = useT();
  const [username, setUsername] = useState("");
  const tg = useTelegramUser();
  const [months, setMonths] = useState<3 | 6 | 12>(6);
  const pricing = usePricing();

  const cleanUsername = username.trim().replace(/^@/, "");
  const validUsername = /^[a-zA-Z][a-zA-Z0-9_]{2,31}$/.test(cleanUsername);
  const price = pricing.premium[months];

  const submit = () => {
    if (!validUsername) return;
    const order = createOrder({
      targetUsername: cleanUsername,
      type: `premium_${months}` as const,
      quantity: months,
      basePrice: price,
    });
    navigate({ to: "/payment/$orderId", params: { orderId: String(order.id) } });
  };

  return (
    <>
      <AppHeader title={t.premiumTitle} subtitle={t.premiumSubtitle} />
      <main className="px-4 pb-8 pt-4 space-y-5">
        <section>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t.toWhoLabel}
          </label>
          <div className="relative">
            <AtSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="durov"
              className="w-full rounded-xl border border-border bg-input py-3 pl-9 pr-3 text-sm placeholder:text-muted-foreground/60 focus:border-primary-glow focus:outline-none focus:ring-2 focus:ring-primary-glow/30"
            />
          </div>
          {tg.username && (
            <button
              type="button"
              onClick={() => setUsername(tg.username!)}
              className="no-tap-highlight mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl border border-primary-glow bg-primary/25 px-4 py-3 text-sm font-bold text-foreground"
            >
              <AtSign className="h-4 w-4" />
              {t.selfButton(tg.username)}
            </button>
          )}
        </section>

        <section className="space-y-2">
          {PLANS.map((p) => {
            const active = months === p.months;
            return (
              <button
                key={p.months}
                onClick={() => setMonths(p.months)}
                className={`no-tap-highlight flex w-full items-center justify-between rounded-2xl border p-4 text-left transition ${
                  active ? "border-primary-glow bg-primary/20" : "border-border bg-card"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-white"
                    style={{ background: "var(--gradient-premium)" }}
                  >
                    <Crown className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Premium · {t.monthsLabel(p.months)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatAmount(Math.round(pricing.premium[p.months] / p.months))} UZS / {t.perMonth}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {p.badge && (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">
                      {t[p.badge]}
                    </span>
                  )}
                  <div className="text-right">
                    <p className="text-sm font-bold">{formatAmount(pricing.premium[p.months])}</p>
                    <p className="text-[10px] text-muted-foreground">UZS</p>
                  </div>
                  <div
                    className={`ml-1 flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                      active ? "border-primary-glow bg-primary-glow" : "border-border"
                    }`}
                  >
                    {active && <Check className="h-3 w-3 text-primary" strokeWidth={3} />}
                  </div>
                </div>
              </button>
            );
          })}
        </section>


        <button
          onClick={submit}
          disabled={!validUsername}
          className="w-full rounded-full py-3.5 text-sm font-semibold btn-primary-glow disabled:opacity-40 disabled:shadow-none no-tap-highlight"
        >
          {t.payAmount(formatAmount(price))}
        </button>
      </main>
    </>
  );
}
