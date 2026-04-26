"use client";

import { useState } from "react";
import type { RoomPhase } from "@/hooks/useRoom";

export default function RoomModeBanner({
  phase,
  activeRoomId,
  activeRoomTitle,
  onJoinWithToken,
  onOpenRooms,
}: {
  phase: RoomPhase;
  activeRoomId: string | null;
  activeRoomTitle: string | null;
  onJoinWithToken: (token: string, password?: string) => Promise<string | null>;
  onOpenRooms: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  async function handleJoin() {
    if (!token.trim()) return;
    setJoining(true);
    setJoinError(null);
    const err = await onJoinWithToken(token.trim(), password.trim() || undefined);
    setJoining(false);
    if (err) setJoinError(err);
  }

  if (phase === "join-required") {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(255,248,255,0.88)", backdropFilter: "blur(12px)" }}>
        <div className="panel w-full max-w-sm rounded-2xl p-5 flex flex-col gap-4">
          <div>
            <p className="text-sm font-bold">Private room</p>
            <p className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
              Paste the invite link you received to join.
            </p>
          </div>
          <input
            value={token}
            onChange={(e) => { setToken(e.target.value); setJoinError(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") void handleJoin(); }}
            className="input-soft w-full px-3 py-2 text-sm outline-none"
            placeholder="https://… or paste token"
            autoFocus
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            className="input-soft w-full px-3 py-2 text-sm outline-none"
            placeholder="Password (if required)"
          />
          {joinError ? <p className="text-xs" style={{ color: "#b42318" }}>{joinError}</p> : null}
          <div className="flex items-center gap-2">
            <button
              onClick={handleJoin}
              disabled={joining || !token.trim()}
              className="btn-smooth flex-1 rounded-xl py-2 text-xs font-semibold text-white"
              style={{ background: "linear-gradient(135deg, var(--pink), var(--lavender))", opacity: joining ? 0.7 : 1 }}
            >
              {joining ? "Joining…" : "Join room"}
            </button>
            <button
              onClick={onOpenRooms}
              className="btn-smooth rounded-xl px-3 py-2 text-xs font-semibold"
              style={{ background: "var(--surface-active)", color: "var(--muted-strong)" }}
            >
              My rooms
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "joining") {
    return (
      <div className="absolute left-4 right-4 top-3 z-50 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs" style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)" }}>
        <span style={{ color: "var(--muted)" }}>Joining room…</span>
      </div>
    );
  }

  if (!activeRoomTitle) return null;

  const shareUrl = activeRoomId ? `${globalThis.location?.origin}/rooms/${activeRoomId}` : null;

  return (
    <div className="absolute left-4 right-4 top-3 z-50 flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs" style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)" }}>
      <span className="truncate font-semibold" style={{ color: "var(--muted-strong)" }}>
        {activeRoomTitle}
      </span>
      <div className="flex shrink-0 items-center gap-1.5">
        {shareUrl ? (
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(shareUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="btn-smooth rounded-lg px-2 py-1 font-semibold text-white"
            style={{ background: copied ? "rgba(52,211,153,0.85)" : "linear-gradient(135deg, var(--pink), var(--lavender))" }}
          >
            {copied ? "Copied!" : "Share link"}
          </button>
        ) : null}
        <button
          onClick={onOpenRooms}
          className="btn-smooth rounded-lg px-2 py-1 font-semibold"
          style={{ background: "var(--surface-active)", color: "var(--muted-strong)" }}
        >
          Rooms
        </button>
      </div>
    </div>
  );
}
