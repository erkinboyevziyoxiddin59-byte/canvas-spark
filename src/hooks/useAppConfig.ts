import { useQuery } from "@tanstack/react-query";
import { getAppConfig, type ApiAppConfig } from "../lib/config.functions";

export const DEFAULT_CONFIG: ApiAppConfig = {
  pricing: { starPriceUzs: 200, premium: { "3": 55000, "6": 95000, "12": 170000 }, minStars: 50, maxStars: 5000 },
  maintenance: { enabled: false, message: "" },
  botUsername: "StarKerakBot",
};

/** Public app configuration (pricing, maintenance, bot username) from the server. */
export function useAppConfig() {
  const query = useQuery<ApiAppConfig>({
    queryKey: ["app-config"],
    queryFn: () => getAppConfig(),
    staleTime: 60_000,
  });
  return {
    config: query.data ?? DEFAULT_CONFIG,
    isLoading: query.isLoading,
    isReady: query.isSuccess,
    error: query.error as Error | null,
  };
}
