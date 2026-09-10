import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatMoney, formatDate, SLOT_LABEL } from "@/lib/format";
import { MockPayActions } from "@/components/MockPayActions";
import { env } from "@/lib/env";

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
      <div className="checkout-closed">
        <span className="badge warn">{booking.status}</span>
        <h1>Esta sesión de pago ya no está activa</h1>
        <p className="muted">
          La reserva <code>{booking.id}</code> ya fue procesada. Puedes revisar su estado o empezar
          una nueva reserva.
        </p>
        <p>
          <a href={`/reservas/confirmacion?session_id=${booking.stripeSessionId}`}>Ver la reserva</a>{" "}
          · <a href={`/tours/${booking.tour.slug}`}>Volver al tour</a>
        </p>
      </div>
    );
  }

  const pax = booking.passengersCount;
  const discount = booking.discountBps > 0;
  const totalCents = booking.finalPriceCents * pax;
  const baseTotalCents = booking.basePriceCents * pax;
  const discountTotalCents = booking.discountCents * pax;

  return (
    <div className="checkout">
      <div className="checkout-grid">
        {/* ── Resumen del pedido ─────────────────────────────── */}
        <aside className="checkout-summary">
          <div className="checkout-merchant">
            <span className="brand-dot" aria-hidden="true" />
            Paseo Seguro
          </div>

          <p className="checkout-amount-label">Pagar a Paseo Seguro</p>
          <p className="checkout-amount">{formatMoney(totalCents, booking.currency)}</p>

          <div className="checkout-item">
            <div>
              <p className="checkout-item-name">{booking.tour.title}</p>
              <p className="checkout-item-sub">
                {booking.tour.locationName} ·{" "}
                {formatDate(booking.bookingDate.toISOString().slice(0, 10))} ·{" "}
                {SLOT_LABEL[booking.timeSlot]}
              </p>
              <p className="checkout-item-sub">
                {pax} {pax === 1 ? "pasajero" : "pasajeros"} ·{" "}
                {formatMoney(booking.finalPriceCents, booking.currency)} c/u
              </p>
            </div>
            <span className="checkout-item-price">
              {formatMoney(totalCents, booking.currency)}
            </span>
          </div>

          <dl className="checkout-lines">
            {discount && (
              <>
                <div>
                  <dt>Subtotal</dt>
                  <dd>{formatMoney(baseTotalCents, booking.currency)}</dd>
                </div>
                <div className="is-discount">
                  <dt>Descuento por lluvia ({booking.discountBps / 100} %)</dt>
                  <dd>−{formatMoney(discountTotalCents, booking.currency)}</dd>
                </div>
              </>
            )}
            <div className="checkout-total">
              <dt>Total</dt>
              <dd>{formatMoney(totalCents, booking.currency)}</dd>
            </div>
          </dl>

          <div className="checkout-customer">
            <p className="checkout-customer-label">Reserva a nombre de</p>
            <p>{booking.customerName}</p>
            <p className="muted">{booking.customerEmail}</p>
            <p className="checkout-ref">
              Ref. <code>{booking.id}</code>
            </p>
          </div>
        </aside>

        {/* ── Formulario de pago ─────────────────────────────── */}
        <MockPayActions
          bookingId={booking.id}
          customerName={booking.customerName}
          customerEmail={booking.customerEmail}
          amountLabel={formatMoney(totalCents, booking.currency)}
          cancelHref={`${env.FRONTEND_URL}/tours/${booking.tour.slug}?cancelado=1`}
        />
      </div>
    </div>
  );
}
