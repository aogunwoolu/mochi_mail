"use client";

import { useEffect, useMemo, useState } from "react";
import { ViewerIdentity } from "@/types";

const ACCENT_PRESETS = ["#ff6b9d", "#67d4f1", "#6ee7b7", "#a78bfa", "#fb923c", "#fbbf24"] as const;

const WALLPAPER_PRESETS = [
  {
    id: "petal-blush",
    name: "Petal Blush",
    value: "radial-gradient(circle at top left, rgba(255,255,255,0.95), rgba(255,214,236,0.92) 42%, rgba(255,246,251,0.92) 100%)",
  },
  {
    id: "mint-airmail",
    name: "Mint Airmail",
    value: "linear-gradient(135deg, rgba(237,247,255,0.95), rgba(203,244,255,0.92), rgba(244,255,252,0.96))",
  },
  {
    id: "apricot-note",
    name: "Apricot Note",
    value: "linear-gradient(145deg, rgba(255,248,228,0.96), rgba(255,224,208,0.92), rgba(255,245,236,0.96))",
  },
  {
    id: "lilac-dream",
    name: "Lilac Dream",
    value: "linear-gradient(145deg, rgba(246,241,255,0.96), rgba(226,223,255,0.92), rgba(255,245,252,0.96))",
  },
] as const;

function buildDicebearUrl(seed: string): string {
  return `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(seed || "mochimail")}`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read file."));
    reader.readAsDataURL(file);
  });
}

function SwatchButton({
  color,
  active,
  onClick,
}: Readonly<{ color: string; active: boolean; onClick: () => void }>) {
  return (
    <button
      onClick={onClick}
      className="btn-smooth h-9 w-9 rounded-full border-2"
      style={{
        background: color,
        borderColor: active ? "rgba(53,39,66,0.85)" : "rgba(53,39,66,0.12)",
        boxShadow: active ? "0 0 0 3px rgba(255,255,255,0.92), 0 0 0 5px rgba(53,39,66,0.12)" : "none",
      }}
      aria-label={`Choose ${color}`}
      title={color}
    />
  );
}

