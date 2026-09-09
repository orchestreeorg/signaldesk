"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { applyTheme, DEFAULT_THEME, isThemeId, readTheme, writeTheme, type ThemeId } from "./theme";

type ThemeContextValue = {
  theme: ThemeId;
  setTheme: (id: ThemeId) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  setTheme: () => undefined,
});

function bootTheme(): ThemeId {
  if (typeof document === "undefined") {
    return DEFAULT_THEME;
  }
  const applied = document.documentElement.dataset.theme;
  return isThemeId(applied) ? applied : DEFAULT_THEME;
}

export function ThemeProvider(props: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(bootTheme);

  useEffect(() => {
    const next = readTheme();
    setThemeState(next);
    applyTheme(next);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme: (id: ThemeId) => {
        writeTheme(id);
        applyTheme(id);
        setThemeState(id);
      },
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{props.children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
