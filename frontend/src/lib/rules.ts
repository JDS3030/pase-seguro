/**
 * Constantes de COPY (solo para textos de marketing/UI).
 *
 * Regla de oro: el precio real, el umbral y el descuento efectivo SIEMPRE los
 * calcula el backend y llegan en la respuesta de `/bookings/quote`
 * (`price.thresholdPct`, `price.discountBps`). Estos valores existen únicamente
 * para redactar textos cuando todavía no hay cotización (landing, catálogo).
 * Si cambian en `.env.local` (RAIN_THRESHOLD_PCT / WEATHER_DISCOUNT_BPS),
 * actualiza este archivo — nada de aquí influye en un cobro.
 */
export const COPY_RAIN_THRESHOLD_PCT = 60;
export const COPY_DISCOUNT_PCT = 20;
export const COPY_FORECAST_DAYS = 14;
