import type { Metadata } from "next";
import { ThemeToggle, THEME_INIT_SCRIPT } from "@/components/ThemeToggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "Paseo Seguro",
  description:
    "Reserva tours en República Dominicana con descuento automático cuando el pronóstico anuncia lluvia.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        {/* Aplica el tema guardado antes del primer paint (evita el flash). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <header className="site-header">
          <a className="brand" href="/">
            <span className="brand-dot" aria-hidden="true" />
            Paseo Seguro
          </a>
          <div className="site-nav">
            <p className="tagline">Si el pronóstico anuncia lluvia, el precio baja solo.</p>
            <ThemeToggle />
          </div>
        </header>
        <main className="site-main">{children}</main>
        <footer className="site-footer">
          <span>Pronóstico por Open-Meteo · Pagos por Stripe (modo prueba)</span>
        </footer>
      </body>
    </html>
  );
}
