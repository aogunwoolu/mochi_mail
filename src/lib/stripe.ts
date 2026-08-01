import Stripe from "stripe";

// Server-only singleton Stripe client. NEVER import this from a client component
// — it reads the secret key. The billing route handlers (which run with
// `runtime = "nodejs"`) are the only callers.

let stripe: Stripe | null = null;

/** Returns the shared Stripe client, or null if the secret key isn't configured
 *  (lets routes respond with a clean 503 instead of throwing at import time). */
export function getStripe(): Stripe | null {
  if (stripe) return stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  // No explicit apiVersion: pin to whatever the installed SDK ships with, which
  // avoids a brittle version-literal type mismatch when the package is bumped.
  stripe = new Stripe(key);
  return stripe;
}
