
import { useState } from "react";
import { FiCopy, FiCheck, FiLock, FiGlobe } from "react-icons/fi";
import type { RoomPhase } from "@/hooks/useRoom";

interface RoomControlProps {
  phase: RoomPhase;
  isPublic: boolean;
  isOwner: boolean;
  shareUrl: string;
  error: string | null;
  onTogglePublic: (pub: boolean) => Promise<void>;
}

export default function RoomControl({
  phase,
  isPublic,
  isOwner,
  shareUrl,
  error,
  onTogglePublic,
}: RoomControlProps) {
  const [copied, setCopied] = useState(false);
  const [toggling, setToggling] = useState(false);

  async function handleCopy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        // Fallback for non-HTTPS or browsers that block clipboard API
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
      // Silent fail — URL is in the address bar anyway
    }
  }

  async function handleToggle() {
    if (!isOwner || toggling) return;
    setToggling(true);
    await onTogglePublic(!isPublic);
    setToggling(false);
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
        <span
          className="h-2 w-2 animate-pulse rounded-full"
          style={{ background: "var(--pink)" }}
        />
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

  return (
    <div
      className="flex items-center gap-1.5 rounded-full px-2 py-1.5"
      style={chipStyle}
    >
      {/* Privacy badge — owner can click to toggle */}
      {isOwner ? (
        <button
          onClick={handleToggle}
          disabled={toggling}
          title={isPublic ? "Click to make private" : "Click to make public"}
          className="btn-smooth flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors"
          style={{
            background: isPublic
              ? "rgba(110,231,183,0.2)"
              : "rgba(167,139,250,0.15)",
            color: isPublic ? "#065f46" : "#5b21b6",
            opacity: toggling ? 0.6 : 1,
          }}
        >
          {isPublic ? (
            <FiGlobe size={11} />
          ) : (
            <FiLock size={11} />
          )}
          {isPublic ? "Public" : "Private"}
        </button>
      ) : (
        <span
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
          style={{
            background: isPublic
              ? "rgba(110,231,183,0.2)"
              : "rgba(167,139,250,0.15)",
            color: isPublic ? "#065f46" : "#5b21b6",
          }}
        >
          {isPublic ? <FiGlobe size={11} /> : <FiLock size={11} />}
          {isPublic ? "Public" : "Private"}
        </span>
      )}

      {/* Divider */}
      <span
        className="h-4 w-px shrink-0"
        style={{ background: "var(--border)" }}
      />

      {/* Share / copy URL button */}
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
    </div>
  );
}
