"use client";

import React, { useState, useMemo } from "react";
import { Letter } from "@/types";

interface MailboxProps {
  inbox: Letter[];
  sent: Letter[];
  userId: string;
  isDelivered: (letter: Letter) => boolean;
  getDeliveryProgress: (letter: Letter) => number;
  getTimeRemaining: (letter: Letter) => string;
  markAsRead: (id: string) => void;
  onCompose: () => void;
}

export default function Mailbox({
  inbox,
  sent,
  userId,
  isDelivered,
  getDeliveryProgress,
  getTimeRemaining,
  markAsRead,
  onCompose,
}: MailboxProps) {
  const [viewLetter, setViewLetter] = useState<Letter | null>(null);

  // Deduplicated chronological timeline of all letters
  const timeline = useMemo(() => {
    const seen = new Set<string>();
    return [...inbox, ...sent]
      .filter((l) => !seen.has(l.id) && seen.add(l.id))
      .sort((a, b) => a.sentAt - b.sentAt);
  }, [inbox, sent]);

  const isMine = (l: Letter) => l.senderId === userId;

  // Full-screen letter viewer
  if (viewLetter) {
    return (
      <div className="animate-fade-in flex h-full flex-col p-4 sm:p-5">
        <div
          className="panel-soft flex shrink-0 items-center gap-3 px-4 py-3"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <button
            onClick={() => setViewLetter(null)}
            className="btn-smooth rounded-lg px-3 py-1.5 text-xs"
            style={{ background: "var(--surface)", color: "var(--muted-strong)" }}
          >
            ← Back
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">
              {isMine(viewLetter)
                ? `To ${viewLetter.receiverName}`
                : `From ${viewLetter.senderName}`}
            </div>
            <div className="text-xs" style={{ color: "var(--muted)" }}>
              {new Date(viewLetter.sentAt).toLocaleString()} · {viewLetter.stampStyle}
            </div>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center overflow-auto p-4">
          <div
            className="panel w-full max-w-lg overflow-hidden rounded-2xl"
            style={{ border: "1px solid var(--border)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={viewLetter.imageData}
              alt="Letter"
              className="w-full"
              style={{ background: "white" }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Chat header */}
      <div
        className="panel-soft m-4 mb-2 flex shrink-0 items-center justify-between px-4 py-3 sm:m-5 sm:mb-2"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div>
          <h2 className="text-sm font-bold">Letters</h2>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            {timeline.length === 0
              ? "No letters yet"
              : `${timeline.length} letter${timeline.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full text-lg"
          style={{ background: "rgba(255,107,157,0.1)" }}>
          💌
        </div>
      </div>

      {/* Message timeline */}
      <div className="flex-1 overflow-y-auto px-4 py-2 sm:px-5" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {timeline.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="text-6xl opacity-20">💌</div>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              No letters yet.
              <br />
              Write one below!
            </p>
          </div>
        ) : (
          timeline.map((letter) => {
            const mine = isMine(letter);
            const delivered = isDelivered(letter);
            const progress = getDeliveryProgress(letter);
            const timeLeft = getTimeRemaining(letter);

            return (
              <div
                key={letter.id}
                className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : "flex-row"}`}
              >
                {/* Avatar — only for received messages */}
                {!mine && (
                  <div
                    className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                    style={{
                      background: "rgba(167,139,250,0.15)",
                      color: "var(--lavender)",
                      border: "1px solid rgba(167,139,250,0.25)",
                    }}
                  >
                    {letter.senderName.charAt(0).toUpperCase()}
                  </div>
                )}

                <div
                  className={`flex max-w-[72%] flex-col gap-1 ${mine ? "items-end" : "items-start"}`}
                >
                  {/* Name label */}
                  <div className="px-1 text-[11px]" style={{ color: "var(--muted)" }}>
                    {mine ? `you → ${letter.receiverName}` : letter.senderName}
                  </div>

                  {/* Bubble */}
                  <div
                    className={`overflow-hidden rounded-2xl ${mine ? "rounded-br-sm" : "rounded-bl-sm"}`}
                    style={{
                      background: mine
                        ? "rgba(255,107,157,0.12)"
                        : "rgba(167,139,250,0.1)",
                      border: `1px solid ${
                        mine
                          ? "rgba(255,107,157,0.25)"
                          : "rgba(167,139,250,0.2)"
                      }`,
                    }}
                  >
                    {delivered ? (
                      <button
                        className="block w-full text-left"
                        onClick={() => {
                          if (!letter.read && !mine) markAsRead(letter.id);
                          setViewLetter(letter);
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={letter.imageData}
                          alt="Letter"
                          className="block max-h-44 w-full object-cover"
                          style={{ background: "white" }}
                        />
                        <div className="flex items-center gap-2 px-3 py-2">
                          <span className="text-base">{letter.stampStyle}</span>
                          <span className="text-xs" style={{ color: "var(--muted)" }}>
                            {new Date(letter.sentAt).toLocaleDateString()}
                          </span>
                          {!letter.read && !mine && (
                            <span
                              className="ml-auto h-2 w-2 rounded-full"
                              style={{ background: "var(--pink)" }}
                            />
                          )}
                        </div>
                      </button>
                    ) : (
                      <div className="px-4 py-3">
                        <div
                          className="mb-2 flex items-center gap-2 text-xs"
                          style={{ color: "var(--muted)" }}
                        >
                          <span className="animate-float text-base">
                            {letter.deliverySpeed === "express"
                              ? "⚡"
                              : letter.deliverySpeed === "standard"
                              ? "✈️"
                              : "🐌"}
                          </span>
                          <span>In transit · {timeLeft}</span>
                        </div>
                        <div
                          className="h-1.5 w-40 overflow-hidden rounded-full"
                          style={{ background: "var(--surface-active)" }}
                        >
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${progress * 100}%`,
                              background:
                                "linear-gradient(90deg, var(--pink), var(--lavender))",
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Compose action bar */}
      <div
        className="shrink-0 px-4 py-3 sm:px-5"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <button
          onClick={onCompose}
          className="btn-smooth flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm"
          style={{
            background: "rgba(255,107,157,0.08)",
            border: "1px solid rgba(255,107,157,0.2)",
            color: "var(--muted-strong)",
          }}
        >
          <span className="text-base">✍️</span>
          <span>Write a new letter...</span>
          <span
            className="ml-auto rounded-full px-3 py-1 text-xs font-semibold text-white"
            style={{ background: "linear-gradient(135deg, var(--pink), var(--lavender))" }}
          >
            Draw →
          </span>
        </button>
      </div>
    </div>
  );
}
