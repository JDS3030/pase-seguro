import type { Quote } from "@/components/BookingPanel";

const COPY: Record<string, { className: string; headline: (p: number | null) => string; detail: string }> = {
  FORECAST_OK: {
    className: "weather",
    headline: (p) => `${p} % de probabilidad de lluvia`,
    detail: "Pronóstico en vivo para la franja seleccionada.",
  },
  FORECAST_STALE: {
    className: "weather",
    headline: (p) => `${p} % de probabilidad de lluvia`,
    detail: "Pronóstico guardado hace poco; el proveedor no responde ahora mismo.",
  },
  FORECAST_OUT_OF_RANGE: {
    className: "weather unknown",
    headline: () => "Fuera de la ventana de pronóstico",
    detail: "El descuento por lluvia se evalúa 14 días antes del tour.",
  },
  WEATHER_UNAVAILABLE: {
    className: "weather unknown",
    headline: () => "No pudimos consultar el pronóstico",
    detail: "El precio mostrado es el base. Puedes reservar igualmente.",
  },
};

export function WeatherBadge({ quote }: { quote: Quote }) {
  const copy = COPY[quote.weather.status] ?? COPY.WEATHER_UNAVAILABLE;
  const rain = quote.weather.rainProbability;
  const discounted = quote.price.discountApplied;

  return (
    <div className={discounted ? "weather discount" : copy.className}>
      <span className="headline">{copy.headline(rain)}</span>
      {rain !== null && (
        <div className="rainbar" role="img" aria-label={`${rain} por ciento de lluvia`}>
          <span style={{ width: `${rain}%` }} />
        </div>
      )}
      <span className="detail-line">
        {discounted
          ? `Supera el ${quote.price.thresholdPct} %: descuento del ${quote.price.discountBps / 100} % aplicado.`
          : copy.detail}
      </span>
    </div>
  );
}
