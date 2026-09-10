import { prisma } from "@/lib/db";
import { ok, fail, ERROR_MESSAGES } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const limit = Math.min(Number(searchParams.get("limit") ?? 20) || 20, 50);
  const cursor = searchParams.get("cursor") ?? undefined;

  try {
    const tours = await prisma.tour.findMany({
      where: {
        active: true,
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" as const } },
                { locationName: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      orderBy: { title: "asc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        slug: true,
        title: true,
        locationName: true,
        countryCode: true,
        latitude: true,
        longitude: true,
        timezone: true,
        basePriceCents: true,
        currency: true,
        durationMin: true,
        slots: true,
      },
    });

    const hasMore = tours.length > limit;
    const data = hasMore ? tours.slice(0, limit) : tours;

    return ok({ data, nextCursor: hasMore ? data[data.length - 1]?.id : null });
  } catch (err) {
    console.error("[tours] ", err);
    return fail(500, "INTERNAL_ERROR", ERROR_MESSAGES.INTERNAL_ERROR);
  }
}
