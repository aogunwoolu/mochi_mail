import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

let client: SupabaseClient<Database> | null = null;

export function createSupabaseBrowserClient(): SupabaseClient<Database> {
  if (client) return client;

  // Support both VITE_ (Replit/standard) and NEXT_PUBLIC_ (Vercel legacy) prefixes.
  const url =
    import.meta.env.VITE_SUPABASE_URL ||
    import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !anonKey) {
    console.warn(
      "[MochiMail] Supabase env vars not found. " +
      "Running in offline/local-only mode. " +
      "Set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (or the NEXT_PUBLIC_ equivalents) to enable accounts and sync."
    );
  }

  client = createBrowserClient<Database>(
    url || "https://placeholder.supabase.co",
    anonKey || "placeholder-anon-key"
  );
  return client;
}
