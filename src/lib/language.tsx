import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DICTS, uz, type Dict, type Lang } from "./i18n";

const STORAGE_KEY = "starbbot:lang";

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Dict;
  /** true once we've read localStorage on the client */
  ready: boolean;
  /** true when the user has explicitly picked a language */
  hasChosen: boolean;
}

const LanguageContext = createContext<Ctx>({
  lang: "uz",
  setLang: () => {},
  t: uz,
  ready: false,
  hasChosen: false,
});

function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "uz" || saved === "ru") return saved;
    const code = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user?.language_code as
      | string
      | undefined;
    if (code?.startsWith("ru")) return "ru";
  } catch {
    /* noop */
  }
  return "uz";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("uz");
  const [ready, setReady] = useState(false);
  const [hasChosen, setHasChosen] = useState(false);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
    setLangState(detectLang());
    setHasChosen(saved === "uz" || saved === "ru");
    setReady(true);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    setHasChosen(true);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* noop */
    }
    if (typeof document !== "undefined") document.documentElement.lang = l;
  }, []);

  const value = useMemo(
    () => ({ lang, setLang, t: DICTS[lang], ready, hasChosen }),
    [lang, setLang, ready, hasChosen],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}


export function useI18n() {
  return useContext(LanguageContext);
}

export function useT(): Dict {
  return useContext(LanguageContext).t;
}
