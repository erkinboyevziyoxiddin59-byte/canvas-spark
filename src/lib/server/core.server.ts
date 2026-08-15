// Server-only core: Supabase admin access, Telegram initData verification,
// encrypted session cookie and authorization helpers.
// NEVER import this from client code or from the module scope of a *.functions.ts file.
import { useSession } from "@tanstack/react-start/server";
import { supabaseAdmin } from "../../integrations/supabase/client.server";
import type { Database } from "../../integrations/supabase/types";

export type DbUser = Database["public"]["Tables"]["users"]["Row"];

export const db = supabaseAdmin;

/** Business error whose message is a stable code the UI can translate. */
export class AppError extends Error {
  constructor(code: string) {
    super(code);
    this.name = "AppError";
  }
}

/* ---------------- session ---------------- */

interface SessionData {
  userId?: string;
  telegramId?: string;
}

function sessionConfig() {
  const password = process.env["SESSION_SECRET"];
  if (!password) throw new AppError("session_not_configured");
  return {
    password,
    name: "starkerak_session",
    maxAge: 60 * 60 * 24 * 30,
    cookie: { httpOnly: true, sameSite: "none" as const, secure: true, path: "/" },
  };
}

export async function readSession() {
  return useSession<SessionData>(sessionConfig());
}

export async function setSessionUser(userId: string, telegramId: string) {
  const session = await readSession();
  await session.update({ userId, telegramId });
}

export async function clearSessionUser() {
  const session = await readSession();
  await session.clear();
}

/* ---------------- telegram initData ---------------- */

export interface TelegramUserPayload {
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
  language_code: string | null;
}

const encoder = new TextEncoder();

