import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

let client: SupabaseClient<Database> | null = null;

export function createSupabaseBrowserClient(): SupabaseClient<Database> {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !anonKey) {
    console.warn(
      "[MochiMail] Supabase env vars not found. " +
      "Running in offline/local-only mode. " +
      "Set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY to enable accounts and sync."
    );
  }

  client = createClient<Database>(
    url || "https://placeholder.supabase.co",
    anonKey || "placeholder-anon-key",
    {
      auth: {
        // Persist the session in localStorage and refresh it automatically so
        // users (both saved accounts and anonymous guests) stay logged in across
        // page refreshes. This app does all auth client-side — no server/SSR
        // route reads the session from cookies (route handlers use the service
        // role key) — so cookie-based storage gave no benefit and dropped
        // sessions on reload. localStorage persistence is the reliable choice.
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "mochimail-auth",
      },
    }
  );
  return client;
}
