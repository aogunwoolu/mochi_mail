"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { SpaceItem, SpaceItemType, UserSpace } from "@/types";
import type { Database } from "@/types/database";

type SpaceRow = Database["public"]["Tables"]["spaces"]["Row"];
type SpaceItemRow = Database["public"]["Tables"]["space_items"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type SpaceUpdate = Database["public"]["Tables"]["spaces"]["Update"];
type SpaceItemUpdate = Database["public"]["Tables"]["space_items"]["Update"];

function generateId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function rowToSpaceItem(row: SpaceItemRow): SpaceItem {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    content: row.content,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    color: row.color,
    rotation: row.rotation,
    imageUrl: row.image_url ?? undefined,
  };
}

function makeItem(type: SpaceItemType, overrides: Partial<SpaceItem> = {}): SpaceItem {
  let title = "Post-it";
  let content = "";
  let color = "rgba(255,255,255,0.86)";

  if (type === "about") {
    title = "About Me";
    content = "Tell visitors what your corner of the world feels like.";
    color = "#d9f7ff";
  } else if (type === "image") {
    title = "Photo";
  } else if (type === "drawing") {
    title = "Doodle";
  } else {
    content = "Leave a tiny thought here.";
    color = "#ffe08a";
  }

  return {
    id: generateId(),
    type,
    title,
    content,
    x: 80 + Math.floor(Math.random() * 320),
    y: 80 + Math.floor(Math.random() * 180),
    width: type === "image" || type === "drawing" ? 240 : 220,
    height: type === "image" || type === "drawing" ? 200 : 170,
    color,
    rotation: Math.round((Math.random() * 8 - 4) * 10) / 10,
    ...overrides,
  };
}

function buildSpace(
  space: SpaceRow,
  items: SpaceItemRow[],
  profile: ProfileRow | undefined,
  currentAccount: { id: string; displayName: string; username: string; bio: string; avatarUrl: string; youtubeUrl: string; accentColor: string; wallpaper: string; homeTitle: string } | null
): UserSpace {
  const isCurrentUser = Boolean(currentAccount && currentAccount.id === space.owner_id);

  const ownerName = isCurrentUser
    ? currentAccount!.displayName
    : (profile?.display_name ?? "Artist");

  const slug = profile?.username ?? space.id;

  return {
    id: space.id,
    ownerId: space.owner_id,
    ownerName,
    slug,
    title: space.title,
    tagline: space.tagline,
    aboutMe: space.about_me,
    avatarUrl: isCurrentUser ? currentAccount!.avatarUrl : (profile?.avatar_url ?? ""),
    youtubeUrl: isCurrentUser ? currentAccount!.youtubeUrl : (profile?.youtube_url ?? ""),
    accentColor: isCurrentUser ? currentAccount!.accentColor : (profile?.accent_color ?? "#ff6b9d"),
    wallpaper: isCurrentUser ? currentAccount!.wallpaper : (profile?.wallpaper ?? ""),
    items: items.map(rowToSpaceItem),
    updatedAt: new Date(space.updated_at).getTime(),
  };
}

function toSpaceItemUpdate(patch: Partial<SpaceItem>): SpaceItemUpdate {
  const dbPatch: SpaceItemUpdate = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) dbPatch.title = patch.title;
  if (patch.content !== undefined) dbPatch.content = patch.content;
  if (patch.x !== undefined) dbPatch.x = patch.x;
  if (patch.y !== undefined) dbPatch.y = patch.y;
  if (patch.width !== undefined) dbPatch.width = patch.width;
  if (patch.height !== undefined) dbPatch.height = patch.height;
  if (patch.color !== undefined) dbPatch.color = patch.color;
  if (patch.rotation !== undefined) dbPatch.rotation = patch.rotation;
  if (patch.imageUrl !== undefined) dbPatch.image_url = patch.imageUrl;
  return dbPatch;
}

