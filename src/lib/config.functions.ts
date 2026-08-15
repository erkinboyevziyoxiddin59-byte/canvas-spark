import { createServerFn } from "@tanstack/react-start";

export interface ApiAppConfig {
  pricing: {
    starPriceUzs: number;
    premium: Record<string, number>;
    minStars: number;
    maxStars: number;
  };
  maintenance: { enabled: boolean; message: string };
  botUsername: string;
}

/** Public, read-only app configuration used by the purchase screens and the maintenance gate. */
export const getAppConfig = createServerFn({ method: "GET" }).handler(async (): Promise<ApiAppConfig> => {
  const core = await import("./server/core.server");
  const [pricing, maintenance, bot] = await Promise.all([
    core.getSetting("pricing", core.DEFAULT_PRICING),
    core.getSetting("maintenance", core.DEFAULT_MAINTENANCE),
    core.getSetting<{ username: string }>("bot", { username: "StarKerakBot" }),
  ]);
  return { pricing, maintenance, botUsername: bot.username };
});
