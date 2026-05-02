"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Letter, DELIVERY_SPEEDS, LetterSendPayload, ViewerIdentity } from "@/types";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Json } from "@/types/database";

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

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
  localStorage.setItem(storageKey, JSON.stringify(letters));
}

export function useMail(user: ViewerIdentity) {
  const [letters, setLetters] = useState<Letter[]>([]);
  const [tick, setTick] = useState(0);
  const [hydratedRemote, setHydratedRemote] = useState(false);
  const viewerName = normalizeName(user);
  const normalizedUser = useMemo(() => ({ ...user, name: viewerName }), [user, viewerName]);
  const storageKey = useMemo(() => storageKeyFor(user), [user]);
  const ownerId = user.isGuest ? null : (user.accountId ?? user.id ?? null);

  useEffect(() => {
    const local = loadLetters(storageKey);
    setLetters(local);

    if (!ownerId) {
      setHydratedRemote(true);
      return;
    }

    let cancelled = false;
    const loadRemote = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase
          .from("mail_states")
          .select("payload")
          .eq("owner_id", ownerId)
          .maybeSingle();

        if (cancelled) return;

        const remoteLetters = ((data?.payload as { letters?: Letter[] } | null)?.letters ?? null);
        if (Array.isArray(remoteLetters)) {
          setLetters(remoteLetters);
          saveLetters(storageKey, remoteLetters);
        } else if (local.length > 0) {
          await supabase
            .from("mail_states")
            .upsert({ owner_id: ownerId, payload: ({ letters: local } as unknown as Json), updated_at: new Date().toISOString() }, { onConflict: "owner_id" });
        }
      } catch {
        // Keep local fallback when Supabase is unavailable.
      } finally {
        if (!cancelled) setHydratedRemote(true);
      }
    };

    void loadRemote();
    return () => {
      cancelled = true;
    };
  }, [ownerId, storageKey]);

  useEffect(() => {
    if (!hydratedRemote) return;
    saveLetters(storageKey, letters);
    if (!ownerId) return;

    const timeout = globalThis.setTimeout(() => {
      void (async () => {
        try {
          const supabase = createSupabaseBrowserClient();
          await supabase
            .from("mail_states")
            .upsert({ owner_id: ownerId, payload: ({ letters } as unknown as Json), updated_at: new Date().toISOString() }, { onConflict: "owner_id" });
        } catch {
          // Local persistence already succeeded.
        }
      })();
    }, 350);

    return () => globalThis.clearTimeout(timeout);
  }, [letters, ownerId, storageKey, hydratedRemote]);

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
    }: LetterSendPayload) => {
      const speedConfig = DELIVERY_SPEEDS.find((s) => s.id === speed)!;
      const letter: Letter = {
        id: generateId(),
        senderId: user.id,
        senderName: viewerName,
        receiverId: receiverName.toLowerCase().replaceAll(/\s+/g, "_"),
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
      return letter;
    },
    [user.id, viewerName]
  );

  const isDelivered = useCallback((letter: Letter) => {
    return Date.now() >= letter.sentAt + letter.deliveryDuration;
  }, [tick]);

  const getDeliveryProgress = useCallback((letter: Letter) => {
    const elapsed = Date.now() - letter.sentAt;
    return Math.min(1, elapsed / letter.deliveryDuration);
  }, [tick]);

  const getTimeRemaining = useCallback((letter: Letter) => {
    const remaining = (letter.sentAt + letter.deliveryDuration) - Date.now();
    if (remaining <= 0) return "Delivered!";
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }, [tick]);

  const markAsRead = useCallback((letterId: string) => {
    setLetters((prev) => prev.map((l) => (l.id === letterId ? { ...l, read: true } : l)));
  }, []);

  const inbox = letters.filter(
    (letter) =>
      letter.receiverId === user.id ||
      safeLower(letter.receiverName) === safeLower(viewerName)
  );
  const sent = letters.filter((l) => l.senderId === user.id);

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
