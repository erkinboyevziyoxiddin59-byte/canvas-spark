import { createServerFn } from "@tanstack/react-start";
import type { TelegramUserPayload } from "./server/core.server";

export interface SessionUser {
  id: string;
  telegramId: string;
  name: string;
  username: string | null;
  photoUrl: string | null;
  languageCode: string | null;
  referralCode: string;
  isAdmin: boolean;
  isBlocked: boolean;
}

/**
 * Exchanges a signed Telegram initData string for an encrypted server session.
 * `initDataUnsafe` is never accepted as proof of identity.
 */
export const authenticate = createServerFn({ method: "POST" })
  .inputValidator((input: { initData?: string | null; startParam?: string | null; devTelegramId?: number | null }) => ({
    initData: input.initData ?? null,
    startParam: input.startParam ?? null,
    devTelegramId: input.devTelegramId ?? null,
  }))
  .handler(async ({ data }): Promise<SessionUser> => {
    const core = await import("./server/core.server");
    // Fail closed when a production deployment still allows dev authentication.
    core.assertDevAuthConfig();

    let payload: TelegramUserPayload;
    if (data.initData) {
      payload = await core.verifyInitData(data.initData);
    } else if (core.devAuthEnabled()) {
      const id = data.devTelegramId && data.devTelegramId > 0 ? data.devTelegramId : 900000001;
      payload = {
        telegram_id: id,
        username: `dev${id}`,
        first_name: "Dev",
        last_name: `User ${id}`,
        photo_url: null,
        language_code: "uz",
      };
    } else {
      throw new core.AppError("invalid_init_data");
    }


    const user = await core.upsertTelegramUser(payload);
    await core.attachReferral(user, data.startParam);
    await core.setSessionUser(user.id, String(user.telegram_id));

    return {
      id: user.id,
      telegramId: String(user.telegram_id),
      name: [user.first_name, user.last_name].filter(Boolean).join(" ") || `@${user.username ?? user.telegram_id}`,
      username: user.username,
      photoUrl: user.photo_url,
      languageCode: user.language_code,
      referralCode: user.referral_code,
      isAdmin: await core.isAdmin(user.id),
      isBlocked: user.is_blocked,
    };
  });

/** Returns the current session user, or null when not authenticated. */
export const getSession = createServerFn({ method: "GET" }).handler(async (): Promise<SessionUser | null> => {
  const core = await import("./server/core.server");
  const user = await core.getCurrentUser();
  if (!user) return null;
  return {
    id: user.id,
    telegramId: String(user.telegram_id),
    name: [user.first_name, user.last_name].filter(Boolean).join(" ") || `@${user.username ?? user.telegram_id}`,
    username: user.username,
    photoUrl: user.photo_url,
    languageCode: user.language_code,
    referralCode: user.referral_code,
    isAdmin: await core.isAdmin(user.id),
    isBlocked: user.is_blocked,
  };
});

export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  const core = await import("./server/core.server");
  await core.clearSessionUser();
  return { ok: true };
});
