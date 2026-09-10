import { BrowserRouter, Routes, Route, Link, NavLink, useLocation } from "react-router-dom";
import { LandingPage }     from "./pages/LandingPage";
import { TourListPage }    from "./pages/TourListPage";
import { TourDetailPage }  from "./pages/TourDetailPage";
import { ConfirmationPage } from "./pages/ConfirmationPage";
import { ThemeToggle } from "./components/ThemeToggle";
import "./App.css";

function Shell() {
  const { pathname } = useLocation();
  const isLanding = pathname === "/";

  return (
    <>
      <header className={`site-header${isLanding ? " is-overlay" : ""}`}>
        <Link className="brand" to="/">
          <span className="brand-dot" aria-hidden="true" />
          Paseo Seguro
        </Link>

        <nav className="site-nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "is-active" : undefined)}>
            Inicio
          </NavLink>
          <NavLink to="/tours" className={({ isActive }) => (isActive ? "is-active" : undefined)}>
            Tours
          </NavLink>
          <ThemeToggle />
        </nav>
      </header>

      <main className={`site-main${isLanding ? " is-full" : ""}`}>
        <Routes>
          <Route path="/"                      element={<LandingPage />} />
          <Route path="/tours"                 element={<TourListPage />} />
          <Route path="/tours/:slug"           element={<TourDetailPage />} />
          <Route path="/reservas/confirmacion" element={<ConfirmationPage />} />
          <Route path="*"                      element={<NotFound />} />
        </Routes>
      </main>

      <footer className="site-footer">
        <span>Pronóstico por Open-Meteo · Pagos por Stripe (modo prueba)</span>
      </footer>
    </>
  );
}

function NotFound() {
  return (
    <div className="confirm">
      <h1>Página no encontrada</h1>
      <p className="muted">
        La ruta que abriste no existe. <Link to="/tours">Ver el catálogo de tours</Link>.
      </p>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
