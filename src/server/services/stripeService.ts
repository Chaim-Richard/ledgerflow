import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY as string;
    stripeClient = new Stripe(key, { apiVersion: "2024-12-18.acacia" as any });
  }
  return stripeClient;
}
