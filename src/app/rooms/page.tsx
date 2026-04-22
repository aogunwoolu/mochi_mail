"use client";

import { ReactNode, useEffect, useRef, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccount } from "@/hooks/useAccount";
import { useRooms } from "@/hooks/useRooms";

function RoomCard({
  title,
  description,
  ownerName,
  visibility,
  hasPassword,
  actions,
}: Readonly<{
  title: string;
  description: string;
  ownerName: string;
  visibility: "public" | "private";
  hasPassword: boolean;
  actions?: ReactNode;
}>) {
  return (
    <div className="rounded-2xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "var(--surface-active)", color: "var(--muted-strong)" }}>
          {visibility}
        </span>
      </div>
      <p className="mb-2 line-clamp-2 text-xs" style={{ color: "var(--muted)" }}>
        {description || "No description"}
      </p>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px]" style={{ color: "var(--muted-strong)" }}>
        <span>owner: {ownerName}</span>
        {hasPassword ? <span className="rounded-full px-2 py-0.5" style={{ background: "rgba(244,114,182,0.16)" }}>password</span> : null}
      </div>
      {actions}
    </div>
  );
}

export default function RoomsPage() {
  return (
    <Suspense fallback={<div className="flex h-svh items-center justify-center">Loading rooms...</div>}>
      <RoomsPageInner />
    </Suspense>
  );
}

function RoomsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteFromUrl = searchParams.get("invite")?.trim() ?? "";
  const account = useAccount();
  const rooms = useRooms(account.currentAccount ? {
    id: account.currentAccount.id,
    displayName: account.currentAccount.displayName,
    username: account.currentAccount.username,
  } : null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [password, setPassword] = useState("");
  const [inviteToken, setInviteToken] = useState(inviteFromUrl);
  const [invitePassword, setInvitePassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedRoomId, setCopiedRoomId] = useState<string | null>(null);

  const canUseRooms = account.hydrated && account.hasSession && account.currentAccount;

  // Auto-create a private room on first visit if the user has none
  const autoCreatedRef = useRef(false);
  useEffect(() => {
    if (!canUseRooms || rooms.loading || autoCreatedRef.current) return;
    if (rooms.myRooms.length === 0) {
      autoCreatedRef.current = true;
      rooms.createRoom({
        title: `${account.currentAccount?.displayName ?? "My"}'s Room`,
        description: "",
        isPublic: false,
      }).catch(() => { /* silent — will retry on next visit */ });
    }
  }, [canUseRooms, rooms.loading, rooms.myRooms.length, rooms, account.currentAccount?.displayName]);

  const visiblePublicRooms = useMemo(
    () => rooms.publicRooms.filter((room) => room.ownerId !== account.currentAccount?.id),
    [rooms.publicRooms, account.currentAccount?.id]
  );

  if (!account.hydrated) {
    return <div className="flex h-svh items-center justify-center">Loading rooms...</div>;
  }

  if (!canUseRooms) {
    return (
      <div className="flex h-svh items-center justify-center p-4">
        <div className="panel max-w-md rounded-3xl p-5 text-center">
          <p className="text-sm font-semibold">Sign in to use rooms</p>
          <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
            Rooms are account-based. Open your account panel from the studio, then come back.
          </p>
          <button onClick={() => router.push("/")} className="btn-smooth mt-4 rounded-xl px-3 py-2 text-xs font-semibold text-white" style={{ background: "linear-gradient(135deg, var(--pink), var(--lavender))" }}>
            Back to studio
          </button>
        </div>
      </div>
    );
  }

  const create = async () => {
    setError(null);
    setStatus(null);
    try {
      const created = await rooms.createRoom({
        title: title.trim() || "Untitled Room",
        description: description.trim(),
        isPublic,
        password,
      });
      const shareLink = `${globalThis.location.origin}/rooms/${created.invite_token}`;
      setStatus(`Room created. Share link: ${shareLink}`);
      setTitle("");
      setDescription("");
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create room.");
    }
  };

  const joinByToken = async () => {
    if (!inviteToken.trim()) {
      setError("Enter an invite token or link.");
      return;
    }

    setError(null);
    setStatus(null);

    try {
      const token = inviteToken.includes("/") ? inviteToken.split("/").pop() ?? "" : inviteToken;
      const joined = await rooms.joinByInviteToken(token.trim(), invitePassword);
      router.push(`/?room=${encodeURIComponent(joined.room_id)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to join room.");
    }
  };

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-7xl flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div>
          <h1 className="text-lg font-semibold">Rooms</h1>
          <p className="text-xs" style={{ color: "var(--muted)" }}>Create public/private collaboration rooms, share links, and join with optional passwords.</p>
        </div>
        <button onClick={() => router.push("/")} className="btn-smooth rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: "var(--surface-active)", color: "var(--muted-strong)" }}>
          Back to studio
        </button>
      </header>

      {error ? <p className="rounded-xl border px-3 py-2 text-xs" style={{ borderColor: "rgba(248,113,113,0.4)", color: "#b42318", background: "rgba(254,226,226,0.6)" }}>{error}</p> : null}
      {status ? <p className="rounded-xl border px-3 py-2 text-xs" style={{ borderColor: "rgba(52,211,153,0.35)", color: "#065f46", background: "rgba(209,250,229,0.62)" }}>{status}</p> : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={(event) => {
          event.preventDefault();
          void create();
        }} className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <h2 className="mb-3 text-sm font-semibold">Create Room</h2>
          <div className="grid gap-2">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input-soft px-3 py-2 text-sm outline-none" placeholder="Room title" />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="input-soft px-3 py-2 text-sm outline-none" placeholder="Describe what this room is for" />
            <label className="flex items-center gap-2 text-xs" style={{ color: "var(--muted-strong)" }}>
              <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
              <span>Public room (shown in discovery)</span>
            </label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="input-soft px-3 py-2 text-sm outline-none" placeholder="Optional room password" />
          </div>
          <button type="submit" className="btn-smooth mt-3 rounded-xl px-3 py-2 text-xs font-semibold text-white" style={{ background: "linear-gradient(135deg, var(--pink), var(--lavender))" }}>
            Create room
          </button>
        </form>

        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <h2 className="mb-3 text-sm font-semibold">Join By Invite Link</h2>
          <div className="grid gap-2">
            <input value={inviteToken} onChange={(e) => setInviteToken(e.target.value)} className="input-soft px-3 py-2 text-sm outline-none" placeholder="Paste invite link or token" />
            <input value={invitePassword} onChange={(e) => setInvitePassword(e.target.value)} type="password" className="input-soft px-3 py-2 text-sm outline-none" placeholder="Password (if required)" />
          </div>
          <button onClick={joinByToken} className="btn-smooth mt-3 rounded-xl px-3 py-2 text-xs font-semibold text-white" style={{ background: "var(--foreground-soft)" }}>
            Join room
          </button>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {/* Prominent invite link card for the user's first owned room */}
        {(() => {
          const firstOwned = rooms.myRooms.find((r) => r.isOwner);
          if (!firstOwned) return null;
          const link = `${globalThis.location.origin}/rooms/${firstOwned.inviteToken}`;
          const copied = copiedRoomId === firstOwned.id;
          return (
            <div className="lg:col-span-2 rounded-2xl border p-4 flex flex-col gap-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold">{firstOwned.title}</h2>
                  <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>Your room · {firstOwned.visibility}</p>
                </div>
                <button onClick={() => router.push(`/?room=${encodeURIComponent(firstOwned.id)}`)} className="btn-smooth rounded-xl px-3 py-2 text-xs font-semibold text-white" style={{ background: "linear-gradient(135deg, var(--pink), var(--lavender))" }}>
                  Open room
                </button>
              </div>
              <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "var(--surface-active)" }}>
                <span className="flex-1 truncate text-xs font-mono" style={{ color: "var(--muted-strong)" }}>{link}</span>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(link);
                    setCopiedRoomId(firstOwned.id);
                    setTimeout(() => setCopiedRoomId(null), 2000);
                  }}
                  className="btn-smooth shrink-0 rounded-lg px-2 py-1 text-[11px] font-semibold"
                  style={{ background: copied ? "rgba(52,211,153,0.2)" : "var(--border)", color: copied ? "#065f46" : "var(--muted-strong)" }}
                >
                  {copied ? "Copied!" : "Copy link"}
                </button>
              </div>
              <p className="text-[11px]" style={{ color: "var(--muted)" }}>Share this link to invite others. Only people with the link can join (it&apos;s private).</p>
            </div>
          );
        })()}

        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <h2 className="mb-3 text-sm font-semibold">My Rooms</h2>
          <div className="grid gap-2">
            {rooms.myRooms.map((room) => (
              <RoomCard
                key={room.id}
                title={room.title}
                description={room.description}
                ownerName={room.ownerName}
                visibility={room.visibility}
                hasPassword={room.hasPassword}
                actions={
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => router.push(`/?room=${encodeURIComponent(room.id)}`)} className="btn-smooth rounded-lg px-2 py-1 text-[11px] font-semibold" style={{ background: "var(--surface-active)", color: "var(--muted-strong)" }}>
                      Open
                    </button>
                    {room.isOwner ? (
                      <button
                        onClick={async () => {
                          const link = `${globalThis.location.origin}/rooms/${room.inviteToken}`;
                          await navigator.clipboard.writeText(link);
                          setStatus(`Copied invite link for ${room.title}`);
                        }}
                        className="btn-smooth rounded-lg px-2 py-1 text-[11px] font-semibold"
                        style={{ background: "var(--surface-active)", color: "var(--muted-strong)" }}
                      >
                        Copy link
                      </button>
                    ) : null}
                    {room.isOwner ? (
                      <button
                        onClick={async () => {
                          try {
                            await rooms.rotateRoomInviteToken(room.id);
                            setStatus(`Invite link rotated for ${room.title}`);
                          } catch (err) {
                            setError(err instanceof Error ? err.message : "Failed to rotate invite link.");
                          }
                        }}
                        className="btn-smooth rounded-lg px-2 py-1 text-[11px] font-semibold"
                        style={{ background: "var(--surface-active)", color: "var(--muted-strong)" }}
                      >
                        Rotate link
                      </button>
                    ) : null}
                    {room.isOwner ? (
                      <button
                        onClick={async () => {
                          const visibility = room.visibility === "public" ? "private" : "public";
                          try {
                            await rooms.updateRoomSecurity(room.id, visibility === "public", null);
                            setStatus(`${room.title} is now ${visibility}.`);
                          } catch (err) {
                            setError(err instanceof Error ? err.message : "Failed to update visibility.");
                          }
                        }}
                        className="btn-smooth rounded-lg px-2 py-1 text-[11px] font-semibold"
                        style={{ background: "var(--surface-active)", color: "var(--muted-strong)" }}
                      >
                        Toggle visibility
                      </button>
                    ) : null}
                    {room.isOwner ? (
                      <button
                        onClick={async () => {
                          const nextPassword = globalThis.prompt("Set room password. Leave empty to remove password.", "") ?? "";
                          try {
                            await rooms.updateRoomSecurity(room.id, room.visibility === "public", nextPassword);
                            setStatus(`Updated password for ${room.title}`);
                          } catch (err) {
                            setError(err instanceof Error ? err.message : "Failed to update room password.");
                          }
                        }}
                        className="btn-smooth rounded-lg px-2 py-1 text-[11px] font-semibold"
                        style={{ background: "var(--surface-active)", color: "var(--muted-strong)" }}
                      >
                        Set password
                      </button>
                    ) : null}
                  </div>
                }
              />
            ))}
            {rooms.myRooms.length === 0 ? <p className="text-xs" style={{ color: "var(--muted)" }}>No rooms yet.</p> : null}
          </div>
        </div>

        <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <h2 className="mb-3 text-sm font-semibold">Public Rooms</h2>
          <div className="grid gap-2">
            {visiblePublicRooms.map((room) => (
              <RoomCard
                key={room.id}
                title={room.title}
                description={room.description}
                ownerName={room.ownerName}
                visibility={room.visibility}
                hasPassword={room.hasPassword}
                actions={
                  <div className="flex gap-2">
                    <button onClick={() => router.push(`/?room=${encodeURIComponent(room.id)}`)} className="btn-smooth rounded-lg px-2 py-1 text-[11px] font-semibold" style={{ background: "var(--surface-active)", color: "var(--muted-strong)" }}>
                      Open
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          if (!room.isMember) {
                            await rooms.joinByInviteToken(room.inviteToken);
                          }
                          router.push(`/?room=${encodeURIComponent(room.id)}`);
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "Unable to join room.");
                        }
                      }}
                      className="btn-smooth rounded-lg px-2 py-1 text-[11px] font-semibold"
                      style={{ background: "var(--surface-active)", color: "var(--muted-strong)" }}
                    >
                      Join
                    </button>
                  </div>
                }
              />
            ))}
            {visiblePublicRooms.length === 0 ? <p className="text-xs" style={{ color: "var(--muted)" }}>No public rooms available yet.</p> : null}
          </div>
        </div>
      </section>

      {rooms.loading ? <p className="text-xs" style={{ color: "var(--muted)" }}>Refreshing rooms...</p> : null}
      {rooms.error ? <p className="text-xs" style={{ color: "#b42318" }}>{rooms.error}</p> : null}
    </div>
  );
}
