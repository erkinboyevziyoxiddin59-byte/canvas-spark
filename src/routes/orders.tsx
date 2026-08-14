import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Star, Crown, Clock, CheckCircle2, XCircle, Sparkles, PackageOpen } from "lucide-react";
import { AppHeader } from "../components/AppHeader";
import { formatAmount, getOrders, type Order } from "../lib/mock-store";
import { useT } from "../lib/language";
import type { Dict } from "../lib/i18n";

export const Route = createFileRoute("/orders")({
  head: () => ({
    meta: [
      { title: "Buyurtmalarim — Starbbot" },
      { name: "description", content: "Sizning barcha buyurtmalaringiz." },
    ],
  }),
  component: OrdersPage,
});

function OrdersPage() {
  const t = useT();
  const [orders, setOrders] = useState<Order[]>([]);
  useEffect(() => {
    const refresh = () => setOrders(getOrders());
    refresh();
    window.addEventListener("orders:changed", refresh);
    const iv = setInterval(refresh, 30_000);
    return () => {
      window.removeEventListener("orders:changed", refresh);
      clearInterval(iv);
    };
  }, []);

  return (
    <>
      <AppHeader title={t.myOrders} />
      <main className="px-4 pb-8 pt-4">
        {orders.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="space-y-2">
            {orders.map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

function OrderCard({ order }: { order: Order }) {
  const t = useT();
  const isStars = order.type === "stars";
  const statusMeta = getStatusMeta(order.status, t);
  return (
    <li>
      <Link
        to="/payment/$orderId"
        params={{ orderId: String(order.id) }}
        className="no-tap-highlight block rounded-2xl border border-border bg-card p-4 transition active:scale-[0.99]"
      >
        <div className="flex items-start gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
            style={{ background: isStars ? "var(--gradient-star)" : "var(--gradient-premium)" }}
          >
            {isStars ? <Star className="h-5 w-5" fill="currentColor" /> : <Crown className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-semibold">
                {isStars ? `${formatAmount(order.quantity)} Stars` : `Premium · ${t.monthsShort(order.quantity)}`}
              </p>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusMeta.className}`}
              >
                {statusMeta.icon}
                {statusMeta.label}
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              @{order.targetUsername} · #{order.id}
            </p>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{new Date(order.createdAt).toLocaleString(t.langName === "Русский" ? "ru-RU" : "uz-UZ")}</span>
              <span className="font-semibold text-foreground">{formatAmount(order.amountUzs)} UZS</span>
            </div>
          </div>
        </div>
      </Link>
    </li>
  );
}

function getStatusMeta(s: Order["status"], t: Dict) {
  switch (s) {
    case "active":
      return {
        label: t.orderStatusActive,
        icon: <Clock className="h-3 w-3" />,
        className: "bg-warning/15 text-warning",
      };
    case "paid":
      return {
        label: t.orderStatusPaid,
        icon: <Sparkles className="h-3 w-3" />,
        className: "bg-primary/25 text-primary-glow",
      };
    case "delivered":
      return {
        label: t.orderStatusDelivered,
        icon: <CheckCircle2 className="h-3 w-3" />,
        className: "bg-success/15 text-success",
      };
    case "expired":
      return {
        label: t.orderStatusExpired,
        icon: <XCircle className="h-3 w-3" />,
        className: "bg-secondary text-muted-foreground",
      };
  }
}

function EmptyState() {
  const t = useT();
  return (
    <div className="mt-12 flex flex-col items-center px-8 text-center">
      <div className="mb-4 rounded-2xl bg-secondary p-4 text-primary-glow">
        <PackageOpen className="h-8 w-8" />
      </div>
      <h2 className="text-base font-semibold">{t.ordersEmptyTitle}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t.ordersEmptyDesc}</p>
      <div className="mt-5 flex w-full gap-2">
        <Link
          to="/stars"
          className="flex-1 rounded-full py-3 text-center text-sm font-semibold btn-primary-glow no-tap-highlight"
        >
          {t.buyStars}
        </Link>
        <Link
          to="/premium"
          className="flex-1 rounded-full border border-border bg-card py-3 text-center text-sm font-semibold no-tap-highlight"
        >
          {t.premium}
        </Link>
      </div>
    </div>
  );
}
