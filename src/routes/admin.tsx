import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { AppHeader } from "../components/AppHeader";
import {
  addMission,
  getMissions,
  removeMission,
  updateMission,
  type Mission,
} from "../lib/missions";
import {
  DEFAULT_MAINTENANCE,
  DEFAULT_PRICING,
  formatAmount,
  getMaintenance,
  getPricing,
  resetPricing,
  saveMaintenance,
  savePricing,
  type Maintenance,
  type Pricing,
} from "../lib/mock-store";
import {
  DEFAULT_SETTINGS,
  RULE_LABELS,
  STATUS_LABELS,
  getRewardRequests,
  getSettings,
  resetSettings,
  saveSettings,
  setRequestStatus,
  type LoyaltySettings,
  type ProgressionRule,
  type RewardRequest,
} from "../lib/loyalty";
import { useT } from "../lib/language";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Loyalty sozlamalari | Starbbot" },
      { name: "description", content: "Darajalar, koeffitsiyentlar va mukofot narxlarini kodsiz o‘zgartiring." },
      { property: "og:title", content: "Admin — Loyalty sozlamalari" },
      { property: "og:description", content: "Darajalar, koeffitsiyentlar va mukofot so‘rovlarini boshqaring." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const t = useT();
  const [settings, setSettings] = useState<LoyaltySettings | null>(null);
  const [requests, setRequests] = useState<RewardRequest[]>([]);
  const [pricing, setPricing] = useState<Pricing>(DEFAULT_PRICING);
  const [maintenance, setMaintenance] = useState<Maintenance>(DEFAULT_MAINTENANCE);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [draft, setDraft] = useState({ title: "", description: "", url: "", points: 50 });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setSettings(getSettings());
      setRequests(getRewardRequests());
      setPricing(getPricing());
      setMaintenance(getMaintenance());
      setMissions(getMissions());
    };
    refresh();
    window.addEventListener("orders:changed", refresh);
    return () => window.removeEventListener("orders:changed", refresh);
  }, []);

  if (!settings) {
    return (
      <>
        <AppHeader title={t.adminTitle} />
        <main className="px-4 pt-4">
          <div className="h-64 animate-pulse rounded-2xl bg-card" />
        </main>
      </>
    );
  }

  const update = (patch: Partial<LoyaltySettings>) => setSettings({ ...settings, ...patch });

  const persist = () => {
    saveSettings(settings);
    savePricing(pricing);
    saveMaintenance(maintenance);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const pending = requests.filter((r) => r.status === "pending" || r.status === "approved");

  return (
    <>
      <AppHeader title={t.adminTitle} />
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
                      <p className="truncate text-sm font-semibold">@{r.username}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {r.levelEmoji} {r.levelName} Member · #{r.id}
                      </p>
                      <p className="mt-1 text-xs">
                        {t.adminReward}: <span className="font-semibold">{r.stars} Stars</span> ·{" "}
                        {t.adminDeducted}:{" "}
                        <span className="font-semibold">
                          {formatAmount(r.cost)} {t.adminPointsSuffix}
                        </span>
                      </p>
                    </div>
                    <span className="whitespace-nowrap text-[11px] font-medium">
                      {STATUS_LABELS[r.status].dot} {t[STATUS_LABELS[r.status].key]}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {r.status === "pending" && (
                      <Action label={t.adminApprove} onClick={() => setRequestStatus(r.id, "approved")} primary />
                    )}
                    {(r.status === "pending" || r.status === "approved") && (
                      <>
                        <Action label={t.adminSent} onClick={() => setRequestStatus(r.id, "completed")} primary />
                        <Action label={t.adminReject} onClick={() => setRequestStatus(r.id, "rejected")} />
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
            {(Object.keys(RULE_LABELS) as ProgressionRule[]).map((rule) => (
              <label key={rule} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="rule"
                  checked={settings.progressionRule === rule}
                  onChange={() => update({ progressionRule: rule })}
                />
                {t[RULE_LABELS[rule]]}
              </label>
            ))}
          </div>

          <h3 className="mt-5 text-sm font-semibold">{t.adminBaseRate}</h3>
          <NumberInput
            value={settings.baseRate}
            step={0.01}
            onChange={(v) => update({ baseRate: v })}
            suffix={t.adminBaseRateSuffix}
          />
        </section>

        {/* Levels */}
        <section className="mt-4 rounded-2xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold">{t.adminLevelsTitle}</h3>
          <div className="mt-3 space-y-3">
            {settings.levels.map((l, i) => (
              <div key={l.key} className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-sm">
                  {l.emoji} {l.name}
                </span>
                <NumberInput
                  value={l.threshold}
                  step={100}
                  onChange={(v) =>
                    update({
                      levels: settings.levels.map((x, xi) => (xi === i ? { ...x, threshold: v } : x)),
                    })
                  }
                  suffix={t.adminThreshold}
                />
                <NumberInput
                  value={l.multiplier}
                  step={0.05}
                  onChange={(v) =>
                    update({
                      levels: settings.levels.map((x, xi) => (xi === i ? { ...x, multiplier: v } : x)),
                    })
                  }
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
            {settings.rewards.map((r, i) => (
              <div key={r.id} className="flex items-center gap-2">
                <NumberInput
                  value={r.cost}
                  step={50}
                  onChange={(v) =>
                    update({ rewards: settings.rewards.map((x, xi) => (xi === i ? { ...x, cost: v } : x)) })
                  }
                  suffix={t.adminPointsSuffix}
                />
                <span className="text-muted-foreground">→</span>
                <NumberInput
                  value={r.stars}
                  step={5}
                  onChange={(v) =>
                    update({ rewards: settings.rewards.map((x, xi) => (xi === i ? { ...x, stars: v } : x)) })
                  }
                  suffix="⭐"
                />
              </div>
            ))}
          </div>

          <h3 className="mt-5 text-sm font-semibold">{t.adminCooldownTitle}</h3>
          <NumberInput
            value={settings.redeemCooldownMinutes}
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
                  value={pricing.premium[m]}
                  step={1000}
                  onChange={(v) => setPricing({ ...pricing, premium: { ...pricing.premium, [m]: v } })}
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
                addMission({ ...draft, title: draft.title.trim(), active: true });
                setDraft({ title: "", description: "", url: "", points: 50 });
              }}
              className="no-tap-highlight flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-sm font-semibold btn-primary-glow"
            >
              <Plus className="h-4 w-4" />
              {t.adminMissionAdd}
            </button>
          </div>

          <div className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border">
            {missions.length === 0 ? (
              <p className="px-3 py-3 text-xs text-muted-foreground">{t.adminNoMissions}</p>
            ) : (
              missions.map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{m.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      +{formatAmount(m.points)} · {m.url || "—"}
                    </p>
                  </div>
                  <label className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={m.active}
                      onChange={() => updateMission(m.id, { active: !m.active })}
                    />
                    {t.adminMissionActive}
                  </label>
                  <button
                    onClick={() => removeMission(m.id)}
                    aria-label={t.adminMissionDelete}
                    className="no-tap-highlight shrink-0 rounded-full border border-border p-2 text-muted-foreground"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Referrals */}
        <section className="mt-4 rounded-2xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold">{t.adminReferralTitle}</h3>
          <div className="mt-3">
            <NumberInput
              value={settings.referralPoints}
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
                  checked={settings.referralAwardOn === mode}
                  onChange={() => update({ referralAwardOn: mode })}
                />
                {mode === "first_purchase" ? t.adminAwardFirstPurchase : t.adminAwardRegistration}
              </label>
            ))}
          </div>
        </section>

        <div className="mt-4 flex gap-2">
          <button
            onClick={persist}
            className="no-tap-highlight flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold btn-primary-glow"
          >
            <Save className="h-4 w-4" />
            {saved ? t.saved : t.save}
          </button>
          <button
            onClick={() => {
              resetSettings();
              resetPricing();
              setSettings(DEFAULT_SETTINGS);
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
