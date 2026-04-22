"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function useActiveRoomContext(
  hasSession: boolean,
  viewerAccountId: string | undefined,
  selfArtistId: string
) {
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [activeRoomTitle, setActiveRoomTitle] = useState<string | null>(null);
  const [roomAccessError, setRoomAccessError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSession) {
      setActiveRoomId(null);
      setActiveRoomTitle(null);
      setRoomAccessError(null);
      return;
    }

    const params = new URLSearchParams(globalThis.location.search);
    const roomId = params.get("room")?.trim() ?? "";
    if (!roomId) {
      setActiveRoomId(null);
      setActiveRoomTitle(null);
      setRoomAccessError(null);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    let cancelled = false;

    const verifyAccess = async () => {
      const { data, error } = await supabase
        .from("rooms")
        .select("id,title")
        .eq("id", roomId)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data) {
        setActiveRoomId(null);
        setActiveRoomTitle(null);
        setRoomAccessError("You do not have access to this room. Join through an invite link.");
        return;
      }

      setActiveRoomId(data.id);
      setActiveRoomTitle(data.title);
      setRoomAccessError(null);
    };

    void verifyAccess();
    return () => {
      cancelled = true;
    };
  }, [hasSession]);

  const collabScope = useMemo(
    () => (activeRoomId ? `room:${activeRoomId}` : `personal:${viewerAccountId ?? selfArtistId}`),
    [activeRoomId, viewerAccountId, selfArtistId]
  );

  return {
    activeRoomId,
    activeRoomTitle,
    roomAccessError,
    collabScope,
  };
}
