import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatMoney, formatDate, SLOT_LABEL } from "@/lib/format";
import { MockPayActions } from "@/components/MockPayActions";

export const dynamic = "force-dynamic";

export default async function MockPagoPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = await params;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { tour: { select: { title: true, slug: true, locationName: true } } },
  });

  if (!booking || !booking.stripeSessionId?.startsWith("cs_mock_")) notFound();
  if (booking.status !== "PENDING") {
    return (
      <div className="mock-terminal">
        <p className="muted" style={{ textAlign: "center" }}>
          Esta sesión de pago ya no está activa.{" "}
          <a href="/">Volver al catálogo</a>
        </p>
      </div>
    );
  }

  const discount = booking.discountBps > 0;

  return (
    <div className="mock-terminal">
      <div className="mock-badge">ENTORNO DE PRUEBA · SIN CARGO REAL</div>

      <div className="mock-merchant">
        <span className="brand-dot" aria-hidden="true" />
        Paseo Seguro
      </div>

      <div className="mock-product">
        <p className="mock-product-name">{booking.tour.title}</p>
        <p className="mock-product-sub">
          {booking.tour.locationName} · {formatDate(booking.bookingDate.toISOString().slice(0, 10))} · {SLOT_LABEL[booking.timeSlot]}
        </p>
      </div>

      <div className="mock-pricing">
        {discount && (
          <div className="mock-line">
            <span>Precio base</span>
            <span style={{ textDecoration: "line-through", color: "var(--ink-3)" }}>
              {formatMoney(booking.basePriceCents, booking.currency)}
            </span>
          </div>
        )}
        {discount && (
          <div className="mock-line" style={{ color: "var(--ok)" }}>
            <span>Descuento por lluvia ({booking.discountBps / 100} %)</span>
            <span>−{formatMoney(booking.discountCents, booking.currency)}</span>
          </div>
        )}
        <div className="mock-line mock-total">
          <span>Total</span>
          <span>{formatMoney(booking.finalPriceCents, booking.currency)}</span>
        </div>
      </div>

      <div className="mock-customer">
        <p>{booking.customerName}</p>
        <p>{booking.customerEmail}</p>
      </div>

      <MockPayActions
        bookingId={booking.id}
        cancelHref={`/tours/${booking.tour.slug}?cancelado=1`}
      />
    </div>
  );
}
