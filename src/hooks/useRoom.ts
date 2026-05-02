
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
};

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
  trackCursor: (pos: { x: number; y: number }) => void;
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

    const token = new URLSearchParams(globalThis.location?.search ?? "")
      .get("room")
      ?.trim() ?? "";

    const fallbackToLocal = () => {
      setActiveRoomId(null);
      setActiveRoomTitle("My Canvas");
      setActiveRoomToken(null);
      setIsPublic(false);
      setIsOwner(true);
      setPhase("drawing");
    };

    if (!token) {
      // No room in URL: reuse most-recent owned room, or create a new private one
      setPhase("creating");
      const supabase = createSupabaseBrowserClient();

      // Race the entire room-setup flow against a 5s timeout so the spinner
      // never hangs indefinitely (e.g. when create_room RPC is slow or blocked).
      const timeout = new Promise<void>((resolve) =>
        setTimeout(() => { fallbackToLocal(); resolve(); }, 5000)
      );

      void Promise.race([
        (async () => {
          const { data: { user } } = await supabase.auth.getUser();

          // Look for an existing owned room before creating
          if (user) {
            const { data: existing } = await supabase
              .from("rooms")
              .select("id, title, invite_token, is_public")
              .eq("owner_id", user.id)
              .order("updated_at", { ascending: false })
              .limit(1);

            const room = existing?.[0] as
              | { id: string; title: string; invite_token: string; is_public: boolean }
              | undefined;

            if (room) {
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
              return;
            }
          }

          // No existing room — create a new private one
          const { data, error: err } = await (supabase.rpc as Function)("create_room", {
            p_title: "My Canvas",
            p_description: "",
            p_is_public: false,
            p_password: null,
          });
          if (err || !data?.[0]) {
            // If room creation fails (e.g. RLS policy for anonymous users),
            // fall back to local-only drawing mode — canvas still works without sync.
            fallbackToLocal();
            return;
          }
          const { id, invite_token } = data[0] as { id: string; invite_token: string };

          if (globalThis.history) {
            const url = new URL(globalThis.location.href);
            url.searchParams.set("room", invite_token);
            globalThis.history.replaceState(null, "", url.toString());
          }

          setActiveRoomId(id);
          setActiveRoomTitle("My Canvas");
          setActiveRoomToken(invite_token);
          setIsPublic(false);
          setIsOwner(true);
          setPhase("drawing");
        })(),
        timeout,
      ]);
    } else {
      // Token in URL: join the room (idempotent for owner/existing members).
      // The token may be an invite_token (hex string) or a room UUID (stable link).
      setPhase("joining");
      const supabase = createSupabaseBrowserClient();
      void (async () => {
        // 1. Try invite token first (the normal case)
        const { data, error: err } = await (supabase.rpc as Function)("join_room_full", {
          p_token: token,
        });

        if (!err && data?.[0]) {
          const room = data[0] as {
            room_id: string;
            room_title: string;
            is_public: boolean;
            is_owner: boolean;
            invite_token: string;
          };
          setActiveRoomId(room.room_id);
          setActiveRoomTitle(room.room_title);
          setActiveRoomToken(room.invite_token);
          setIsPublic(room.is_public);
          setIsOwner(room.is_owner);
          setPhase("drawing");
          return;
        }

        // 2. Direct table query — works even when the RPC is unavailable.
        //    RLS already allows owners, members, and public-room visitors to read.
        //    This is the most reliable recovery path on refresh.
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        const { data: directRoom } = await supabase
          .from("rooms")
          .select("id, title, invite_token, is_public, owner_id")
          .eq("invite_token", token)
          .maybeSingle();

        if (directRoom) {
          const userIsOwner = Boolean(currentUser && directRoom.owner_id === currentUser.id);
          setActiveRoomId(directRoom.id);
          setActiveRoomTitle(directRoom.title);
          setActiveRoomToken(directRoom.invite_token);
          setIsPublic(directRoom.is_public);
          setIsOwner(userIsOwner);
          setPhase("drawing");
          return;
        }

        // 3. Fallback: token might be a room UUID from a legacy share link.
        //    join_room_by_id handles public rooms and existing members by ID.
        const { data: d2, error: e2 } = await (supabase.rpc as Function)("join_room_by_id", {
          p_room_id: token,
        });

        if (!e2 && d2?.[0]) {
          const room2 = d2[0] as {
            room_id: string;
            room_title: string;
            is_public: boolean;
            invite_token: string;
          };
          // Update URL to the invite token so future shares work correctly.
          if (globalThis.history && room2.invite_token) {
            const url = new URL(globalThis.location.href);
            url.searchParams.set("room", room2.invite_token);
            globalThis.history.replaceState(null, "", url.toString());
          }
          setActiveRoomId(room2.room_id);
          setActiveRoomTitle(room2.room_title);
          setActiveRoomToken(room2.invite_token);
          setIsPublic(room2.is_public);
          setIsOwner(false);
          setPhase("drawing");
          return;
        }

        // All join attempts failed — strip the stale token and fall back to
        // the create-or-reuse flow so drawing is never permanently blocked.
        if (globalThis.history) {
          const url = new URL(globalThis.location.href);
          url.searchParams.delete("room");
          globalThis.history.replaceState(null, "", url.toString());
        }

        // Keep roomInitiatedRef=true so the effect doesn't double-fire;
        // the create/reuse path runs inline below.
        setError("That invite link was invalid or expired — starting a fresh canvas.");

        // Re-run the no-token create flow inline
        setPhase("creating");
        const supabase2 = createSupabaseBrowserClient();
        const { data: { user: u2 } } = await supabase2.auth.getUser();
        if (u2) {
          const { data: existing2 } = await supabase2
            .from("rooms")
            .select("id, title, invite_token, is_public")
            .eq("owner_id", u2.id)
            .order("updated_at", { ascending: false })
            .limit(1);
          const room2 = existing2?.[0] as
            | { id: string; title: string; invite_token: string; is_public: boolean }
            | undefined;
          if (room2) {
            if (globalThis.history) {
              const url2 = new URL(globalThis.location.href);
              url2.searchParams.set("room", room2.invite_token);
              globalThis.history.replaceState(null, "", url2.toString());
            }
            setActiveRoomId(room2.id);
            setActiveRoomTitle(room2.title);
            setActiveRoomToken(room2.invite_token);
            setIsPublic(room2.is_public);
            setIsOwner(true);
            setPhase("drawing");
            // Clear the transient warning after a moment
            setTimeout(() => setError(null), 4000);
            return;
          }
        }
        // No existing room — create a new one
        const { data: newRoom, error: createErr } = await (supabase2.rpc as Function)("create_room", {
          p_title: "My Canvas",
          p_description: "",
          p_is_public: false,
          p_password: null,
        });
        if (createErr || !newRoom?.[0]) {
          fallbackToLocal();
          return;
        }
        const { id: newId, invite_token: newToken } = newRoom[0] as { id: string; invite_token: string };
        if (globalThis.history) {
          const url3 = new URL(globalThis.location.href);
          url3.searchParams.set("room", newToken);
          globalThis.history.replaceState(null, "", url3.toString());
        }
        setActiveRoomId(newId);
        setActiveRoomTitle("My Canvas");
        setActiveRoomToken(newToken);
        setIsPublic(false);
        setIsOwner(true);
        setPhase("drawing");
        setTimeout(() => setError(null), 4000);
      })();
    }
  }, [hasSession, hydrated]);

  // ── Step 2: Presence + cursor channel (active once room is ready) ──────────
  useEffect(() => {
    if (!hasSession || !activeRoomId || phase !== "drawing") return;

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
      .on("broadcast", { event: "cursor" }, ({ payload }) => {
        const data = payload as CursorBroadcast;
        if (!data?.id || data.id === selfIdRef.current) return;
        setMembers((prev) => {
          const idx = prev.findIndex((m) => m.presenceKey === data.id);
          if (idx === -1) return prev;
          const updated = [...prev];
          updated[idx] = {
            ...updated[idx],
            x: data.x,
            y: data.y,
            name: data.name,
            color: data.color,
            avatarUrl: data.avatarUrl,
            username: data.username,
          };
          return updated;
        });
      });

    ch.subscribe(async (status) => {
      if (status !== "SUBSCRIBED") return;
      await ch.track({
        userId: selfIdRef.current,
        name: selfNameRef.current,
        color: selfColorRef.current,
        avatarUrl: selfAvatarRef.current,
        username: selfUsernameRef.current,
        x: 0,
        y: 0,
      } satisfies PresencePayload);
    });

    channelRef.current = ch;

    return () => {
      void ch.untrack().finally(() => void supabase.removeChannel(ch));
      channelRef.current = null;
      setMembers([]);
    };
  }, [hasSession, activeRoomId, phase]);

  // ── Cursor broadcast (16 ms throttle) ─────────────────────────────────────
  const trackCursor = useCallback((pos: { x: number; y: number }) => {
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
        avatarUrl: selfAvatarRef.current,
        username: selfUsernameRef.current,
      } satisfies CursorBroadcast,
    });
  }, []);

  // ── Toggle room public / private (owner only) ──────────────────────────────
  const setRoomPublic = useCallback(
    async (pub: boolean) => {
      if (!activeRoomId) return;
      const supabase = createSupabaseBrowserClient();
      await (supabase.rpc as Function)("update_room_security", {
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
