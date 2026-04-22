"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { RoomInvitePreview, RoomSummary } from "@/types";
import type { Database } from "@/types/database";

type RoomRow = Database["public"]["Tables"]["rooms"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type RoomMemberRow = Database["public"]["Tables"]["room_members"]["Row"];

type AccountIdentity = {
  id: string;
  displayName: string;
  username: string;
} | null;

function mapRoom(
  room: RoomRow,
  profile: ProfileRow | undefined,
  me: AccountIdentity,
  memberRoomIds: Set<string>
): RoomSummary {
  const isOwner = Boolean(me && room.owner_id === me.id);
  const resolvedOwnerName = me?.displayName ?? profile?.display_name ?? "Artist";
  return {
    id: room.id,
    ownerId: room.owner_id,
    ownerName: isOwner ? resolvedOwnerName : (profile?.display_name ?? "Artist"),
    ownerUsername: profile?.username ?? "",
    title: room.title,
    description: room.description,
    visibility: room.is_public ? "public" : "private",
    inviteToken: room.invite_token,
    hasPassword: Boolean(room.password_hash),
    isMember: memberRoomIds.has(room.id) || isOwner,
    isOwner,
    updatedAt: new Date(room.updated_at).getTime(),
    createdAt: new Date(room.created_at).getTime(),
  };
}

export function useRooms(currentAccount: AccountIdentity) {
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable refs so refresh callback doesn't change on every render
  const accountIdRef = React.useRef(currentAccount?.id ?? null);
  const accountRef = React.useRef(currentAccount);
  accountIdRef.current = currentAccount?.id ?? null;
  accountRef.current = currentAccount;

  const refresh = useCallback(async () => {
    const account = accountRef.current;
    if (!account) {
      setRooms([]);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    setLoading(true);
    setError(null);

    try {
      const [{ data: roomRows, error: roomsError }, { data: memberRows, error: membersError }] = await Promise.all([
        supabase.from("rooms").select("*").order("updated_at", { ascending: false }),
        supabase.from("room_members").select("room_id,user_id").eq("user_id", account.id),
      ]);

      if (roomsError) throw roomsError;
      if (membersError) throw membersError;

      const ownerIds = [...new Set((roomRows ?? []).map((room) => room.owner_id))];
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .in("id", ownerIds);

      if (profilesError) throw profilesError;

      const memberRoomIds = new Set((memberRows as RoomMemberRow[] | null)?.map((row) => row.room_id) ?? []);
      const profilesByOwner = new Map<string, ProfileRow>();
      for (const profile of profiles ?? []) {
        profilesByOwner.set(profile.id, profile);
      }

      const mapped = (roomRows ?? []).map((room) => mapRoom(room, profilesByOwner.get(room.owner_id), account, memberRoomIds));
      setRooms(mapped);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load rooms.";
      setError(message);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const accountId = currentAccount?.id ?? null;
  useEffect(() => {
    void refresh();
  }, [refresh, accountId]);

  const myRooms = useMemo(
    () => rooms.filter((room) => room.ownerId === currentAccount?.id || room.isMember),
    [rooms, currentAccount?.id]
  );

  const publicRooms = useMemo(
    () => rooms.filter((room) => room.visibility === "public"),
    [rooms]
  );

  const createRoom = useCallback(
    async (payload: { title: string; description: string; isPublic: boolean; password?: string }) => {
      const supabase = createSupabaseBrowserClient();
      const { data, error: createError } = await supabase.rpc("create_room", {
        p_title: payload.title,
        p_description: payload.description,
        p_is_public: payload.isPublic,
        p_password: payload.password?.trim() ? payload.password : null,
      });

      if (createError) throw createError;
      const created = data?.[0];
      if (!created) throw new Error("Room was not created.");

      await refresh();
      return created;
    },
    [refresh]
  );

  const updateRoomSecurity = useCallback(
    async (roomId: string, isPublic: boolean, passwordValue: string | null) => {
      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase.rpc("update_room_security", {
        p_room_id: roomId,
        p_is_public: isPublic,
        p_password: passwordValue,
      });
      if (updateError) throw updateError;
      await refresh();
    },
    [refresh]
  );

  const rotateRoomInviteToken = useCallback(
    async (roomId: string) => {
      const supabase = createSupabaseBrowserClient();
      const { data, error: rotateError } = await supabase.rpc("rotate_room_invite_token", {
        p_room_id: roomId,
      });

      if (rotateError) throw rotateError;
      await refresh();
      return data;
    },
    [refresh]
  );

  const getInvitePreview = useCallback(async (token: string): Promise<RoomInvitePreview | null> => {
    const supabase = createSupabaseBrowserClient();
    const { data, error: previewError } = await supabase.rpc("get_room_invite_preview", {
      p_token: token,
    });
    if (previewError) throw previewError;

    const row = data?.[0];
    if (!row) return null;

    return {
      id: row.id,
      title: row.title,
      description: row.description,
      isPublic: row.is_public,
      hasPassword: row.has_password,
      ownerName: row.owner_display_name,
      ownerUsername: row.owner_username,
    };
  }, []);

  const joinByInviteToken = useCallback(
    async (token: string, password?: string) => {
      const supabase = createSupabaseBrowserClient();
      const { data, error: joinError } = await supabase.rpc("join_room_by_token", {
        p_token: token,
        p_password: password?.trim() ? password : null,
      });

      if (joinError) throw joinError;
      const joined = data?.[0];
      if (!joined) throw new Error("Unable to join this room.");
      await refresh();
      return joined;
    },
    [refresh]
  );

  return {
    rooms,
    myRooms,
    publicRooms,
    loading,
    error,
    refresh,
    createRoom,
    updateRoomSecurity,
    rotateRoomInviteToken,
    getInvitePreview,
    joinByInviteToken,
  };
}
