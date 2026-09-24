"use client";

import * as React from "react";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = Exclude<Theme, "system">;

type AppThemeContextValue = {
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  systemTheme: ResolvedTheme;
  theme: Theme;
  themes: Theme[];
};

const storageKey = "mirage-theme";
const themes: Theme[] = ["light", "dark", "system"];
const mediaQuery = "(prefers-color-scheme: dark)";

const AppThemeContext = React.createContext<AppThemeContextValue | null>(null);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") {
    return "light";
  }

  return window.matchMedia(mediaQuery).matches ? "dark" : "light";
}

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

function getStoredTheme(): Theme {
  if (typeof window === "undefined") {
    return "system";
  }

  try {
    const storedTheme = window.localStorage.getItem(storageKey);
    return isTheme(storedTheme) ? storedTheme : "system";
  } catch {
    return "system";
  }
}

function applyTheme(theme: Theme, systemTheme: ResolvedTheme) {
  const resolvedTheme = theme === "system" ? systemTheme : theme;
  const root = document.documentElement;

  root.classList.remove("light", "dark");
  root.classList.add(resolvedTheme);
  root.style.colorScheme = resolvedTheme;
}

function disableTransitionsTemporarily() {
  const style = document.createElement("style");

  style.appendChild(
    document.createTextNode("*,*::before,*::after{transition:none!important}"),
  );
  document.head.appendChild(style);
  window.getComputedStyle(document.body);
  window.setTimeout(() => style.remove(), 1);
}

function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>("system");
  const [systemTheme, setSystemTheme] =
    React.useState<ResolvedTheme>(getSystemTheme);

  React.useEffect(() => {
    const storedTheme = getStoredTheme();

    setThemeState(storedTheme);
    applyTheme(storedTheme, getSystemTheme());
  }, []);

  React.useEffect(() => {
    const media = window.matchMedia(mediaQuery);
    const onChange = () => {
      const nextSystemTheme = media.matches ? "dark" : "light";

      setSystemTheme(nextSystemTheme);
      setThemeState((currentTheme) => {
        if (currentTheme === "system") {
          applyTheme(currentTheme, nextSystemTheme);
        }

        return currentTheme;
      });
    };

    media.addEventListener("change", onChange);

    return () => media.removeEventListener("change", onChange);
  }, []);

  React.useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) {
        return;
      }

      const nextTheme = isTheme(event.newValue) ? event.newValue : "system";

      setThemeState(nextTheme);
      applyTheme(nextTheme, getSystemTheme());
    };

    window.addEventListener("storage", onStorage);

    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setTheme = React.useCallback(
    (nextTheme: Theme) => {
      disableTransitionsTemporarily();
      setThemeState(nextTheme);
      applyTheme(nextTheme, systemTheme);

      try {
        window.localStorage.setItem(storageKey, nextTheme);
      } catch {}
    },
    [systemTheme],
  );

  const value = React.useMemo<AppThemeContextValue>(
    () => ({
      resolvedTheme: theme === "system" ? systemTheme : theme,
      setTheme,
      systemTheme,
      theme,
      themes,
    }),
    [setTheme, systemTheme, theme],
  );

  return (
    <AppThemeContext.Provider value={value}>
      {children}
    </AppThemeContext.Provider>
  );
}

function useTheme() {
  const context = React.useContext(AppThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within AppThemeProvider.");
  }

  return context;
}

export { AppThemeProvider, useTheme };
export type { Theme };
