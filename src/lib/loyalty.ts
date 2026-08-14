// Loyalty system: configurable tiers, Star Points ledger and reward requests.
// All state is kept client-side (localStorage) to match the rest of this mock Mini App.
import { getOrders, type Order } from "./mock-store";
import { missionLedgerEntries } from "./missions";
import {
  getFriends,
  referralLedgerEntries,
  syncReferralAwards,
  type Friend,
  type ReferralAwardOn,
} from "./referrals";

export type LevelKey = "new" | "bronze" | "silver" | "gold" | "diamond";
export type ProgressionRule = "lifetime_stars" | "lifetime_spend" | "order_count";

export interface Level {
  key: LevelKey;
  name: string;
  emoji: string;
  threshold: number; // in units of the active progression rule
  multiplier: number; // Star Points multiplier
  stars: number; // 0-5 rating pips
  gradient: string;
}

export interface Reward {
  id: string;
  cost: number; // star points
  stars: number; // telegram stars sent by admin
}

export interface LoyaltySettings {
  progressionRule: ProgressionRule;
  baseRate: number; // points per purchased star before the multiplier
  levels: Level[];
  rewards: Reward[];
  redeemCooldownMinutes: number;
  referralPoints: number;
  referralAwardOn: ReferralAwardOn;
}

export const DEFAULT_LEVELS: Level[] = [
  { key: "new", name: "New", emoji: "🆕", threshold: 0, multiplier: 1.0, stars: 1, gradient: "var(--gradient-primary)" },
  { key: "bronze", name: "Bronze", emoji: "🥉", threshold: 1_000, multiplier: 1.1, stars: 2, gradient: "linear-gradient(135deg,#8a5a2b,#c98b4b)" },
  { key: "silver", name: "Silver", emoji: "🥈", threshold: 5_000, multiplier: 1.25, stars: 3, gradient: "linear-gradient(135deg,#7c8794,#c3ccd6)" },
  { key: "gold", name: "Gold", emoji: "🥇", threshold: 15_000, multiplier: 1.5, stars: 4, gradient: "linear-gradient(135deg,#b8860b,#f5c542)" },
  { key: "diamond", name: "Diamond", emoji: "💎", threshold: 40_000, multiplier: 2.0, stars: 5, gradient: "linear-gradient(135deg,#2a7bd6,#67e8f9)" },
];

export const DEFAULT_SETTINGS: LoyaltySettings = {
  progressionRule: "lifetime_stars",
  baseRate: 0.1,
  levels: DEFAULT_LEVELS,
  rewards: [
    { id: "r500", cost: 500, stars: 50 },
    { id: "r1000", cost: 1_000, stars: 100 },
  ],
  redeemCooldownMinutes: 5,
  referralPoints: 50,
  referralAwardOn: "first_purchase",
};

const SETTINGS_KEY = "starkerak.loyalty.settings.v1";
const LEDGER_KEY = "starkerak.loyalty.ledger.v1";
const REQUESTS_KEY = "starkerak.loyalty.requests.v1";

export interface Profile {
  name: string;
  telegramId: string;
  username: string;
  language: string;
  referralCode: string;
}

export const PROFILE: Profile = {
  name: "Ziyohiddin",
  telegramId: "784 512 903",
  username: "ziyohiddin",
  language: "O‘zbekcha",
  referralCode: "ZIYO-8452",
};

export const REFERRAL_POINTS = 0;

/* ---------------- settings ---------------- */

function emit() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("orders:changed"));
}

export function getSettings(): LoyaltySettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<LoyaltySettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      levels: parsed.levels?.length ? parsed.levels : DEFAULT_LEVELS,
      rewards: parsed.rewards?.length ? parsed.rewards : DEFAULT_SETTINGS.rewards,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(next: LoyaltySettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  emit();
}

export function resetSettings() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SETTINGS_KEY);
  emit();
}

/* ---------------- ledger ---------------- */

export type LedgerType = "earn" | "referral" | "mission" | "redeem" | "refund";

export interface LedgerEntry {
  id: string;
  createdAt: number;
  type: LedgerType;
  points: number; // positive = credit, negative = debit
  note: string;
}

function readManualLedger(): LedgerEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LEDGER_KEY);
    return raw ? (JSON.parse(raw) as LedgerEntry[]) : [];
  } catch {
    return [];
  }
}

function writeManualLedger(entries: LedgerEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LEDGER_KEY, JSON.stringify(entries));
  emit();
}

