
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * creating → auto-creating a new private room (no ?room= in URL)
 * joining  → joining an existing room via invite token in the URL
 * drawing  → room is ready, canvas is live
 * error    → something went wrong (see `error` field)
 */
export type RoomPhase = "creating" | "joining" | "drawing" | "error";

export interface RoomMember {
  presenceKey: string;
  userId: string;
  name: string;
  color: string;
  avatarUrl?: string;
  username?: string;
  /** World-space X position (updated via cursor broadcast). */
  x: number;
  /** World-space Y position (updated via cursor broadcast). */
  y: number;
  /** Active layer the user is drawing on */
  activeLayer?: number;
  /** Current tool the user is using */
  tool?: "pen" | "eraser" | "select" | "text" | "washi" | "asset" | "animated";
}

type PresencePayload = {
  userId: string;
  name: string;
  color: string;
  avatarUrl?: string;
  username?: string;
  x: number;
  y: number;
};

type CursorBroadcast = {
  id: string;
  x: number;
  y: number;
  name: string;
  color: string;
  avatarUrl?: string;
  username?: string;
  activeLayer?: number;
  tool?: "pen" | "eraser" | "select" | "text" | "washi" | "asset" | "animated";
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

// localStorage key used to remember the last room token across navigations.
// Exported so the rooms page can read it when building the Back → canvas URL.
// To let the user intentionally switch rooms: write a new token here then reload.
export const ROOM_TOKEN_KEY = "mochi:room-token";

function readSavedToken(): string {
  try { return globalThis.localStorage?.getItem(ROOM_TOKEN_KEY) ?? ""; } catch { return ""; }
}

function saveToken(token: string): void {
  try { globalThis.localStorage?.setItem(ROOM_TOKEN_KEY, token); } catch { /* ignore */ }
}

function clearSavedToken(): void {
  try { globalThis.localStorage?.removeItem(ROOM_TOKEN_KEY); } catch { /* ignore */ }
}

type PersistedRoom = { id: string; title: string; invite_token: string; is_public: boolean };

/**
 * Returns the user's most recent owned room, or creates one if none exist.
 * ownerName is used as the title prefix when creating: "Abi's Room".
 * Pass the display name from the account hook so canvas and rooms page
 * always create rooms with the same naming convention.
 */
async function findOrCreateRoom(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  ownerName?: string,
): Promise<PersistedRoom | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    // Always try to find an existing owned room first — never create duplicates.
    const { data: existing } = await supabase
      .from("rooms")
      .select("id, title, invite_token, is_public")
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1);
    const room = existing?.[0] as PersistedRoom | undefined;
    if (room) return room;
  }
  // No existing room — create the user's first room.
  // Title matches the rooms-page convention: "Abi's Room" or "My Room".
  const title = ownerName ? `${ownerName}'s Room` : "My Room";
  const { data, error } = await supabase.rpc("create_room", {
    p_title: title,
    p_description: "",
    p_is_public: false,
    p_password: null,
  });
  if (error || !data?.[0]) return null;
  return data[0] as PersistedRoom;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PRESENCE_COLORS = [
  "#ff6b9d", "#67d4f1", "#6ee7b7", "#a78bfa", "#fb923c", "#fbbf24",
];

