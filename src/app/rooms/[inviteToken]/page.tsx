"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAccount } from "@/hooks/useAccount";
import { useRooms } from "@/hooks/useRooms";
import { RoomInvitePreview } from "@/types";

export default function RoomInvitePage() {
  const router = useRouter();
  const params = useParams<{ inviteToken: string }>();
  const token = params.inviteToken;
  const account = useAccount();
  const rooms = useRooms(account.currentAccount ? {
    id: account.currentAccount.id,
    displayName: account.currentAccount.displayName,
    username: account.currentAccount.username,
  } : null);

  const [preview, setPreview] = useState<RoomInvitePreview | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!account.hydrated) return;
    if (!account.hasSession) {
      router.replace(`/rooms?invite=${encodeURIComponent(token)}`);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await rooms.getInvitePreview(token);
        if (!cancelled) {
          if (!result) {
            setError("Invite link is invalid or expired.");
          } else {
            setPreview(result);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load invite preview.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [account.hydrated, account.hasSession, rooms, router, token]);

  if (!account.hydrated || loading) {
    return <div className="flex h-svh items-center justify-center">Loading invite...</div>;
  }

  if (!account.hasSession) return null;

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-lg items-center justify-center p-4">
      <div className="panel w-full rounded-3xl p-5">
        <h1 className="text-lg font-semibold">Room Invite</h1>
        {error ? <p className="mt-2 text-sm" style={{ color: "#b42318" }}>{error}</p> : null}

        {preview ? (
          <>
            <p className="mt-2 text-sm font-semibold">{preview.title}</p>
            <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>{preview.description || "No description"}</p>
            <p className="mt-2 text-xs" style={{ color: "var(--muted-strong)" }}>
              hosted by {preview.ownerName} @{preview.ownerUsername}
            </p>
            {preview.hasPassword ? (
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                className="input-soft mt-3 px-3 py-2 text-sm outline-none"
                placeholder="Enter room password"
              />
            ) : null}
            <div className="mt-3 flex gap-2">
              <button
                onClick={async () => {
                  setError(null);
                  try {
                    const joined = await rooms.joinByInviteToken(token, password);
                    router.push(`/?room=${encodeURIComponent(joined.room_id)}`);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Could not join room.");
                  }
                }}
                className="btn-smooth rounded-xl px-3 py-2 text-xs font-semibold text-white"
                style={{ background: "linear-gradient(135deg, var(--pink), var(--lavender))" }}
              >
                Join room
              </button>
              <button
                onClick={() => router.push("/rooms")}
                className="btn-smooth rounded-xl px-3 py-2 text-xs font-semibold"
                style={{ background: "var(--surface-active)", color: "var(--muted-strong)" }}
              >
                Back
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
