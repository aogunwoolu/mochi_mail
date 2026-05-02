import { createClient } from "@supabase/supabase-js";
import type { IncomingMessage, ServerResponse } from "node:http";

const ACCENT_CHOICES = ["#ff6b9d", "#67d4f1", "#6ee7b7", "#a78bfa", "#fb923c", "#fbbf24"] as const;
const WALLPAPER_CHOICES = [
  "radial-gradient(circle at top left, rgba(255,255,255,0.95), rgba(255,214,236,0.92) 42%, rgba(255,246,251,0.92) 100%)",
  "linear-gradient(135deg, rgba(237,247,255,0.95), rgba(203,244,255,0.92), rgba(244,255,252,0.96))",
  "linear-gradient(145deg, rgba(255,248,228,0.96), rgba(255,224,208,0.92), rgba(255,245,236,0.96))",
  "linear-gradient(145deg, rgba(246,241,255,0.96), rgba(226,223,255,0.92), rgba(255,245,252,0.96))",
] as const;

const AUTH_EMAIL_DOMAIN = "mochimail.app";

function randomFrom<T>(items: readonly T[], seed: string): T {
  const index = Math.abs(seed.split("").reduce((acc, ch) => acc + (ch.codePointAt(0) ?? 0), 0)) % items.length;
  return items[index];
}

function getAdminClient() {
  const url = process.env.SUPABASE_URL ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !serviceRoleKey) throw new Error("Missing Supabase admin credentials");
  return createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: Buffer | string) => { data += String(chunk); });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  try {
    const raw = await readBody(req);
    const body = JSON.parse(raw) as { username?: string; password?: string; displayName?: string };
    const username = body.username?.trim().toLowerCase() ?? "";
    const password = body.password?.trim() ?? "";
    const displayName = (body.displayName?.trim() || username).trim();

    if (!username || !password) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Username and password are required." }));
      return;
    }

    if (!/^[a-z0-9_]+$/.test(username)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Username can only use lowercase letters, numbers, and underscores." }));
      return;
    }

    const supabaseAdmin = getAdminClient();

    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (existingProfile) {
      res.writeHead(409, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "That username is already taken." }));
      return;
    }

    const email = `${username}@${AUTH_EMAIL_DOMAIN}`;
    const accentColor = randomFrom(ACCENT_CHOICES, username);
    const wallpaper = randomFrom(WALLPAPER_CHOICES, username + "w");

    type AdminApi = { createUser(opts: Record<string, unknown>): Promise<{ data: { user: { id: string } | null }; error: { message: string } | null }> };
    type AuthWithAdmin = { admin: AdminApi };
    const { data: userData, error: createError } = await (supabaseAdmin.auth as unknown as AuthWithAdmin).admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username,
        display_name: displayName,
        avatar_url: `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(displayName)}`,
        bio: "Artist, collector, and letter sender.",
        accent_color: accentColor,
        wallpaper,
      },
    });

    if (createError || !userData.user) {
      const message = createError?.message ?? "Unable to create account.";
      const status = message.toLowerCase().includes("already") ? 409 : 400;
      const error = status === 409 ? "That username is already taken." : message;
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error }));
      return;
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid signup request." }));
  }
}
