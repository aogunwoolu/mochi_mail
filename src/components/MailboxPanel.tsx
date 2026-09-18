
import React, { useEffect, useMemo, useState } from "react";
import { Letter } from "@/types";
import { FiCheck, FiCopy, FiEdit3, FiInbox, FiMail, FiSend } from "react-icons/fi";
import { toast } from "@/lib/toast";

interface MailboxPanelProps {
  inbox: Letter[];
  sent: Letter[];
  userId: string;
  /** The viewer's own username, shown so they know their "mail address" to
   *  give out to friends - without it, nobody knows how to reach them. */
  ownUsername?: string;
  isDelivered: (letter: Letter) => boolean;
  getDeliveryProgress: (letter: Letter) => number;
  getTimeRemaining: (letter: Letter) => string;
  markAsRead: (id: string) => void;
  onCompose: () => void;
}

type MailFilter = "all" | "inbox" | "sent";

// Cache decoded stamp images across renders/letters so we don't re-fetch the
// same stamp URL for every letter bubble in the timeline.
const stampImageCache = new Map<string, Promise<HTMLImageElement>>();
function loadCachedImage(src: string): Promise<HTMLImageElement> {
  let promise = stampImageCache.get(src);
  if (!promise) {
    promise = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("stamp image failed to load"));
      img.src = src;
    });
    stampImageCache.set(src, promise);
  }
  return promise;
}

/** Builds a placeholder envelope for letters that predate custom envelope
 *  art. Waits for the stamp image to actually finish loading (rather than
 *  racily checking `.complete` right after setting `src`, which is almost
 *  always false for remote URLs) before falling back to the emoji stamp. */
async function makeFallbackEnvelope(letter: Letter): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = 820;
  canvas.height = 520;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = "#fff4f8";
  ctx.beginPath();
  ctx.roundRect(40, 110, 740, 320, 28);
  ctx.fill();
  ctx.fillStyle = "#ffd9e6";
  ctx.beginPath();
  ctx.moveTo(60, 128);
  ctx.lineTo(410, 315);
  ctx.lineTo(760, 128);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.42)";
  ctx.beginPath();
  ctx.moveTo(60, 408);
  ctx.lineTo(410, 236);
  ctx.lineTo(760, 408);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.74)";
  ctx.beginPath();
  ctx.roundRect(180, 255, 380, 88, 22);
  ctx.fill();
  ctx.fillStyle = "#5f5168";
  ctx.textAlign = "center";
  ctx.font = '600 34px "Space Mono", monospace';
  ctx.fillText(letter.receiverName, canvas.width / 2, 312);
  ctx.textAlign = "start";

  let drewStamp = false;
  if (letter.stampImageData) {
    try {
      const stamp = await loadCachedImage(letter.stampImageData);
      ctx.drawImage(stamp, canvas.width - 222, 84, 126, 144);
      drewStamp = true;
    } catch {
      // fall through to the emoji placeholder below
    }
  }
  if (!drewStamp) {
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.beginPath();
    ctx.roundRect(canvas.width - 220, 84, 126, 144, 22);
    ctx.fill();
    ctx.font = "72px serif";
    ctx.fillStyle = "#ff6b9d";
    ctx.fillText(letter.stampStyle, canvas.width - 175, 182);
  }
  return canvas.toDataURL("image/png");
}

