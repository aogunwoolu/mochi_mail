"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { SpaceItem, SpaceItemType, UserSpace } from "@/types";
import type { Database } from "@/types/database";

type SpaceRow = Database["public"]["Tables"]["spaces"]["Row"];
type SpaceItemRow = Database["public"]["Tables"]["space_items"]["Row"];
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

function rowsToUserSpace(space: SpaceRow, items: SpaceItemRow[]): UserSpace {
  return {
    id: space.id,
    ownerId: space.owner_id,
    ownerName: "",
    slug: space.id,
    title: space.title,
    tagline: space.tagline,
    aboutMe: space.about_me,
    avatarUrl: "",
    youtubeUrl: "",
    accentColor: "",
    wallpaper: "",
    items: items.map(rowToSpaceItem),
    updatedAt: new Date(space.updated_at).getTime(),
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

export function useSpaces(
  _accounts: never[],
  currentAccount: { id: string; displayName: string; username: string; bio: string; avatarUrl: string; youtubeUrl: string; accentColor: string; wallpaper: string; homeTitle: string } | null
) {
  const [spaces, setSpaces] = useState<UserSpace[]>([]);

  // Load spaces for the current user from Supabase
  useEffect(() => {
    if (!currentAccount) { setSpaces([]); return; }
    const supabase = createSupabaseBrowserClient();

    async function load() {
      const { data: spaceRows } = await supabase
        .from("spaces")
        .select("*")
        .eq("owner_id", currentAccount!.id);

      if (!spaceRows || spaceRows.length === 0) {
        // Create a default space for this user
        const { data: newSpace } = await supabase
          .from("spaces")
          .insert({
            owner_id: currentAccount!.id,
            title: currentAccount!.homeTitle,
            tagline: "A public creative board full of scraps, sounds, and mood.",
            about_me: currentAccount!.bio,
          })
          .select()
          .single();

        if (newSpace) {
          const aboutItem = makeItem("about", { content: currentAccount!.bio });
          const noteItem = makeItem("note", { color: "#ffe08a", content: "Pin ideas, to-dos, or little moods here." });

          await supabase.from("space_items").insert([
            { space_id: newSpace.id, type: aboutItem.type, title: aboutItem.title, content: aboutItem.content, x: 90, y: 100, width: 280, height: 220, color: aboutItem.color, rotation: 0 },
            { space_id: newSpace.id, type: noteItem.type, title: noteItem.title, content: noteItem.content, x: 430, y: 90, width: 220, height: 170, color: noteItem.color, rotation: 0 },
          ]);

          const { data: freshSpace } = await supabase
            .from("spaces")
            .select("*")
            .eq("id", newSpace.id)
            .single();

          const { data: freshItems } = await supabase
            .from("space_items")
            .select("*")
            .eq("space_id", newSpace.id);

          if (freshSpace) {
            const space = rowsToUserSpace(freshSpace, freshItems ?? []);
            space.ownerName = currentAccount!.displayName;
            space.avatarUrl = currentAccount!.avatarUrl;
            space.youtubeUrl = currentAccount!.youtubeUrl;
            space.accentColor = currentAccount!.accentColor;
            space.wallpaper = currentAccount!.wallpaper;
            setSpaces([space]);
          }
        }
        return;
      }

      const spaceIds = spaceRows.map((row) => row.id);
      const { data: itemRows } = await supabase
        .from("space_items")
        .select("*")
        .in("space_id", spaceIds);

      const itemsBySpace = new Map<string, SpaceItemRow[]>();
      for (const row of itemRows ?? []) {
        const existing = itemsBySpace.get(row.space_id);
        if (existing) {
          existing.push(row);
        } else {
          itemsBySpace.set(row.space_id, [row]);
        }
      }

      const mapped = spaceRows.map((row) => {
        const space = rowsToUserSpace(row, itemsBySpace.get(row.id) ?? []);
        space.ownerName = currentAccount!.displayName;
        space.avatarUrl = currentAccount!.avatarUrl;
        space.youtubeUrl = currentAccount!.youtubeUrl;
        space.accentColor = currentAccount!.accentColor;
        space.wallpaper = currentAccount!.wallpaper;
        return space;
      });
      setSpaces(mapped);
    }

    load();
  }, [currentAccount?.id]);

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

  const updateSpaceItem = useCallback(async (spaceId: string, itemId: string, patch: Partial<SpaceItem>) => {
    const supabase = createSupabaseBrowserClient();
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

    await supabase.from("space_items").update(dbPatch).eq("id", itemId);

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
  }, []);

  const removeSpaceItem = useCallback(async (spaceId: string, itemId: string) => {
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