function counted(o: Order) {
  return o.status === "paid" || o.status === "delivered";
}

function progressValueFor(orders: Order[], rule: ProgressionRule): number {
  if (rule === "order_count") return orders.length;
  if (rule === "lifetime_spend") return orders.reduce((s, o) => s + o.amountUzs, 0);
  return orders.filter((o) => o.type === "stars").reduce((s, o) => s + o.quantity, 0);
}

export function levelFor(value: number, settings = getSettings()): Level {
  let current = settings.levels[0];
  for (const l of settings.levels) if (value >= l.threshold) current = l;
  return current;
}

export function nextLevel(level: Level, settings = getSettings()): Level | null {
  const i = settings.levels.findIndex((l) => l.key === level.key);
  return i >= 0 && i < settings.levels.length - 1 ? settings.levels[i + 1] : null;
}

/** Points earned per completed purchase, using the tier held at that moment. */
export function earnLedger(settings = getSettings()): LedgerEntry[] {
  const orders = getOrders().filter(counted);
  const sorted = [...orders].sort((a, b) => a.createdAt - b.createdAt);
  const entries: LedgerEntry[] = [];
  const seen: Order[] = [];
  for (const o of sorted) {
    if (o.type === "stars") {
      const level = levelFor(progressValueFor(seen, settings.progressionRule), settings);
      const points = Math.round(o.quantity * settings.baseRate * level.multiplier);
      entries.push({
        id: `earn-${o.id}`,
        createdAt: o.createdAt,
        type: "earn",
        points,
        note: `${o.quantity} Stars · ${level.emoji} ${level.name} ×${level.multiplier}`,
      });
    }
    seen.push(o);
  }
  return entries;
}

export function getLedger(settings = getSettings()): LedgerEntry[] {
  const referral: LedgerEntry[] = referralLedgerEntries().map((e) => ({
    ...e,
    type: "referral" as const,
  }));
  const missions: LedgerEntry[] = missionLedgerEntries().map((e) => ({
    ...e,
    type: "mission" as const,
  }));
  return [...earnLedger(settings), ...referral, ...missions, ...readManualLedger()].sort(
    (a, b) => b.createdAt - a.createdAt,
  );
}

/* ---------------- reward requests ---------------- */

export type RequestStatus = "pending" | "approved" | "completed" | "rejected";

export interface RewardRequest {
  id: number;
  createdAt: number;
  updatedAt: number;
  username: string;
  levelName: string;
  levelEmoji: string;
  rewardId: string;
  cost: number;
  stars: number;
  status: RequestStatus;
}

export function getRewardRequests(): RewardRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(REQUESTS_KEY);
    const list = raw ? (JSON.parse(raw) as RewardRequest[]) : [];
    return list.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

function writeRequests(list: RewardRequest[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REQUESTS_KEY, JSON.stringify(list));
  emit();
}

export type RedeemResult =
  | { ok: true; request: RewardRequest }
  | { ok: false; reason: "insufficient" | "cooldown" | "unknown_reward" };

export function redeemReward(rewardId: string): RedeemResult {
  const settings = getSettings();
  const reward = settings.rewards.find((r) => r.id === rewardId);
  if (!reward) return { ok: false, reason: "unknown_reward" };
  const stats = getLoyaltyStats();
  if (stats.points < reward.cost) return { ok: false, reason: "insufficient" };

  const now = Date.now();
  const existing = getRewardRequests();
  const last = existing[0];
  if (last && now - last.createdAt < settings.redeemCooldownMinutes * 60 * 1000) {
    return { ok: false, reason: "cooldown" };
  }

  const request: RewardRequest = {
    id: (existing.reduce((m, r) => Math.max(m, r.id), 0) || 100) + 1,
    createdAt: now,
    updatedAt: now,
    username: PROFILE.username,
    levelName: stats.level.name,
    levelEmoji: stats.level.emoji,
    rewardId: reward.id,
    cost: reward.cost,
    stars: reward.stars,
    status: "pending",
  };
  writeRequests([request, ...existing]);
  writeManualLedger([
    ...readManualLedger(),
    {
      id: `redeem-${request.id}`,
      createdAt: now,
      type: "redeem",
      points: -reward.cost,
      note: `${reward.stars} Telegram Stars uchun so‘rov #${request.id}`,
    },
  ]);
  return { ok: true, request };
}

