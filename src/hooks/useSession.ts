import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authenticate, getSession, type SessionUser } from "../lib/auth.functions";

interface TelegramWebApp {
  initData?: string;
  initDataUnsafe?: { start_param?: string };
  ready?: () => void;
  expand?: () => void;
}

function webApp(): TelegramWebApp | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp ?? null;
}

/**
 * Establishes the server session from signed Telegram initData.
 * The client never asserts who the user is — the server verifies the signature.
 */
export function useSession() {
  const queryClient = useQueryClient();

  const query = useQuery<SessionUser | null>({
    queryKey: ["session"],
    queryFn: async () => {
      const wa = webApp();
      try {
        wa?.ready?.();
        wa?.expand?.();
      } catch {
        /* noop */
      }

      const existing = await getSession();
      if (existing) return existing;

      const startParam =
        wa?.initDataUnsafe?.start_param ??
        (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("startapp") : null);

      const devTelegramId =
        typeof window !== "undefined"
          ? Number(new URLSearchParams(window.location.search).get("dev_tg")) || null
          : null;

      return authenticate({
        data: { initData: wa?.initData || null, startParam, devTelegramId },
      });
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    if (query.data) queryClient.invalidateQueries({ queryKey: ["profile"] });
  }, [query.data?.id, queryClient]);

  return {
    session: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    isAdmin: query.data?.isAdmin ?? false,
  };
}
