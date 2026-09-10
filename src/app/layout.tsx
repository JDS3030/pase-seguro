import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Paseo Seguro",
  description:
    "Reserva tours en República Dominicana con descuento automático cuando el pronóstico anuncia lluvia.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <header className="site-header">
          <a className="brand" href="/">
            <span className="brand-dot" aria-hidden="true" />
            Paseo Seguro
          </a>
          <p className="tagline">Si el pronóstico anuncia lluvia, el precio baja solo.</p>
        </header>
        <main className="site-main">{children}</main>
        <footer className="site-footer">
          <span>Pronóstico por Open-Meteo · Pagos por Stripe (modo prueba)</span>
        </footer>
      </body>
    </html>
  );
}
