import Stripe from "stripe";
import { env } from "@/lib/env";

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  appInfo: { name: "paseo-seguro", version: "1.0.0" },
});
