export const THEME_STORAGE_KEY = "signaldesk-theme";
export const THEME_IDS = ["finance", "clear", "studio", "markets"] as const;
export type ThemeId = (typeof THEME_IDS)[number];
export const DEFAULT_THEME: ThemeId = "finance";

export type ThemeOption = {
  id: ThemeId;
  name: string;
  note: string;
};

export const THEMES: ThemeOption[] = [
  { id: "finance", name: "Finance", note: "Dark terminal. Hairlines, blotter, tabular figures." },
  { id: "clear", name: "Clear", note: "Same desk layout in light colors." },
  { id: "studio", name: "Studio", note: "Dark product desk. Rounded panels, soft glow." },
  { id: "markets", name: "Markets", note: "CoinMarketCap-style. Navy, Inter, blue underline." },
];

export function isThemeId(value: string | null | undefined): value is ThemeId {
  return Boolean(value && (THEME_IDS as readonly string[]).includes(value));
}

export function readTheme(): ThemeId {
  if (typeof window === "undefined") {
    return DEFAULT_THEME;
  }
  const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isThemeId(raw) ? raw : DEFAULT_THEME;
}

export function writeTheme(id: ThemeId): void {
  window.localStorage.setItem(THEME_STORAGE_KEY, id);
}

export function applyTheme(id: ThemeId): void {
  document.documentElement.dataset.theme = id;
}

export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var ok=${JSON.stringify(THEME_IDS)};document.documentElement.dataset.theme=ok.indexOf(t)>=0?t:${JSON.stringify(DEFAULT_THEME)};}catch(e){document.documentElement.dataset.theme=${JSON.stringify(DEFAULT_THEME)};}})();`;
