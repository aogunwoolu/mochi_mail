import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

let client: SupabaseClient<Database> | null = null;

export function createSupabaseBrowserClient(): SupabaseClient<Database> {
  if (client) return client;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.warn(
      "[MochiMail] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set. " +
      "The app will run in offline/local-only mode. " +
      "Set these environment variables in your deployment to enable accounts and sync."
    );
  }

  client = createBrowserClient<Database>(
    url || "https://placeholder.supabase.co",
    anonKey || "placeholder-anon-key"
  );
  return client;
}
