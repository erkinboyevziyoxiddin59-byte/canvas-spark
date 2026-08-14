import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { BottomNav } from "../components/BottomNav";
import { LanguageProvider } from "../lib/language";
import { LanguageGate } from "../components/LanguageGate";
import { MaintenanceGate } from "../components/MaintenanceGate";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-6xl font-bold">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sahifa topilmadi. / Страница не найдена.</p>
        <a
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold btn-primary-glow"
        >
          Bosh sahifa
        </a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-lg font-semibold">Xatolik yuz berdi</h1>
        <p className="mt-2 text-sm text-muted-foreground">Iltimos, qayta urinib ko‘ring.</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold btn-primary-glow"
        >
          Qayta urinish
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#17212b" },
      { title: "Starbbot — Telegram Stars & Premium" },
      { name: "description", content: "Telegram Stars va Premium obunani bir necha daqiqada sotib oling." },
      { property: "og:title", content: "Starbbot — Telegram Stars & Premium" },
      { property: "og:description", content: "Telegram Stars va Premium obunani bir necha daqiqada sotib oling." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
      },
    ],
    scripts: [{ src: "https://telegram.org/js/telegram-web-app.js", defer: true }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="uz">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <LanguageGate>
          <MaintenanceGate>
          <div className="mx-auto flex min-h-screen max-w-md flex-col">
            <div className="flex-1 pb-2">
              <Outlet />
            </div>
            <BottomNav />
          </div>
          </MaintenanceGate>
        </LanguageGate>
      </LanguageProvider>
    </QueryClientProvider>

  );
}
