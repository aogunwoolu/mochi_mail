"use client";

import { useState, useCallback, useEffect } from "react";
import { Letter, DeliverySpeed, DELIVERY_SPEEDS, ViewerIdentity } from "@/types";

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

const STORAGE_KEY = "mochimail_letters";

function loadLetters(): Letter[] {
  if (!globalThis.window) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLetters(letters: Letter[]) {
  if (!globalThis.window) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(letters));
}

export function useMail(user: ViewerIdentity) {
  const [letters, setLetters] = useState<Letter[]>([]);
  const [tick, setTick] = useState(0);

  // Load on mount
  useEffect(() => {
    setLetters(loadLetters());
  }, []);

  // Persist on change
  useEffect(() => {
    if (letters.length > 0) saveLetters(letters);
  }, [letters]);

  // Timer tick to update delivery status
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  const sendLetter = useCallback(
    (
      receiverName: string,
      imageData: string,
      speed: DeliverySpeed,
      stampStyle: string
    ) => {
      const speedConfig = DELIVERY_SPEEDS.find((s) => s.id === speed)!;
      const letter: Letter = {
        id: generateId(),
        senderId: user.id,
        senderName: user.name,
        receiverId: receiverName.toLowerCase().replaceAll(/\s+/g, "_"),
        receiverName,
        imageData,
        sentAt: Date.now(),
        deliveryDuration: speedConfig.duration,
        deliverySpeed: speed,
        read: false,
        stampStyle,
      };
      setLetters((prev) => {
        const updated = [...prev, letter];
        saveLetters(updated);
        return updated;
      });
      return letter;
    },
    [user]
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
    setLetters((prev) => {
      const updated = prev.map((l) => (l.id === letterId ? { ...l, read: true } : l));
      saveLetters(updated);
      return updated;
    });
  }, []);

  const inbox = letters.filter((l) => l.receiverId === user.id || l.receiverName.toLowerCase() === user.name.toLowerCase());
  const sent = letters.filter((l) => l.senderId === user.id);

  return {
    user,
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
