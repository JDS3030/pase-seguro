import { prisma } from "@/lib/db";
import { formatMoney, SLOT_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const tours = await prisma.tour.findMany({
    where: { active: true },
    orderBy: { basePriceCents: "asc" },
  });

  return (
    <>
      <h1>Tours en República Dominicana</h1>
      <p className="muted">
        Elige una fecha dentro de los próximos 14 días y consultaremos el pronóstico del
        destino. Si la probabilidad de lluvia supera el 60 %, el descuento se aplica solo.
      </p>

      <div className="tour-grid">
        {tours.map((tour) => (
          <a key={tour.id} className="tour-card" href={`/tours/${tour.slug}`}>
            <h3>{tour.title}</h3>
            <p className="loc">{tour.locationName}</p>
            <p className="desc">{tour.description}</p>
            <div className="foot">
              <span className="price">{formatMoney(tour.basePriceCents, tour.currency)}</span>
              <span className="muted" style={{ fontSize: ".82rem" }}>
                {tour.slots.map((s) => SLOT_LABEL[s]).join(" · ")}
              </span>
            </div>
          </a>
        ))}
      </div>
    </>
  );
}
