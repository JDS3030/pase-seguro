import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const tours = await prisma.tour.findMany({ select: { id: true, slug: true, basePriceCents: true } });
  const saona  = tours.find((t) => t.slug === "isla-saona-catamaran")!;
  const charcos = tours.find((t) => t.slug === "27-charcos-damajagua")!;

  // Usuario 1 — sin descuento (lluvia 12%)
  const b1 = await prisma.booking.upsert({
    where: { stripeSessionId: "cs_test_user1_sin_descuento" },
    update: {},
    create: {
      tourId: saona.id,
      customerName: "Ana García",
      customerEmail: "ana.garcia@ejemplo.com",
      bookingDate: new Date("2026-09-20T00:00:00Z"),
      timeSlot: "MORNING",
      basePriceCents: saona.basePriceCents,
      discountBps: 0,
      discountCents: 0,
      finalPriceCents: saona.basePriceCents,
      currency: "USD",
      pricingRuleVersion: "rain-v1",
      weatherSnapshot: {
        status: "FORECAST_OK",
        rainProbability: 12,
        source: "LIVE",
        aggregation: "max",
        slot: "MORNING",
        thresholdPct: 60,
        discountBps: 0,
        fetchedAt: new Date().toISOString(),
      },
      status: "CONFIRMED",
      stripeSessionId: "cs_test_user1_sin_descuento",
      stripePaymentIntentId: "pi_test_user1",
      amountPaidCents: saona.basePriceCents,
      confirmedAt: new Date(),
    },
  });

  // Usuario 2 — con descuento 20% (lluvia 74%)
  const descuentoCents = Math.round((charcos.basePriceCents * 2000) / 10_000);
  const finalCents = charcos.basePriceCents - descuentoCents;

  const b2 = await prisma.booking.upsert({
    where: { stripeSessionId: "cs_test_user2_con_descuento" },
    update: {},
    create: {
      tourId: charcos.id,
      customerName: "Carlos Méndez",
      customerEmail: "carlos.mendez@ejemplo.com",
      bookingDate: new Date("2026-09-18T00:00:00Z"),
      timeSlot: "AFTERNOON",
      basePriceCents: charcos.basePriceCents,
      discountBps: 2000,
      discountCents: descuentoCents,
      finalPriceCents: finalCents,
      currency: "USD",
      pricingRuleVersion: "rain-v1",
      weatherSnapshot: {
        status: "FORECAST_OK",
        rainProbability: 74,
        source: "LIVE",
        aggregation: "max",
        slot: "AFTERNOON",
        thresholdPct: 60,
        discountBps: 2000,
        fetchedAt: new Date().toISOString(),
      },
      status: "CONFIRMED",
      stripeSessionId: "cs_test_user2_con_descuento",
      stripePaymentIntentId: "pi_test_user2",
      amountPaidCents: finalCents,
      confirmedAt: new Date(),
    },
  });

  console.log("\nUsuarios de prueba creados:\n");
  console.log(`  Usuario 1 — ${b1.customerName}`);
  console.log(`    Tour:     Isla Saona en catamarán`);
  console.log(`    Precio:   $${(b1.finalPriceCents / 100).toFixed(2)} (sin descuento, lluvia 12 %)`);
  console.log(`    URL:      http://localhost:3001/reservas/confirmacion?session_id=cs_test_user1_sin_descuento\n`);

  console.log(`  Usuario 2 — ${b2.customerName}`);
  console.log(`    Tour:     27 Charcos de Damajagua`);
  console.log(`    Precio:   $${(b2.finalPriceCents / 100).toFixed(2)} (descuento 20 %, lluvia 74 %)`);
  console.log(`    URL:      http://localhost:3001/reservas/confirmacion?session_id=cs_test_user2_con_descuento\n`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
