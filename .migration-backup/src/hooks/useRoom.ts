"use client";

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
    if (!hasSession) return;

    const token = new URLSearchParams(globalThis.location?.search ?? "")
      .get("room")
      ?.trim() ?? "";

    if (!token) {
      // No room in URL: reuse most-recent owned room, or create a new private one
      setPhase("creating");
      const supabase = createSupabaseBrowserClient();
      void (async () => {
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
          setPhase("error");
          setError("Failed to create your canvas. Please refresh.");
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
      })();
    } else {
      // Token in URL: join the room (idempotent for owner/existing members)
      setPhase("joining");
      const supabase = createSupabaseBrowserClient();
      void (async () => {
        const { data, error: err } = await (supabase.rpc as Function)("join_room_full", {
          p_token: token,
        });
        if (err || !data?.[0]) {
          setPhase("error");
          setError("Could not join this room. The link may be invalid.");
          return;
        }
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
      })();
    }
  }, [hasSession]);

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
