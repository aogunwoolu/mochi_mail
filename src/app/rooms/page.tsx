
"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FiArrowLeft, FiCopy, FiCheck, FiExternalLink, FiLock, FiGlobe, FiPlus, FiRefreshCw } from "react-icons/fi";
import { useAccount } from "@/hooks/useAccount";
import { useRooms } from "@/hooks/useRooms";
import { ROOM_TOKEN_KEY } from "@/hooks/useRoom";
import { RoomSummary } from "@/types";

function errMsg(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err && typeof (err as Record<string, unknown>).message === "string") {
    return (err as { message: string }).message;
  }
  return fallback;
}

export default function RoomsPage() {
  return (
    <Suspense fallback={<div className="flex h-svh items-center justify-center">Loading rooms...</div>}>
      <RoomsPageInner />
    </Suspense>
  );
}

function CopyButton({ text, label = "Copy link" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
          } else {
            const el = document.createElement("textarea");
            el.value = text;
            el.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0";
            document.body.appendChild(el);
            el.select();
            document.execCommand("copy");
            document.body.removeChild(el);
          }
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch { /* silent fail */ }
      }}
      className="btn-smooth flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
      style={{
        background: copied ? "rgba(52,211,153,0.15)" : "var(--surface-active)",
        color: copied ? "#065f46" : "var(--muted-strong)",
      }}
    >
      {copied ? <FiCheck size={12} /> : <FiCopy size={12} />}
      {copied ? "Copied!" : label}
    </button>
  );
}

function RoomRow({
  room,
  onOpen,
  onCopyLink,
  onRotate,
  onToggleVisibility,
}: {
  room: RoomSummary;
  onOpen: () => void;
  onCopyLink: () => void;
  onRotate: () => void;
  onToggleVisibility: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="flex min-w-0 items-center gap-2">
        <span style={{ color: room.visibility === "public" ? "var(--lavender)" : "var(--muted)" }}>
          {room.visibility === "public" ? <FiGlobe size={13} /> : <FiLock size={13} />}
        </span>
        <span className="truncate text-sm font-semibold">{room.title}</span>
        {room.hasPassword ? (
          <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(244,114,182,0.12)", color: "#be185d" }}>pw</span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {room.isOwner ? (
          <>
            <button onClick={onCopyLink} title="Copy room link" className="btn-smooth rounded-lg p-1.5" style={{ color: "var(--muted-strong)" }}><FiCopy size={13} /></button>
            <button onClick={onRotate} title="Rotate invite token" className="btn-smooth rounded-lg p-1.5" style={{ color: "var(--muted-strong)" }}><FiRefreshCw size={13} /></button>
            <button onClick={onToggleVisibility} title={room.visibility === "public" ? "Make private" : "Make public"} className="btn-smooth rounded-lg p-1.5" style={{ color: "var(--muted-strong)" }}>
              {room.visibility === "public" ? <FiLock size={13} /> : <FiGlobe size={13} />}
            </button>
          </>
        ) : null}
        <button onClick={onOpen} className="btn-smooth rounded-lg px-2.5 py-1 text-xs font-semibold text-white" style={{ background: "linear-gradient(135deg, var(--pink), var(--lavender))" }}>
          Open
        </button>
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 text-xs font-semibold" style={{ color: "var(--muted-strong)" }}>{children}</p>
  );
}

function RoomsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteFromUrl = searchParams?.get("invite")?.trim() ?? "";
  const account = useAccount();
  // Use currentAccount for full users, fall back to viewer identity for anonymous users
  const roomIdentity = account.currentAccount ? {
    id: account.currentAccount.id,
    displayName: account.currentAccount.displayName,
    username: account.currentAccount.username,
  } : (account.hasSession && account.viewer.id ? {
    id: account.viewer.id,
    displayName: account.viewer.name,
    username: account.viewer.username || "",
  } : null);

  const rooms = useRooms(roomIdentity);

  const [joinToken, setJoinToken] = useState(inviteFromUrl);
  const [joinPassword, setJoinPassword] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createPublic, setCreatePublic] = useState(false);
  const [createPassword, setCreatePassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  // Allow anonymous users with a session to use rooms
  const canUseRooms = account.hydrated && account.hasSession && roomIdentity;

  const primaryRoom = rooms.myRooms.find((r) => r.isOwner) ?? rooms.myRooms[0] ?? null;
  const otherRooms = rooms.publicRooms.filter((r) => r.id !== primaryRoom?.id);

  // Build the canvas URL for the "Back" button.
  // Prefer the primary room's token so the owner lands in the same room they see
  // on this page (and the room others will join via the invite link shown here).
  // Falls back to localStorage, then bare "/" so useRoom auto-creates a room.
  const canvasUrl = (): string => {
    if (primaryRoom?.inviteToken) return `/?room=${encodeURIComponent(primaryRoom.inviteToken)}`;
    try {
      const token = globalThis.localStorage?.getItem(ROOM_TOKEN_KEY) ?? "";
      return token ? `/?room=${encodeURIComponent(token)}` : "/";
    } catch { return "/"; }
  };

  const flash = (msg: string, isError = false) => {
    if (isError) { setError(msg); setStatus(null); }
    else { setStatus(msg); setError(null); }
    setTimeout(() => { setError(null); setStatus(null); }, 4000);
  };

  if (!account.hydrated) {
    return <div className="flex h-svh items-center justify-center">Loading...</div>;
  }

  if (!canUseRooms) {
    return (
      <div className="flex h-svh items-center justify-center p-4">
        <div className="panel max-w-sm rounded-3xl p-6 text-center">
          <p className="text-sm font-semibold">Authentication required</p>
          <p className="mt-1.5 text-xs" style={{ color: "var(--muted)" }}>Rooms require an active session. Please sign in or enable anonymous auth.</p>
          <button onClick={() => router.push(canvasUrl())} className="btn-smooth mt-4 rounded-xl px-4 py-2 text-xs font-semibold text-white" style={{ background: "linear-gradient(135deg, var(--pink), var(--lavender))" }}>
            Back to studio
          </button>
        </div>
      </div>
    );
  }

  // Stable room link uses room ID — the invite token can be rotated separately
  const getInviteLink = (room: RoomSummary) => `${globalThis.location.origin}/rooms/${room.inviteToken}`;

  const handleJoin = async () => {
    const raw = joinToken.trim();
    if (!raw) { flash("Enter a room code or paste an invite link.", true); return; }
    setError(null);
    try {
      // 6-char alphanumeric code (with optional dash) → join by code
      const codeOnly = raw.replace(/-/g, "").toUpperCase();
      if (/^[A-Z0-9]{6}$/.test(codeOnly)) {
        const joined = await rooms.joinByCode(codeOnly, joinPassword);
        router.push(`/?room=${encodeURIComponent(joined.invite_token || joined.room_id)}`);
        return;
      }
      // Otherwise treat as invite link or raw token
      const token = raw.includes("/") ? raw.split("/").pop() ?? "" : raw;
      const joined = await rooms.joinByInviteToken(token, joinPassword);
      router.push(`/?room=${encodeURIComponent(joined.invite_token || joined.room_id)}`);
    } catch (err) {
      flash(errMsg(err, "Unable to join room."), true);
    }
  };

  const handleCreate = async () => {
    setError(null);
    try {
      await rooms.createRoom({
        title: createTitle.trim() || "My Room",
        description: createDescription.trim(),
        isPublic: createPublic,
        password: createPassword,
      });
      setCreateTitle(""); setCreateDescription(""); setCreatePassword(""); setCreatePublic(false);
      setShowCreate(false);
      flash("Room created.");
    } catch (err) {
      flash(errMsg(err, "Failed to create room."), true);
    }
  };

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-5 p-4 pb-10">
      {/* Header */}
      <header className="flex items-center justify-between">
        <button onClick={() => router.push(canvasUrl())} className="btn-smooth flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold" style={{ background: "var(--surface)", color: "var(--muted-strong)" }}>
          <FiArrowLeft size={15} /> Back
        </button>
        <div className="text-right">
          <h1 className="text-base font-bold">Rooms</h1>
          <p className="text-[11px]" style={{ color: "var(--muted)" }}>Private by default · share with a link</p>
        </div>
      </header>

      {/* Toast */}
      {error ? (
        <div className="rounded-xl px-3 py-2 text-xs font-medium" style={{ background: "rgba(254,226,226,0.8)", color: "#b42318", border: "1px solid rgba(248,113,113,0.3)" }}>{error}</div>
      ) : null}
      {status ? (
        <div className="rounded-xl px-3 py-2 text-xs font-medium" style={{ background: "rgba(209,250,229,0.8)", color: "#065f46", border: "1px solid rgba(52,211,153,0.3)" }}>{status}</div>
      ) : null}

      {/* Primary room */}
      {primaryRoom ? (
        <section className="rounded-2xl border p-5 flex flex-col gap-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <h2 className="text-base font-bold">{primaryRoom.title}</h2>
                <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "var(--surface-active)", color: "var(--muted-strong)" }}>
                  {primaryRoom.visibility === "public" ? <FiGlobe size={10} /> : <FiLock size={10} />}
                  {primaryRoom.visibility}
                </span>
                {primaryRoom.hasPassword && (
                  <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(244,114,182,0.12)", color: "#be185d" }}>
                    <FiLock size={9} /> password
                  </span>
                )}
              </div>
              {primaryRoom.description ? (
                <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>{primaryRoom.description}</p>
              ) : null}
            </div>
            <button
              onClick={() => router.push(`/?room=${encodeURIComponent(primaryRoom.inviteToken)}`)}
              className="btn-smooth shrink-0 flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-white"
              style={{ background: "linear-gradient(135deg, var(--pink), var(--lavender))" }}
            >
              <FiExternalLink size={13} /> Open
            </button>
          </div>

          {/* Invite link — the one link to share */}
          <div>
            <FieldLabel>Invite link</FieldLabel>
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: "var(--surface-active)" }}>
              <span className="flex-1 truncate font-mono text-xs" style={{ color: "var(--muted-strong)" }}>{getInviteLink(primaryRoom)}</span>
              <CopyButton text={getInviteLink(primaryRoom)} />
            </div>
            <p className="mt-1.5 text-[11px]" style={{ color: "var(--muted)" }}>Share this link so others can join. Rotate it to revoke access.</p>
          </div>

          {/* Owner actions */}
          {primaryRoom.isOwner ? (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={async () => {
                  try {
                    await rooms.rotateRoomInviteToken(primaryRoom.id);
                    flash("Invite link rotated — old link no longer works.");
                  } catch (err) {
                    flash(errMsg(err, "Failed to rotate invite link."), true);
                  }
                }}
                className="btn-smooth flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                style={{ background: "var(--surface-active)", color: "var(--muted-strong)" }}
              >
                <FiRefreshCw size={12} /> Rotate link
              </button>
              <button
                onClick={async () => {
                  const next = primaryRoom.visibility === "public" ? "private" : "public";
                  try {
                    await rooms.updateRoomSecurity(primaryRoom.id, next === "public", null);
                    flash(`Room is now ${next}.`);
                  } catch (err) {
                    flash(errMsg(err, "Failed to update visibility."), true);
                  }
                }}
                className="btn-smooth flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                style={{ background: "var(--surface-active)", color: "var(--muted-strong)" }}
              >
                {primaryRoom.visibility === "public" ? <FiLock size={12} /> : <FiGlobe size={12} />}
                {primaryRoom.visibility === "public" ? "Make private" : "Make public"}
              </button>
            </div>
          ) : null}
        </section>
      ) : rooms.loading ? (
        <div className="rounded-2xl border p-5 text-center text-xs" style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted)" }}>
          Loading your rooms…
        </div>
      ) : (
        /* No room yet — the canvas creates one automatically on first visit. */
        <section className="rounded-2xl border p-5 text-center flex flex-col items-center gap-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <p className="text-sm font-semibold">No room yet</p>
          <p className="text-xs max-w-xs" style={{ color: "var(--muted)" }}>
            Your room is created the first time you open the canvas. Head there to get started — it will appear here automatically.
          </p>
          <button
            onClick={() => router.push("/")}
            className="btn-smooth rounded-xl px-4 py-2 text-xs font-semibold text-white"
            style={{ background: "linear-gradient(135deg, var(--pink), var(--lavender))" }}
          >
            Open canvas
          </button>
        </section>
      )}

      {/* Join a room */}
      <section className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <h2 className="mb-3 text-sm font-semibold">Join a room</h2>
        <div className="flex flex-col gap-3">
          <div>
            <FieldLabel>Invite link</FieldLabel>
            <input
              value={joinToken}
              onChange={(e) => setJoinToken(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleJoin(); }}
              className="input-soft w-full px-3 py-2 text-sm outline-none"
              placeholder="Paste invite link here…"
              maxLength={200}
            />
          </div>
          <div>
            <FieldLabel>Password <span className="font-normal" style={{ color: "var(--muted)" }}>— only if the room requires one</span></FieldLabel>
            <input
              value={joinPassword}
              onChange={(e) => setJoinPassword(e.target.value)}
              type="password"
              className="input-soft w-full px-3 py-2 text-sm outline-none"
              placeholder="Leave blank if no password"
            />
          </div>
          <button
            onClick={handleJoin}
            className="btn-smooth self-start rounded-xl px-3 py-2 text-xs font-semibold text-white"
            style={{ background: "var(--foreground-soft)" }}
          >
            Join room
          </button>
        </div>
      </section>

      {/* Other rooms */}
      {otherRooms.length > 0 ? (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Public rooms</h2>
          <div className="flex flex-col gap-2">
            {otherRooms.map((room) => (
              <RoomRow
                key={room.id}
                room={room}
                onOpen={() => router.push(`/?room=${encodeURIComponent(room.inviteToken)}`)}
                onCopyLink={async () => {
                  const link = getInviteLink(room);
                  try {
                    if (navigator.clipboard?.writeText) {
                      await navigator.clipboard.writeText(link);
                    } else {
                      const el = document.createElement("textarea");
                      el.value = link;
                      el.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0";
                      document.body.appendChild(el);
                      el.select();
                      document.execCommand("copy");
                      document.body.removeChild(el);
                    }
                  } catch { /* silent fail */ }
                  flash(`Copied link for "${room.title}"`);
                }}
                onRotate={async () => {
                  try {
                    await rooms.rotateRoomInviteToken(room.id);
                    flash("Invite link rotated.");
                  } catch (err) {
                    flash(errMsg(err, "Failed to rotate."), true);
                  }
                }}
                onToggleVisibility={async () => {
                  const next = room.visibility === "public" ? "private" : "public";
                  try {
                    await rooms.updateRoomSecurity(room.id, next === "public", null);
                    flash(`"${room.title}" is now ${next}.`);
                  } catch (err) {
                    flash(errMsg(err, "Failed."), true);
                  }
                }}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* Create another room */}
      <section>
        {showCreate ? (
          <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">New room</h2>
              <button onClick={() => setShowCreate(false)} className="text-xs" style={{ color: "var(--muted)" }}>Cancel</button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <FieldLabel>Room name</FieldLabel>
                <input value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} className="input-soft w-full px-3 py-2 text-sm outline-none" placeholder="e.g. Weekend sketch club" />
              </div>
              <div>
                <FieldLabel>Description <span className="font-normal" style={{ color: "var(--muted)" }}>— optional</span></FieldLabel>
                <textarea value={createDescription} onChange={(e) => setCreateDescription(e.target.value)} rows={2} className="input-soft w-full px-3 py-2 text-sm outline-none" placeholder="What's this room for?" />
              </div>
              <div>
                <FieldLabel>Password <span className="font-normal" style={{ color: "var(--muted)" }}>— optional, locks the room</span></FieldLabel>
                <input value={createPassword} onChange={(e) => setCreatePassword(e.target.value)} type="password" className="input-soft w-full px-3 py-2 text-sm outline-none" placeholder="Leave blank for no password" />
              </div>
              <label className="flex items-center gap-2 text-xs" style={{ color: "var(--muted-strong)" }}>
                <input type="checkbox" checked={createPublic} onChange={(e) => setCreatePublic(e.target.checked)} />
                Make public — show in discovery so anyone can find it
              </label>
              <button onClick={handleCreate} className="btn-smooth self-start rounded-xl px-3 py-2 text-xs font-semibold text-white" style={{ background: "linear-gradient(135deg, var(--pink), var(--lavender))" }}>
                Create room
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="btn-smooth flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold"
            style={{ background: "var(--surface)", color: "var(--muted-strong)", border: "1px dashed var(--border)" }}
          >
            <FiPlus size={13} /> {rooms.myRooms.length > 0 ? "Create another room" : "Create a room"}
          </button>
        )}
      </section>

      {rooms.error ? <p className="text-xs" style={{ color: "#b42318" }}>{rooms.error}</p> : null}
    </div>
  );
}
