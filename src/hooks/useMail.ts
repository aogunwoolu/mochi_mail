
import { useState, useCallback, useEffect, useMemo } from "react";
import { generateId } from "@/lib/id";
import { Letter, DELIVERY_SPEEDS, LetterSendPayload, ViewerIdentity } from "@/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type LetterRow = Database["public"]["Tables"]["letters"]["Row"];

function normalizeName(user: ViewerIdentity): string {
  return user.name?.trim() || user.username?.trim() || "Guest";
}

function safeLower(value: string | undefined): string {
  return value?.toLowerCase() ?? "";
}

function storageKeyFor(user: ViewerIdentity): string {
  const id = user.accountId ?? user.id ?? "guest";
  return `mochimail_letters:${id}`;
}

function loadLetters(storageKey: string): Letter[] {
  if (!globalThis.window) return [];
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as Letter[]) : [];
  } catch {
    return [];
  }
}

function saveLetters(storageKey: string, letters: Letter[]) {
  if (!globalThis.window) return;
  try { localStorage.setItem(storageKey, JSON.stringify(letters)); } catch { /* quota */ }
}

function rowToLetter(row: LetterRow): Letter {
  return {
    id: row.id,
    senderId: row.sender_id,
    senderName: row.sender_name,
    receiverId: row.receiver_id ?? row.receiver_username,
    receiverName: row.receiver_name,
    imageData: row.image_data,
    envelopeImageData: row.envelope_image_data ?? undefined,
    envelopeName: row.envelope_name ?? undefined,
    stampImageData: row.stamp_image_data ?? undefined,
    stampName: row.stamp_name ?? undefined,
    stampStyle: row.stamp_style,
    sentAt: row.sent_at,
    deliveryDuration: row.delivery_duration,
    deliverySpeed: row.delivery_speed as Letter["deliverySpeed"],
    read: row.read,
  };
}

