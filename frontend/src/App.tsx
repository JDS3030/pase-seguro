import { BrowserRouter, Routes, Route } from "react-router-dom";
import { TourListPage }    from "./pages/TourListPage";
import { TourDetailPage }  from "./pages/TourDetailPage";
import { ConfirmationPage } from "./pages/ConfirmationPage";
import "./App.css";

export function App() {
  return (
    <BrowserRouter>
      <header className="site-header">
        <a className="brand" href="/">
          <span className="brand-dot" aria-hidden="true" />
          Paseo Seguro
        </a>
        <p className="tagline">Si el pronóstico anuncia lluvia, el precio baja solo.</p>
      </header>

      <main className="site-main">
        <Routes>
          <Route path="/"                          element={<TourListPage />} />
          <Route path="/tours/:slug"               element={<TourDetailPage />} />
          <Route path="/reservas/confirmacion"     element={<ConfirmationPage />} />
        </Routes>
      </main>

      <footer className="site-footer">
        <span>Pronóstico por Open-Meteo · Pagos por Stripe (modo prueba)</span>
      </footer>
    </BrowserRouter>
  );
}
