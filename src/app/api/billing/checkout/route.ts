import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getAdminClient, verifyAccessToken } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  accessToken?: string;
  mode?: "subscription" | "tip";
  plan?: "monthly" | "yearly";
  amountCents?: number;
  displayName?: string;
};

function appOrigin(req: NextRequest): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    req.headers.get("origin") ??
    new URL(req.url).origin
  );
}

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const admin = getAdminClient();
  if (!stripe || !admin) {
    return NextResponse.json({ error: "Billing is not configured." }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const user = await verifyAccessToken(admin, body.accessToken);
  if (!user) {
    return NextResponse.json({ error: "Please sign in and try again." }, { status: 401 });
  }

  const origin = appOrigin(req);
  const success_url = `${origin}/?support=thanks`;
  const cancel_url = `${origin}/?support=cancelled`;

  // ── Find-or-create the Stripe customer for this user ──────────────────────────
  const { data: existing } = await admin
    .from("supporters")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  let customerId = existing?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
    await admin
      .from("supporters")
      .upsert({ user_id: user.id, stripe_customer_id: customerId }, { onConflict: "user_id" });
  }

  // ── Tip: a no-commitment one-time payment. Works for anyone. ───────────────────
  if (body.mode === "tip") {
    const amount = Math.round(body.amountCents ?? 0);
    if (!Number.isFinite(amount) || amount < 100) {
      return NextResponse.json({ error: "Please choose a tip amount of at least $1." }, { status: 400 });
    }
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amount,
            product_data: { name: "Buy us a tea 🍵", description: "A one-time thank-you to keep Mochi cozy." },
          },
        },
      ],
      // Tips never grant entitlement; the webhook only logs them.
      payment_intent_data: {
        metadata: { supabase_user_id: user.id, kind: "tip", display_name: body.displayName ?? "" },
      },
      metadata: { supabase_user_id: user.id, kind: "tip", display_name: body.displayName ?? "" },
      success_url,
      cancel_url,
    });
    return NextResponse.json({ url: session.url });
  }

  // ── Subscription: Mochi Plus ──────────────────────────────────────────────────
  if (body.mode === "subscription") {
    // Gentle save at checkout: a durable identity (real email) is required so the
    // membership survives a cleared browser. Anonymous users are asked to save
    // their account first; the client surfaces an inline email/password step.
    if (user.isAnonymous || !user.email) {
      return NextResponse.json({ needsAccount: true }, { status: 409 });
    }

    const priceId =
      body.plan === "yearly"
        ? process.env.STRIPE_PRICE_PLUS_YEARLY
        : process.env.STRIPE_PRICE_PLUS_MONTHLY;
    if (!priceId) {
      return NextResponse.json({ error: "Membership pricing is not configured." }, { status: 503 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: { metadata: { supabase_user_id: user.id } },
      allow_promotion_codes: true,
      success_url,
      cancel_url,
    });
    return NextResponse.json({ url: session.url });
  }

  return NextResponse.json({ error: "Unknown checkout mode." }, { status: 400 });
}
