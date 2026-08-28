import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Server-only service-role client + access-token verification, shared by the
// billing route handlers. Mirrors the inline pattern in api/rooms/join.
//
// Cached per warm serverless instance so route handlers don't re-parse client
// options (and re-create the underlying fetch/connection setup) on every call.
let adminClient: SupabaseClient<Database> | null = null;

export function getAdminClient(): SupabaseClient<Database> | null {
  if (adminClient) return adminClient;
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  adminClient = createClient<Database>(url, serviceKey, { auth: { persistSession: false } });
  return adminClient;
}

export interface VerifiedUser {
  id: string;
  email: string | null;
  isAnonymous: boolean;
}

/** Verify a Supabase access token and return the caller's identity. Works for
 *  anonymous users too (they have a real, stable auth.uid()). */
export async function verifyAccessToken(
  admin: SupabaseClient<Database>,
  accessToken: string | undefined,
): Promise<VerifiedUser | null> {
  if (!accessToken?.trim()) return null;
  const { data, error } = await admin.auth.getUser(accessToken.trim());
  if (error || !data.user) return null;
  const user = data.user;
  const isAnonymous =
    (user as { is_anonymous?: boolean }).is_anonymous === true ||
    !user.identities ||
    user.identities.length === 0 ||
    user.identities.every((i) => i.provider === "anonymous");
  return { id: user.id, email: user.email ?? null, isAnonymous };
}
