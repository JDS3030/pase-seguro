export type ThemeChoice = "system" | "light" | "dark";

export const THEME_KEY = "paseo-theme";

/**
 * Lee la preferencia guardada. "system" (sin atributo en <html>) deja que
 * `color-scheme: light dark` + light-dark() sigan al sistema operativo.
 */
export function readTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);

  try {
    if (choice === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
  } catch {
    /* modo privado: el tema vale solo para esta pestaña */
  }
}
