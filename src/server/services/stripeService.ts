import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('Payments are not set up yet (STRIPE_SECRET_KEY is missing).');
    stripeClient = new Stripe(key, { apiVersion: "2024-12-18.acacia" as any });
  }
  return stripeClient;
}
