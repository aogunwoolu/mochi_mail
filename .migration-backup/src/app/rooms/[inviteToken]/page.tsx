"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAccount } from "@/hooks/useAccount";
import { useRooms } from "@/hooks/useRooms";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { RoomInvitePreview } from "@/types";

function errMsg(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err && typeof (err as Record<string, unknown>).message === "string") {
    return (err as { message: string }).message;
  }
  return fallback;
}

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

    if (account.hasSession) {
      let cancelled = false;
      const load = async () => {
        setLoading(true);
        setError(null);

        try {
          const result = await rooms.getInvitePreview(token);
          if (!cancelled) {
            if (result) {
              setPreview(result);
              setLoading(false);
              return;
            }
          }

          // Fall back: treat as a room ID (stable share link)
          const supabase = createSupabaseBrowserClient();
          const { data: roomData } = await supabase
            .from("rooms")
            .select("id,title")
            .eq("id", token)
            .maybeSingle();

          if (!cancelled) {
            if (roomData) {
              router.replace(`/?room=${encodeURIComponent(roomData.id)}`);
            } else {
              setError("Room not found, or you need an invite link to access it. Ask the room owner for their invite link.");
              setLoading(false);
            }
          }
        } catch (err) {
          if (!cancelled) {
            setError(errMsg(err, "Unable to load room."));
            setLoading(false);
          }
        }
      };

      void load();
      return () => {
        cancelled = true;
      };
    } else {
      router.replace(`/rooms?invite=${encodeURIComponent(token)}`);
    }
  }, [account.hydrated, account.hasSession, rooms, router, token]);

  if (!account.hydrated || loading) {
    return <div className="flex h-svh items-center justify-center">Loading...</div>;
  }

  if (!account.hasSession) return null;

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-lg items-center justify-center p-4">
      <div className="panel w-full rounded-3xl p-6">
        <h1 className="text-lg font-semibold">Room invite</h1>

        {error ? (
          <div className="mt-3 rounded-xl px-3 py-2.5 text-sm" style={{ background: "rgba(254,226,226,0.8)", color: "#b42318", border: "1px solid rgba(248,113,113,0.3)" }}>
            {error}
          </div>
        ) : null}

        {preview ? (
          <>
            <p className="mt-3 text-base font-semibold">{preview.title}</p>
            {preview.description ? (
              <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>{preview.description}</p>
            ) : null}
            <p className="mt-2 text-xs" style={{ color: "var(--muted-strong)" }}>
              Hosted by {preview.ownerName}
              {preview.ownerUsername ? ` @${preview.ownerUsername}` : ""}
            </p>

            {preview.hasPassword ? (
              <div className="mt-4">
                <p className="mb-1 text-xs font-semibold" style={{ color: "var(--muted-strong)" }}>Room password</p>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  className="input-soft w-full px-3 py-2 text-sm outline-none"
                  placeholder="Enter the room password"
                />
              </div>
            ) : null}

            <div className="mt-4 flex gap-2">
              <button
                onClick={async () => {
                  setError(null);
                  try {
                    const joined = await rooms.joinByInviteToken(token, password);
                    router.push(`/?room=${encodeURIComponent(joined.room_id)}`);
                  } catch (err) {
                    setError(errMsg(err, "Could not join room."));
                  }
                }}
                className="btn-smooth rounded-xl px-4 py-2 text-xs font-semibold text-white"
                style={{ background: "linear-gradient(135deg, var(--pink), var(--lavender))" }}
              >
                Join room
              </button>
              <button
                onClick={() => router.push("/rooms")}
                className="btn-smooth rounded-xl px-4 py-2 text-xs font-semibold"
                style={{ background: "var(--surface-active)", color: "var(--muted-strong)" }}
              >
                Back
              </button>
            </div>
          </>
        ) : null}

        {!preview && !error ? null : !preview ? (
          <div className="mt-4">
            <button
              onClick={() => router.push("/rooms")}
              className="btn-smooth rounded-xl px-4 py-2 text-xs font-semibold"
              style={{ background: "var(--surface-active)", color: "var(--muted-strong)" }}
            >
              Back to rooms
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
