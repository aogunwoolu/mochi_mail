
import { useCallback, useEffect, useMemo, useState } from "react";
import { generateId } from "@/lib/id";
import type { User } from "@supabase/supabase-js";
import { uniqueNamesGenerator } from "unique-names-generator";
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

function seededPickFrom<T>(items: readonly T[], seed: string): T {
  const index = Math.abs(seed.split("").reduce((acc, ch) => acc + (ch.codePointAt(0) ?? 0), 0)) % items.length;
  return items[index];
}

const GUEST_NAME_STARTS = ["Mochi", "Doodle", "Pastel", "Cloud", "Star", "Paper", "Tea", "Ribbon"];
const GUEST_NAME_ENDS = ["Fox", "Bun", "Sprite", "Comet", "Bear", "Note", "Bloom", "Sketch"];

function generateGuestName(): string {
  const base = uniqueNamesGenerator({ dictionaries: [GUEST_NAME_STARTS, GUEST_NAME_ENDS], separator: "_", length: 2 });
  return `${base}${Math.floor(Math.random() * 90 + 10)}`;
}

const GUEST_NAME_KEY = "mochimail_guest_name";
const GUEST_ID_KEY = "mochimail_guest_id";
const ANON_TOKENS_KEY = "mochimail_anon_tokens";
const AUTH_EMAIL_DOMAIN = "mochimail.app";

function saveAnonTokens(session: { access_token: string; refresh_token: string }) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(ANON_TOKENS_KEY, JSON.stringify(session)); } catch (err) { console.warn("[useAccount] Failed to save anon tokens to localStorage:", err); }
}

function clearAnonTokens() {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(ANON_TOKENS_KEY); } catch (err) { console.warn("[useAccount] Failed to remove anon tokens from localStorage:", err); }
}

async function tryRestoreAnonSession(
  supabase: ReturnType<typeof createSupabaseBrowserClient>
): Promise<User | null> {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(ANON_TOKENS_KEY);
  if (!raw) return null;
  try {
    const tokens = JSON.parse(raw) as { access_token: string; refresh_token: string };
    const { data, error } = await supabase.auth.setSession(tokens);
    if (error || !data.user || !isAnonymousUser(data.user)) {
      clearAnonTokens();
      return null;
    }
    if (data.session) saveAnonTokens(data.session);
    return data.user;
  } catch (err) {
    console.error("[useAccount] Failed to restore anonymous session:", err);
    clearAnonTokens();
    return null;
  }
}

