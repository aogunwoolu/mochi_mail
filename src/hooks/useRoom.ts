"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RoomPhase =
  | "idle"           // no room in URL, personal canvas
  | "joining"        // auto-joining a public room in progress
  | "join-required"  // private room — user must paste invite token
  | "lobby"          // room verified, show code + waiting for others
  | "drawing";       // user clicked "Start Drawing" or auto-transitioned

export interface RoomMember {
  /** Unique key for this presence slot (= selfId of that client). */
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
  /** Stable session-level ID for this browser tab (used as presence key). */
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
  /** Short human-readable code, e.g. "ABC123" — display as "ABC-123". */
  activeRoomCode: string | null;
  activeRoomInviteToken: string | null;
  roomAccessError: string | null;
  /** All currently-online members, including self. */
  members: RoomMember[];
  /** Yjs + stroke channel scope — same contract as useActiveRoomContext. */
  collabScope: string;
  /** Stable self color derived from selfId. */
  selfColor: string;
  /**
   * Call on every mouse/pointer move with world-space coordinates.
   * Throttled internally to 16 ms; broadcasts to channel peers.
   */
  trackCursor: (pos: { x: number; y: number }) => void;
  /** Transition from "lobby" → "drawing". */
  enterDrawing: () => void;
  /**
   * For "join-required" phase: paste an invite token/link to join a private room.
   * Resolves with null on success or an error string on failure.
   */
  joinWithToken: (tokenOrLink: string, password?: string) => Promise<string | null>;
}

