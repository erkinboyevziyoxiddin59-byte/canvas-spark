import { useEffect, useState } from "react";
import { PROFILE } from "../lib/loyalty";

export interface TgUser {
  name: string;
  username: string | null;
  telegramId: string;
  photoUrl: string | null;
  language: string;
  isTelegram: boolean;
}

const FALLBACK: TgUser = {
  name: PROFILE.name,
  username: PROFILE.username,
  telegramId: PROFILE.telegramId,
  photoUrl: null,
  language: PROFILE.language,
  isTelegram: false,
};

const LANGS: Record<string, string> = {
  uz: "O‘zbekcha",
  ru: "Русский",
  en: "English",
};

export function useTelegramUser(): TgUser {
  const [user, setUser] = useState<TgUser>(FALLBACK);

  useEffect(() => {
    const wa = (window as any)?.Telegram?.WebApp;
    if (!wa) return;
    try {
      wa.ready?.();
      wa.expand?.();
    } catch {
      /* noop */
    }
    const u = wa.initDataUnsafe?.user;
    if (!u) return;
    const name = [u.first_name, u.last_name].filter(Boolean).join(" ") || FALLBACK.name;
    setUser({
      name,
      username: u.username ?? null,
      telegramId: String(u.id),
      photoUrl: u.photo_url ?? null,
      language: LANGS[u.language_code as string] ?? (u.language_code ?? FALLBACK.language),
      isTelegram: true,
    });
  }, []);

  return user;
}
