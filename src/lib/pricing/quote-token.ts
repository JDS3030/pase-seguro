import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

const TTL_MS = 10 * 60_000;

export type QuotePayload = {
  t: string; // tourId
  d: string; // bookingDate YYYY-MM-DD
  s: string; // timeSlot
  f: number; // finalPriceCents unitario
  p: number; // passengersCount
  r: string; // ruleVersion
  x: number; // expiresAt timestamp
};

const encode = (s: string) => Buffer.from(s).toString("base64url");
const sign = (body: string) =>
  createHmac("sha256", env.QUOTE_SIGNING_SECRET).update(body).digest("base64url");

export function issueQuoteToken(p: Omit<QuotePayload, "x">): {
  quoteToken: string;
  quoteExpiresAt: string;
} {
  const payload: QuotePayload = { ...p, x: Date.now() + TTL_MS };
  const body = encode(JSON.stringify(payload));
  return {
    quoteToken: `v1.${body}.${sign(body)}`,
    quoteExpiresAt: new Date(payload.x).toISOString(),
  };
}

export function verifyQuoteToken(token: string): QuotePayload | null {
  const [version, body, mac] = token.split(".");
  if (version !== "v1" || !body || !mac) return null;

  const expected = Buffer.from(sign(body));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString(),
    ) as QuotePayload;
    return payload.x < Date.now() ? null : payload;
  } catch {
    return null;
  }
}
