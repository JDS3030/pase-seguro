import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatMoney, SLOT_LABEL, SLOT_RANGE } from "@/lib/format";
import { forecastWindow, FORECAST_MAX_DAYS } from "@/lib/weather/window";
import { BookingPanel } from "@/components/BookingPanel";

export const dynamic = "force-dynamic";

export default async function TourPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tour = await prisma.tour.findFirst({ where: { slug, active: true } });
  if (!tour) notFound();

  const window = forecastWindow(tour.timezone);

  return (
    <div className="detail">
      <div className="body">
        <h1>{tour.title}</h1>
        <p className="muted">{tour.locationName}</p>
        <p>{tour.description}</p>

        <dl className="facts">
          <div>
            <dt>Duración</dt>
            <dd>
              {tour.durationMin >= 1440
                ? `${Math.round(tour.durationMin / 1440)} días`
                : `${Math.round(tour.durationMin / 60)} horas`}
            </dd>
          </div>
          <div>
            <dt>Franjas</dt>
            <dd>{tour.slots.map((s) => SLOT_LABEL[s]).join(" · ")}</dd>
          </div>
          <div>
            <dt>Horario</dt>
            <dd>{tour.slots.map((s) => SLOT_RANGE[s]).join(" / ")}</dd>
          </div>
          <div>
            <dt>Precio base</dt>
            <dd>{formatMoney(tour.basePriceCents, tour.currency)}</dd>
          </div>
          <div>
            <dt>Zona horaria</dt>
            <dd style={{ fontSize: ".85rem" }}>{tour.timezone}</dd>
          </div>
          <div>
            <dt>Ventana de pronóstico</dt>
            <dd>{FORECAST_MAX_DAYS} días</dd>
          </div>
        </dl>
      </div>

      <BookingPanel
        tourId={tour.id}
        slots={tour.slots}
        currency={tour.currency}
        basePriceCents={tour.basePriceCents}
        minDate={window.minDate}
        maxDate={window.maxDate}
        maxForecastDate={window.maxForecastDate}
      />
    </div>
  );
}