function pickColor(seed: string): string {
  return PRESENCE_COLORS[(seed.codePointAt(0) ?? 0) % PRESENCE_COLORS.length];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseRoomOptions {
  hasSession: boolean;
  /** True once auth has been fully attempted (success or failure). */
  hydrated: boolean;
  selfId: string;
  selfName: string;
  viewerAccountId?: string;
  selfAvatarUrl?: string;
  selfUsername?: string;
}

export interface UseRoomReturn {
  phase: RoomPhase;
  activeRoomId: string | null;
  activeRoomTitle: string | null;
  /** The invite_token — also the ?room= URL param. Share this URL to invite others. */
  activeRoomToken: string | null;
  isPublic: boolean;
  isOwner: boolean;
  /** null until the room is ready; used to gate stroke sync. */
  collabScope: string | null;
  members: RoomMember[];
  selfColor: string;
  error: string | null;
  trackCursor: (pos: { x: number; y: number }, activeLayer?: number, tool?: string) => void;
  setRoomPublic: (pub: boolean) => Promise<void>;
}

export function useRoom({
  hasSession,
  hydrated,
  selfId,
  selfName,
  selfAvatarUrl,
  selfUsername,
}: UseRoomOptions): UseRoomReturn {
  const [phase, setPhase] = useState<RoomPhase>("creating");
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [activeRoomTitle, setActiveRoomTitle] = useState<string | null>(null);
  const [activeRoomToken, setActiveRoomToken] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [error, setError] = useState<string | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastCursorBroadcastRef = useRef(0);
  const roomInitiatedRef = useRef(false);
  const selfColor = pickColor(selfId);

  const selfIdRef = useRef(selfId);
  const selfNameRef = useRef(selfName);
  const selfColorRef = useRef(selfColor);
  const selfAvatarRef = useRef(selfAvatarUrl);
  const selfUsernameRef = useRef(selfUsername);
  selfIdRef.current = selfId;
  selfNameRef.current = selfName;
  selfColorRef.current = selfColor;
  selfAvatarRef.current = selfAvatarUrl;
  selfUsernameRef.current = selfUsername;

  // collabScope is null until the room is ready (gates stroke sync + board load)
  const collabScope = useMemo(
    () => (activeRoomId ? `room:${activeRoomId}` : null),
    [activeRoomId],
  );

  // ── Step 1: Read URL → create or join room ─────────────────────────────────
  useEffect(() => {
    // If auth has been fully attempted but failed (anon auth disabled), run local-only.
    if (!hasSession) {
      if (hydrated && !roomInitiatedRef.current) {
        roomInitiatedRef.current = true;
        setActiveRoomId(null);
        setActiveRoomTitle("My Canvas");
        setActiveRoomToken(null);
        setIsPublic(false);
        setIsOwner(true);
        setPhase("drawing");
      }
      return;
    }

    // Guard against double-firing when both hasSession and hydrated change.
    if (roomInitiatedRef.current) return;
    roomInitiatedRef.current = true;

    // Prefer ?room= from the URL; fall back to the last token we saved in localStorage.
    // This means navigating back to / (which strips the query string) still reopens
    // the same room instead of creating a new one.
    const urlToken = new URLSearchParams(globalThis.location?.search ?? "").get("room")?.trim() ?? "";
    const token = urlToken || readSavedToken();

    const fallbackToLocal = () => {
      setActiveRoomId(null);
      setActiveRoomTitle("My Canvas");
      setActiveRoomToken(null);
      setIsPublic(false);
      setIsOwner(true);
      setPhase("drawing");
    };

    if (!token) {
      // No room in URL and no saved token: create (or reuse) a room for this user.
      // This only runs on the very first visit or after clearSavedToken() is called.
      setPhase("creating");
      const supabase = createSupabaseBrowserClient();

      // Race the setup flow against a 5s timeout so the spinner never hangs indefinitely.
      const timeout = new Promise<void>((resolve) =>
        setTimeout(() => { fallbackToLocal(); resolve(); }, 5000)
      );

      void Promise.race([
        (async () => {
          const room = await findOrCreateRoom(supabase, selfName);
          if (!room) { fallbackToLocal(); return; }
          saveToken(room.invite_token); // remember for next visit
          if (globalThis.history) {
            const url = new URL(globalThis.location.href);
            url.searchParams.set("room", room.invite_token);
            globalThis.history.replaceState(null, "", url.toString());
          }
          setActiveRoomId(room.id);
          setActiveRoomTitle(room.title);
          setActiveRoomToken(room.invite_token);
          setIsPublic(room.is_public);
          setIsOwner(true);
          setPhase("drawing");
        })(),
        timeout,
      ]);
    } else {
      // Token in URL (?room=xxx): join or re-enter the room.
      setPhase("joining");
      const supabase = createSupabaseBrowserClient();
      void (async () => {
        const { data: { user: currentUser } } = await supabase.auth.getUser();

        // ── Path 1: join_room_by_token ──────────────────────────────────────
        // The only DB function that accepts invite tokens. Works for new joins
        // and is idempotent (safe to call again if already a member/owner).
        // No password here — if the room is password-protected, the user must
        // arrive via /rooms/[token] which has the password form.
        const { data: joinData, error: joinErr } = await supabase.rpc("join_room_by_token", {
          p_token: token,
          p_password: null,
        });
        console.log(`[useRoom:join_room_by_token] token=${token} err=${joinErr?.message ?? null} data=`, joinData);

        if (!joinErr && joinData?.[0]) {
          // Fetch full room details now that we have membership (RLS will allow it).
          const { data: room } = await supabase
            .from("rooms")
            .select("id, title, invite_token, is_public, owner_id")
            .eq("id", joinData[0].room_id)
            .single();
          if (room) {
            saveToken(room.invite_token); // persist so navigating back to / reopens this room
            setActiveRoomId(room.id);
            setActiveRoomTitle(room.title);
            setActiveRoomToken(room.invite_token);
            setIsPublic(room.is_public);
            setIsOwner(Boolean(currentUser && room.owner_id === currentUser.id));
            setPhase("drawing");
            return;
          }
        }

        // ── Path 2: direct table query ──────────────────────────────────────
        // Catches owners and existing members refreshing the page — they already
        // have RLS read access so no join RPC is needed.
        const { data: directRoom } = await supabase
          .from("rooms")
          .select("id, title, invite_token, is_public, owner_id")
          .eq("invite_token", token)
          .maybeSingle();

        console.log(`[useRoom:directRoom] result=`, directRoom);
        if (directRoom) {
          saveToken(directRoom.invite_token); // persist so navigating back to / reopens this room
          setActiveRoomId(directRoom.id);
          setActiveRoomTitle(directRoom.title);
          setActiveRoomToken(directRoom.invite_token);
          setIsPublic(directRoom.is_public);
          setIsOwner(Boolean(currentUser && directRoom.owner_id === currentUser.id));
          setPhase("drawing");
          return;
        }

        // ── Path 3: server API route (bypasses RLS for anonymous users) ────
        // Called when both DB paths fail — typically because the Supabase RLS
        // policy blocks anonymous JWTs from reading the rooms table directly.
        // The API route uses the service-role key server-side.
        try {
          const apiRes = await fetch("/api/rooms/join", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          });
          if (apiRes.ok) {
            const { room: apiRoom } = (await apiRes.json()) as {
              room: { id: string; title: string; invite_token: string; is_public: boolean; owner_id: string };
            };
            if (apiRoom) {
              console.log(`[useRoom:apiPath] resolved room id=${apiRoom.id}`);
              saveToken(apiRoom.invite_token);
              if (globalThis.history) {
                const url = new URL(globalThis.location.href);
                url.searchParams.set("room", apiRoom.invite_token);
                globalThis.history.replaceState(null, "", url.toString());
              }
              setActiveRoomId(apiRoom.id);
              setActiveRoomTitle(apiRoom.title);
              setActiveRoomToken(apiRoom.invite_token);
              setIsPublic(apiRoom.is_public);
              setIsOwner(Boolean(currentUser && apiRoom.owner_id === currentUser.id));
              setPhase("drawing");
              return;
            }
          }
        } catch (apiErr) {
          console.warn("[useRoom:apiPath] fetch failed:", apiErr);
        }

        // ── All paths failed ────────────────────────────────────────────────
        // Token is genuinely invalid or expired (e.g. rotated by owner).
        // Clear the saved token so future visits don't keep retrying it.
        clearSavedToken();
        if (globalThis.history) {
          const url = new URL(globalThis.location.href);
          url.searchParams.delete("room");
          globalThis.history.replaceState(null, "", url.toString());
        }
        console.warn(`[useRoom] All join paths failed for token=${token}`);
        setError("That invite link was invalid or expired — starting a fresh canvas.");
        setPhase("creating");

        const room = await findOrCreateRoom(supabase, selfName);
        if (room) {
          saveToken(room.invite_token);
          if (globalThis.history) {
            const url = new URL(globalThis.location.href);
            url.searchParams.set("room", room.invite_token);
            globalThis.history.replaceState(null, "", url.toString());
          }
          setActiveRoomId(room.id);
          setActiveRoomTitle(room.title);
          setActiveRoomToken(room.invite_token);
          setIsPublic(room.is_public);
          setIsOwner(true);
          setPhase("drawing");
        } else {
          fallbackToLocal();
        }
        setTimeout(() => setError(null), 4000);
      })();
    }
  }, [hasSession, hydrated]);

  // ── Step 2: Presence + cursor channel (active once room is ready) ──────────
  useEffect(() => {
    if (!hasSession || !activeRoomId || phase !== "drawing") return;

    console.log(`[useRoom] Opening presence channel — roomId=${activeRoomId} selfId=${selfIdRef.current} selfName=${selfNameRef.current}`);

    const supabase = createSupabaseBrowserClient();
    const ch = supabase
      .channel(`room-live:room:${activeRoomId}`, {
        config: {
          presence: { key: selfIdRef.current },
          broadcast: { self: false },
        },
      })
      .on("presence", { event: "sync" }, () => {
        const state = ch.presenceState<PresencePayload>();
        console.log(`[useRoom:sync] self=${selfIdRef.current} keys=`, Object.keys(state));
        const next: RoomMember[] = [];
        for (const [key, slots] of Object.entries(state)) {
          const p = slots[0];
          if (!p) continue;
          next.push({
            presenceKey: key,
            userId: p.userId ?? key,
            name: p.name ?? "Artist",
            color: p.color ?? "#ff6b9d",
            avatarUrl: p.avatarUrl,
            username: p.username,
            x: p.x ?? 0,
            y: p.y ?? 0,
          });
        }
        setMembers(next);
      })
      .on("presence", { event: "join" }, ({ key, newPresences }) => {
        const p = (newPresences as unknown as PresencePayload[])[0];
        console.log(`[useRoom:join] self=${selfIdRef.current} joined key=${key} name=${p?.name}`);
        if (!p) return;
        setMembers((prev) => {
          if (prev.some((m) => m.presenceKey === key)) return prev;
          return [
            ...prev,
            {
              presenceKey: key,
              userId: p.userId ?? key,
              name: p.name ?? "Artist",
              color: p.color ?? "#ff6b9d",
              avatarUrl: p.avatarUrl,
              username: p.username,
              x: p.x ?? 0,
              y: p.y ?? 0,
            },
          ];
        });
      })
      .on("presence", { event: "leave" }, ({ key }) => {
        console.log(`[useRoom:leave] self=${selfIdRef.current} left key=${key}`);
        setMembers((prev) => prev.filter((m) => m.presenceKey !== key));
      })
      .on("broadcast", { event: "cursor" }, ({ payload }) => {
        const data = payload as CursorBroadcast;
        if (!data?.id || data.id === selfIdRef.current) return;
        setMembers((prev) => {
          const idx = prev.findIndex((m) => m.presenceKey === data.id);
          if (idx === -1) return prev;
          const existing = prev[idx];
          const updated = [...prev];
          updated[idx] = {
            ...existing,
            x: data.x,
            y: data.y,
            // Only overwrite optional fields if broadcast includes them
            ...(data.name && { name: data.name }),
            ...(data.color && { color: data.color }),
            ...(data.avatarUrl && { avatarUrl: data.avatarUrl }),
            ...(data.username && { username: data.username }),
            ...(data.activeLayer !== undefined && { activeLayer: data.activeLayer }),
            ...(data.tool && { tool: data.tool }),
          };
          return updated;
        });
      });

    ch.subscribe(async (status) => {
      console.log(`[useRoom:subscribe] self=${selfIdRef.current} status=${status}`);
      if (status !== "SUBSCRIBED") return;
      // Strip data: URLs from the avatar — they can be hundreds of KB (e.g. GIF stickers
      // used as profile pictures) and will exceed Supabase Realtime's ~250 KB payload
      // limit, causing track() to be silently dropped for all other users.
      const safeAvatarUrl = selfAvatarRef.current?.startsWith("data:") ? undefined : selfAvatarRef.current;
      const trackResult = await ch.track({
        userId: selfIdRef.current,
        name: selfNameRef.current,
        color: selfColorRef.current,
        avatarUrl: safeAvatarUrl,
        username: selfUsernameRef.current,
        x: 0,
        y: 0,
      } satisfies PresencePayload);
      console.log(`[useRoom:track] self=${selfIdRef.current} trackResult=`, trackResult);
    });

    channelRef.current = ch;

    return () => {
      void ch.untrack().finally(() => void supabase.removeChannel(ch));
      channelRef.current = null;
      setMembers([]);
    };
  }, [hasSession, activeRoomId, phase]);

  // ── Re-track when avatar changes ───────────────────────────────────────────
  useEffect(() => {
    const ch = channelRef.current;
    if (!ch) return;
    const safeAvatarUrl = selfAvatarRef.current?.startsWith("data:") ? undefined : selfAvatarRef.current;
    // Re-track presence with new avatar
    void ch.track({
      userId: selfIdRef.current,
      name: selfNameRef.current,
      color: selfColorRef.current,
      avatarUrl: safeAvatarUrl,
      username: selfUsernameRef.current,
      x: 0,
      y: 0,
    } satisfies PresencePayload);
    // Also broadcast via cursor channel for immediate update
    void ch.send({
      type: "broadcast",
      event: "cursor",
      payload: {
        id: selfIdRef.current,
        x: 0,
        y: 0,
        name: selfNameRef.current,
        color: selfColorRef.current,
        avatarUrl: safeAvatarUrl,
        username: selfUsernameRef.current,
      } satisfies CursorBroadcast,
    });
  }, [selfAvatarUrl]);

  // ── Cursor broadcast (16 ms throttle) ─────────────────────────────────────
  const trackCursor = useCallback((pos: { x: number; y: number }, activeLayer?: number, tool?: string) => {
    const ch = channelRef.current;
    if (!ch) return;
    const now = performance.now();
    if (now - lastCursorBroadcastRef.current < 16) return;
    lastCursorBroadcastRef.current = now;
    void ch.send({
      type: "broadcast",
      event: "cursor",
      payload: {
        id: selfIdRef.current,
        x: pos.x,
        y: pos.y,
        name: selfNameRef.current,
        color: selfColorRef.current,
        avatarUrl: selfAvatarRef.current?.startsWith("data:") ? undefined : selfAvatarRef.current,
        username: selfUsernameRef.current,
        activeLayer,
        tool: tool as CursorBroadcast["tool"],
      } satisfies CursorBroadcast,
    });
  }, []);

  // ── Toggle room public / private (owner only) ──────────────────────────────
  const setRoomPublic = useCallback(
    async (pub: boolean) => {
      if (!activeRoomId) return;
      const supabase = createSupabaseBrowserClient();
      await supabase.rpc("update_room_security", {
        p_room_id: activeRoomId,
        p_is_public: pub,
      });
      setIsPublic(pub);
    },
    [activeRoomId],
  );

  return {
    phase,
    activeRoomId,
    activeRoomTitle,
    activeRoomToken,
    isPublic,
    isOwner,
    collabScope,
    members,
    selfColor,
    error,
    trackCursor,
    setRoomPublic,
  };
}
