import { PrismaClient, TimeSlot } from "@prisma/client";

const prisma = new PrismaClient();
const GEO = process.env.OPEN_METEO_GEOCODING_URL
  ?? "https://geocoding-api.open-meteo.com/v1/search";

type GeoResult = {
  latitude: number;
  longitude: number;
  timezone: string;
  locationName: string;
  countryCode: string;
};

async function geocode(query: string, countryCode = "DO"): Promise<GeoResult> {
  const url = new URL(GEO);
  url.searchParams.set("name", query);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "es");
  url.searchParams.set("countryCode", countryCode);
  url.searchParams.set("format", "json");

  const res = await fetch(url);
  if (!res.ok) throw new Error(`geocoding HTTP ${res.status} para "${query}"`);

  const data = (await res.json()) as { results?: Array<Record<string, unknown>> };
  const hit = data.results?.[0];
  if (!hit) throw new Error(`sin coordenadas para "${query}"`);

  return {
    latitude: hit.latitude as number,
    longitude: hit.longitude as number,
    timezone: hit.timezone as string,
    locationName: [hit.name, hit.admin1].filter(Boolean).join(", "),
    countryCode: hit.country_code as string,
  };
}

const CATALOGO = [
  {
    slug: "isla-saona-catamaran",
    title: "Isla Saona en catamarán",
    query: "Bayahibe",
    description:
      "Travesía en catamarán hasta Isla Saona con parada en la piscina natural, almuerzo criollo en la playa y regreso en lancha rápida por el Parque Nacional del Este.",
    basePriceCents: 8900,
    durationMin: 480,
    slots: [TimeSlot.MORNING],
  },
  {
    slug: "bahia-de-las-aguilas",
    title: "Bahía de las Águilas",
    query: "Pedernales",
    description:
      "Ocho kilómetros de playa virgen dentro del Parque Nacional Jaragua. Traslado en bote desde Cabo Rojo, sin infraestructura ni sombra: el pronóstico importa.",
    basePriceCents: 12000,
    durationMin: 600,
    slots: [TimeSlot.MORNING],
  },
  {
    slug: "salto-el-limon",
    title: "Salto El Limón a caballo",
    query: "Samaná",
    description:
      "Cabalgata de cuarenta minutos por senderos de montaña hasta una cascada de 52 metros, con tiempo para bañarse en la poza.",
    basePriceCents: 5500,
    durationMin: 240,
    slots: [TimeSlot.MORNING, TimeSlot.AFTERNOON],
  },
  {
    slug: "los-haitises-en-bote",
    title: "Los Haitises en bote",
    query: "Sabana de la Mar",
    description:
      "Recorrido entre mogotes y manglares, con visita a cuevas de pictografías taínas y avistamiento de aves en la bahía de San Lorenzo.",
    basePriceCents: 7200,
    durationMin: 300,
    slots: [TimeSlot.MORNING, TimeSlot.AFTERNOON],
  },
  {
    slug: "27-charcos-damajagua",
    title: "27 Charcos de Damajagua",
    query: "Imbert",
    description:
      "Ascenso por el cañón del río Damajagua y descenso saltando y deslizándose por las 27 pozas. Con casco, chaleco y guía local.",
    basePriceCents: 4999,
    durationMin: 300,
    slots: [TimeSlot.MORNING, TimeSlot.AFTERNOON],
  },
  {
    slug: "amanecer-pico-duarte",
    title: "Amanecer en Pico Duarte",
    query: "Jarabacoa",
    description:
      "Ascenso guiado de dos días al techo del Caribe, con campamento en La Compartición y salida nocturna para llegar a la cumbre al amanecer.",
    basePriceCents: 21000,
    durationMin: 2880,
    slots: [TimeSlot.MORNING],
  },
];

async function main() {
  for (const t of CATALOGO) {
    const geo = await geocode(t.query);
    const { query: _query, ...rest } = t;

    await prisma.tour.upsert({
      where: { slug: t.slug },
      update: { ...rest, ...geo, currency: "USD" },
      create: { ...rest, ...geo, currency: "USD" },
    });

    console.log(
      `  ✓ ${t.title.padEnd(30)} ${geo.latitude.toFixed(4)}, ${geo.longitude.toFixed(4)}  ${geo.timezone}`,
    );

    await new Promise((r) => setTimeout(r, 250));
  }
  console.log(`\n${CATALOGO.length} tours sembrados con coordenadas resueltas por la API.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
