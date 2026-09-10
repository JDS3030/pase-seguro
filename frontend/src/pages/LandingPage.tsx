import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Tour } from "../types";
import { api } from "../lib/api";
import { formatMoney } from "../lib/format";
import { COPY_DISCOUNT_PCT, COPY_FORECAST_DAYS, COPY_RAIN_THRESHOLD_PCT } from "../lib/rules";

const STEPS = [
  {
    n: "01",
    title: "Elige fecha y franja",
    body: `Dentro de los próximos ${COPY_FORECAST_DAYS} días. El calendario solo abre fechas con pronóstico disponible.`,
  },
  {
    n: "02",
    title: "El servidor consulta el clima",
    body: "Pronóstico horario de Open-Meteo para las coordenadas exactas del destino y la franja que elegiste.",
  },
  {
    n: "03",
    title: "Pagas el precio ya ajustado",
    body: `Si la lluvia prevista supera el ${COPY_RAIN_THRESHOLD_PCT}%, el descuento del ${COPY_DISCOUNT_PCT}% ya viene aplicado en el total.`,
  },
];

export function LandingPage() {
  const [tours, setTours] = useState<Tour[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.tours
      .list()
      .then((r) => !cancelled && setTours(r.data))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const cheapest =
    tours && tours.length > 0
      ? tours.reduce((min, t) => (t.basePriceCents < min.basePriceCents ? t : min))
      : null;
  const featured = tours?.slice(0, 3) ?? [];

  return (
    <div className="landing">
      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="hero">
        <div className="hero-sky" aria-hidden="true">
          <span className="rain" />
        </div>

        <div className="hero-inner">
          <p className="eyebrow">
            <span className="pulse" aria-hidden="true" />
            Pronóstico en vivo · Open-Meteo
          </p>

          <h1 className="hero-title">
            Si el pronóstico anuncia lluvia,
            <br />
            <em>el precio baja solo.</em>
          </h1>

          <p className="hero-lead">
            Tours por República Dominicana con precio dinámico. Consultamos el clima de tu fecha
            antes de cobrarte: cuando la probabilidad de lluvia pasa del {COPY_RAIN_THRESHOLD_PCT}%,
            el descuento se aplica automáticamente. Sin cupones, sin pedirlo.
          </p>

          <div className="hero-cta">
            <Link className="btn btn-primary" to="/tours">
              Ver tours disponibles
            </Link>
            <a className="btn btn-ghost" href="#como-funciona">
              Cómo funciona
            </a>
          </div>

          <dl className="hero-stats">
            <div>
              <dt>Tours activos</dt>
              <dd>{tours ? tours.length : failed ? "—" : <span className="sk sk-xs" />}</dd>
            </div>
            <div>
              <dt>Desde</dt>
              <dd>
                {cheapest ? (
                  formatMoney(cheapest.basePriceCents, cheapest.currency)
                ) : failed ? (
                  "—"
                ) : (
                  <span className="sk sk-sm" />
                )}
              </dd>
            </div>
            <div>
              <dt>Ventana de pronóstico</dt>
              <dd>{COPY_FORECAST_DAYS} días</dd>
            </div>
          </dl>
        </div>

        <a className="hero-scroll" href="#como-funciona" aria-label="Ir a cómo funciona">
          <span aria-hidden="true">↓</span>
        </a>
      </section>

      {/* ── Cómo funciona ──────────────────────────────────────── */}
      <section className="section" id="como-funciona">
        <h2 className="section-title">Cómo funciona</h2>
        <p className="section-lead">
          Tres pasos. El precio se calcula en el servidor en el momento de reservar, nunca en tu
          navegador.
        </p>

        <ol className="steps">
          {STEPS.map((s) => (
            <li key={s.n} className="step">
              <span className="step-n">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Destacados ─────────────────────────────────────────── */}
      <section className="section">
        <div className="section-head">
          <div>
            <h2 className="section-title">Destinos destacados</h2>
            <p className="section-lead">Playas, montaña y ciudad colonial — todos con precio por clima.</p>
          </div>
          <Link className="link-more" to="/tours">
            Ver {tours ? `los ${tours.length} tours` : "todos los tours"} →
          </Link>
        </div>

        {failed && (
          <div className="alert warn">
            No pudimos cargar el catálogo ahora mismo. <Link to="/tours">Intenta desde el catálogo</Link>.
          </div>
        )}

        <div className="tour-grid">
          {!tours && !failed &&
            [0, 1, 2].map((i) => (
              <div key={i} className="tour-card is-skeleton" aria-hidden="true">
                <span className="sk sk-line" />
                <span className="sk sk-line sk-short" />
                <span className="sk sk-block" />
              </div>
            ))}

          {featured.map((tour) => (
            <Link key={tour.id} className="tour-card" to={`/tours/${tour.slug}`}>
              <h3>{tour.title}</h3>
              <p className="loc">{tour.locationName}</p>
              <p className="desc">{tour.description}</p>
              <div className="foot">
                <span className="price">{formatMoney(tour.basePriceCents, tour.currency)}</span>
                <span className="muted" style={{ fontSize: ".82rem" }}>
                  {Math.round(tour.durationMin / 60)} h
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── La regla ───────────────────────────────────────────── */}
      <section className="section">
        <div className="rule-card">
          <div>
            <span className="badge">Regla de precio</span>
            <h2 className="section-title" style={{ marginTop: 12 }}>
              Lluvia prevista sobre {COPY_RAIN_THRESHOLD_PCT}% = {COPY_DISCOUNT_PCT}% menos
            </h2>
            <p className="section-lead">
              Comparamos la probabilidad de lluvia de tu franja horaria contra el umbral. Si lo
              supera, el descuento entra al total antes de que pagues. Si el pronóstico cambia entre
              tu cotización y el pago, el servidor lo detecta y te pide confirmar el precio nuevo.
            </p>
            <Link className="btn btn-primary" to="/tours">
              Elegir mi tour
            </Link>
          </div>

          <div className="rule-demo" aria-hidden="true">
            <div className="rule-demo-row">
              <span>Lluvia prevista</span>
              <strong>78 %</strong>
            </div>
            <div className="rainbar">
              <span style={{ width: "78%" }} />
            </div>
            <div className="rule-demo-price">
              <span className="strike">US$100.00</span>
              <span className="final">US$80.00</span>
              <span className="save">Ahorras US$20.00 por lluvia prevista</span>
            </div>
            <p className="rule-demo-note">Ejemplo ilustrativo. Tu precio real lo calcula el servidor.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
