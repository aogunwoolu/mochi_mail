import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const ACCENT_CHOICES = ["#ff6b9d", "#67d4f1", "#6ee7b7", "#a78bfa", "#fb923c", "#fbbf24"];
const WALLPAPER_CHOICES = [
  "radial-gradient(circle at top left, rgba(255,255,255,0.95), rgba(255,214,236,0.92) 42%, rgba(255,246,251,0.92) 100%)",
  "linear-gradient(135deg, rgba(237,247,255,0.95), rgba(203,244,255,0.92), rgba(244,255,252,0.96))",
  "linear-gradient(145deg, rgba(255,248,228,0.96), rgba(255,224,208,0.92), rgba(255,245,236,0.96))",
  "linear-gradient(145deg, rgba(246,241,255,0.96), rgba(226,223,255,0.92), rgba(255,245,252,0.96))",
];

const AUTH_EMAIL_DOMAIN = "mochimail.app";

function randomFrom<T>(items: readonly T[], seed: string): T {
  const index = Math.abs(seed.split("").reduce((acc, ch) => acc + (ch.codePointAt(0) ?? 0), 0)) % items.length;
  return items[index];
}

type SignupBody = {
  username?: string;
  password?: string;
  displayName?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SignupBody;
    const username = body.username?.trim().toLowerCase() ?? "";
    const password = body.password?.trim() ?? "";
    const displayName = (body.displayName?.trim() || username).trim();

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
    }

    if (!/^[a-z0-9_]+$/.test(username)) {
      return NextResponse.json({ error: "Username can only use lowercase letters, numbers, and underscores." }, { status: 400 });
    }

    const supabaseAdmin = createSupabaseAdminClient();

    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }

    const email = `${username}@${AUTH_EMAIL_DOMAIN}`;

    // Derive stable accent/wallpaper from username since we don't have the user id yet.
    const accentColor = randomFrom(ACCENT_CHOICES, username);
    const wallpaper = randomFrom(WALLPAPER_CHOICES, username + "w");

    // Pass profile fields as user_metadata so the DB trigger can insert the
    // profiles row as SECURITY DEFINER, fully bypassing RLS.
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
        return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
      }
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid signup request." }, { status: 400 });
  }
}