export function setRequestStatus(id: number, status: RequestStatus) {
  const list = getRewardRequests();
  const target = list.find((r) => r.id === id);
  if (!target) return;
  if (status === "rejected" && target.status !== "rejected") {
    // refund the points
    writeManualLedger([
      ...readManualLedger(),
      {
        id: `refund-${id}-${Date.now()}`,
        createdAt: Date.now(),
        type: "refund",
        points: target.cost,
        note: `So‘rov #${id} rad etildi — ball qaytarildi`,
      },
    ]);
  }
  writeRequests(
    list.map((r) => (r.id === id ? { ...r, status, updatedAt: Date.now() } : r)),
  );
}

/* ---------------- aggregate stats ---------------- */

export interface LoyaltyStats {
  settings: LoyaltySettings;
  completedOrders: number;
  lifetimeStars: number;
  starsOrders: number;
  premiumOrders: number;
  premiumMonths: number;
  spentUzs: number;
  progressValue: number;
  level: Level;
  next: Level | null;
  toNextLevel: number;
  levelProgress: number; // 0..1
  earnedPoints: number;
  redeemedPoints: number;
  referralPoints: number;
  referralCount: number;
  referralPurchasedCount: number;
  friends: Friend[];
  points: number;
  nextReward: Reward | null;
  pointsToNextReward: number;
  rewardProgress: number; // 0..1
  requests: RewardRequest[];
  ledger: LedgerEntry[];
}

export function getLoyaltyStats(): LoyaltyStats {
  const settings = getSettings();
  syncReferralAwards(settings.referralPoints, settings.referralAwardOn);
  const friends = getFriends();
  const orders = getOrders().filter(counted);
  const lifetimeStars = orders
    .filter((o) => o.type === "stars")
    .reduce((s, o) => s + o.quantity, 0);
  const premium = orders.filter((o) => o.type !== "stars");
  const spentUzs = orders.reduce((s, o) => s + o.amountUzs, 0);

  const progressValue = progressValueFor(orders, settings.progressionRule);
  const level = levelFor(progressValue, settings);
  const next = nextLevel(level, settings);
  const toNextLevel = next ? Math.max(0, next.threshold - progressValue) : 0;
  const levelProgress = next
    ? Math.min(1, Math.max(0, (progressValue - level.threshold) / (next.threshold - level.threshold)))
    : 1;

  const ledger = getLedger(settings);
  const earnedPoints = ledger.filter((e) => e.type === "earn").reduce((s, e) => s + e.points, 0);
  const referralPoints = ledger.filter((e) => e.type === "referral").reduce((s, e) => s + e.points, 0);
  const redeemedPoints = -ledger.filter((e) => e.type === "redeem").reduce((s, e) => s + e.points, 0);
  const points = Math.max(0, ledger.reduce((s, e) => s + e.points, 0));

  const sortedRewards = [...settings.rewards].sort((a, b) => a.cost - b.cost);
  const nextReward = sortedRewards.find((r) => r.cost > points) ?? sortedRewards[sortedRewards.length - 1] ?? null;
  const pointsToNextReward = nextReward ? Math.max(0, nextReward.cost - points) : 0;

  return {
    settings,
    completedOrders: orders.length,
    lifetimeStars,
    starsOrders: orders.filter((o) => o.type === "stars").length,
    premiumOrders: premium.length,
    premiumMonths: premium.reduce((s, o) => s + o.quantity, 0),
    spentUzs,
    progressValue,
    level,
    next,
    toNextLevel,
    levelProgress,
    earnedPoints,
    redeemedPoints,
    referralPoints,
    referralCount: friends.length,
    referralPurchasedCount: friends.filter((f) => f.purchasedAt).length,
    friends,
    points,
    nextReward,
    pointsToNextReward,
    rewardProgress: nextReward ? Math.min(1, points / nextReward.cost) : 1,
    requests: getRewardRequests(),
    ledger,
  };
}

export const RULE_LABELS: Record<ProgressionRule, "ruleLifetimeStars" | "ruleLifetimeSpend" | "ruleOrderCount"> = {
  lifetime_stars: "ruleLifetimeStars",
  lifetime_spend: "ruleLifetimeSpend",
  order_count: "ruleOrderCount",
};

export const STATUS_LABELS: Record<
  RequestStatus,
  { key: "reqPending" | "reqApproved" | "reqCompleted" | "reqRejected"; dot: string }
> = {
  pending: { key: "reqPending", dot: "🟡" },
  approved: { key: "reqApproved", dot: "🔵" },
  completed: { key: "reqCompleted", dot: "🟢" },
  rejected: { key: "reqRejected", dot: "🔴" },
};
