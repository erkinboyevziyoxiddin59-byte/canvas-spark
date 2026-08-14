// Referral program (client-side mock, mirrors the rest of this Mini App).
// Referrers earn Star Points — never free Stars — when an invited friend joins
// and (by default) completes their first purchase.

export const BOT_USERNAME = "Starbbot";

const FRIENDS_KEY = "starbbot.referrals.v1";
const INVITED_BY_KEY = "starbbot.referrals.invitedby.v1";

export interface Friend {
  id: string;
  name: string;
  username: string | null;
  joinedAt: number;
  purchasedAt: number | null;
  awardedPoints: number;
  awardedAt: number | null;
}

function emit() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("orders:changed"));
}

export function referralCodeFor(telegramId: string): string {
  return `ref_${telegramId.replace(/\D/g, "") || "0"}`;
}

export function referralLink(code: string): string {
  return `https://t.me/${BOT_USERNAME}?start=${code}`;
}

export function referralShareUrl(link: string, text: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
}

/** Opens Telegram's native share sheet inside the Mini App, or a normal tab outside it. */
export function shareReferralLink(link: string, text: string) {
  if (typeof window === "undefined") return;
  const url = referralShareUrl(link, text);
  const wa = (window as any)?.Telegram?.WebApp;
  if (wa?.openTelegramLink) {
    wa.openTelegramLink(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

/* ---------------- invited friends ---------------- */

export function getFriends(): Friend[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FRIENDS_KEY);
    const list = raw ? (JSON.parse(raw) as Friend[]) : [];
    return list.sort((a, b) => b.joinedAt - a.joinedAt);
  } catch {
    return [];
  }
}

function writeFriends(list: Friend[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FRIENDS_KEY, JSON.stringify(list));
  emit();
}

export function addFriend(friend: Pick<Friend, "id" | "name" | "username">) {
  const list = getFriends();
  if (list.some((f) => f.id === friend.id)) return;
  writeFriends([
    { ...friend, joinedAt: Date.now(), purchasedAt: null, awardedPoints: 0, awardedAt: null },
    ...list,
  ]);
}

export function markFriendPurchased(id: string) {
  const list = getFriends();
  const target = list.find((f) => f.id === id);
  if (!target || target.purchasedAt) return;
  writeFriends(list.map((f) => (f.id === id ? { ...f, purchasedAt: Date.now() } : f)));
}

/**
 * Credits any friend that satisfies the award rule and has not been paid yet.
 * Returns true when something changed.
 */
export function syncReferralAwards(points: number, awardOn: ReferralAwardOn): boolean {
  const list = getFriends();
  let changed = false;
  const next = list.map((f) => {
    if (f.awardedAt) return f;
    const eligible = awardOn === "registration" ? true : Boolean(f.purchasedAt);
    if (!eligible || points <= 0) return f;
    changed = true;
    return { ...f, awardedPoints: points, awardedAt: Date.now() };
  });
  if (changed) writeFriends(next);
  return changed;
}

export type ReferralAwardOn = "registration" | "first_purchase";

export interface ReferralLedgerEntry {
  id: string;
  createdAt: number;
  points: number;
  note: string;
}

export function referralLedgerEntries(): ReferralLedgerEntry[] {
  return getFriends()
    .filter((f) => f.awardedAt && f.awardedPoints > 0)
    .map((f) => ({
      id: `referral-${f.id}`,
      createdAt: f.awardedAt as number,
      points: f.awardedPoints,
      note: `Referal bonusi — ${f.username ? `@${f.username}` : f.name}`,
    }));
}

/* ---------------- inbound deep link ---------------- */

export function getInvitedBy(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(INVITED_BY_KEY);
}

/** Reads `start_param` (t.me/Bot?start=ref_123) once and remembers the inviter. */
export function captureStartParam() {
  if (typeof window === "undefined") return;
  const wa = (window as any)?.Telegram?.WebApp;
  const param: string | undefined =
    wa?.initDataUnsafe?.start_param ??
    new URLSearchParams(window.location.search).get("tgWebAppStartParam") ??
    undefined;
  if (!param || !param.startsWith("ref_")) return;
  if (window.localStorage.getItem(INVITED_BY_KEY)) return;
  window.localStorage.setItem(INVITED_BY_KEY, param);
  emit();
}