function isAnonymousUser(user: User | null): boolean {
  if (!user) return false;
  // Supabase v2 exposes is_anonymous directly; fall back to checking identities
  if ("is_anonymous" in user && (user as { is_anonymous?: boolean }).is_anonymous === true) return true;
  // No linked identities = not a converted full account
  if (!user.identities || user.identities.length === 0) return true;
  return user.identities.every((identity) => identity.provider === "anonymous");
}

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
  const accentColor = getMetadataText(metadata, "accent_color") || seededPickFrom(ACCENT_CHOICES, username);
  const wallpaper = getMetadataText(metadata, "wallpaper") || seededPickFrom(WALLPAPER_CHOICES, username + "w");
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
  const id = sessionStorage.getItem(GUEST_ID_KEY) ?? `guest_${generateId()}`;
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
  const [anonymousAvatarUrl, setAnonymousAvatarUrl] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [anonymousAuthWarning, setAnonymousAuthWarning] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const guest = loadGuestIdentity();
    setGuestId(guest.id);
    setGuestName(guest.name);

    supabase.auth.getSession().then(async ({ data }) => {
      const existingUser = data.session?.user ?? null;
      if (existingUser) {
        if (isAnonymousUser(existingUser) && data.session) saveAnonTokens(data.session);
        // Load avatar URL from metadata for anonymous users
        const metadata = existingUser.user_metadata as Record<string, unknown> | undefined;
        const avatarFromMeta = metadata?.avatar_url;
        if (typeof avatarFromMeta === "string") setAnonymousAvatarUrl(avatarFromMeta);
        setAuthUser(existingUser);
        setHydrated(true);
        return;
      }

      // Try to restore a previously created anonymous session before creating a new one.
      const restored = await tryRestoreAnonSession(supabase);
      if (restored) {
        setAuthUser(restored);
        setHydrated(true);
        return;
      }

      const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously();
      if (anonError) {
        console.warn("[Account] Anonymous sign-in disabled or failed:", anonError.message);
        setAnonymousAuthWarning(anonError.message);
        setAuthUser(null);
        setHydrated(true);
        return;
      }

      if (anonData.session) saveAnonTokens(anonData.session);
      setAnonymousAuthWarning(null);
      setAuthUser(anonData.user ?? null);
      setHydrated(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      console.log("[DBG auth]", _event, "user:", nextUser?.id ?? null, "anon:", nextUser ? isAnonymousUser(nextUser) : null);
      if (nextUser) {
        if (isAnonymousUser(nextUser) && session) saveAnonTokens(session);
        else if (!isAnonymousUser(nextUser)) clearAnonTokens();
        setAnonymousAuthWarning(null);
        setAuthUser(nextUser);
        return;
      }

      void tryRestoreAnonSession(supabase).then((restored) => {
        if (restored) { setAuthUser(restored); return; }
        void supabase.auth.signInAnonymously().then(({ data: anonData, error: anonError }) => {
          if (anonError) {
            console.warn("[Account] Could not restore anonymous session:", anonError.message);
            setAnonymousAuthWarning(anonError.message);
            setAuthUser(null);
            return;
          }
          if (anonData.session) saveAnonTokens(anonData.session);
          setAnonymousAuthWarning(null);
          setAuthUser(anonData.user ?? null);
        });
      });
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authUser || isAnonymousUser(authUser)) { setProfile(null); setProfileLoading(false); return; }
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
    // Key on the user *identity*, not the authUser object reference. Supabase's
    // onAuthStateChange hands back a fresh user object on every event (initial
    // session, token refresh, tab refocus); depending on the object reference
    // re-ran this fetch each time, flipping profileLoading→hydrated false and
    // briefly unmounting the whole space (items "disappeared" after a few seconds).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id]);

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
    // Anonymous Supabase user: use their stable ID so mail/assets are consistent,
    // but treat them as a guest (no space, no public profile).
    return {
      id: authUser?.id ?? guestId,
      // Anonymous Supabase users have a real, stable auth.uid() that RLS accepts,
      // so expose it as accountId to let mail/shop/assets sync. True local-only
      // guests (no authUser) get undefined and stay on localStorage.
      accountId: authUser?.id,
      name: guestName,
      avatarUrl: anonymousAvatarUrl ?? undefined,
      isGuest: true,
    };
  }, [authUser, profile, guestId, guestName, anonymousAvatarUrl]);

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

  // Gentle save at checkout: convert the *existing* anonymous user into a saved
  // account in place (same auth.uid()), so all their assets/mail/space carry
  // over and any Mochi Plus perks bind to a durable, recoverable identity.
  //
  // NOTE: this uses a REAL email (unlike `signUp`, which uses a fake
  // username@mochimail.app address). If Supabase "Confirm email" is enabled the
  // address won't be active until verified — for the smoothest flow, enable
  // auto-confirm / disable secure email change for this project.
  const saveAccount = useCallback(async (input: {
    email: string;
    password: string;
    displayName?: string;
  }): Promise<{ ok: boolean; error?: string }> => {
    const email = input.email.trim().toLowerCase();
    const password = input.password.trim();
    if (!email || !password) return { ok: false, error: "Email and password are required." };
    if (!authUser) return { ok: false, error: "Still getting you set up — try again in a moment." };

    const supabase = createSupabaseBrowserClient();
    const displayName = (input.displayName ?? "").trim();
    const { data, error } = await supabase.auth.updateUser({
      email,
      password,
      data: displayName ? { display_name: displayName } : undefined,
    });
    if (error) return { ok: false, error: error.message };

    const updatedUser = data.user ?? authUser;
    // The user id is unchanged, so the profile-loading effect won't re-fire;
    // create the profile row here so the saved account is immediately usable.
    const { data: createdProfile } = await supabase
      .from("profiles")
      .upsert(buildProfileInsert(updatedUser), { onConflict: "id" })
      .select()
      .single();
    if (createdProfile) setProfile(createdProfile);
    setAuthUser(updatedUser);
    clearAnonTokens();
    return { ok: true };
  }, [authUser]);

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

  const uploadAvatar = useCallback(async (file: File): Promise<string | null> => {
    if (!authUser) return null;
    const supabase = createSupabaseBrowserClient();

    // Upload to avatars bucket with user ID as folder
    const fileExt = file.name.split(".").pop() ?? "png";
    const filePath = `${authUser.id}/avatar.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      console.error("[useAccount] Avatar upload failed:", uploadError);
      return null;
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
    const publicUrl = publicUrlData.publicUrl;

    // For anonymous users, save to user metadata so it persists
    if (isAnonymousUser(authUser)) {
      const { error: metaError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      });
      if (!metaError) setAnonymousAvatarUrl(publicUrl);
    }

    return publicUrl;
  }, [authUser]);

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

  const identityMode = authUser
    ? (isAnonymousUser(authUser) ? "anonymous" : "saved")
    : "local-guest";
  const hasSavedAccount = Boolean(authUser && profile && !isAnonymousUser(authUser));

  return {
    accounts: [] as never[],
    currentAccount,
    viewer,
    hasSession: Boolean(authUser),
    isAuthenticated: hasSavedAccount,
    hydrated: hydrated && !profileLoading,
    accountLabel: authUser ? (isAnonymousUser(authUser) ? "Anonymous artist" : "Saved account") : "Guest artist",
    identityMode,
    identityHelp:
      identityMode === "local-guest"
        ? `Local-only guest mode${anonymousAuthWarning ? `: ${anonymousAuthWarning}` : ". Enable Supabase anonymous sign-ins for shared cross-device users."}`
        : null,
    signUp,
    saveAccount,
    logIn,
    logOut,
    renameGuest,
    updateAccount,
    uploadAvatar,
  };
}
