import Script from "next/script";

const themeScript = `
(() => {
  const storageKey = "mirage-theme";
  const root = document.documentElement;
  const getSystemTheme = () =>
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

  let theme = "system";

  try {
    const storedTheme = window.localStorage.getItem(storageKey);
    if (storedTheme === "light" || storedTheme === "dark" || storedTheme === "system") {
      theme = storedTheme;
    }
  } catch {}

  const resolvedTheme = theme === "system" ? getSystemTheme() : theme;

  root.classList.remove("light", "dark");
  root.classList.add(resolvedTheme);
  root.style.colorScheme = resolvedTheme;
})();
`;

function AppThemeScript() {
  return (
    <Script id="mirage-theme-script" strategy="beforeInteractive">
      {themeScript}
    </Script>
  );
}

export { AppThemeScript };