export function useRoom({
  hasSession,
  selfId,
  selfName,
  viewerAccountId,
  selfAvatarUrl,
  selfUsername,
}: UseRoomOptions): UseRoomReturn {
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [activeRoomTitle, setActiveRoomTitle] = useState<string | null>(null);
  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(null);
  const [activeRoomInviteToken, setActiveRoomInviteToken] = useState<string | null>(null);
  const [roomAccessError, setRoomAccessError] = useState<string | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [phase, setPhase] = useState<RoomPhase>("idle");

  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastCursorBroadcastRef = useRef(0);
  const pendingRoomIdRef = useRef<string | null>(null);
  const selfColor = pickColor(selfId);

  // Stable refs so closures always see current values without re-renders.
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

  // Derive collabScope — same contract as useActiveRoomContext.
  const collabScope = useMemo(
    () =>
      activeRoomId
        ? `room:${activeRoomId}`
        : `personal:${viewerAccountId ?? selfId}`,
    [activeRoomId, viewerAccountId, selfId]
  );

  // ── Step 1: Read URL param → verify room access ──────────────────────────
  useEffect(() => {
    if (!hasSession) {
      setActiveRoomId(null);
      setActiveRoomTitle(null);
      setActiveRoomCode(null);
      setActiveRoomInviteToken(null);
      setRoomAccessError(null);
      setPhase("idle");
      return;
    }

    const params = new URLSearchParams(globalThis.location?.search ?? "");
    const roomId = params.get("room")?.trim() ?? "";

    if (!roomId) {
      setActiveRoomId(null);
      setActiveRoomTitle(null);
      setActiveRoomCode(null);
      setActiveRoomInviteToken(null);
      setRoomAccessError(null);
      setPhase("idle");
      return;
    }

    const supabase = createSupabaseBrowserClient();
    let cancelled = false;

    void (async () => {
      // ── Try to fetch room info. RLS allows: public rooms, owner, or member.
      // room_code / is_public added by migrations 0007/0008 — cast until DB
      // types are regenerated with `supabase gen types typescript`.
      const { data, error } = await supabase
        .from("rooms")
        .select("id, title, invite_token, is_public")
        .eq("id", roomId)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data) {
        // Room not found OR private room the user can't see yet.
        // Keep the roomId so joinWithToken can use it, but show the join form.
        setActiveRoomId(null);
        setActiveRoomTitle(null);
        setActiveRoomCode(null);
        setActiveRoomInviteToken(null);
        setRoomAccessError(null);
        // Store pending room id for joinWithToken to reference
        pendingRoomIdRef.current = roomId;
        setPhase("join-required");
        return;
      }

      // room_code not in DB types until regenerated — safe unknown cast.
      const roomCode = (data as unknown as Record<string, string>).room_code ?? null;

      // ── Public room: auto-join so the user lands in room_members.
      // join_room_by_id is idempotent (ON CONFLICT DO NOTHING), safe to call
      // even if already a member.
      if (data.is_public) {
        setPhase("joining");
        // join_room_by_id added in migration 0008 — cast until DB types regenerated.
        await (supabase.rpc as Function)("join_room_by_id", { p_room_id: roomId });
        if (cancelled) return;
      }

      setActiveRoomId(data.id);
      setActiveRoomTitle(data.title);
      setActiveRoomCode(roomCode);
      setActiveRoomInviteToken(data.invite_token);
      setRoomAccessError(null);
      pendingRoomIdRef.current = null;
      setPhase("lobby");
    })();

    return () => { cancelled = true; };
  }, [hasSession]);

  // ── Step 2: Subscribe presence + cursor channel when room is active ────────
  useEffect(() => {
    if (!hasSession || !activeRoomId) return;

    const supabase = createSupabaseBrowserClient();

    const ch = supabase
      .channel(`room-live:${collabScope}`, {
        config: {
          presence: { key: selfIdRef.current },
          broadcast: { self: false },
        },
      })
      // Presence sync — fires on join/leave/initial connect.
      // Gives us reliable online-status with auto-cleanup on disconnect.
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
      // Cursor broadcast — fast path for position updates (16 ms throttle).
      // We update only the x/y of an existing member so we don't flash.
      .on("broadcast", { event: "cursor" }, ({ payload }) => {
        const data = payload as CursorBroadcast;
        if (!data?.id || data.id === selfIdRef.current) return;
        setMembers((prev) => {
          const idx = prev.findIndex((m) => m.presenceKey === data.id);
          if (idx === -1) return prev; // unknown member — wait for presence sync
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
      // Register self in presence — Supabase auto-unregisters on disconnect
      // (ghost-cursor fix).
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
      // Untrack self before removing channel so peers get a clean leave event.
      void ch.untrack().finally(() => void supabase.removeChannel(ch));
      channelRef.current = null;
      setMembers([]);
    };
  }, [hasSession, activeRoomId, collabScope]);

  // ── Cursor tracking (fast broadcast, 16 ms throttle) ─────────────────────
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

  const enterDrawing = useCallback(() => {
    setPhase("drawing");
  }, []);

  // ── joinWithToken: used when "join-required" phase is active ─────────────
  const joinWithToken = useCallback(async (tokenOrLink: string, password?: string): Promise<string | null> => {
    const raw = tokenOrLink.trim();
    if (!raw) return "Paste an invite link or token.";
    const token = raw.includes("/") ? raw.split("/").pop()?.trim() ?? "" : raw;
    if (!token) return "Could not read a token from that link.";

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("join_room_by_token", {
        p_token: token,
        p_password: password?.trim() ? password : null,
      });
      if (error) return error.message;
      const joined = (data as Array<{ room_id: string; room_title: string }> | null)?.[0];
      if (!joined) return "Unable to join room.";

      // Fetch full room info now that we have access.
      const { data: room } = await supabase
        .from("rooms")
        .select("id, title, invite_token, is_public")
        .eq("id", joined.room_id)
        .maybeSingle();

      if (!room) return "Joined but could not load room.";
      const roomCode = (room as unknown as Record<string, string>).room_code ?? null;

      pendingRoomIdRef.current = null;
      setActiveRoomId(room.id);
      setActiveRoomTitle(room.title);
      setActiveRoomCode(roomCode);
      setActiveRoomInviteToken(room.invite_token);
      setRoomAccessError(null);
      setPhase("lobby");
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Failed to join room.";
    }
  }, []);

  return {
    phase,
    activeRoomId,
    activeRoomTitle,
    activeRoomCode,
    activeRoomInviteToken,
    roomAccessError,
    members,
    collabScope,
    selfColor,
    trackCursor,
    enterDrawing,
    joinWithToken,
  };
}
