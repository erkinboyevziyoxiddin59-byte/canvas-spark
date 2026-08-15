import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, AtSign } from "lucide-react";
import { AppHeader } from "../components/AppHeader";
import { useSession } from "../hooks/useSession";
import { formatAmount } from "../lib/format";
import { createOrder } from "../lib/orders.functions";
import { useAppConfig } from "../hooks/useAppConfig";
import { useT } from "../lib/language";

export const Route = createFileRoute("/stars")({
  head: () => ({
    meta: [
      { title: "Stars sotib olish — Starbbot" },
      { name: "description", content: "Telegram Stars 50 dan 5 000 gacha." },
    ],
  }),
  component: StarsPage,
});

const PRESETS = [50, 100, 250, 500, 1000, 5000];

function StarsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const t = useT();
  const [username, setUsername] = useState("");
  const { session } = useSession();
  const [qty, setQty] = useState<number>(100);
  const [custom, setCustom] = useState("");
  const { config } = useAppConfig();
  const pricing = config.pricing;
  const MAX_STARS = pricing.maxStars;
  const MIN_STARS = pricing.minStars;

  const cleanUsername = username.trim().replace(/^@/, "");
  const validUsername = /^[a-zA-Z][a-zA-Z0-9_]{2,31}$/.test(cleanUsername);
  const price = qty * pricing.starPriceUzs;

  const mutation = useMutation({
    mutationFn: () =>
      createOrder({ data: { recipientUsername: cleanUsername, productType: "stars", quantity: qty } }),
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      navigate({ to: "/payment/$orderId", params: { orderId: order.id } });
    },
  });

  const canSubmit =
    validUsername && qty >= MIN_STARS && qty <= MAX_STARS && !mutation.isPending;

  const submit = () => {
    if (!canSubmit) return;
    mutation.mutate();
  };

  return (
    <>
      <AppHeader title={t.starsTitle} subtitle={t.starsSubtitle} />
      <main className="px-4 pb-8 pt-4 space-y-5">
        {/* Username */}
        <Field label={t.toWhoLabel}>
          <div className="relative">
            <AtSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              inputMode="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="durov"
              className="w-full rounded-xl border border-border bg-input py-3 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary-glow focus:outline-none focus:ring-2 focus:ring-primary-glow/30"
            />
          </div>
          {session?.username && (
            <button
              type="button"
              onClick={() => setUsername(session.username!)}
              className="no-tap-highlight mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl border border-primary-glow bg-primary/25 px-4 py-3 text-sm font-bold text-foreground"
            >
              <AtSign className="h-4 w-4" />
              {t.selfButton(session.username)}
            </button>
          )}
          {username && !validUsername && (
            <p className="mt-1.5 text-xs text-destructive">{t.usernameInvalid}</p>
          )}
        </Field>

        {/* Preset amounts */}
        <Field label={t.howManyStars}>
          <div className="grid grid-cols-3 gap-2">
            {PRESETS.map((n) => (
              <button
                key={n}
                onClick={() => {
                  setQty(n);
                  setCustom("");
                }}
                className={`no-tap-highlight rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                  qty === n && !custom
                    ? "border-primary-glow bg-primary/30 text-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                <Star className="mx-auto mb-1 h-4 w-4" fill="currentColor" />
                {formatAmount(n)}
              </button>
            ))}
          </div>
          <div className="mt-3">
            <input
              type="number"
              min={MIN_STARS}
              max={MAX_STARS}
              value={custom}
              onChange={(e) => {
                const v = e.target.value;
                setCustom(v);
                const n = Number(v);
                if (Number.isFinite(n) && n > 0) setQty(Math.max(MIN_STARS, Math.min(MAX_STARS, Math.floor(n))));
              }}
              placeholder={t.customAmountPh}
              className="w-full rounded-xl border border-border bg-input px-3 py-3 text-sm placeholder:text-muted-foreground/60 focus:border-primary-glow focus:outline-none focus:ring-2 focus:ring-primary-glow/30"
            />
          </div>
        </Field>

        {/* Summary */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <Row label={t.quantity} value={<span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5" fill="currentColor" />{formatAmount(qty)}</span>} />
          <Row label={t.starUnitPrice} value={`${formatAmount(pricing.starPriceUzs)} UZS`} />
          <div className="my-3 h-px bg-border" />
          <Row
            label={<span className="text-foreground">{t.total}</span>}
            value={<span className="text-lg font-bold text-foreground">{formatAmount(price)} <span className="text-xs font-medium text-muted-foreground">UZS</span></span>}
          />
        </div>

        {mutation.error && (
          <p className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-center text-xs text-destructive">
            {(mutation.error as Error).message}
          </p>
        )}

        <button
          onClick={submit}
          disabled={!canSubmit}
          className="w-full rounded-full py-3.5 text-sm font-semibold btn-primary-glow disabled:opacity-40 disabled:shadow-none no-tap-highlight"
        >
          {mutation.isPending ? "…" : t.goToPayment}
        </button>
      </main>
    </>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm text-muted-foreground">
      <span>{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
