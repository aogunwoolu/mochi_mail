
import { useEffect, useRef, useState } from "react";
import { FiCopy, FiCheck, FiLock, FiGlobe, FiSettings, FiX } from "react-icons/fi";
import type { RoomPhase } from "@/hooks/useRoom";

interface RoomControlProps {
  phase: RoomPhase;
  isPublic: boolean;
  hasPassword: boolean;
  isOwner: boolean;
  shareUrl: string;
  error: string | null;
  onTogglePublic: (pub: boolean) => Promise<void>;
  onSetPassword: (password: string | null) => Promise<void>;
}

export default function RoomControl({
  phase,
  isPublic,
  hasPassword,
  isOwner,
  shareUrl,
  error,
  onTogglePublic,
  onSetPassword,
}: RoomControlProps) {
  const [copied, setCopied] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    if (!settingsOpen) return;
    function onDown(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [settingsOpen]);

  async function handleCopy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const el = document.createElement("textarea");
        el.value = shareUrl;
        el.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // silent — URL is in the address bar anyway
    }
  }

  async function handleTogglePublic() {
    if (toggling) return;
    setToggling(true);
    await onTogglePublic(!isPublic);
    setToggling(false);
  }

  async function handleSavePassword() {
    setSavingPw(true);
    await onSetPassword(passwordInput.trim() || null);
    setSavingPw(false);
    setPasswordInput("");
  }

  async function handleClearPassword() {
    setSavingPw(true);
    await onSetPassword(null);
    setSavingPw(false);
  }

  // Loading states
  if (phase === "creating" || phase === "joining") {
    return (
      <div
        className="absolute z-50 flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium"
        style={{
          left: "calc(4.5rem + env(safe-area-inset-left, 0px))",
          top: "calc(0.75rem + env(safe-area-inset-top, 0px))",
          background: "rgba(255,255,255,0.96)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(186,156,214,0.25)",
          boxShadow: "0 4px 16px rgba(143,109,178,0.12), 0 1px 4px rgba(0,0,0,0.07)",
          color: "var(--muted)",
        }}
      >
        <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: "var(--pink)" }} />
        {phase === "creating" ? "Creating your canvas…" : "Joining room…"}
      </div>
    );
  }

  const chipStyle: React.CSSProperties = {
    position: "absolute",
    left: "calc(4.5rem + env(safe-area-inset-left, 0px))",
    top: "calc(0.75rem + env(safe-area-inset-top, 0px))",
    zIndex: 50,
    background: "rgba(255,255,255,0.96)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    border: "1px solid rgba(186,156,214,0.25)",
    boxShadow: "0 4px 16px rgba(143,109,178,0.12), 0 1px 4px rgba(0,0,0,0.07)",
  };

  if (phase === "error") {
    return (
      <div
        className="flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium"
        style={{ ...chipStyle, border: "1px solid rgba(252,165,165,0.6)", color: "#b91c1c" }}
      >
        {error ?? "Something went wrong"}
      </div>
    );
  }

  if (phase === "drawing" && error) {
    return (
      <div
        className="flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium"
        style={{
          ...chipStyle,
          border: "1px solid rgba(251,191,36,0.5)",
          color: "#92400e",
          background: "rgba(255,251,235,0.97)",
        }}
      >
        <span>⚠ {error}</span>
      </div>
    );
  }

  return (
    <div ref={popoverRef} style={{ position: "absolute", left: "calc(4.5rem + env(safe-area-inset-left, 0px))", top: "calc(0.75rem + env(safe-area-inset-top, 0px))", zIndex: 50 }}>
      {/* Chip */}
      <div
        className="flex items-center gap-1.5 rounded-full px-2 py-1.5"
        style={{
          background: "rgba(255,255,255,0.96)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(186,156,214,0.25)",
          boxShadow: "0 4px 16px rgba(143,109,178,0.12), 0 1px 4px rgba(0,0,0,0.07)",
        }}
      >
        {/* Privacy badge — non-owners see read-only */}
        {!isOwner && (
          <span
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{
              background: isPublic ? "rgba(110,231,183,0.2)" : "rgba(167,139,250,0.15)",
              color: isPublic ? "#065f46" : "#5b21b6",
            }}
          >
            {isPublic ? <FiGlobe size={11} /> : <FiLock size={11} />}
            {isPublic ? "Public" : "Private"}
            {hasPassword && <FiLock size={9} style={{ opacity: 0.6 }} />}
          </span>
        )}

        {/* Divider (non-owners only) */}
        {!isOwner && <span className="h-4 w-px shrink-0" style={{ background: "var(--border)" }} />}

        {/* Copy link button */}
        <button
          onClick={handleCopy}
          title="Copy invite link"
          className="btn-smooth flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors"
          style={{
            background: copied ? "rgba(52,211,153,0.15)" : "transparent",
            color: copied ? "#065f46" : "var(--muted-strong)",
          }}
        >
          {copied ? <FiCheck size={11} /> : <FiCopy size={11} />}
          {copied ? "Copied!" : "Copy link"}
        </button>

        {/* Settings button — owner only */}
        {isOwner && (
          <>
            <span className="h-4 w-px shrink-0" style={{ background: "var(--border)" }} />
            <button
              onClick={() => setSettingsOpen((v) => !v)}
              title="Room settings"
              className="btn-smooth flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors"
              style={{
                background: settingsOpen ? "rgba(167,139,250,0.15)" : "transparent",
                color: settingsOpen ? "#5b21b6" : "var(--muted-strong)",
              }}
            >
              {settingsOpen ? <FiX size={11} /> : <FiSettings size={11} />}
              Settings
            </button>
          </>
        )}
      </div>

      {/* Settings popover — drops below the chip */}
      {settingsOpen && isOwner && (
        <div
          className="absolute left-0 mt-2 w-64 rounded-2xl p-4 flex flex-col gap-3"
          style={{
            background: "rgba(255,255,255,0.98)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(186,156,214,0.3)",
            boxShadow: "0 8px 32px rgba(143,109,178,0.18), 0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          {/* Visibility toggle */}
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Visibility</p>
            <button
              onClick={handleTogglePublic}
              disabled={toggling}
              className="btn-smooth flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold"
              style={{
                background: isPublic ? "rgba(110,231,183,0.15)" : "rgba(167,139,250,0.12)",
                color: isPublic ? "#065f46" : "#5b21b6",
                opacity: toggling ? 0.6 : 1,
              }}
            >
              {isPublic ? <FiGlobe size={13} /> : <FiLock size={13} />}
              <span className="flex-1 text-left">{isPublic ? "Public — anyone can find it" : "Private — invite only"}</span>
            </button>
          </div>

          {/* Password */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Password</p>
              {hasPassword && (
                <button
                  onClick={handleClearPassword}
                  disabled={savingPw}
                  className="text-[11px] font-semibold"
                  style={{ color: "#b91c1c" }}
                >
                  Remove
                </button>
              )}
            </div>
            <p className="mb-2 text-[11px]" style={{ color: "var(--muted)" }}>
              {hasPassword ? "Password is set. New members must enter it to join." : "No password — anyone with the link can join."}
            </p>
            <div className="flex gap-1.5">
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void handleSavePassword(); }}
                placeholder={hasPassword ? "Set new password…" : "Add a password…"}
                className="input-soft min-w-0 flex-1 px-2.5 py-1.5 text-xs outline-none"
              />
              <button
                onClick={handleSavePassword}
                disabled={savingPw || !passwordInput.trim()}
                className="btn-smooth rounded-xl px-2.5 py-1.5 text-xs font-semibold text-white"
                style={{
                  background: "linear-gradient(135deg, var(--pink), var(--lavender))",
                  opacity: savingPw || !passwordInput.trim() ? 0.5 : 1,
                }}
              >
                {savingPw ? "…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
