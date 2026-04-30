"use client";

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
        className="absolute left-4 top-3 z-50 flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium"
        style={{
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(10px)",
          border: "1px solid var(--border)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
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

  if (phase === "error") {
    return (
      <div
        className="absolute left-4 top-3 z-50 flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium"
        style={{
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(10px)",
          border: "1px solid #fca5a5",
          color: "#b91c1c",
        }}
      >
        {error ?? "Something went wrong"}
      </div>
    );
  }

  return (
    <div
      className="absolute left-4 top-3 z-50 flex items-center gap-1.5 rounded-full px-2 py-1.5"
      style={{
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(10px)",
        border: "1px solid var(--border)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
      }}
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