async function hmac(key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Verifies the signed Telegram WebApp initData string.
 * Returns the trusted user payload, or throws AppError('invalid_init_data').
 */
export async function verifyInitData(initData: string): Promise<TelegramUserPayload> {
  const botToken = process.env["TELEGRAM_BOT_TOKEN"];
  if (!botToken) throw new AppError("telegram_not_configured");

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) throw new AppError("invalid_init_data");
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .map(([k, v]) => [k, v] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secretKey = await hmac(encoder.encode("WebAppData"), botToken);
  const signature = toHex(await hmac(secretKey, dataCheckString));
  if (signature !== hash) throw new AppError("invalid_init_data");

  const authDate = Number(params.get("auth_date") ?? 0);
  if (!authDate || Date.now() / 1000 - authDate > 60 * 60 * 24) {
    throw new AppError("init_data_expired");
  }

  const rawUser = params.get("user");
  if (!rawUser) throw new AppError("invalid_init_data");
  const u = JSON.parse(rawUser) as {
    id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
    photo_url?: string;
    language_code?: string;
  };
  if (!u?.id) throw new AppError("invalid_init_data");

  return {
    telegram_id: u.id,
    username: u.username ?? null,
    first_name: u.first_name ?? null,
    last_name: u.last_name ?? null,
    photo_url: u.photo_url ?? null,
    language_code: u.language_code ?? null,
  };
}

/* ---------------- environment / dev auth guard ---------------- */

/**
 * True when the server is running a production deployment.
 * Derived from the runtime environment, never from the dev-auth flag itself.
 */
export function isProduction(): boolean {
  const appEnv = (process.env["APP_ENV"] ?? process.env["LOVABLE_ENV"] ?? "").toLowerCase();
  if (appEnv) return appEnv === "production" || appEnv === "prod";
  return (process.env["NODE_ENV"] ?? "").toLowerCase() === "production";
}

let devAuthMisconfigLogged = false;

/**
 * Dev auth (session without signed Telegram initData) is a development-only escape hatch.
 * In production ALLOW_DEV_AUTH must be explicitly "false"; anything else is a
 * misconfiguration and we fail closed instead of issuing a fake identity.
 */
export function assertDevAuthConfig(): void {
  if (!isProduction()) return;
  const flag = process.env["ALLOW_DEV_AUTH"];
  if (flag === "false") return;
  if (!devAuthMisconfigLogged) {
    devAuthMisconfigLogged = true;
    console.error(
      `[security] ALLOW_DEV_AUTH must be explicitly "false" in production (got ${flag === undefined ? "unset" : JSON.stringify(flag)}). Dev authentication is disabled and authentication will fail until this is fixed.`,
    );
  }
  throw new AppError("dev_auth_misconfigured");
}

export function devAuthEnabled(): boolean {
  // Never available in production, regardless of the flag value.
  if (isProduction()) return false;
  return process.env["ALLOW_DEV_AUTH"] === "true";
}


/* ---------------- users ---------------- */

export function referralCodeFor(telegramId: number | string): string {
  return `ref_${String(telegramId).replace(/\D/g, "")}`;
}

function adminTelegramIds(): string[] {
  return (process.env["ADMIN_TELEGRAM_IDS"] ?? "")
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Creates or refreshes the user row for a verified Telegram identity. */
export async function upsertTelegramUser(payload: TelegramUserPayload): Promise<DbUser> {
  const { data, error } = await db
    .from("users")
    .upsert(
      {
        telegram_id: payload.telegram_id,
        username: payload.username,
        first_name: payload.first_name,
        last_name: payload.last_name,
        photo_url: payload.photo_url,
        language_code: payload.language_code,
        referral_code: referralCodeFor(payload.telegram_id),
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "telegram_id" },
    )
    .select()
    .single();

  if (error || !data) throw new AppError("user_upsert_failed");

  if (adminTelegramIds().includes(String(payload.telegram_id))) {
    await db.from("user_roles").upsert({ user_id: data.id, role: "admin" }, { onConflict: "user_id,role" });
  }
  await db.from("user_roles").upsert({ user_id: data.id, role: "user" }, { onConflict: "user_id,role" });

  return data;
}

/** Attributes a referral once, ignoring self-referrals and duplicates. */
export async function attachReferral(user: DbUser, startParam: string | null | undefined) {
  if (!startParam || user.referred_by) return;
  const code = startParam.trim();
  if (!code.startsWith("ref_")) return;
  if (code === user.referral_code) return;

  const { data: referrer } = await db
    .from("users")
    .select("id")
    .eq("referral_code", code)
    .maybeSingle();
  if (!referrer || referrer.id === user.id) return;

  const { error } = await db
    .from("referrals")
    .insert({ referrer_id: referrer.id, referred_id: user.id });
  if (error) return; // unique / check constraint => already referred or self-referral

  await db.from("users").update({ referred_by: referrer.id }).eq("id", user.id);
}

/* ---------------- authorization ---------------- */

export async function getCurrentUser(): Promise<DbUser | null> {
  const session = await readSession();
  const userId = session.data.userId;
  if (!userId) return null;
  const { data } = await db.from("users").select("*").eq("id", userId).maybeSingle();
  return data ?? null;
}

export async function requireUser(): Promise<DbUser> {
  const user = await getCurrentUser();
  if (!user) throw new AppError("unauthorized");
  if (user.is_blocked) throw new AppError("blocked");
  return user;
}

export async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await db.rpc("has_role", { _user_id: userId, _role: "admin" });
  return data === true;
}

export async function requireAdmin(): Promise<DbUser> {
  const user = await requireUser();
  if (!(await isAdmin(user.id))) throw new AppError("forbidden");
  return user;
}

export async function audit(
  actorId: string,
  action: string,
  entity: string,
  entityId: string | null,
  payload: Record<string, unknown> = {},
) {
  await db.from("admin_audit_log").insert({
    actor_id: actorId,
    action,
    entity,
    entity_id: entityId,
    payload: payload as never,
  });
}

/* ---------------- settings ---------------- */

export interface PricingSettings {
  starPriceUzs: number;
  premium: Record<string, number>;
  minStars: number;
  maxStars: number;
}
export interface PaymentSettings {
  cardNumber: string;
  cardHolder: string;
  orderExpireMinutes: number;
}
export interface MaintenanceSettings {
  enabled: boolean;
  message: string;
}
export interface LoyaltySettingsRow {
  progressionRule: string;
  baseRate: number;
  redeemCooldownMinutes: number;
  referralPoints: number;
  referralAwardOn: string;
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const { data } = await db.from("app_settings").select("value").eq("key", key).maybeSingle();
  return (data?.value as T | undefined) ?? fallback;
}

export const DEFAULT_PRICING: PricingSettings = {
  starPriceUzs: 200,
  premium: { "3": 55000, "6": 95000, "12": 170000 },
  minStars: 50,
  maxStars: 5000,
};
export const DEFAULT_PAYMENT: PaymentSettings = {
  cardNumber: "9860 1666 5354 5375",
  cardHolder: "E. Z.",
  orderExpireMinutes: 10,
};
export const DEFAULT_MAINTENANCE: MaintenanceSettings = { enabled: false, message: "" };
export const DEFAULT_LOYALTY: LoyaltySettingsRow = {
  progressionRule: "lifetime_stars",
  baseRate: 0.1,
  redeemCooldownMinutes: 5,
  referralPoints: 50,
  referralAwardOn: "first_purchase",
};
