import { useMemo, useState, type ReactNode } from "react";
import { Star, Check } from "lucide-react";
import { useI18n } from "../lib/language";
import type { Lang } from "../lib/i18n";

const OPTIONS: { code: Lang; name: string; native: string; flag: string; hint: string }[] = [
  { code: "uz", name: "O‘zbekcha", native: "Uzbek", flag: "🇺🇿", hint: "Ilovani o‘zbek tilida oching" },
  { code: "ru", name: "Русский", native: "Russian", flag: "🇷🇺", hint: "Откройте приложение на русском" },
];

function StarField() {
  const stars = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        left: (i * 37) % 100,
        top: (i * 53) % 100,
        size: 8 + ((i * 7) % 20),
        delay: (i % 9) * 0.45,
        duration: 5 + ((i * 3) % 6),
        opacity: 0.18 + ((i % 5) * 0.12),
      })),
    [],
  );
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {stars.map((s) => (
        <Star
          key={s.id}
          className="absolute star-float"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            opacity: s.opacity,
            color: "oklch(0.82 0.16 85)",
            fill: "oklch(0.82 0.16 85)",
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

export function LanguageGate({ children }: { children: ReactNode }) {
  const { ready, hasChosen, setLang } = useI18n();
  const [picked, setPicked] = useState<Lang | null>(null);

  if (!ready) {
    return <div className="min-h-screen bg-background" />;
  }

  if (hasChosen && !picked) return <>{children}</>;
  if (picked && hasChosen) return <>{children}</>;

  const choose = (code: Lang) => {
    setPicked(code);
    window.setTimeout(() => setLang(code), 420);
  };

  return (
    <div className="relative flex min-h-screen flex-col justify-center overflow-hidden px-6 py-10">
      <div className="gate-glow" aria-hidden />
      <StarField />

      <div className="relative z-10 animate-fade-in">
        <div className="flex flex-col items-center text-center">
          <div className="star-badge">
            <Star className="h-11 w-11" strokeWidth={1.6} style={{ fill: "white", color: "white" }} />
          </div>
          <h1 className="mt-6 text-2xl font-extrabold tracking-tight">
            <span className="gold-text">Starbbot</span>
          </h1>
          <p className="mt-2 max-w-[16rem] text-sm text-muted-foreground">
            Telegram Stars &amp; Premium · Tilni tanlang / Выберите язык
          </p>
        </div>

        <div className="mt-9 space-y-3">
          {OPTIONS.map((o, i) => {
            const active = picked === o.code;
            return (
              <button
                key={o.code}
                type="button"
                onClick={() => choose(o.code)}
                className="no-tap-highlight lang-card group w-full text-left"
                data-active={active}
                style={{ animationDelay: `${120 + i * 90}ms` }}
              >
                <span className="text-2xl leading-none">{o.flag}</span>
                <span className="flex-1">
                  <span className="block text-base font-bold">{o.name}</span>
                  <span className="block text-xs text-muted-foreground">{o.hint}</span>
                </span>
                <span className="lang-check">
                  {active ? <Check className="h-4 w-4" strokeWidth={3} /> : null}
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-7 text-center text-[11px] text-muted-foreground">
          Keyinchalik profilda o‘zgartirishingiz mumkin · Можно изменить в профиле
        </p>
      </div>
    </div>
  );
}
