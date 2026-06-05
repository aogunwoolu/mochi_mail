import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { getAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SupporterStatus = Database["public"]["Tables"]["supporters"]["Row"]["status"];

// Stripe → Mochi membership status. Anything not actively paid-through maps to a
// non-granting state (perks switch off via isPlusActive).
function mapStatus(s: Stripe.Subscription.Status): SupporterStatus {
  switch (s) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "unpaid":
      return "past_due";
    default:
      return "canceled";
  }
}

/** Read a unix-seconds field that has lived in a couple of places across Stripe
 *  API versions, and return an ISO string (or null). */
function periodEndIso(sub: Stripe.Subscription): string | null {
  const top = (sub as unknown as { current_period_end?: number }).current_period_end;
  const fromItem = sub.items?.data?.[0]?.current_period_end;
  const unix = top ?? fromItem;
  return typeof unix === "number" ? new Date(unix * 1000).toISOString() : null;
}

async function upsertFromSubscription(
  admin: NonNullable<ReturnType<typeof getAdminClient>>,
  sub: Stripe.Subscription,
) {
  const userId =
    (sub.metadata?.supabase_user_id as string | undefined) ??
    (typeof sub.customer === "object" && sub.customer && "metadata" in sub.customer
      ? (sub.customer.metadata?.supabase_user_id as string | undefined)
      : undefined);

  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;

  // Resolve the user either from metadata or by the customer id we stored at checkout.
  let resolvedUserId = userId ?? null;
  if (!resolvedUserId && customerId) {
    const { data } = await admin
      .from("supporters")
      .select("user_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    resolvedUserId = data?.user_id ?? null;
  }
  if (!resolvedUserId) return; // can't attribute — ignore

  const interval = sub.items?.data?.[0]?.price?.recurring?.interval;
  const plan = interval === "year" ? "yearly" : interval === "month" ? "monthly" : null;
  const status = mapStatus(sub.status);
  const active = status === "active" || status === "trialing";

  // Preserve the member's badge preference across subscription updates.
  const { data: prev } = await admin
    .from("supporters")
    .select("show_badge")
    .eq("user_id", resolvedUserId)
    .maybeSingle();
  const showBadge = prev?.show_badge ?? true;

  await admin.from("supporters").upsert(
    {
      user_id: resolvedUserId,
      stripe_customer_id: customerId ?? null,
      stripe_subscription_id: sub.id,
      status,
      plan,
      current_period_end: periodEndIso(sub),
      cancel_at_period_end: sub.cancel_at_period_end ?? false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  // Mirror the public, render-only badge flag onto the profile so visitors can
  // see the ♡ (only when the member is active AND hasn't hidden it).
  await admin
    .from("profiles")
    .update({ is_supporter: active && showBadge })
    .eq("id", resolvedUserId);
}

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const admin = getAdminClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !admin || !secret) {
    return NextResponse.json({ error: "Billing is not configured." }, { status: 503 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature." }, { status: 400 });

  const raw = await req.text(); // raw body required for signature verification
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await upsertFromSubscription(admin, event.data.object as Stripe.Subscription);
        break;
      }
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        // Tips are one-time payments; log a thank-you record (no entitlement).
        if (session.mode === "payment" && session.metadata?.kind === "tip") {
          const userId = session.metadata?.supabase_user_id || null;
          await admin.from("tips").insert({
            user_id: userId,
            display_name: session.metadata?.display_name || null,
            amount_cents: session.amount_total ?? 0,
            currency: session.currency ?? "usd",
          });
        }
        break;
      }
      default:
        break; // ignore the rest
    }
  } catch (err) {
    console.error("[billing/webhook] handler error:", err);
    return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
