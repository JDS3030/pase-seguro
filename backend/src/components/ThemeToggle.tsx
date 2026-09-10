"use client";

import { useEffect, useState, type ReactElement } from "react";

export type ThemeChoice = "system" | "light" | "dark";

export const THEME_KEY = "paseo-theme";

/** Script que corre antes del primer paint para evitar el parpadeo de tema. */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t);}catch(e){}`;

const OPTIONS: { value: ThemeChoice; label: string; icon: ReactElement }[] = [
  {
    value: "system",
    label: "Automático",
    icon: (
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path d="M8 1.5a6.5 6.5 0 1 0 0 13z" fill="currentColor" />
        <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    ),
  },
  {
    value: "light",
    label: "Claro",
    icon: (
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <circle cx="8" cy="8" r="3.2" fill="currentColor" />
        <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
          <path d="M8 1v1.8M8 13.2V15M1 8h1.8M13.2 8H15M3.1 3.1l1.3 1.3M11.6 11.6l1.3 1.3M12.9 3.1l-1.3 1.3M4.4 11.6l-1.3 1.3" />
        </g>
      </svg>
    ),
  },
  {
    value: "dark",
    label: "Oscuro",
    icon: (
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path d="M13.4 9.9A5.6 5.6 0 0 1 6.1 2.6a5.9 5.9 0 1 0 7.3 7.3z" fill="currentColor" />
      </svg>
    ),
  },
];

export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>("system");

  useEffect(() => {
    try {
      const v = localStorage.getItem(THEME_KEY);
      if (v === "light" || v === "dark") setChoice(v);
    } catch {
      /* sin almacenamiento: queda en automático */
    }
  }, []);

  function pick(value: ThemeChoice) {
    setChoice(value);
    const root = document.documentElement;
    if (value === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", value);
    try {
      if (value === "system") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, value);
    } catch {
      /* modo privado: el tema vale solo para esta pestaña */
    }
  }

  return (
    <div className="theme-toggle" role="group" aria-label="Tema de la interfaz">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          className={choice === o.value ? "is-active" : undefined}
          aria-pressed={choice === o.value}
          title={o.label}
          onClick={() => pick(o.value)}
        >
          {o.icon}
          <span className="sr-only">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
