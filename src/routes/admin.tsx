import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { AppHeader } from "../components/AppHeader";
import { formatAmount } from "../lib/format";
import { useT } from "../lib/language";
import { useSession } from "../hooks/useSession";
import {
  createMission,
  deleteMission,
  getAdminSettings,
  listAdminMissions,
  listAdminRequests,
  updateAdminSetting,
  updateLoyaltyLevels,
  updateMission,
  updateRewardRequest,
  updateRewards,
  type AdminMissionRow,
  type AdminRequestRow,
} from "../lib/admin.functions";
import { getLoyaltyConfig } from "../lib/loyalty.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Loyalty sozlamalari | Starbbot" },
      { name: "description", content: "Darajalar, koeffitsiyentlar va mukofot narxlarini kodsiz o‘zgartiring." },
      { property: "og:title", content: "Admin — Loyalty sozlamalari" },
      { property: "og:description", content: "Darajalar, koeffitsiyentlar va mukofot so‘rovlarini boshqaring." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

type Loyalty = {
  progressionRule: "lifetime_stars" | "lifetime_spend" | "order_count";
  baseRate: number;
  redeemCooldownMinutes: number;
  referralPoints: number;
  referralAwardOn: "first_purchase" | "registration";
};
type Pricing = { starPriceUzs: number; premium: Record<string, number>; minStars: number; maxStars: number };
type Maintenance = { enabled: boolean; message: string };

const RULE_LABELS: Record<Loyalty["progressionRule"], "ruleLifetimeStars" | "ruleLifetimeSpend" | "ruleOrderCount"> = {
  lifetime_stars: "ruleLifetimeStars",
  lifetime_spend: "ruleLifetimeSpend",
  order_count: "ruleOrderCount",
};

const STATUS_META: Record<string, { key: "reqPending" | "reqApproved" | "reqCompleted" | "reqRejected"; dot: string }> = {
  pending: { key: "reqPending", dot: "🟡" },
  approved: { key: "reqApproved", dot: "🔵" },
  completed: { key: "reqCompleted", dot: "🟢" },
  rejected: { key: "reqRejected", dot: "🔴" },
};

const DEFAULT_PRICING: Pricing = {
  starPriceUzs: 200,
  premium: { "3": 55000, "6": 95000, "12": 170000 },
  minStars: 50,
  maxStars: 5000,
};
const DEFAULT_LOYALTY: Loyalty = {
  progressionRule: "lifetime_stars",
  baseRate: 0.1,
  redeemCooldownMinutes: 5,
  referralPoints: 50,
  referralAwardOn: "first_purchase",
};

function AdminPage() {
  const t = useT();
  const queryClient = useQueryClient();
  const { isAdmin, isLoading: sessionLoading } = useSession();

  const settingsQuery = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => getAdminSettings(),
    enabled: isAdmin,
  });
  const loyaltyConfigQuery = useQuery({
    queryKey: ["loyalty-config"],
    queryFn: () => getLoyaltyConfig(),
    enabled: isAdmin,
  });
  const requestsQuery = useQuery<AdminRequestRow[]>({
    queryKey: ["admin-requests"],
    queryFn: () => listAdminRequests({ data: { status: null } }),
    enabled: isAdmin,
  });
  const missionsQuery = useQuery<AdminMissionRow[]>({
    queryKey: ["admin-missions"],
    queryFn: () => listAdminMissions(),
    enabled: isAdmin,
  });

  const [loyalty, setLoyalty] = useState<Loyalty | null>(null);
  const [pricing, setPricing] = useState<Pricing>(DEFAULT_PRICING);
  const [maintenance, setMaintenance] = useState<Maintenance>({ enabled: false, message: "" });
  const [levels, setLevels] = useState<{ key: string; name: string; emoji: string; threshold: number; multiplier: number }[]>([]);
  const [rewards, setRewards] = useState<{ id: string; cost: number; stars: number }[]>([]);
  const [draft, setDraft] = useState({ title: "", description: "", url: "", points: 50 });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const s = settingsQuery.data;
    if (!s) return;
    setLoyalty(s.loyalty as Loyalty);
    setPricing(s.pricing as Pricing);
    setMaintenance(s.maintenance as Maintenance);
  }, [settingsQuery.data]);

  useEffect(() => {
    const c = loyaltyConfigQuery.data;
    if (!c) return;
    setLevels(c.levels.map((l) => ({ key: l.key, name: l.name, emoji: l.emoji, threshold: l.threshold, multiplier: l.multiplier })));
    setRewards(c.rewards.map((r) => ({ id: r.id, cost: r.cost, stars: r.stars })));
  }, [loyaltyConfigQuery.data]);

  const requestAction = useMutation({
    mutationFn: (v: { requestId: string; action: "approve" | "complete" | "reject" }) =>
      updateRewardRequest({ data: v }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-requests"] }),
  });

  const save = useMutation({
    mutationFn: async () => {
      if (loyalty) await updateAdminSetting({ data: { key: "loyalty", value: loyalty } });
      await updateAdminSetting({ data: { key: "pricing", value: pricing } });
      await updateAdminSetting({ data: { key: "maintenance", value: maintenance } });
      if (levels.length) await updateLoyaltyLevels({ data: { levels } });
      if (rewards.length) await updateRewards({ data: { rewards } });
      return true;
    },
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      queryClient.invalidateQueries({ queryKey: ["loyalty-config"] });
      queryClient.invalidateQueries({ queryKey: ["app-config"] });
    },
  });

  const addMissionMutation = useMutation({
    mutationFn: () => createMission({ data: { ...draft, title: draft.title.trim(), active: true } }),
    onSuccess: () => {
      setDraft({ title: "", description: "", url: "", points: 50 });
      queryClient.invalidateQueries({ queryKey: ["admin-missions"] });
      queryClient.invalidateQueries({ queryKey: ["missions"] });
    },
  });

  const toggleMission = useMutation({
    mutationFn: (m: AdminMissionRow) => updateMission({ data: { id: m.id, active: !m.active } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-missions"] });
      queryClient.invalidateQueries({ queryKey: ["missions"] });
    },
  });

  const removeMission = useMutation({
    mutationFn: (id: string) => deleteMission({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-missions"] });
      queryClient.invalidateQueries({ queryKey: ["missions"] });
    },
  });

  if (sessionLoading || (isAdmin && (settingsQuery.isLoading || !loyalty))) {
    return (
      <>
        <AppHeader title={t.adminTitle} back />
        <main className="px-4 pt-4">
          <div className="h-64 animate-pulse rounded-2xl bg-card" />
        </main>
      </>
    );
  }

  if (!isAdmin) {
    return (
      <>
        <AppHeader title={t.adminTitle} back />
        <main className="px-4 pt-10 text-center">
          <p className="text-sm text-muted-foreground">403</p>
        </main>
      </>
    );
  }

  const update = (patch: Partial<Loyalty>) => setLoyalty({ ...(loyalty as Loyalty), ...patch });
  const requests = requestsQuery.data ?? [];
  const missions = missionsQuery.data ?? [];
  const pending = requests.filter((r) => r.status === "pending" || r.status === "approved");
  const l = loyalty as Loyalty;

  return (
    <>
      <AppHeader title={t.adminTitle} back />
      <main className="px-4 pb-8 pt-4">
        {/* Reward requests */}
        <section>
          <h3 className="mb-2 text-sm font-semibold">{t.adminNewRequests(pending.length)}</h3>
          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {requests.length === 0 ? (
              <p className="px-4 py-4 text-xs text-muted-foreground">{t.adminNoRequests}</p>
            ) : (
              requests.map((r) => (
                <div key={r.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {r.user.username ? `@${r.user.username}` : r.user.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">#{r.requestNo}</p>
                      <p className="mt-1 text-xs">
                        {t.adminReward}: <span className="font-semibold">{r.stars} Stars</span> ·{" "}
                        {t.adminDeducted}:{" "}
                        <span className="font-semibold">
                          {formatAmount(r.cost)} {t.adminPointsSuffix}
                        </span>
                      </p>
                    </div>
                    <span className="whitespace-nowrap text-[11px] font-medium">
                      {STATUS_META[r.status]?.dot} {STATUS_META[r.status] ? t[STATUS_META[r.status]!.key] : r.status}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {r.status === "pending" && (
                      <Action
                        label={t.adminApprove}
                        onClick={() => requestAction.mutate({ requestId: r.id, action: "approve" })}
                        primary
                      />
                    )}
                    {(r.status === "pending" || r.status === "approved") && (
                      <>
                        <Action
                          label={t.adminSent}
                          onClick={() => requestAction.mutate({ requestId: r.id, action: "complete" })}
                          primary
                        />
                        <Action
                          label={t.adminReject}
                          onClick={() => requestAction.mutate({ requestId: r.id, action: "reject" })}
                        />
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Progression rule */}
        <section className="mt-5 rounded-2xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold">{t.adminLevelRule}</h3>
          <div className="mt-3 grid gap-2">
            {(Object.keys(RULE_LABELS) as Loyalty["progressionRule"][]).map((rule) => (
              <label key={rule} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="rule"
                  checked={l.progressionRule === rule}
                  onChange={() => update({ progressionRule: rule })}
                />
                {t[RULE_LABELS[rule]]}
              </label>
            ))}
          </div>

          <h3 className="mt-5 text-sm font-semibold">{t.adminBaseRate}</h3>
          <NumberInput
            value={l.baseRate}
            step={0.01}
            onChange={(v) => update({ baseRate: v })}
            suffix={t.adminBaseRateSuffix}
          />
        </section>

        {/* Levels */}
        <section className="mt-4 rounded-2xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold">{t.adminLevelsTitle}</h3>
          <div className="mt-3 space-y-3">
            {levels.map((lv, i) => (
              <div key={lv.key} className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-sm">
                  {lv.emoji} {lv.name}
                </span>
                <NumberInput
                  value={lv.threshold}
                  step={100}
                  onChange={(v) => setLevels(levels.map((x, xi) => (xi === i ? { ...x, threshold: v } : x)))}
                  suffix={t.adminThreshold}
                />
                <NumberInput
                  value={lv.multiplier}
                  step={0.05}
                  onChange={(v) => setLevels(levels.map((x, xi) => (xi === i ? { ...x, multiplier: v } : x)))}
                  suffix="×"
                />
              </div>
            ))}
          </div>
        </section>

        {/* Rewards */}
        <section className="mt-4 rounded-2xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold">{t.adminRewardsTitle}</h3>
          <div className="mt-3 space-y-3">
            {rewards.map((r, i) => (
              <div key={r.id} className="flex items-center gap-2">
                <NumberInput
                  value={r.cost}
                  step={50}
                  onChange={(v) => setRewards(rewards.map((x, xi) => (xi === i ? { ...x, cost: v } : x)))}
                  suffix={t.adminPointsSuffix}
                />
                <span className="text-muted-foreground">→</span>
                <NumberInput
                  value={r.stars}
                  step={5}
                  onChange={(v) => setRewards(rewards.map((x, xi) => (xi === i ? { ...x, stars: v } : x)))}
                  suffix="⭐"
                />
              </div>
            ))}
          </div>

          <h3 className="mt-5 text-sm font-semibold">{t.adminCooldownTitle}</h3>
          <NumberInput
            value={l.redeemCooldownMinutes}
            step={1}
            onChange={(v) => update({ redeemCooldownMinutes: v })}
            suffix={t.adminMinutes}
          />
        </section>

        {/* Pricing */}
        <section className="mt-4 rounded-2xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold">{t.adminPricingTitle}</h3>
          <div className="mt-3 flex items-center gap-2">
            <span className="w-28 shrink-0 text-sm">{t.adminStarPrice}</span>
            <NumberInput
              value={pricing.starPriceUzs}
              step={10}
              onChange={(v) => setPricing({ ...pricing, starPriceUzs: v })}
              suffix={t.adminUzs}
            />
          </div>
          <div className="mt-3 space-y-3">
            {([3, 6, 12] as const).map((m) => (
              <div key={m} className="flex items-center gap-2">
                <span className="w-28 shrink-0 text-sm">{t.adminPremiumPrice(m)}</span>
                <NumberInput
                  value={pricing.premium[String(m)] ?? 0}
                  step={1000}
                  onChange={(v) => setPricing({ ...pricing, premium: { ...pricing.premium, [String(m)]: v } })}
                  suffix={t.adminUzs}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Maintenance */}
        <section className="mt-4 rounded-2xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold">{t.adminMaintenanceTitle}</h3>
          <label className="mt-3 flex items-center justify-between gap-3">
            <span className="text-sm">{t.adminMaintenanceToggle}</span>
            <button
              type="button"
              role="switch"
              aria-checked={maintenance.enabled}
              onClick={() => setMaintenance({ ...maintenance, enabled: !maintenance.enabled })}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                maintenance.enabled ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-background transition-transform ${
                  maintenance.enabled ? "translate-x-[22px]" : "translate-x-0.5"
                }`}
              />
            </button>
          </label>
          <p className="mt-2 text-xs text-muted-foreground">{t.adminMaintenanceHint}</p>
          <label className="mt-3 block text-sm">
            {t.adminMaintenanceMessage}
            <textarea
              value={maintenance.message}
              onChange={(e) => setMaintenance({ ...maintenance, message: e.target.value })}
              placeholder={t.adminMaintenancePlaceholder}
              rows={3}
              className="mt-1 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
        </section>

        {/* Missions */}
        <section className="mt-4 rounded-2xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold">{t.adminMissionsTitle}</h3>

          <div className="mt-3 space-y-2">
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder={t.adminMissionTitle}
              className="w-full rounded-xl border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <textarea
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder={t.adminMissionDesc}
              rows={2}
              className="w-full resize-none rounded-xl border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <input
              value={draft.url}
              onChange={(e) => setDraft({ ...draft, url: e.target.value })}
              placeholder={t.adminMissionUrl}
              className="w-full rounded-xl border border-border bg-input px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <NumberInput
              value={draft.points}
              step={10}
              onChange={(v) => setDraft({ ...draft, points: v })}
              suffix={t.adminMissionPoints}
            />
            <button
              onClick={() => {
                if (!draft.title.trim()) return;
                addMissionMutation.mutate();
              }}
              disabled={addMissionMutation.isPending}
              className="no-tap-highlight flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold btn-primary-glow disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
              {t.adminMissionAdd}
            </button>
            {addMissionMutation.error && (
              <p className="text-center text-[11px] text-destructive">
                {(addMissionMutation.error as Error).message}
              </p>
            )}
          </div>

          <div className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border">
            {missions.length === 0 ? (
              <p className="px-3 py-3 text-xs text-muted-foreground">{t.adminNoMissions}</p>
            ) : (
              missions.map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      +{formatAmount(m.points)} {t.points} · {m.completions}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={m.active}
                    onClick={() => toggleMission.mutate(m)}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                      m.active ? "bg-primary" : "bg-muted"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-background transition-transform ${
                        m.active ? "translate-x-[22px]" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                  <button
                    onClick={() => removeMission.mutate(m.id)}
                    aria-label={t.adminMissionDelete}
                    className="no-tap-highlight shrink-0 rounded-full p-2 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Referral */}
        <section className="mt-4 rounded-2xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold">{t.adminReferralTitle}</h3>
          <div className="mt-3">
            <NumberInput
              value={l.referralPoints}
              step={10}
              onChange={(v) => update({ referralPoints: v })}
              suffix={t.adminReferralSuffix}
            />
          </div>
          <div className="mt-3 space-y-2">
            {(["first_purchase", "registration"] as const).map((mode) => (
              <label key={mode} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="referralAwardOn"
                  checked={l.referralAwardOn === mode}
                  onChange={() => update({ referralAwardOn: mode })}
                />
                {mode === "first_purchase" ? t.adminAwardFirstPurchase : t.adminAwardRegistration}
              </label>
            ))}
          </div>
        </section>

        {save.error && (
          <p className="mt-3 text-center text-xs text-destructive">{(save.error as Error).message}</p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="no-tap-highlight flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold btn-primary-glow disabled:opacity-40"
          >
            <Save className="h-4 w-4" />
            {saved ? t.saved : t.save}
          </button>
          <button
            onClick={() => {
              setLoyalty(DEFAULT_LOYALTY);
              setPricing(DEFAULT_PRICING);
            }}
            className="no-tap-highlight flex items-center justify-center gap-2 rounded-full border border-border px-4 py-3 text-sm font-semibold text-muted-foreground"
          >
            <RotateCcw className="h-4 w-4" />
            {t.reset}
          </button>
        </div>
      </main>
    </>
  );
}

function Action({ label, onClick, primary }: { label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`no-tap-highlight rounded-full px-3 py-1.5 text-xs font-semibold ${
        primary ? "btn-primary-glow" : "border border-border text-muted-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function NumberInput({
  value,
  onChange,
  step,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  step: number;
  suffix: string;
}) {
  return (
    <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-input px-3 py-2">
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
        className="w-full min-w-0 bg-transparent text-sm focus:outline-none"
      />
      <span className="shrink-0 text-[11px] text-muted-foreground">{suffix}</span>
    </label>
  );
}
