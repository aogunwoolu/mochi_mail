import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getAdminClient, verifyAccessToken } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Opens the Stripe Billing Portal so members can update or cancel their
// membership themselves — an honest, easy exit, no dark patterns.
export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const admin = getAdminClient();
  if (!stripe || !admin) {
    return NextResponse.json({ error: "Billing is not configured." }, { status: 503 });
  }

  const { accessToken } = (await req.json().catch(() => ({}))) as { accessToken?: string };
  const user = await verifyAccessToken(admin, accessToken);
  if (!user) {
    return NextResponse.json({ error: "Please sign in and try again." }, { status: 401 });
  }

  const { data } = await admin
    .from("supporters")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data?.stripe_customer_id) {
    return NextResponse.json({ error: "No membership found." }, { status: 404 });
  }

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ?? req.headers.get("origin") ?? new URL(req.url).origin;

  const session = await stripe.billingPortal.sessions.create({
    customer: data.stripe_customer_id,
    return_url: `${origin}/`,
  });

  return NextResponse.json({ url: session.url });
}
