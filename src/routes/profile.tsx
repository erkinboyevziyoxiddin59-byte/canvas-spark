import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Star,
  Crown,
  Copy,
  Check,
  Settings,
  Users,
  BadgePercent,
  Languages,
  IdCard,
  ListChecks,
  ChevronRight,
} from "lucide-react";
import { AppHeader } from "../components/AppHeader";
import { Row, StatCard } from "../components/StatBits";
import { formatAmount } from "../lib/format";
import { useI18n } from "../lib/language";
import { getMyProfile } from "../lib/profile.functions";
import { getMyReferrals } from "../lib/referrals.functions";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profil — Starbbot" },
      { name: "description", content: "Daraja, Star Points va bonuslaringizni kuzating." },
      { property: "og:title", content: "Profil — Starbbot" },
      { property: "og:description", content: "Daraja, Star Points va bonuslaringizni kuzating." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { t, lang, setLang } = useI18n();
  const [copied, setCopied] = useState<string | null>(null);

  const profileQuery = useQuery({ queryKey: ["profile"], queryFn: () => getMyProfile() });
  const referralQuery = useQuery({ queryKey: ["referrals"], queryFn: () => getMyReferrals() });

  const profile = profileQuery.data ?? null;
  const referrals = referralQuery.data ?? null;
  const refCode = referrals?.code ?? "—";
  const refLink = referrals?.link ?? "";
  const tg = {
    name: profile?.name ?? "",
    username: profile?.username ?? null,
    photoUrl: profile?.photoUrl ?? null,
    telegramId: profile?.telegramId ?? "",
  };

  const copy = useCallback((value: string, key: string) => {
    navigator.clipboard?.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 1600);
  }, []);

  const copyCode = useCallback(() => copy(refLink, "ref"), [copy, refLink]);

  return (
    <>
      <AppHeader
        title={t.profile}
        right={
          <Link
            to="/admin"
            className="no-tap-highlight rounded-full p-2 text-muted-foreground transition-colors hover:text-foreground"
            aria-label={t.settings}
          >
            <Settings className="h-5 w-5" />
          </Link>
        }
      />
      <main className="px-4 pb-8 pt-4">
        {profileQuery.isLoading ? (
          <div className="h-64 animate-pulse rounded-2xl bg-card" />
        ) : profileQuery.error || !profile ? (
          <div className="mt-10 text-center">
            <p className="text-sm text-muted-foreground">
              {(profileQuery.error as Error | null)?.message ?? "—"}
            </p>
            <button
              onClick={() => profileQuery.refetch()}
              className="mt-4 rounded-full px-5 py-2.5 text-sm font-semibold btn-primary-glow no-tap-highlight"
            >
              {t.retry}
            </button>
          </div>
        ) : (
          <>
            {/* Identity + level */}
            <section
              className="relative overflow-hidden rounded-2xl border border-border p-5"
              style={{ background: profile.level.gradient }}
            >
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/25 blur-3xl" />
              <div className="relative flex items-center gap-3">
                {tg.photoUrl ? (
                  <img
                    src={tg.photoUrl}
                    alt={t.profilePhotoAlt(tg.name)}
                    className="h-14 w-14 shrink-0 rounded-2xl object-cover ring-2 ring-white/30"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-2xl font-bold text-white">
                    {tg.name.charAt(0)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h2 className="truncate text-xl font-bold text-white">{tg.name}</h2>
                    <button
                      onClick={() => copy(tg.name, "name")}
                      aria-label={t.copyName}
                      className="no-tap-highlight shrink-0 rounded-full p-1 text-white/70 transition-colors hover:text-white"
                    >
                      {copied === "name" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                  {tg.username ? (
                    <button
                      onClick={() => copy(`@${tg.username}`, "username")}
                      className="no-tap-highlight mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/25 px-3 py-1"
                      aria-label={t.copyUsername}
                    >
                      <span className="truncate text-sm font-bold text-white">@{tg.username}</span>
                      {copied === "username" ? (
                        <Check className="h-3.5 w-3.5 shrink-0 text-white" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 shrink-0 text-white/80" />
                      )}
                    </button>
                  ) : (
                    <p className="mt-1.5 text-xs text-white/70">{t.noUsername}</p>
                  )}
                </div>
              </div>
              <div className="relative mt-4 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white">
                  {profile.level.emoji} {profile.level.name} {t.member} · ×{profile.level.multiplier}
                </span>
                {copied && <span className="text-[11px] font-medium text-white/90">{t.copied}</span>}
              </div>
            </section>

            {/* Shortcuts */}
            <section className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              <NavRow
                to="/points"
                icon={<Star className="h-4 w-4" fill="currentColor" />}
                label={t.openPoints}
                value={`${formatAmount(profile.points)} ${t.points}`}
              />
              <NavRow
                to="/referral"
                icon={<Users className="h-4 w-4" />}
                label={t.openReferral}
                value={t.countSuffix(referrals?.total ?? 0)}
              />
            </section>

            {/* Stats grid */}
            <section className="mt-4 grid grid-cols-2 gap-3">
              <StatCard
                icon={<ListChecks className="h-4 w-4" />}
                label={t.completedOrders}
                value={String(profile.completedOrders)}
              />
              <StatCard
                icon={<Star className="h-4 w-4" fill="currentColor" />}
                label={t.lifetimePurchased}
                value={`${formatAmount(profile.lifetimeStars)} ⭐`}
              />
              <StatCard
                icon={<Crown className="h-4 w-4" />}
                label={t.premiumSubs}
                value={t.premiumSubsValue(profile.totalOrders - profile.completedOrders >= 0 ? 0 : 0, 0)}
              />
              <StatCard
                icon={<Users className="h-4 w-4" />}
                label={t.referralEarnings}
                value={`${formatAmount(referrals?.pointsEarned ?? 0)} ${t.points}`}
              />
            </section>

            {/* Account info */}
            <section className="mt-5">
              <h3 className="mb-2 text-sm font-semibold">{t.accountInfo}</h3>
              <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                <Row icon={<IdCard className="h-4 w-4" />} label={t.telegramId} value={tg.telegramId} />
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Languages className="h-4 w-4" />
                    {t.language}
                  </span>
                  <div className="flex gap-1 rounded-full bg-secondary p-1">
                    {(["uz", "ru"] as const).map((l) => (
                      <button
                        key={l}
                        onClick={() => setLang(l)}
                        className={`no-tap-highlight rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                          lang === l ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {l === "uz" ? "O‘zbekcha" : "Русский"}
                      </button>
                    ))}
                  </div>
                </div>
                <Row
                  icon={<BadgePercent className="h-4 w-4" />}
                  label={t.multiplier}
                  value={`×${profile.level.multiplier}`}
                />
                <button
                  onClick={copyCode}
                  className="no-tap-highlight flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    {t.referralCode}
                  </span>
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    {refCode}
                    {copied === "ref" ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <Copy className="h-4 w-4 text-muted-foreground" />
                    )}
                  </span>
                </button>
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}

function NavRow({
  to,
  icon,
  label,
  value,
}: {
  to: "/points" | "/referral";
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Link to={to} className="no-tap-highlight flex items-center justify-between px-4 py-3.5">
      <span className="flex items-center gap-2 text-sm font-medium">
        <span className="text-primary-glow">{icon}</span>
        {label}
      </span>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {value}
        <ChevronRight className="h-4 w-4" />
      </span>
    </Link>
  );
}
