import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/client";
import { env } from "@/lib/env";
import { handleStripeEvent } from "@/lib/stripe/handle-event";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) return new Response("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.warn("[stripe] firma inválida:", (err as Error).message);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    await handleStripeEvent(event);
  } catch (err) {
    console.error("[stripe] fallo procesando", event.id, err);
    return new Response("Retry later", { status: 500 });
  }

  return Response.json({ received: true });
}