function EnvelopeThumbnail({ letter, className }: { letter: Letter; className?: string }) {
  const [src, setSrc] = useState<string>(letter.envelopeImageData ?? "");

  useEffect(() => {
    if (letter.envelopeImageData) {
      setSrc(letter.envelopeImageData);
      return;
    }
    let cancelled = false;
    void makeFallbackEnvelope(letter).then((dataUrl) => {
      if (!cancelled) setSrc(dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [letter]);

  if (!src) {
    return <div className={className} style={{ background: "rgba(255,255,255,0.5)" }} />;
  }
  return <img src={src} alt="Envelope" className={className} />;
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "just now";
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(ms).toLocaleDateString();
}

export default function MailboxPanel({
  inbox,
  sent,
  userId,
  ownUsername,
  isDelivered,
  getDeliveryProgress,
  getTimeRemaining,
  markAsRead,
  onCompose,
}: Readonly<MailboxPanelProps>) {
  const [viewLetter, setViewLetter] = useState<Letter | null>(null);
  const [opening, setOpening] = useState(false);
  const [filter, setFilter] = useState<MailFilter>("all");
  const [copied, setCopied] = useState(false);

  const timeline = useMemo(() => {
    const seen = new Set<string>();
    return [...inbox, ...sent]
      .filter((letter) => !seen.has(letter.id) && seen.add(letter.id))
      .sort((a, b) => a.sentAt - b.sentAt);
  }, [inbox, sent]);

  const isMine = (letter: Letter) => letter.senderId === userId;

  const visible = useMemo(() => {
    if (filter === "inbox") return timeline.filter((l) => !isMine(l));
    if (filter === "sent") return timeline.filter((l) => isMine(l));
    return timeline;
  }, [timeline, filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const unreadCount = useMemo(() => inbox.filter((l) => !l.read).length, [inbox]);

  useEffect(() => {
    if (!viewLetter) return;
    setOpening(true);
    const timeout = globalThis.setTimeout(() => setOpening(false), 950);
    return () => globalThis.clearTimeout(timeout);
  }, [viewLetter]);

  const copyAddress = () => {
    if (!ownUsername) return;
    void navigator.clipboard?.writeText(ownUsername).then(() => {
      setCopied(true);
      toast("Copied your mail address!", { icon: "sparkle" });
      globalThis.setTimeout(() => setCopied(false), 1600);
    });
  };

  if (viewLetter) {
    const mine = isMine(viewLetter);

    return (
      <div className="animate-fade-in flex flex-col p-4 sm:p-5">
        <div className="panel-soft flex shrink-0 items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <button onClick={() => setViewLetter(null)} className="btn-smooth rounded-lg px-3 py-1.5 text-xs" style={{ background: "var(--surface)", color: "var(--muted-strong)" }}>
            ← Back
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{mine ? `To ${viewLetter.receiverName}` : `From ${viewLetter.senderName}`}</div>
            <div className="text-xs" style={{ color: "var(--muted)" }}>
              {new Date(viewLetter.sentAt).toLocaleString()} · {viewLetter.envelopeName ?? "Envelope"} · {viewLetter.stampName ?? viewLetter.stampStyle}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center overflow-auto p-4" style={{ minHeight: 480 }}>
          <div className="relative w-full max-w-4xl overflow-hidden rounded-[32px] border bg-[rgba(255,255,255,0.72)] p-6" style={{ borderColor: "var(--border)" }}>
            <EnvelopeThumbnail letter={viewLetter} className={`mx-auto w-full max-w-3xl ${opening ? "animate-envelope-open" : ""}`} />
            <div className={`absolute inset-x-16 top-10 mx-auto max-w-2xl rounded-[26px] border bg-white p-4 shadow-2xl ${opening ? "animate-letter-reveal" : "opacity-100"}`} style={{ borderColor: "rgba(255, 184, 205, 0.45)" }}>
              <img src={viewLetter.imageData} alt="Letter" className="w-full rounded-[18px]" style={{ background: "white" }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="panel-soft m-4 mb-2 flex shrink-0 flex-col gap-3 px-4 py-3 sm:m-5 sm:mb-2" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold inline-flex items-center gap-1"><FiMail /> Letters</h2>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              {timeline.length === 0 ? "No letters yet" : `${timeline.length} letter${timeline.length !== 1 ? "s" : ""}`}
              {unreadCount > 0 ? ` · ${unreadCount} unread` : ""}
            </p>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full text-lg" style={{ background: "rgba(255,107,157,0.1)" }}>💌</div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1 rounded-2xl p-1" style={{ background: "var(--surface)" }}>
            {([
              { id: "all", label: "All" },
              { id: "inbox", label: "Inbox" },
              { id: "sent", label: "Sent" },
            ] as const).map((tab) => {
              const active = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id)}
                  className="btn-smooth rounded-xl px-3 py-1.5 text-xs font-semibold"
                  style={{ background: active ? "rgba(255,107,157,0.14)" : "transparent", color: active ? "var(--pink)" : "var(--muted)" }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          {ownUsername ? (
            <button
              onClick={copyAddress}
              className="btn-smooth inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
              style={{ background: "rgba(167,139,250,0.12)", color: "var(--lavender)", border: "1px solid rgba(167,139,250,0.22)" }}
              title="Copy your mail address to share with friends"
            >
              {copied ? <FiCheck /> : <FiCopy />}
              @{ownUsername}
            </button>
          ) : null}
        </div>
      </div>

      <div className="overflow-y-auto px-4 py-2 sm:px-5" style={{ display: "flex", flexDirection: "column", gap: "12px", minHeight: 200, maxHeight: 520 }}>
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full text-3xl" style={{ background: "rgba(255,107,157,0.08)" }}>
              {filter === "sent" ? <FiSend style={{ color: "var(--pink)" }} /> : <FiInbox style={{ color: "var(--pink)" }} />}
            </div>
            {timeline.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                No letters yet.
                <br />
                {ownUsername ? (
                  <>Share <span className="font-semibold" style={{ color: "var(--muted-strong)" }}>@{ownUsername}</span> with a friend so they can write to you!</>
                ) : (
                  "Write one below!"
                )}
              </p>
            ) : (
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                {filter === "sent" ? "You haven't sent anything yet." : "Nothing in your inbox yet."}
              </p>
            )}
          </div>
        ) : (
          visible.map((letter) => {
            const mine = isMine(letter);
            const delivered = isDelivered(letter);
            const progress = getDeliveryProgress(letter);
            const timeLeft = getTimeRemaining(letter);

            return (
              <div key={letter.id} className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : "flex-row"}`}>
                {!mine ? (
                  <div className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ background: "rgba(167,139,250,0.15)", color: "var(--lavender)", border: "1px solid rgba(167,139,250,0.25)" }}>
                    {letter.senderName.charAt(0).toUpperCase()}
                  </div>
                ) : null}

                <div className={`flex max-w-[78%] flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
                  <div className="px-1 text-[11px]" style={{ color: "var(--muted)" }}>
                    {mine ? `you → ${letter.receiverName}` : letter.senderName}
                  </div>

                  <div className={`overflow-hidden rounded-3xl ${mine ? "rounded-br-sm" : "rounded-bl-sm"}`} style={{ background: mine ? "rgba(255,107,157,0.08)" : "rgba(167,139,250,0.1)", border: `1px solid ${mine ? "rgba(255,107,157,0.22)" : "rgba(167,139,250,0.2)"}` }}>
                    {delivered ? (
                      <button
                        className="block w-full text-left btn-smooth"
                        onClick={() => {
                          if (!letter.read && !mine) {
                            markAsRead(letter.id);
                            toast("Letter marked as read", { icon: "mail" });
                          }
                          setViewLetter(letter);
                        }}
                      >
                        <EnvelopeThumbnail letter={letter} className="block max-h-52 w-full object-cover" />
                        <div className="flex items-center gap-2 px-3 py-2">
                          <span className="text-xs font-semibold" style={{ color: "var(--muted-strong)" }}>{letter.envelopeName ?? "Envelope"}</span>
                          <span className="text-xs" style={{ color: "var(--muted)" }}>{relativeTime(letter.sentAt)}</span>
                          {!letter.read && !mine ? <span className="ml-auto h-2 w-2 rounded-full" style={{ background: "var(--pink)" }} /> : null}
                        </div>
                      </button>
                    ) : (
                      <div className="px-4 py-3">
                        <div className="mb-2 flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
                          <span className="animate-float text-base">{letter.deliverySpeed === "express" ? "⚡" : letter.deliverySpeed === "standard" ? "✈️" : "🐌"}</span>
                          <span>In transit · {timeLeft}</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--surface-active)" }}>
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress * 100}%`, background: "linear-gradient(90deg, var(--pink), var(--lavender))" }} />
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

      <div className="shrink-0 px-4 py-3 sm:px-5" style={{ borderTop: "1px solid var(--border)" }}>
        <button onClick={onCompose} className="btn-smooth flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm" style={{ background: "rgba(255,107,157,0.08)", border: "1px solid rgba(255,107,157,0.2)", color: "var(--muted-strong)" }}>
          <span className="text-base inline-flex"><FiEdit3 /></span>
          <span>Write a new letter...</span>
          <span className="ml-auto rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ background: "linear-gradient(135deg, var(--pink), var(--lavender))" }}>
            Draw →
          </span>
        </button>
      </div>
    </div>
  );
}