function SectionCard({ title, note, children }: Readonly<{ title: string; note?: string; children: React.ReactNode }>) {
  return (
    <div className="rounded-2xl border p-3" style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.7)" }}>
      <div className="mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--muted)" }}>
          {title}
        </p>
        {note ? (
          <p className="mt-1 text-xs" style={{ color: "var(--muted-strong)" }}>
            {note}
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

interface AccountPanelProps {
  viewer: ViewerIdentity;
  currentAccount: { id: string; username: string; displayName: string; avatarUrl: string; bio: string; homeTitle: string; youtubeUrl: string; accentColor: string; wallpaper: string; } | null;
  isAuthenticated: boolean;
  onClose: () => void;
  onRenameGuest: (name: string) => void;
  onSignUp: (username: string, password: string, displayName: string) => Promise<{ ok: boolean; error?: string }>;
  onLogIn: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  onLogOut: () => void;
  onUpdateAccount: (patch: { displayName?: string; avatarUrl?: string; bio?: string; accentColor?: string; wallpaper?: string; youtubeUrl?: string; homeTitle?: string; }) => void;
  onOpenSpaces: () => void;
}

interface AuthenticatedPanelProps {
  currentAccount: NonNullable<AccountPanelProps["currentAccount"]>;
  accent: string;
  selectedWallpaper: string;
  previewName: string;
  previewAvatar: string;
  spaceNamePreview: string;
  bio: string;
  profileName: string;
  setProfileName: (value: string) => void;
  setBio: (value: string) => void;
  homeTitle: string;
  setHomeTitle: (value: string) => void;
  avatarChoices: string[];
  avatarUrl: string;
  setAvatarUrl: (value: string) => void;
  accentColor: string;
  setAccentColor: (value: string) => void;
  setWallpaper: (value: string) => void;
  youtubeUrl: string;
  setYoutubeUrl: (value: string) => void;
  hasProfileChanges: boolean;
  onOpenSpaces: () => void;
  onSave: () => void;
  onLogOut: () => void;
  onUploadAvatar: (file: File | null) => void;
}

interface GuestPanelProps {
  guestName: string;
  setGuestName: (value: string) => void;
  handleGuestSave: () => void;
  mode: "login" | "signup";
  setMode: (value: "login" | "signup") => void;
  username: string;
  setUsername: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  displayName: string;
  setDisplayName: (value: string) => void;
  handleAuth: () => void;
  authBusy: boolean;
  error: string;
  clearError: () => void;
}

function AuthenticatedPanel(props: Readonly<AuthenticatedPanelProps>) {
  const authButtonLabel = props.hasProfileChanges ? "Save changes" : "Saved";

  return (
    <div className="space-y-3">
      <div className="rounded-3xl border p-4" style={{ borderColor: `${props.accent}44`, background: props.selectedWallpaper }}>
        <div className="rounded-[28px] border px-4 py-4 shadow-[0_14px_32px_rgba(53,39,66,0.12)]" style={{ borderColor: `${props.accent}55`, background: "rgba(255,255,255,0.82)" }}>
          <div className="flex items-center gap-3">
            <div className="h-16 w-16 overflow-hidden rounded-2xl border-2" style={{ borderColor: props.accent, background: props.accent }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={props.previewAvatar} alt={props.previewName} className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-bold">{props.previewName}</p>
              <p className="text-xs" style={{ color: "var(--muted)" }}>@{props.currentAccount.username}</p>
              <div className="mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold" style={{ background: `${props.accent}22`, color: "var(--foreground-soft)" }}>
                {props.spaceNamePreview}
              </div>
            </div>
          </div>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--foreground-soft)" }}>
            {props.bio.trim() || "Add a short bio so visitors know what kind of stationery goblin you are."}
          </p>
        </div>
      </div>

      <SectionCard title="Basics" note="The core things people notice first.">
        <div className="grid gap-2">
          <input value={props.profileName} onChange={(e) => props.setProfileName(e.target.value)} placeholder="👤 Display name" className="input-soft w-full px-3 py-2 text-sm outline-none" />
          <textarea value={props.bio} onChange={(e) => props.setBio(e.target.value)} placeholder="📝 Short bio" rows={3} className="input-soft w-full resize-none px-3 py-2 text-sm outline-none" />
          <input value={props.homeTitle} onChange={(e) => props.setHomeTitle(e.target.value)} placeholder="🏠 Space title" className="input-soft w-full px-3 py-2 text-sm outline-none" />
        </div>
      </SectionCard>

      <SectionCard title="Avatar" note="Pick a cute generated avatar, or paste your own image URL if you want something custom.">
        <div className="grid grid-cols-3 gap-2">
          {props.avatarChoices.map((seed) => {
            const option = buildDicebearUrl(seed);
            const active = (props.avatarUrl.trim() || buildDicebearUrl(props.previewName)) === option;
            return (
              <button
                key={seed}
                onClick={() => props.setAvatarUrl(option)}
                className="btn-smooth overflow-hidden rounded-2xl border p-1"
                style={{ borderColor: active ? props.accent : "var(--border)", background: "rgba(255,255,255,0.88)" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={option} alt={seed} className="aspect-square w-full rounded-xl object-cover" />
              </button>
            );
          })}
        </div>
        <label
          className="btn-smooth mt-2 flex w-full cursor-pointer items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold"
          style={{ background: "var(--surface)", color: "var(--foreground-soft)", border: "1px solid var(--border)" }}
        >
          <span>Upload avatar image</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              props.onUploadAvatar(e.target.files?.[0] ?? null);
              e.currentTarget.value = "";
            }}
          />
        </label>
        <input value={props.avatarUrl} onChange={(e) => props.setAvatarUrl(e.target.value)} placeholder="🔗 Or paste a custom avatar URL" className="input-soft mt-2 w-full px-3 py-2 text-sm outline-none" />
      </SectionCard>

      <SectionCard title="Style" note="Choose a vibe instead of typing CSS.">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>Accent</p>
          <div className="flex flex-wrap gap-2">
            {ACCENT_PRESETS.map((color) => (
              <SwatchButton key={color} color={color} active={props.accentColor === color} onClick={() => props.setAccentColor(color)} />
            ))}
          </div>
        </div>
        <div className="mt-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>Wallpaper</p>
          <div className="grid grid-cols-2 gap-2">
            {WALLPAPER_PRESETS.map((preset) => {
              const active = props.selectedWallpaper === preset.value;
              return (
                <button
                  key={preset.id}
                  onClick={() => props.setWallpaper(preset.value)}
                  className="btn-smooth overflow-hidden rounded-2xl border text-left"
                  style={{ borderColor: active ? props.accent : "var(--border)", background: "rgba(255,255,255,0.88)" }}
                >
                  <div className="h-14" style={{ background: preset.value }} />
                  <div className="px-3 py-2 text-xs font-semibold">{preset.name}</div>
                </button>
              );
            })}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Extras" note="Nice-to-have profile details.">
        <div className="grid gap-2">
          <input value={props.youtubeUrl} onChange={(e) => props.setYoutubeUrl(e.target.value)} placeholder="🎵 YouTube link for your space soundtrack" className="input-soft w-full px-3 py-2 text-sm outline-none" />
          <div className="rounded-2xl px-3 py-2 text-xs" style={{ background: "var(--surface)", color: "var(--muted-strong)" }}>
            Username is fixed as @{props.currentAccount.username}
          </div>
        </div>
      </SectionCard>

      <div className="flex gap-2 pt-1">
        <button
          onClick={props.onOpenSpaces}
          className="btn-smooth flex-1 rounded-xl px-3 py-2 text-xs font-semibold text-white"
          style={{ background: `linear-gradient(135deg, ${props.accent}, var(--lavender))` }}
        >
          🏠 My Space
        </button>
        <button
          onClick={props.onSave}
          disabled={!props.hasProfileChanges}
          className="btn-smooth rounded-xl px-3 py-2 text-xs font-semibold"
          style={{ background: props.hasProfileChanges ? "var(--surface)" : "rgba(255,255,255,0.5)", color: "var(--foreground-soft)", border: "1px solid var(--border)", opacity: props.hasProfileChanges ? 1 : 0.6 }}
        >
          {authButtonLabel}
        </button>
        <button
          onClick={props.onLogOut}
          className="btn-smooth rounded-xl px-3 py-2 text-xs font-semibold"
          style={{ background: "var(--surface)", color: "var(--muted-strong)", border: "1px solid var(--border)" }}
        >
          Log out
        </button>
      </div>
    </div>
  );
}

function GuestPanel(props: Readonly<GuestPanelProps>) {
  let authActionLabel = "Log in";
  if (props.authBusy) {
    authActionLabel = "Working...";
  } else if (props.mode === "signup") {
    authActionLabel = "✦ Create account";
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border p-4" style={{ borderColor: "var(--border)", background: "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(248,242,255,0.92))" }}>
        <p className="text-sm font-semibold">Make your profile permanent</p>
        <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--muted-strong)" }}>
          Keep your name, unlock your own space, and send letters from a real account.
        </p>
        <div className="mt-3 flex gap-2">
          <div className="flex-1 rounded-2xl px-3 py-2 text-xs" style={{ background: "rgba(255,255,255,0.8)" }}>Save your look</div>
          <div className="flex-1 rounded-2xl px-3 py-2 text-xs" style={{ background: "rgba(255,255,255,0.8)" }}>Get a profile space</div>
        </div>
      </div>

      <SectionCard title="Guest Name" note="Set how you appear while browsing before you sign up.">
        <div className="flex gap-2">
          <input
            value={props.guestName}
            onChange={(e) => props.setGuestName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && props.handleGuestSave()}
            className="input-soft min-w-0 flex-1 px-3 py-2 text-sm outline-none"
              placeholder="✨ Your artist name"
          />
          <button
            onClick={props.handleGuestSave}
            className="btn-smooth shrink-0 rounded-xl px-3 py-2 text-xs font-semibold"
            style={{ background: "var(--surface)", color: "var(--foreground-soft)", border: "1px solid var(--border)" }}
          >
            Use it
          </button>
        </div>
      </SectionCard>

      <div>
        <div className="mb-3 flex gap-1 rounded-2xl p-1" style={{ background: "var(--surface)" }}>
          {(["signup", "login"] as const).map((entry) => (
            <button
              key={entry}
              onClick={() => { props.setMode(entry); props.clearError(); }}
              className="btn-smooth flex-1 rounded-xl py-1.5 text-xs font-semibold transition-colors"
              style={{
                background: props.mode === entry ? "white" : "transparent",
                color: props.mode === entry ? "var(--foreground)" : "var(--muted)",
                boxShadow: props.mode === entry ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
              }}
            >
              {entry === "signup" ? "Create account" : "Log in"}
            </button>
          ))}
        </div>

        <div className="space-y-2 rounded-2xl border p-3" style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.7)" }}>
          {props.mode === "signup" ? (
            <div>
              <p className="mb-1 px-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>Display name</p>
              <input value={props.displayName} onChange={(e) => props.setDisplayName(e.target.value)} placeholder="👤 e.g. Mochi Fox" className="input-soft w-full px-3 py-2 text-sm outline-none" />
            </div>
          ) : null}
          <div>
            <p className="mb-1 px-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>Username</p>
            <input value={props.username} onChange={(e) => props.setUsername(e.target.value)} placeholder="@ e.g. mochifox" className="input-soft w-full px-3 py-2 text-sm outline-none" autoComplete="username" />
            <p className="mt-1 px-0.5 text-[10px]" style={{ color: "var(--muted)" }}>Lowercase letters, numbers, and underscores only.</p>
          </div>
          <div>
            <p className="mb-1 px-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>Password</p>
            <input value={props.password} onChange={(e) => props.setPassword(e.target.value)} type="password" placeholder="🔒 ••••••••" className="input-soft w-full px-3 py-2 text-sm outline-none" autoComplete={props.mode === "signup" ? "new-password" : "current-password"} onKeyDown={(e) => e.key === "Enter" && props.handleAuth()} />
          </div>
        </div>

        {props.error ? (
          <p className="mt-2 rounded-xl px-3 py-2 text-xs font-medium" style={{ background: "rgba(255,107,157,0.10)", color: "var(--pink)" }}>{props.error}</p>
        ) : null}

        <button
          onClick={props.handleAuth}
          disabled={props.authBusy}
          className="btn-smooth mt-3 w-full rounded-xl px-3 py-2.5 text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg, var(--pink), var(--lavender))", opacity: props.authBusy ? 0.75 : 1 }}
        >
          {authActionLabel}
        </button>

        <p className="mt-2.5 text-center text-[10px]" style={{ color: "var(--muted)" }}>
          {props.mode === "signup" ? "Already have an account? " : "New here? "}
          <button className="font-semibold underline-offset-2 hover:underline" style={{ color: "var(--pink)" }} onClick={() => { props.setMode(props.mode === "signup" ? "login" : "signup"); props.clearError(); }}>
            {props.mode === "signup" ? "Log in" : "Sign up"}
          </button>
        </p>
      </div>
    </div>
  );
}

