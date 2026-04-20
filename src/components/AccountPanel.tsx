"use client";

import { useEffect, useState } from "react";
import { ViewerIdentity } from "@/types";

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

  const handleAuth = async () => {
    const result = mode === "signup"
      ? await onSignUp(username, password, displayName)
      : await onLogIn(username, password);
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

  return (
    <div
      className="absolute right-4 top-16 z-50 w-[min(22rem,calc(100vw-2rem))] animate-fade-in overflow-hidden rounded-3xl"
      style={{
        background: "var(--surface-active)",
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

      <div className="p-4">
        {isAuthenticated && currentAccount ? (
          <div className="space-y-3">
            {/* Profile fields */}
            <div className="space-y-2">
              <p className="px-0.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>Profile</p>
              <input value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Display name" className="input-soft w-full px-3 py-2 text-sm outline-none" />
              <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="Avatar image URL" className="input-soft w-full px-3 py-2 text-sm outline-none" />
              <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Short bio…" rows={2} className="input-soft w-full resize-none px-3 py-2 text-sm outline-none" />
            </div>

            {/* Space settings */}
            <div className="space-y-2">
              <p className="px-0.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>Space</p>
              <input value={homeTitle} onChange={(e) => setHomeTitle(e.target.value)} placeholder="Space title" className="input-soft w-full px-3 py-2 text-sm outline-none" />
              <div className="flex items-center gap-2">
                <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent p-0.5 outline-none" title="Accent colour" />
                <input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} placeholder="#ff6b9d" className="input-soft min-w-0 flex-1 px-3 py-2 text-sm outline-none" />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={onOpenSpaces}
                className="btn-smooth flex-1 rounded-xl px-3 py-2 text-xs font-semibold text-white"
                style={{ background: `linear-gradient(135deg, ${accent}, var(--lavender))` }}
              >
                🏠 My Space
              </button>
              <button
                onClick={handleProfileSave}
                className="btn-smooth rounded-xl px-3 py-2 text-xs font-semibold"
                style={{ background: "var(--surface)", color: "var(--foreground-soft)", border: "1px solid var(--border)" }}
              >
                Save
              </button>
              <button
                onClick={onLogOut}
                className="btn-smooth rounded-xl px-3 py-2 text-xs font-semibold"
                style={{ background: "var(--surface)", color: "var(--muted-strong)", border: "1px solid var(--border)" }}
              >
                Log out
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Guest name */}
            <div className="space-y-2">
              <p className="px-0.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>Guest name</p>
              <div className="flex gap-2">
                <input
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleGuestSave()}
                  className="input-soft min-w-0 flex-1 px-3 py-2 text-sm outline-none"
                  placeholder="Your artist name"
                />
                <button
                  onClick={handleGuestSave}
                  className="btn-smooth shrink-0 rounded-xl px-3 py-2 text-xs font-semibold"
                  style={{ background: "var(--surface)", color: "var(--foreground-soft)", border: "1px solid var(--border)" }}
                >
                  Save
                </button>
              </div>
            </div>

            {/* Auth */}
            <div>
              <div className="mb-3 flex gap-1 rounded-2xl p-1" style={{ background: "var(--surface)" }}>
                {(["signup", "login"] as const).map((entry) => (
                  <button
                    key={entry}
                    onClick={() => { setMode(entry); setError(""); }}
                    className="btn-smooth flex-1 rounded-xl py-1.5 text-xs font-semibold transition-colors"
                    style={{
                      background: mode === entry ? "white" : "transparent",
                      color: mode === entry ? "var(--foreground)" : "var(--muted)",
                      boxShadow: mode === entry ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
                    }}
                  >
                    {entry === "signup" ? "Create account" : "Log in"}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                {mode === "signup" && (
                  <div>
                    <p className="mb-1 px-0.5 text-[10px] font-semibold" style={{ color: "var(--muted)" }}>Display name — shown publicly on your profile</p>
                    <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Mochi Fox" className="input-soft w-full px-3 py-2 text-sm outline-none" />
                  </div>
                )}
                <div>
                  <p className="mb-1 px-0.5 text-[10px] font-semibold" style={{ color: "var(--muted)" }}>Username — used to log in, lowercase only</p>
                  <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. mochifox" className="input-soft w-full px-3 py-2 text-sm outline-none" autoComplete="username" />
                </div>
                <div>
                  <p className="mb-1 px-0.5 text-[10px] font-semibold" style={{ color: "var(--muted)" }}>Password — keep it secret!</p>
                  <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••••" className="input-soft w-full px-3 py-2 text-sm outline-none" autoComplete={mode === "signup" ? "new-password" : "current-password"} onKeyDown={(e) => e.key === "Enter" && handleAuth()} />
                </div>
              </div>

              {error && (
                <p className="mt-2 rounded-xl px-3 py-2 text-xs font-medium" style={{ background: "rgba(255,107,157,0.10)", color: "var(--pink)" }}>{error}</p>
              )}

              <button
                onClick={handleAuth}
                className="btn-smooth mt-3 w-full rounded-xl px-3 py-2.5 text-sm font-semibold text-white"
                style={{ background: "linear-gradient(135deg, var(--pink), var(--lavender))" }}
              >
                {mode === "signup" ? "✦ Create account" : "Log in"}
              </button>

              <p className="mt-2.5 text-center text-[10px]" style={{ color: "var(--muted)" }}>
                {mode === "signup" ? "Already have an account? " : "New here? "}
                <button className="font-semibold underline-offset-2 hover:underline" style={{ color: "var(--pink)" }} onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setError(""); }}>
                  {mode === "signup" ? "Log in" : "Sign up"}
                </button>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
