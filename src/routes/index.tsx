import { createFileRoute, Link } from "@tanstack/react-router";
import { Star, Crown, ListChecks, ArrowRight, Zap, Timer } from "lucide-react";
import { AppHeader } from "../components/AppHeader";
import { useT } from "../lib/language";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const t = useT();
  return (
    <>
      <AppHeader title="Starbbot" />
      <main className="px-4 pb-6 pt-4">
        {/* Hero */}
        <section
          className="relative overflow-hidden rounded-2xl border border-border p-5"
          style={{ background: "var(--gradient-primary)" }}
        >
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-30 blur-3xl" style={{ background: "var(--color-primary-glow)" }} />
          <p className="text-xs font-semibold uppercase tracking-wider text-white/70">{t.miniApp}</p>
          <h2 className="mt-2 text-2xl font-bold leading-tight text-white">{t.heroTitle}</h2>
          <p className="mt-2 text-sm text-white/80">{t.heroDesc}</p>
          <div className="mt-4 flex gap-2">
            <Link
              to="/stars"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-primary shadow-sm"
            >
              {t.start} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* Product tiles */}
        <section className="mt-5 grid grid-cols-2 gap-3">
          <ProductTile
            to="/stars"
            title="Stars"
            subtitle={t.starsTileSub}
            icon={<Star className="h-6 w-6" fill="currentColor" />}
            gradient="var(--gradient-star)"
          />
          <ProductTile
            to="/premium"
            title="Premium"
            subtitle={t.premiumTileSub}
            icon={<Crown className="h-6 w-6" />}
            gradient="var(--gradient-premium)"
          />
        </section>

        {/* Features */}
        <section className="mt-6 space-y-2">
          <Feature icon={Zap} title={t.feature1Title} desc={t.feature1Desc} />
          <Feature icon={Timer} title={t.feature2Title} desc={t.feature2Desc} />
        </section>

        {/* Orders quick link */}
        <Link
          to="/orders"
          className="mt-5 flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3.5 no-tap-highlight"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-secondary p-2 text-primary-glow">
              <ListChecks className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">{t.myOrders}</p>
              <p className="text-xs text-muted-foreground">{t.myOrdersDesc}</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </main>
    </>
  );
}

function ProductTile({
  to,
  title,
  subtitle,
  icon,
  gradient,
}: {
  to: "/stars" | "/premium";
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  gradient: string;
}) {
  return (
    <Link
      to={to}
      className="no-tap-highlight group relative overflow-hidden rounded-2xl border border-border p-4 transition-transform active:scale-[0.98]"
      style={{ background: "var(--gradient-surface)" }}
    >
      <div
        className="mb-6 inline-flex h-11 w-11 items-center justify-center rounded-xl text-white"
        style={{ background: gradient }}
      >
        {icon}
      </div>
      <p className="text-base font-semibold">{title}</p>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
      <ArrowRight className="absolute right-3 top-3 h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function Feature({ icon: Icon, title, desc }: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <div className="mt-0.5 rounded-lg bg-secondary p-1.5 text-primary-glow">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}
