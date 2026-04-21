"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ViewerIdentity } from "@/types";
import type { Database } from "@/types/database";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];

const ACCENT_CHOICES = ["#ff6b9d", "#67d4f1", "#6ee7b7", "#a78bfa", "#fb923c", "#fbbf24"];
const WALLPAPER_CHOICES = [
  "radial-gradient(circle at top left, rgba(255,255,255,0.95), rgba(255,214,236,0.92) 42%, rgba(255,246,251,0.92) 100%)",
  "linear-gradient(135deg, rgba(237,247,255,0.95), rgba(203,244,255,0.92), rgba(244,255,252,0.96))",
  "linear-gradient(145deg, rgba(255,248,228,0.96), rgba(255,224,208,0.92), rgba(255,245,236,0.96))",
  "linear-gradient(145deg, rgba(246,241,255,0.96), rgba(226,223,255,0.92), rgba(255,245,252,0.96))",
];

function randomFrom<T>(items: readonly T[], seed: string): T {
  const index = Math.abs(seed.split("").reduce((acc, ch) => acc + (ch.codePointAt(0) ?? 0), 0)) % items.length;
  return items[index];
}

function generateGuestName(): string {
  const starts = ["Mochi", "Doodle", "Pastel", "Cloud", "Star", "Paper", "Tea", "Ribbon"];
  const ends = ["Fox", "Bun", "Sprite", "Comet", "Bear", "Note", "Bloom", "Sketch"];
  const seed = Math.random().toString(36).slice(2);
  return `${randomFrom(starts, seed)}_${randomFrom(ends, seed + "t")}${Math.floor(Math.random() * 90 + 10)}`;
}

const GUEST_NAME_KEY = "mochimail_guest_name";
const GUEST_ID_KEY = "mochimail_guest_id";
const AUTH_EMAIL_DOMAIN = "mochimail.app";

function sanitizeUsername(value: string): string {
  return value.toLowerCase().replaceAll(/[^a-z0-9_]/g, "_").replaceAll(/_+/g, "_").replaceAll(/^_+|_+$/g, "");
}

function getMetadataText(metadata: Record<string, unknown>, key: string): string {
  const value = metadata[key];
  return typeof value === "string" ? value.trim() : "";
}

function buildProfileInsert(user: User): ProfileInsert {
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const emailName = user.email?.split("@")[0] ?? "";
  const username =
    sanitizeUsername(getMetadataText(metadata, "username")) ||
    sanitizeUsername(emailName) ||
    `mochi_${user.id.slice(0, 8)}`;
  const displayName = getMetadataText(metadata, "display_name") || username;
  const accentColor = getMetadataText(metadata, "accent_color") || randomFrom(ACCENT_CHOICES, username);
  const wallpaper = getMetadataText(metadata, "wallpaper") || randomFrom(WALLPAPER_CHOICES, username + "w");
  const avatarUrl = getMetadataText(metadata, "avatar_url") || `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(displayName)}`;
  const bio = getMetadataText(metadata, "bio") || "Artist, collector, and letter sender.";

  return {
    id: user.id,
    username,
    display_name: displayName,
    avatar_url: avatarUrl,
    bio,
    accent_color: accentColor,
    wallpaper,
  };
}

function loadGuestIdentity(): { id: string; name: string } {
  if (globalThis.window === undefined) return { id: "", name: "" };
  const id = sessionStorage.getItem(GUEST_ID_KEY) ?? `guest_${Math.random().toString(36).slice(2)}`;
  const name = localStorage.getItem(GUEST_NAME_KEY) ?? generateGuestName();
  sessionStorage.setItem(GUEST_ID_KEY, id);
  localStorage.setItem(GUEST_NAME_KEY, name);
  return { id, name };
}

