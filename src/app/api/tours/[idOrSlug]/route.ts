import { prisma } from "@/lib/db";
import { ok, fail, ERROR_MESSAGES } from "@/lib/http";
import { forecastWindow } from "@/lib/weather/window";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ idOrSlug: string }> },
) {
  const { idOrSlug } = await params;

  const tour = await prisma.tour.findFirst({
    where: { active: true, OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
  });

  if (!tour) return fail(404, "TOUR_NOT_FOUND", ERROR_MESSAGES.TOUR_NOT_FOUND);

  return ok({
    ...tour,
    forecastWindow: forecastWindow(tour.timezone),
  });
}
