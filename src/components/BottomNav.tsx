import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Star, Target, ListChecks, User } from "lucide-react";
import { useT } from "../lib/language";

const items = [
  { to: "/", key: "navHome", icon: Home },
  { to: "/missions", key: "navMissions", icon: Target },
  { to: "/points", key: "navPoints", icon: Star },
  { to: "/orders", key: "navOrders", icon: ListChecks },
  { to: "/profile", key: "navProfile", icon: User },
] as const;


export function BottomNav() {
  const t = useT();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="sticky bottom-0 z-40 border-t border-border bg-background/85 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto grid max-w-md grid-cols-5">

        {items.map(({ to, key, icon: Icon }) => {
          const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
          return (
            <li key={to}>
              <Link
                to={to}
                className="no-tap-highlight flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors"
                style={{ color: active ? "var(--color-primary-glow)" : "var(--color-muted-foreground)" }}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                <span>{t[key]}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
