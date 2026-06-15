import { createContext, useContext, useState } from 'react';
import { type LangCode, RTL_LANGS, translations } from '../app/i18n';

export type { LangCode };

type T = typeof translations['fa'];

interface LangCtx {
  lang: LangCode;
  setLang: (l: LangCode) => void;
  t: T;
  isRTL: boolean;
}

const VALID: LangCode[] = ['fa', 'en', 'tr', 'ar', 'fr', 'zh'];

function readLang(): LangCode {
  try {
    const v = localStorage.getItem('cp_lang') as LangCode;
    return VALID.includes(v) ? v : 'fa';
  } catch {
    return 'fa';
  }
}

const Ctx = createContext<LangCtx>({
  lang: 'fa',
  setLang: () => {},
  t: translations['fa'],
  isRTL: true,
});

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<LangCode>(readLang);

  const setLang = (l: LangCode) => {
    try { localStorage.setItem('cp_lang', l); } catch {}
    setLangState(l);
  };

  const t = translations[lang];
  const isRTL = RTL_LANGS.includes(lang);

  return <Ctx.Provider value={{ lang, setLang, t, isRTL }}>{children}</Ctx.Provider>;
}

export const useLang = () => useContext(Ctx);
