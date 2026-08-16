import { type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Wrench, Star } from "lucide-react";
import { useAppConfig } from "../hooks/useAppConfig";
import { useT } from "../lib/language";

export function MaintenanceGate({ children }: { children: ReactNode }) {
  const t = useT();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { config, isReady } = useAppConfig();
  const state = config.maintenance;

  const isAdminRoute = pathname.startsWith("/admin");
  if (!isReady || isAdminRoute || !state.enabled) return <>{children}</>;


  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 12 }, (_, i) => (
          <Star
            key={i}
            className="absolute star-float"
            style={{
              left: `${(i * 41) % 100}%`,
              top: `${(i * 59) % 100}%`,
              width: 10 + ((i * 5) % 18),
              height: 10 + ((i * 5) % 18),
              opacity: 0.15 + (i % 4) * 0.08,
              color: "oklch(0.82 0.16 85)",
              fill: "oklch(0.82 0.16 85)",
              animationDelay: `${(i % 7) * 0.5}s`,
              animationDuration: `${5 + (i % 5)}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center">
        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl border border-border bg-card">
          <Wrench className="h-9 w-9 text-primary" />
        </div>
        <h1 className="text-xl font-bold">{t.maintenanceTitle}</h1>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          {state.message.trim() || t.maintenanceDesc}
        </p>
      </div>
    </div>
  );
}