export default function AccountPanel({
  viewer,
  currentAccount,
  isAuthenticated,
  onClose,
  onRenameGuest,
  onSignUp,
  onLogIn,
  onLogOut,
  onUpdateAccount,
  onOpenSpaces,
}: Readonly<AccountPanelProps>) {
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [error, setError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [guestName, setGuestName] = useState(viewer.name);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const [profileName, setProfileName] = useState(currentAccount?.displayName ?? "");
  const [avatarUrl, setAvatarUrl] = useState(currentAccount?.avatarUrl ?? "");
  const [bio, setBio] = useState(currentAccount?.bio ?? "");
  const [homeTitle, setHomeTitle] = useState(currentAccount?.homeTitle ?? "");
  const [youtubeUrl, setYoutubeUrl] = useState(currentAccount?.youtubeUrl ?? "");
  const [accentColor, setAccentColor] = useState(currentAccount?.accentColor ?? "#ff6b9d");
  const [wallpaper, setWallpaper] = useState(currentAccount?.wallpaper ?? "");

  useEffect(() => { setGuestName(viewer.name); }, [viewer.name]);
  useEffect(() => {
    setProfileName(currentAccount?.displayName ?? "");
    setAvatarUrl(currentAccount?.avatarUrl ?? "");
    setBio(currentAccount?.bio ?? "");
    setHomeTitle(currentAccount?.homeTitle ?? "");
    setYoutubeUrl(currentAccount?.youtubeUrl ?? "");
    setAccentColor(currentAccount?.accentColor ?? "#ff6b9d");
    setWallpaper(currentAccount?.wallpaper ?? "");
  }, [currentAccount]);

  const handleGuestSave = () => { onRenameGuest(guestName); setError(""); };

  const handleAvatarUpload = async (file: File | null) => {
    if (!file) return;
    const imageUrl = await readFileAsDataUrl(file);
    if (imageUrl) setAvatarUrl(imageUrl);
  };

  const handleAuth = async () => {
    setAuthBusy(true);
    const result = mode === "signup"
      ? await onSignUp(username, password, displayName)
      : await onLogIn(username, password);
    setAuthBusy(false);
    if (!result.ok) { setError(result.error ?? "Unable to continue."); return; }
    setError(""); setUsername(""); setPassword(""); setDisplayName("");
  };

  const handleProfileSave = () => {
    onUpdateAccount({
      displayName: profileName.trim() || currentAccount?.displayName,
      avatarUrl: avatarUrl.trim(),
      bio: bio.trim(),
      homeTitle: homeTitle.trim(),
      youtubeUrl: youtubeUrl.trim(),
      accentColor,
      wallpaper: wallpaper.trim(),
    });
  };

  const accent = accentColor || "#ff6b9d";
  const selectedWallpaper = wallpaper || WALLPAPER_PRESETS[0].value;
  const previewName = profileName.trim() || currentAccount?.displayName || viewer.name;
  const previewAvatar = avatarUrl.trim() || buildDicebearUrl(previewName);
  const spaceNamePreview = homeTitle.trim() || `${previewName}'s Space`;
  const hasProfileChanges = Boolean(
    currentAccount && (
      profileName !== currentAccount.displayName ||
      avatarUrl !== currentAccount.avatarUrl ||
      bio !== currentAccount.bio ||
      homeTitle !== currentAccount.homeTitle ||
      youtubeUrl !== currentAccount.youtubeUrl ||
      accentColor !== currentAccount.accentColor ||
      wallpaper !== currentAccount.wallpaper
    )
  );
  const avatarChoices = useMemo(
    () => [previewName, currentAccount?.username ?? viewer.name, `${previewName}-mail`].filter(Boolean),
    [currentAccount?.username, previewName, viewer.name]
  );
  const panelBody = isAuthenticated && currentAccount ? (
    <AuthenticatedPanel
      currentAccount={currentAccount}
      accent={accent}
      selectedWallpaper={selectedWallpaper}
      previewName={previewName}
      previewAvatar={previewAvatar}
      spaceNamePreview={spaceNamePreview}
      bio={bio}
      profileName={profileName}
      setProfileName={setProfileName}
      setBio={setBio}
      homeTitle={homeTitle}
      setHomeTitle={setHomeTitle}
      avatarChoices={avatarChoices}
      avatarUrl={avatarUrl}
      setAvatarUrl={setAvatarUrl}
      accentColor={accentColor}
      setAccentColor={setAccentColor}
      setWallpaper={setWallpaper}
      youtubeUrl={youtubeUrl}
      setYoutubeUrl={setYoutubeUrl}
      hasProfileChanges={hasProfileChanges}
      onOpenSpaces={onOpenSpaces}
      onSave={handleProfileSave}
      onLogOut={onLogOut}
      onUploadAvatar={(file) => { void handleAvatarUpload(file); }}
    />
  ) : (
    <GuestPanel
      guestName={guestName}
      setGuestName={setGuestName}
      handleGuestSave={handleGuestSave}
      mode={mode}
      setMode={setMode}
      username={username}
      setUsername={setUsername}
      password={password}
      setPassword={setPassword}
      displayName={displayName}
      setDisplayName={setDisplayName}
      handleAuth={handleAuth}
      authBusy={authBusy}
      error={error}
      clearError={() => setError("")}
    />
  );

  return (
    <div
      className="absolute right-4 top-16 z-50 w-[min(28rem,calc(100vw-2rem))] animate-fade-in overflow-hidden rounded-3xl"
      style={{
        background: "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(250,245,255,0.96))",
        border: "1px solid var(--border-strong)",
        boxShadow: "0 8px 40px rgba(120,60,160,0.18), 0 2px 8px rgba(0,0,0,0.08)",
      }}
    >
      {/* Banner */}
      <div
        className="relative flex items-end px-5 pb-4 pt-5"
        style={{ background: `linear-gradient(135deg, ${accent}22 0%, var(--lavender)22 100%)`, borderBottom: "1px solid var(--border)" }}
      >
        {isAuthenticated && currentAccount ? (
          <div className="flex flex-1 items-center gap-3">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 text-lg font-bold text-white"
              style={{ borderColor: accent, background: avatarUrl ? "transparent" : accent }}
            >
              {avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={avatarUrl} alt={profileName} className="h-full w-full object-cover" />
              ) : (
                (profileName || currentAccount.displayName).slice(0, 2).toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{profileName || currentAccount.displayName}</p>
              <p className="text-xs" style={{ color: "var(--muted)" }}>@{currentAccount.username}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl text-base" style={{ background: "linear-gradient(135deg, var(--pink), var(--lavender))" }}>
              ✦
            </div>
            <div>
              <p className="text-sm font-bold">MochiMail</p>
              <p className="text-[10px]" style={{ color: "var(--muted)" }}>Digital stationery studio</p>
            </div>
          </div>
        )}
        <button
          onClick={onClose}
          className="btn-smooth absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-sm"
          style={{ background: "rgba(255,255,255,0.6)", color: "var(--muted-strong)" }}
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className="max-h-[min(80vh,46rem)] overflow-y-auto p-4">
        {panelBody}
      </div>
    </div>
  );
}
