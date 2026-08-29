import { useState, useCallback, useEffect, useMemo, useRef } from "react";
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

function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    if (!dataUrl || !dataUrl.startsWith("data:")) return null;
    const commaIdx = dataUrl.indexOf(",");
    if (commaIdx === -1) return null;
    const header = dataUrl.slice(0, commaIdx);
    const base64 = dataUrl.slice(commaIdx + 1);
    const mimeMatch = header.match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : "image/png";
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  } catch {
    return null;
  }
}

/** Upload a canvas-exported PNG data URL to the `letters` Storage bucket and
 *  return its public URL. Returns null on failure so callers can fall back
 *  to storing the base64 data URL inline (better than losing the letter). */
async function uploadLetterImage(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  senderId: string,
  letterId: string,
  fileName: string,
  dataUrl: string,
): Promise<string | null> {
  try {
    if (!dataUrl || !dataUrl.startsWith("data:")) return null;
    const blob = dataUrlToBlob(dataUrl);
    if (!blob) return null;
    const path = `${senderId}/${letterId}/${fileName}`;
    const { error } = await supabase.storage.from("letters").upload(path, blob, {
      contentType: "image/png",
      upsert: true,
    });
    if (error) throw error;
    return supabase.storage.from("letters").getPublicUrl(path).data.publicUrl ?? null;
  } catch (err) {
    console.error(`[useMail] Failed to upload ${fileName}:`, err);
    return null;
  }
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
    // Prefer the Storage public URL (new letters); fall back to the legacy
    // base64 column for letters sent before the Storage migration.
    imageData: row.image_url ?? row.image_data ?? "",
    envelopeImageData: row.envelope_image_url ?? row.envelope_image_data ?? undefined,
    envelopeName: row.envelope_name ?? undefined,
    stampImageData: row.stamp_image_url ?? row.stamp_image_data ?? undefined,
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
  const ownerId = user.accountId ?? null;
  const receiverUsername = user.username ?? null;

  // Single-flight lock to prevent stacking parallel fetches
  const fetchingRef = useRef(false);

  const fetchLetters = useCallback(async () => {
    if (!ownerId || fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      const supabase = createSupabaseBrowserClient();

      // Combine 3 distinct queries into 1 single OR filter
      const orCondition = receiverUsername
        ? `sender_id.eq.${ownerId},receiver_id.eq.${ownerId},and(receiver_id.is.null,receiver_username.eq.${receiverUsername})`
        : `sender_id.eq.${ownerId},receiver_id.eq.${ownerId}`;

      const { data, error } = await supabase
        .from("letters")
        .select(`
          id,
          sender_id,
          sender_name,
          receiver_id,
          receiver_username,
          receiver_name,
          image_data,
          image_url,
          created_at,
          envelope_image_data,
          envelope_image_url,
          envelope_name,
          stamp_image_data,
          stamp_image_url,
          stamp_name,
          stamp_style,
          sent_at,
          delivery_duration,
          delivery_speed,
          read
        `)
        .or(orCondition)
        .order("sent_at", { ascending: true });

      if (error) throw error;

      if (data) {
        setLetters(data.map(rowToLetter));
      }
    } catch (err) {
      console.error("[useMail] Failed to fetch letters:", err);
    } finally {
      fetchingRef.current = false;
    }
  }, [ownerId, receiverUsername]);

  // Keep ref updated to break fetchLetters identity cycles in effect hook
  const fetchLettersRef = useRef(fetchLetters);
  useEffect(() => {
    fetchLettersRef.current = fetchLetters;
  }, [fetchLetters]);

  // Initial load
  useEffect(() => {
    if (!ownerId) {
      setLetters(loadLetters(storageKey));
      return;
    }
    void fetchLetters();
  }, [ownerId, storageKey, fetchLetters]);

  // Real-time subscription with stable ref execution
  useEffect(() => {
    if (!ownerId) return;
    const supabase = createSupabaseBrowserClient();
    // Realtime is authoritative; only the fallback poll needs this flag so we
    // don't hammer Supabase with a redundant fetch on every reconnect churn.
    let realtimeHealthy = false;

    const channel = supabase
      .channel(`letters:${ownerId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "letters", filter: `receiver_id=eq.${ownerId}` },
        () => void fetchLettersRef.current()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "letters", filter: `sender_id=eq.${ownerId}` },
        () => void fetchLettersRef.current()
      )
      .subscribe((status) => {
        realtimeHealthy = status === "SUBSCRIBED";
      });

    // Fallback poll only guards against missed realtime events (dropped socket,
    // etc.) - skip it entirely while the tab is hidden or the channel is
    // healthy to cut needless requests at scale, and use a longer interval
    // than before (90s vs 30s) since realtime already covers the common case.
    const fallback = globalThis.setInterval(() => {
      if (realtimeHealthy) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void fetchLettersRef.current();
    }, 90_000);

    return () => {
      void supabase.removeChannel(channel);
      globalThis.clearInterval(fallback);
    };
  }, [ownerId]); // Removed fetchLetters from deps to prevent re-subscribing on re-renders

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
      const targetUsername = receiverName.toLowerCase().replaceAll(/\s+/g, "_");
      const letter: Letter = {
        id: generateId(),
        senderId: user.id,
        senderName: viewerName,
        receiverId: targetUsername,
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
              .eq("username", targetUsername)
              .maybeSingle();
            const receiverId = profile?.id ?? null;

            // Upload images to Storage (in parallel) instead of writing
            // base64 blobs into the row - keeps the letters table small and
            // inbox queries cheap at scale. Falls back to inline base64 for
            // any upload that fails so sending never silently loses data.
            const [imageUrl, envelopeUrl, stampUrl] = await Promise.all([
              uploadLetterImage(supabase, ownerId, letter.id, "image.png", letter.imageData),
              letter.envelopeImageData
                ? uploadLetterImage(supabase, ownerId, letter.id, "envelope.png", letter.envelopeImageData)
                : Promise.resolve(null),
              letter.stampImageData
                ? uploadLetterImage(supabase, ownerId, letter.id, "stamp.png", letter.stampImageData)
                : Promise.resolve(null),
            ]);

            await supabase.from("letters").insert({
              id: letter.id,
              sender_id: ownerId,
              sender_name: letter.senderName,
              receiver_id: receiverId,
              receiver_username: targetUsername,
              receiver_name: receiverName,
              image_data: imageUrl ? null : letter.imageData,
              image_url: imageUrl,
              envelope_image_data: envelopeUrl ? null : (letter.envelopeImageData ?? null),
              envelope_image_url: envelopeUrl,
              envelope_name: letter.envelopeName ?? null,
              stamp_image_data: stampUrl ? null : (letter.stampImageData ?? null),
              stamp_image_url: stampUrl,
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
    ? letters.filter(
        (l) =>
          l.receiverId === ownerId ||
          (receiverUsername && l.receiverId === receiverUsername) ||
          safeLower(l.receiverName) === safeLower(viewerName)
      )
    : letters.filter(
        (l) =>
          l.receiverId === user.id ||
          safeLower(l.receiverName) === safeLower(viewerName)
      );

  const sent = letters.filter(
    (l) => l.senderId === (ownerId ?? user.id) || l.senderId === user.id
  );

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