export function useMail(user: ViewerIdentity) {
  const [letters, setLetters] = useState<Letter[]>([]);
  const [tick, setTick] = useState(0);
  const viewerName = normalizeName(user);
  const normalizedUser = useMemo(() => ({ ...user, name: viewerName }), [user, viewerName]);
  const storageKey = useMemo(() => storageKeyFor(user), [user]);
  const ownerId = user.isGuest ? null : (user.accountId ?? user.id ?? null);

  const receiverUsername = user.username ?? null;

  const fetchLetters = useCallback(async () => {
    if (!ownerId) return;
    try {
      const supabase = createSupabaseBrowserClient();
      const queries: Promise<{ data: LetterRow[] | null }>[] = [
        supabase.from("letters").select("*").eq("sender_id", ownerId).order("sent_at", { ascending: true }),
        supabase.from("letters").select("*").eq("receiver_id", ownerId).order("sent_at", { ascending: true }),
      ];
      // Fallback: catch letters where receiver_id was null at send time (profile didn't exist yet)
      if (receiverUsername) {
        queries.push(
          supabase.from("letters").select("*").is("receiver_id", null).eq("receiver_username", receiverUsername).order("sent_at", { ascending: true })
        );
      }
      const results = await Promise.all(queries);
      const seen = new Set<string>();
      const all: Letter[] = [];
      for (const { data } of results) {
        for (const row of (data ?? [])) {
          if (!seen.has(row.id)) {
            seen.add(row.id);
            all.push(rowToLetter(row));
          }
        }
      }
      setLetters(all);
    } catch (err) {
      console.error("[useMail] Failed to fetch letters:", err);
    }
  }, [ownerId, receiverUsername]);

  // Initial load
  useEffect(() => {
    if (!ownerId) {
      setLetters(loadLetters(storageKey));
      return;
    }
    void fetchLetters();
  }, [ownerId, storageKey, fetchLetters]);

  // Real-time subscription for new letters; fall back to 30s polling if unavailable
  useEffect(() => {
    if (!ownerId) return;
    const supabase = createSupabaseBrowserClient();

    const channel = supabase
      .channel(`letters:${ownerId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "letters", filter: `receiver_id=eq.${ownerId}` }, () => void fetchLetters())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "letters", filter: `sender_id=eq.${ownerId}` }, () => void fetchLetters())
      .subscribe();

    const fallback = globalThis.setInterval(() => void fetchLetters(), 30_000);

    return () => {
      void supabase.removeChannel(channel);
      globalThis.clearInterval(fallback);
    };
  }, [ownerId, fetchLetters]);

  // Persist guest letters to localStorage
  useEffect(() => {
    if (ownerId) return;
    saveLetters(storageKey, letters);
  }, [letters, ownerId, storageKey]);

  // Tick to drive delivery progress
  useEffect(() => {
    const interval = globalThis.setInterval(() => setTick((t) => t + 1), 5000);
    return () => globalThis.clearInterval(interval);
  }, []);

  const sendLetter = useCallback(
    ({
      receiverName,
      imageData,
      speed,
      stampStyle,
      envelopeImageData,
      envelopeName,
      stampImageData,
      stampName,
    }: LetterSendPayload): Letter => {
      const speedConfig = DELIVERY_SPEEDS.find((s) => s.id === speed)!;
      const receiverUsername = receiverName.toLowerCase().replaceAll(/\s+/g, "_");
      const letter: Letter = {
        id: generateId(),
        senderId: user.id,
        senderName: viewerName,
        receiverId: receiverUsername,
        receiverName,
        imageData,
        envelopeImageData,
        envelopeName,
        stampImageData,
        stampName,
        sentAt: Date.now(),
        deliveryDuration: speedConfig.duration,
        deliverySpeed: speed,
        read: false,
        stampStyle,
      };

      setLetters((prev) => [...prev, letter]);

      if (ownerId) {
        void (async () => {
          try {
            const supabase = createSupabaseBrowserClient();
            const { data: profile } = await supabase
              .from("profiles")
              .select("id")
              .eq("username", receiverUsername)
              .maybeSingle();
            const receiverId = profile?.id ?? null;

            await supabase.from("letters").insert({
              id: letter.id,
              sender_id: ownerId,
              sender_name: letter.senderName,
              receiver_id: receiverId,
              receiver_username: receiverUsername,
              receiver_name: receiverName,
              image_data: letter.imageData,
              envelope_image_data: letter.envelopeImageData ?? null,
              envelope_name: letter.envelopeName ?? null,
              stamp_image_data: letter.stampImageData ?? null,
              stamp_name: letter.stampName ?? null,
              stamp_style: letter.stampStyle,
              sent_at: letter.sentAt,
              delivery_duration: letter.deliveryDuration,
              delivery_speed: letter.deliverySpeed,
              read: false,
            });

            if (receiverId) {
              setLetters((prev) =>
                prev.map((l) => (l.id === letter.id ? { ...l, receiverId } : l))
              );
            }
          } catch (err) {
            console.error("[useMail] Failed to persist letter:", err);
          }
        })();
      }

      return letter;
    },
    [ownerId, user.id, viewerName]
  );

  const isDelivered = useCallback((letter: Letter) => {
    return Date.now() >= letter.sentAt + letter.deliveryDuration;
  }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const getDeliveryProgress = useCallback((letter: Letter) => {
    const elapsed = Date.now() - letter.sentAt;
    return Math.min(1, elapsed / letter.deliveryDuration);
  }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const getTimeRemaining = useCallback((letter: Letter) => {
    const remaining = (letter.sentAt + letter.deliveryDuration) - Date.now();
    if (remaining <= 0) return "Delivered!";
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const markAsRead = useCallback((letterId: string) => {
    setLetters((prev) => prev.map((l) => (l.id === letterId ? { ...l, read: true } : l)));
    if (!ownerId) return;
    void createSupabaseBrowserClient()
      .from("letters")
      .update({ read: true })
      .eq("id", letterId);
  }, [ownerId]);

  const inbox = ownerId
    ? letters.filter((l) => l.receiverId === ownerId || (receiverUsername && l.receiverId === receiverUsername))
    : letters.filter(
        (l) =>
          l.receiverId === user.id ||
          safeLower(l.receiverName) === safeLower(viewerName)
      );

  const sent = letters.filter((l) => l.senderId === (ownerId ?? user.id));

  return {
    user: normalizedUser,
    letters,
    inbox,
    sent,
    sendLetter,
    isDelivered,
    getDeliveryProgress,
    getTimeRemaining,
    markAsRead,
  };
}