export function useSpaces(
  _accounts: never[],
  currentAccount: { id: string; displayName: string; username: string; bio: string; avatarUrl: string; youtubeUrl: string; accentColor: string; wallpaper: string; homeTitle: string } | null
) {
  const [spaces, setSpaces] = useState<UserSpace[]>([]);
  const pendingItemPatchRef = useRef<Record<string, Partial<SpaceItem>>>({});
  const pendingItemTimerRef = useRef<Record<string, ReturnType<typeof globalThis.setTimeout>>>({});

  useEffect(() => {
    return () => {
      Object.values(pendingItemTimerRef.current).forEach((timerId) => globalThis.clearTimeout(timerId));
      pendingItemTimerRef.current = {};
      pendingItemPatchRef.current = {};
    };
  }, []);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;

    async function ensureOwnSpace() {
      if (!currentAccount) return null;

      const { data: ownSpace } = await supabase
        .from("spaces")
        .select("*")
        .eq("owner_id", currentAccount.id)
        .maybeSingle();

      if (ownSpace) return ownSpace;

      const { data: created } = await supabase
        .from("spaces")
        .insert({
          owner_id: currentAccount.id,
          title: currentAccount.homeTitle,
          tagline: "A public creative board full of scraps, sounds, and mood.",
          about_me: currentAccount.bio,
        })
        .select()
        .single();

      if (!created) return null;

      const aboutItem = makeItem("about", { content: currentAccount.bio });
      const noteItem = makeItem("note", { color: "#ffe08a", content: "Pin ideas, to-dos, or little moods here." });

      await supabase.from("space_items").insert([
        {
          space_id: created.id,
          type: aboutItem.type,
          title: aboutItem.title,
          content: aboutItem.content,
          x: 90,
          y: 100,
          width: 280,
          height: 220,
          color: aboutItem.color,
          rotation: 0,
        },
        {
          space_id: created.id,
          type: noteItem.type,
          title: noteItem.title,
          content: noteItem.content,
          x: 430,
          y: 90,
          width: 220,
          height: 170,
          color: noteItem.color,
          rotation: 0,
        },
      ]);

      return created;
    }

    async function load() {
      await ensureOwnSpace();

      const { data: spaceRows } = await supabase
        .from("spaces")
        .select("*")
        .order("updated_at", { ascending: false });

      if (!spaceRows || spaceRows.length === 0) {
        if (!cancelled) setSpaces([]);
        return;
      }

      const spaceIds = spaceRows.map((row) => row.id);
      const ownerIds = [...new Set(spaceRows.map((row) => row.owner_id))];

      const [{ data: itemRows }, { data: profiles }] = await Promise.all([
        supabase.from("space_items").select("*").in("space_id", spaceIds),
        supabase.from("profiles").select("*").in("id", ownerIds),
      ]);

      if (cancelled) return;

      const itemsBySpace = new Map<string, SpaceItemRow[]>();
      for (const row of itemRows ?? []) {
        const list = itemsBySpace.get(row.space_id);
        if (list) list.push(row);
        else itemsBySpace.set(row.space_id, [row]);
      }

      const profilesByOwner = new Map<string, ProfileRow>();
      for (const profile of profiles ?? []) {
        profilesByOwner.set(profile.id, profile);
      }

      const mapped = spaceRows.map((space) =>
        buildSpace(space, itemsBySpace.get(space.id) ?? [], profilesByOwner.get(space.owner_id), currentAccount)
      );

      setSpaces(mapped);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [currentAccount?.id, currentAccount?.displayName, currentAccount?.username, currentAccount?.bio, currentAccount?.avatarUrl, currentAccount?.youtubeUrl, currentAccount?.accentColor, currentAccount?.wallpaper, currentAccount?.homeTitle]);

  const ownSpace = useMemo(
    () => (currentAccount ? spaces.find((s) => s.ownerId === currentAccount.id) ?? null : null),
    [currentAccount, spaces]
  );

  const updateOwnSpace = useCallback(async (patch: Partial<UserSpace>) => {
    if (!currentAccount || !ownSpace) return;
    const supabase = createSupabaseBrowserClient();

    const dbPatch: SpaceUpdate = { updated_at: new Date().toISOString() };
    if (patch.title !== undefined) dbPatch.title = patch.title;
    if (patch.tagline !== undefined) dbPatch.tagline = patch.tagline;
    if (patch.aboutMe !== undefined) dbPatch.about_me = patch.aboutMe;

    await supabase.from("spaces").update(dbPatch).eq("id", ownSpace.id);

    await supabase
      .from("profiles")
      .update({
        display_name: patch.ownerName,
        avatar_url: patch.avatarUrl,
        bio: patch.aboutMe,
        accent_color: patch.accentColor,
        wallpaper: patch.wallpaper,
        youtube_url: patch.youtubeUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", currentAccount.id);

    setSpaces((prev) =>
      prev.map((s) =>
        s.ownerId === currentAccount.id ? { ...s, ...patch, updatedAt: Date.now() } : s
      )
    );
  }, [currentAccount, ownSpace]);

  const addItemToOwnSpace = useCallback((type: SpaceItemType, seed?: Partial<SpaceItem>) => {
    if (!currentAccount || !ownSpace) return undefined;
    const item = makeItem(type, seed);

    setSpaces((prev) =>
      prev.map((s) =>
        s.ownerId === currentAccount.id
          ? { ...s, items: [...s.items, item], updatedAt: Date.now() }
          : s
      )
    );

    const supabase = createSupabaseBrowserClient();
    void supabase.from("space_items").insert({
      space_id: ownSpace.id,
      type: item.type,
      title: item.title,
      content: item.content,
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      color: item.color,
      rotation: item.rotation,
      image_url: item.imageUrl ?? null,
    });

    return item;
  }, [currentAccount, ownSpace]);

  const updateSpaceItem = useCallback((spaceId: string, itemId: string, patch: Partial<SpaceItem>) => {
    setSpaces((prev) =>
      prev.map((s) =>
        s.id === spaceId
          ? {
              ...s,
              items: s.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
              updatedAt: Date.now(),
            }
          : s
      )
    );

    const mergedPatch = { ...(pendingItemPatchRef.current[itemId] ?? {}), ...patch };
    pendingItemPatchRef.current[itemId] = mergedPatch;

    const existingTimer = pendingItemTimerRef.current[itemId];
    if (existingTimer) globalThis.clearTimeout(existingTimer);

    pendingItemTimerRef.current[itemId] = globalThis.setTimeout(() => {
      const payload = pendingItemPatchRef.current[itemId];
      delete pendingItemPatchRef.current[itemId];
      delete pendingItemTimerRef.current[itemId];

      if (!payload) return;

      const supabase = createSupabaseBrowserClient();
      void supabase.from("space_items").update(toSpaceItemUpdate(payload)).eq("id", itemId);
    }, 140);
  }, []);

  const removeSpaceItem = useCallback(async (spaceId: string, itemId: string) => {
    const pendingTimer = pendingItemTimerRef.current[itemId];
    if (pendingTimer) {
      globalThis.clearTimeout(pendingTimer);
      delete pendingItemTimerRef.current[itemId];
      delete pendingItemPatchRef.current[itemId];
    }

    const supabase = createSupabaseBrowserClient();
    await supabase.from("space_items").delete().eq("id", itemId);

    setSpaces((prev) =>
      prev.map((s) =>
        s.id === spaceId
          ? { ...s, items: s.items.filter((item) => item.id !== itemId), updatedAt: Date.now() }
          : s
      )
    );
  }, []);

  const leaveVisitorNote = useCallback(async (spaceId: string, authorName: string, message: string) => {
    const content = message.trim();
    if (!content) return;
    const supabase = createSupabaseBrowserClient();
    const item = makeItem("note", {
      title: `${authorName}'s note`,
      content,
      color: "#fff0a8",
      x: 120 + Math.floor(Math.random() * 320),
      y: 120 + Math.floor(Math.random() * 220),
    });

    const { data: row } = await supabase
      .from("space_items")
      .insert({
        space_id: spaceId,
        type: item.type,
        title: item.title,
        content: item.content,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        color: item.color,
        rotation: item.rotation,
      })
      .select()
      .single();

    const persisted = row ? rowToSpaceItem(row) : item;

    setSpaces((prev) =>
      prev.map((s) =>
        s.id === spaceId
          ? { ...s, items: [...s.items, persisted], updatedAt: Date.now() }
          : s
      )
    );
  }, []);

  return {
    spaces,
    ownSpace,
    updateOwnSpace,
    addItemToOwnSpace,
    updateSpaceItem,
    removeSpaceItem,
    leaveVisitorNote,
  };
}