export function useAccount() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [guestId, setGuestId] = useState("");
  const [guestName, setGuestName] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const guest = loadGuestIdentity();
    setGuestId(guest.id);
    setGuestName(guest.name);

    supabase.auth.getSession().then(({ data }) => {
      setAuthUser(data.session?.user ?? null);
      setHydrated(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authUser) { setProfile(null); setProfileLoading(false); return; }
    setProfileLoading(true);
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;

    const loadProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .maybeSingle();

      if (cancelled) return;

      if (data) {
        setProfile(data);
        setProfileLoading(false);
        return;
      }

      const fallbackProfile = buildProfileInsert(authUser);
      const { data: createdProfile } = await supabase
        .from("profiles")
        .upsert(fallbackProfile, { onConflict: "id" })
        .select()
        .single();

      if (cancelled) return;
      setProfile(createdProfile ?? null);
      setProfileLoading(false);
    };

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [authUser]);

  const viewer = useMemo<ViewerIdentity>(() => {
    if (authUser && profile) {
      return {
        id: authUser.id,
        accountId: authUser.id,
        username: profile.username,
        name: profile.display_name,
        avatarUrl: profile.avatar_url ?? undefined,
        bio: profile.bio ?? undefined,
        accentColor: profile.accent_color ?? undefined,
        wallpaper: profile.wallpaper ?? undefined,
        youtubeUrl: profile.youtube_url ?? undefined,
        isGuest: false,
      };
    }
    return { id: guestId, name: guestName, isGuest: true };
  }, [authUser, profile, guestId, guestName]);

  const currentAccount = useMemo(
    () =>
      profile
        ? {
            id: authUser!.id,
            username: profile.username,
            displayName: profile.display_name,
            avatarUrl: profile.avatar_url ?? "",
            bio: profile.bio ?? "",
            homeTitle: profile.display_name + "'s Space",
            youtubeUrl: profile.youtube_url ?? "",
            accentColor: profile.accent_color ?? "#ff6b9d",
            wallpaper: profile.wallpaper ?? "",
          }
        : null,
    [authUser, profile]
  );

  const signUp = useCallback(async (
    username: string,
    password: string,
    displayName: string
  ): Promise<{ ok: boolean; error?: string }> => {
    const clean = username.trim().toLowerCase();
    const name = displayName.trim() || clean;
    if (!clean || !password.trim()) return { ok: false, error: "Username and password are required." };

    const createRes = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: clean, password: password.trim(), displayName: name }),
    });

    if (!createRes.ok) {
      const payload = (await createRes.json().catch(() => ({ error: "Sign up failed." }))) as { error?: string };
      return { ok: false, error: payload.error ?? "Sign up failed." };
    }

    const supabase = createSupabaseBrowserClient();
    const email = `${clean}@${AUTH_EMAIL_DOMAIN}`;
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: password.trim(),
    });
    if (signInError) return { ok: false, error: signInError.message };

    return { ok: true };
  }, []);

  const logIn = useCallback(async (
    username: string,
    password: string
  ): Promise<{ ok: boolean; error?: string }> => {
    const supabase = createSupabaseBrowserClient();
    const email = `${username.trim().toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;
    const { error } = await supabase.auth.signInWithPassword({ email, password: password.trim() });
    if (error) return { ok: false, error: "Invalid username or password." };
    return { ok: true };
  }, []);

  const logOut = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
  }, []);

  const renameGuest = useCallback((name: string) => {
    const next = name.trim();
    if (!next) return;
    setGuestName(next);
    if (globalThis.window !== undefined) localStorage.setItem(GUEST_NAME_KEY, next);
  }, []);

  const updateAccount = useCallback(async (patch: {
    displayName?: string;
    avatarUrl?: string;
    bio?: string;
    accentColor?: string;
    wallpaper?: string;
    youtubeUrl?: string;
    homeTitle?: string;
  }) => {
    if (!authUser) return;
    const supabase = createSupabaseBrowserClient();
    const { data } = await supabase
      .from("profiles")
      .update({
        display_name: patch.displayName,
        avatar_url: patch.avatarUrl,
        bio: patch.bio,
        accent_color: patch.accentColor,
        wallpaper: patch.wallpaper,
        youtube_url: patch.youtubeUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", authUser.id)
      .select()
      .single();
    if (data) setProfile(data);
  }, [authUser]);

  return {
    accounts: [] as never[],
    currentAccount,
    viewer,
    hasSession: Boolean(authUser),
    isAuthenticated: Boolean(authUser && profile),
    hydrated: hydrated && !profileLoading,
    accountLabel: authUser ? "Saved account" : "Guest artist",
    signUp,
    logIn,
    logOut,
    renameGuest,
    updateAccount,
  };
}
