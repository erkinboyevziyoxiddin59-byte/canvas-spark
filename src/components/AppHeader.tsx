import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  back?: boolean;
  right?: ReactNode;
}

export function AppHeader({ title, subtitle, back, right }: Props) {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const showBack = back ?? pathname !== "/";
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex max-w-md items-center gap-2 px-4 py-3">
        {showBack ? (
          <button
            onClick={() => router.history.back()}
            className="no-tap-highlight -ml-2 rounded-full p-2 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Back"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : (
          <Link to="/" className="text-lg font-semibold tracking-tight">
            ⭐ Starbbot
          </Link>
        )}
        {showBack && (
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold leading-tight">{title}</h1>
            {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        )}
        {!showBack && <div className="flex-1" />}
        {right}
      </div>
    </header>
  );
}
