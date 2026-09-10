import { type NextRequest, NextResponse } from "next/server";

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

export function middleware(req: NextRequest) {
  const origin = req.headers.get("origin") ?? "";
  const isPreflight = req.method === "OPTIONS";
  const isAllowed = ALLOWED_ORIGINS.includes(origin);

  if (isPreflight) {
    const headers: HeadersInit = isAllowed
      ? {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
          "Vary": "Origin",
        }
      : {};
    return new NextResponse(null, { status: 204, headers });
  }

  const res = NextResponse.next();
  if (isAllowed) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "Content-Type");
    res.headers.set("Vary", "Origin");
  }
  return res;
}

export const config = { matcher: "/api/:path*" };
