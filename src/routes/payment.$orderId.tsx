import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, Check, CreditCard, Clock, CheckCircle2, Sparkles } from "lucide-react";
import { AppHeader } from "../components/AppHeader";
import {
  CARD_HOLDER,
  CARD_NUMBER,
  cancelOrder,
  formatAmount,
  getOrder,
  markPaid,
  ORDER_EXPIRE_MINUTES,
  typeLabel,
  type Order,
} from "../lib/mock-store";
import { useT } from "../lib/language";

export const Route = createFileRoute("/payment/$orderId")({
  head: () => ({
    meta: [
      { title: "To‘lov — Starbbot" },
      { name: "description", content: "Buyurtma uchun to‘lov ma’lumotlari." },
    ],
  }),
  component: PaymentPage,
});

function PaymentPage() {
  const { orderId } = Route.useParams();
  const t = useT();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | undefined>(() => getOrder(Number(orderId)));
  const [now, setNow] = useState(Date.now());
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setOrder(getOrder(Number(orderId)));
    const iv = setInterval(() => setNow(Date.now()), 1000);
    window.addEventListener("orders:changed", refresh);
    return () => {
      clearInterval(iv);
      window.removeEventListener("orders:changed", refresh);
    };
  }, [orderId]);

  if (!order) {
    return (
      <>
        <AppHeader title={t.orderNotFound} back />
        <main className="px-4 pt-8 text-center">
          <p className="text-sm text-muted-foreground">{t.orderNotFoundDesc}</p>
          <Link
            to="/"
            className="mt-4 inline-flex rounded-full px-5 py-2.5 text-sm font-semibold btn-primary-glow"
          >
            {t.home}
          </Link>
        </main>
      </>
    );
  }

  const msLeft = Math.max(0, order.expiresAt - now);
  const totalMs = ORDER_EXPIRE_MINUTES * 60 * 1000;
  const mm = Math.floor(msLeft / 60000).toString().padStart(2, "0");
  const ss = Math.floor((msLeft % 60000) / 1000).toString().padStart(2, "0");
  const progress = Math.max(0, Math.min(1, msLeft / totalMs));

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      /* noop */
    }
  };

  const isTerminal = order.status !== "active";

  return (
    <>
      <AppHeader title={t.orderNo(order.id)} subtitle={typeLabel(order.type)} back />
      <main className="px-4 pb-8 pt-4 space-y-4">
        {/* Status banner */}
        {order.status === "paid" && (
          <StatusBanner
            tone="warning"
            icon={<Sparkles className="h-5 w-5 animate-pulse" />}
            title={t.paidTitle}
            desc={t.paidDesc}
          />
        )}
        {order.status === "delivered" && (
          <StatusBanner
            tone="success"
            icon={<CheckCircle2 className="h-5 w-5" />}
            title={t.deliveredTitle}
            desc={t.deliveredDesc(order.targetUsername)}
          />
        )}
        {order.status === "expired" && (
          <StatusBanner tone="muted" icon={<Clock className="h-5 w-5" />} title={t.expiredTitle} desc={t.expiredDesc} />
        )}

        {/* Amount card */}
        <section className="card-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t.exactAmount}
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tabular-nums">{formatAmount(order.amountUzs)}</span>
            <span className="text-sm font-medium text-muted-foreground">UZS</span>
            <button
              onClick={() => copy(String(order.amountUzs), "amount")}
              className="ml-auto rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground no-tap-highlight"
            >
              {copied === "amount" ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{t.uniqueAmountNote}</p>

          {/* Card */}
          <div
            className="mt-4 rounded-xl p-4 text-white"
            style={{ background: "var(--gradient-primary)" }}
          >
            <div className="flex items-center justify-between text-[11px] uppercase tracking-widest text-white/70">
              <span className="inline-flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5" /> UZCARD / HUMO</span>
              <span>Starbbot</span>
            </div>
            <p className="mt-3 font-mono text-lg tracking-widest">{CARD_NUMBER}</p>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-white/60">{t.cardHolderLabel}</p>
                <p className="text-sm font-semibold">{CARD_HOLDER}</p>
              </div>
              <button
                onClick={() => copy(CARD_NUMBER.replace(/\s/g, ""), "card")}
                className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-medium backdrop-blur no-tap-highlight"
              >
                {copied === "card" ? t.copiedShort : t.copyShort}
              </button>
            </div>
          </div>
        </section>

        {/* Timer */}
        {!isTerminal && (
          <section className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-4 w-4" /> {t.timeLeft}
              </span>
              <span className="font-mono text-lg font-bold tabular-nums">
                {mm}:{ss}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full transition-[width] duration-1000"
                style={{ width: `${progress * 100}%`, background: "var(--gradient-primary)" }}
              />
            </div>
          </section>
        )}

        {/* Details */}
        <section className="rounded-2xl border border-border bg-card p-4 text-sm">
          <Row label={t.toWho} value={`@${order.targetUsername}`} />
          <Row
            label={t.product}
            value={order.type === "stars" ? `${formatAmount(order.quantity)} Stars` : `${t.monthsShort(order.quantity)} Premium`}
          />
          <Row label={t.orderNumber} value={`#${order.id}`} />
        </section>

        {/* Actions */}
        {!isTerminal && (
          <div className="space-y-2">
            <button
              onClick={() => markPaid(order.id)}
              className="w-full rounded-full py-3.5 text-sm font-semibold btn-primary-glow no-tap-highlight"
            >
              {t.iPaid}
            </button>
            <button
              onClick={() => {
                cancelOrder(order.id);
                navigate({ to: "/orders" });
              }}
              className="w-full rounded-full border border-border py-3 text-sm font-medium text-muted-foreground hover:text-foreground no-tap-highlight"
            >
              {t.cancel}
            </button>
          </div>
        )}

        {isTerminal && (
          <Link
            to="/orders"
            className="mt-2 flex w-full items-center justify-center rounded-full py-3.5 text-sm font-semibold btn-primary-glow no-tap-highlight"
          >
            {t.myOrders}
          </Link>
        )}
      </main>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function StatusBanner({
  tone,
  icon,
  title,
  desc,
}: {
  tone: "success" | "warning" | "muted";
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  const styles = {
    success: "bg-success/15 text-success border-success/30",
    warning: "bg-warning/15 text-warning border-warning/30",
    muted: "bg-secondary text-muted-foreground border-border",
  }[tone];
  return (
    <div className={`flex items-start gap-3 rounded-2xl border p-4 ${styles}`}>
      <div className="mt-0.5">{icon}</div>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs opacity-90">{desc}</p>
      </div>
    </div>
  );
}
