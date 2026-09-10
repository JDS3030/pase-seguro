import type { Quote } from "../types";

const COPY: Record<string, { label: string; detail: string }> = {
  FORECAST_OK:        { label: "% de probabilidad de lluvia",                 detail: "Pronóstico en vivo." },
  FORECAST_STALE:     { label: "% de probabilidad de lluvia",                 detail: "Dato reciente; proveedor no disponible ahora." },
  FORECAST_OUT_OF_RANGE: { label: "Fuera de ventana de pronóstico",           detail: "El descuento se evalúa dentro de 14 días." },
  WEATHER_UNAVAILABLE:   { label: "No pudimos consultar el pronóstico",       detail: "Se muestra el precio base." },
};

export function WeatherBadge({ quote }: { quote: Quote }) {
  const copy   = COPY[quote.weather.status] ?? COPY.WEATHER_UNAVAILABLE;
  const rain   = quote.weather.rainProbability;
  const disc   = quote.price.discountApplied;

  return (
    <div className={disc ? "weather discount" : "weather"}>
      <span className="headline">
        {rain !== null ? `${rain} ${copy.label}` : copy.label}
      </span>
      {rain !== null && (
        <div className="rainbar" role="img" aria-label={`${rain}% de lluvia`}>
          <span style={{ width: `${rain}%` }} />
        </div>
      )}
      <span className="detail-line">
        {disc
          ? `Supera el ${quote.price.thresholdPct}%: descuento del ${quote.price.discountBps / 100}% aplicado por persona.`
          : copy.detail}
      </span>
    </div>
  );
}
