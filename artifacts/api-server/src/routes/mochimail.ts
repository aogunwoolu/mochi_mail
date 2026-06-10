import { Router } from "express";
import { createClient } from "@supabase/supabase-js";

const router = Router();

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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !serviceRoleKey) throw new Error("Missing Supabase admin credentials");
  return createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

router.post("/auth/signup", async (req, res) => {
  try {
    const body = req.body as { username?: string; password?: string; displayName?: string };
    const username = body.username?.trim().toLowerCase() ?? "";
    const password = body.password?.trim() ?? "";
    const displayName = (body.displayName?.trim() || username).trim();

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required." });
    }
    if (!/^[a-z0-9_]+$/.test(username)) {
      return res.status(400).json({ error: "Username can only use lowercase letters, numbers, and underscores." });
    }

    const supabaseAdmin = getAdminClient();

    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (existingProfile) {
      return res.status(409).json({ error: "That username is already taken." });
    }

    const email = `${username}@${AUTH_EMAIL_DOMAIN}`;
    const accentColor = randomFrom(ACCENT_CHOICES, username);
    const wallpaper = randomFrom(WALLPAPER_CHOICES, username + "w");

    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
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
      if (message.toLowerCase().includes("already")) {
        return res.status(409).json({ error: "That username is already taken." });
      }
      return res.status(400).json({ error: message });
    }

    return res.json({ ok: true });
  } catch {
    return res.status(400).json({ error: "Invalid signup request." });
  }
});

const GIF_PROVIDER = (process.env.GIF_PROVIDER ?? "giphy").toLowerCase();
const GIPHY_KEY = process.env.GIPHY_API_KEY ?? "";
const GIFAPI_KEY = process.env.GIFAPI_KEY ?? "";
const GIFAPI_BASE_URL = process.env.GIFAPI_BASE_URL ?? "https://api.gifapi.com/v1";

function gifProviderReady(): { ready: boolean; provider: string; error?: string } {
  if (GIF_PROVIDER === "giphy") {
    return GIPHY_KEY
      ? { ready: true, provider: "giphy" }
      : { ready: false, provider: "giphy", error: "missing_giphy_key" };
  }
  return GIFAPI_KEY
    ? { ready: true, provider: "gifapi" }
    : { ready: false, provider: "gifapi", error: "missing_gifapi_key" };
}

// Log GIF provider status at startup so missing keys are surfaced immediately.
const gifStatus = gifProviderReady();
if (gifStatus.ready) {
  console.info(`[GIF] Provider "${gifStatus.provider}" configured and ready.`);
} else {
  console.warn(`[GIF] Provider "${gifStatus.provider}" not ready — ${gifStatus.error}. Set the appropriate API key secret to enable GIF search.`);
}

router.get("/gifs/status", (_req, res) => {
  return res.json(gifProviderReady());
});

router.get("/gifs/search", async (req, res) => {
  const q = (req.query.q as string | undefined)?.trim();
  if (!q) return res.status(400).json({ error: "Missing query" });

  try {
    let url: string;
    if (GIF_PROVIDER === "giphy") {
      if (!GIPHY_KEY) return res.status(500).json({ error: "missing_giphy_key" });
      url = `https://api.giphy.com/v1/gifs/search?${new URLSearchParams({ api_key: GIPHY_KEY, q, limit: "18", rating: "pg" })}`;
    } else {
      if (!GIFAPI_KEY) return res.status(500).json({ error: "missing_gifapi_key" });
      url = `${GIFAPI_BASE_URL}/gifs/search?${new URLSearchParams({ api_key: GIFAPI_KEY, q, limit: "18", rating: "pg" })}`;
    }

    const fetchRes = await fetch(url);
    if (fetchRes.status === 429) return res.status(429).json({ error: "rate_limited" });
    if (!fetchRes.ok) return res.status(502).json({ error: "search_failed" });
    const data = await fetchRes.json();
    return res.json(data);
  } catch {
    return res.status(500).json({ error: "search_failed" });
  }
});

export default router;
