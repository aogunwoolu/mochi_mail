// One-shot Stripe setup for Mochi Plus.
//
// Creates (idempotently) the "Mochi Plus" product and its monthly + yearly
// recurring prices, then prints the STRIPE_PRICE_* env values to paste into
// .env.local (and your Vercel project settings).
//
// Usage (Node 20+, reads STRIPE_SECRET_KEY from .env.local):
//   node --env-file=.env.local scripts/setup-stripe.mjs
//
// Safe to re-run: it reuses the existing product and prices by lookup_key.

import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("✗ STRIPE_SECRET_KEY is not set. Add it to .env.local (use a sk_test_… key first).");
  process.exit(1);
}
const stripe = new Stripe(key);
const live = key.startsWith("sk_live_");

// Tune these to your final pricing. Amounts are in cents.
const PRODUCT_NAME = "Mochi Plus";
const PRICES = [
  { lookup_key: "mochi_plus_monthly", env: "STRIPE_PRICE_PLUS_MONTHLY", unit_amount: 400, interval: "month" },
  { lookup_key: "mochi_plus_yearly", env: "STRIPE_PRICE_PLUS_YEARLY", unit_amount: 3600, interval: "year" },
];

async function findOrCreateProduct() {
  const existing = await stripe.products.search({ query: `name:'${PRODUCT_NAME}' AND active:'true'` });
  if (existing.data[0]) return existing.data[0];
  return stripe.products.create({
    name: PRODUCT_NAME,
    description: "Support Mochi and get a ♡ badge, exclusive themes, and a little more studio room.",
  });
}

async function findOrCreatePrice(productId, spec) {
  const found = await stripe.prices.list({ lookup_keys: [spec.lookup_key], active: true, limit: 1 });
  if (found.data[0]) return found.data[0];
  return stripe.prices.create({
    product: productId,
    currency: "usd",
    unit_amount: spec.unit_amount,
    recurring: { interval: spec.interval },
    lookup_key: spec.lookup_key,
  });
}

async function main() {
  console.log(`\n🍵 Setting up Mochi Plus in Stripe ${live ? "LIVE" : "TEST"} mode…\n`);
  const product = await findOrCreateProduct();
  console.log(`  product: ${product.id} (${product.name})`);

  const envLines = [];
  for (const spec of PRICES) {
    const price = await findOrCreatePrice(product.id, spec);
    console.log(`  ${spec.interval}ly price: ${price.id} ($${(spec.unit_amount / 100).toFixed(2)})`);
    envLines.push(`${spec.env}=${price.id}`);
  }

  console.log("\n✅ Done. Add these to .env.local and your Vercel env:\n");
  console.log(envLines.join("\n"));
  console.log(
    "\nNext: create a webhook endpoint pointing at /api/billing/webhook " +
      "(events: customer.subscription.*, checkout.session.completed) and set STRIPE_WEBHOOK_SECRET.\n",
  );
}

main().catch((err) => {
  console.error("✗ Stripe setup failed:", err.message);
  process.exit(1);
});
