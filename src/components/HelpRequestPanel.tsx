import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { commands } from "@uiw/react-md-editor";
import { useMochi } from "@/context/MochiContext";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { markFilePickerOpening } from "@/lib/filePickerGuard";
import { toast } from "@/lib/toast";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";

// The editor touches `document` at render time, so keep it client-only.
const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false });

// Only formatting that Discord actually renders in embeds — no images/tables.
const TOOLBAR = [
  commands.bold,
  commands.italic,
  commands.strikethrough,
  commands.divider,
  commands.link,
  commands.quote,
  commands.code,
  commands.codeBlock,
  commands.divider,
  commands.unorderedListCommand,
  commands.orderedListCommand,
];

const CATEGORIES = [
  { id: "help", label: "Get help", emoji: "🌸" },
  { id: "bug", label: "Report a bug", emoji: "🐛" },
  { id: "feature", label: "Feature idea", emoji: "✨" },
  { id: "other", label: "Other", emoji: "💬" },
] as const;

type Category = (typeof CATEGORIES)[number]["id"];

const MAX_FILES = 4;
const MAX_FILE_BYTES = 25 * 1024 * 1024; // matches the bucket's file_size_limit
const ACCEPTED_TYPES = /^(image|video)\//;

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-80) || "attachment";
}

export default function HelpRequestPanel({ defaultOpen = false }: Readonly<{ defaultOpen?: boolean }>) {
  const { account } = useMochi();
  const [open, setOpen] = useState(defaultOpen);
  const [category, setCategory] = useState<Category>("help");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [sentCase, setSentCase] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // When opened via the WIP banner, bring the form into view — it sits at the
  // bottom of the account panel's scroll area.
  useEffect(() => {
    if (defaultOpen) rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canSubmit = subject.trim().length > 0 && message.trim().length > 0 && !busy;

  const addFiles = (picked: FileList | null) => {
    if (!picked) return;
    const next = [...files];
    for (const file of Array.from(picked)) {
      if (next.length >= MAX_FILES) {
        toast(`Up to ${MAX_FILES} attachments per request.`, { variant: "error", icon: "warning" });
        break;
      }
      if (!ACCEPTED_TYPES.test(file.type)) {
        toast(`"${file.name}" isn't a photo or video.`, { variant: "error", icon: "warning" });
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        toast(`"${file.name}" is over 25 MB.`, { variant: "error", icon: "warning" });
        continue;
      }
      next.push(file);
    }
    setFiles(next);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadAttachments = async (): Promise<string[] | null> => {
    if (files.length === 0) return [];
    const supabase = createSupabaseBrowserClient();
    const folder = crypto.randomUUID();
    const urls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setStatus(`Uploading ${file.name} (${i + 1}/${files.length})…`);
      const path = `${folder}/${i}-${sanitizeFileName(file.name)}`;
      const { error } = await supabase.storage
        .from("support-attachments")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) {
        toast(`Couldn't upload "${file.name}". ${error.message}`, { variant: "error", icon: "warning" });
        return null;
      }
      urls.push(supabase.storage.from("support-attachments").getPublicUrl(path).data.publicUrl);
    }
    return urls;
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      const attachments = await uploadAttachments();
      if (attachments === null) return;

      setStatus("Sending your request…");
      const username = account.currentAccount?.username;
      const res = await fetch("/api/support/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          subject: subject.trim(),
          message: message.trim(),
          contact: contact.trim() || undefined,
          username: username ? `@${username}` : account.viewer.name || undefined,
          attachments,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast(json?.error ?? "Couldn't send your request. Please try again.", { variant: "error", icon: "warning" });
        return;
      }
      setSentCase(typeof json?.caseNumber === "string" ? json.caseNumber : "sent");
      setSubject("");
      setMessage("");
      setContact("");
      setFiles([]);
      toast("Request sent! Thank you 💌", { icon: "star" });
    } catch {
      toast("Couldn't send your request. Please check your connection.", { variant: "error", icon: "warning" });
    } finally {
      setBusy(false);
      setStatus("");
    }
  };

  const copyCaseNumber = async () => {
    if (!sentCase) return;
    try {
      await navigator.clipboard.writeText(sentCase);
      toast("Case number copied!", { icon: "star" });
    } catch {
      /* clipboard unavailable — the number is visible to copy manually */
    }
  };

  return (
    <div
      ref={rootRef}
      className="rounded-2xl border p-3"
      style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.7)" }}
    >
      <button
        onClick={() => setOpen((p) => !p)}
        className="btn-smooth flex w-full items-center justify-between text-left"
        aria-expanded={open}
      >
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--muted)" }}>
            ✉︎ Help &amp; Feedback
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--muted-strong)" }}>
            Stuck on something, found a bug, or have an idea? Tell us!
          </p>
        </div>
        <span className="shrink-0 text-xs" style={{ color: "var(--muted)" }}>
          {open ? "−" : "+"}
        </span>
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {sentCase ? (
            <div className="rounded-xl px-3 py-3 text-center" style={{ background: "var(--surface)" }}>
              <p className="text-sm font-semibold">Thank you! 💌</p>
              <p className="mt-1 text-xs" style={{ color: "var(--muted-strong)" }}>
                Your request is with us. If you left a way to reach you, we&apos;ll follow up.
              </p>
              {sentCase !== "sent" && (
                <button
                  onClick={() => void copyCaseNumber()}
                  className="btn-smooth mt-2 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-mono text-xs font-semibold"
                  style={{ background: "white", border: "1px solid var(--border-strong)" }}
                  title="Copy case number"
                >
                  {sentCase} <span aria-hidden>⧉</span>
                </button>
              )}
              <p className="mt-1.5 text-[10px]" style={{ color: "var(--muted)" }}>
                Keep this case number handy if you want to follow up.
              </p>
              <button
                onClick={() => setSentCase(null)}
                className="btn-smooth mt-2 block w-full rounded-xl px-3 py-1.5 text-xs font-semibold"
                style={{ background: "white", border: "1px solid var(--border)", color: "var(--foreground-soft)" }}
              >
                Send another
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCategory(c.id)}
                    className="btn-smooth rounded-xl px-2.5 py-1.5 text-[11px] font-semibold"
                    style={{
                      background: category === c.id ? "white" : "var(--surface)",
                      color: category === c.id ? "var(--foreground)" : "var(--muted)",
                      boxShadow: category === c.id ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
                      border: "1px solid " + (category === c.id ? "var(--border-strong)" : "transparent"),
                    }}
                  >
                    {c.emoji} {c.label}
                  </button>
                ))}
              </div>

              <div>
                <label htmlFor="help-subject" className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
                  Title
                </label>
                <input
                  id="help-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={90}
                  placeholder="A short summary"
                  className="input-soft w-full px-3 py-2 text-sm outline-none"
                />
              </div>

              <div>
                <label htmlFor="help-message" className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
                  Details
                </label>
                <div
                  data-color-mode="light"
                  className="overflow-hidden rounded-xl border"
                  style={{ borderColor: "var(--border)" }}
                >
                  <MDEditor
                    value={message}
                    onChange={(v) => setMessage((v ?? "").slice(0, 2000))}
                    preview="edit"
                    height={170}
                    visibleDragbar={false}
                    commands={TOOLBAR}
                    extraCommands={[commands.codeEdit, commands.codePreview]}
                    textareaProps={{
                      id: "help-message",
                      maxLength: 2000,
                      placeholder:
                        category === "bug"
                          ? "What happened, and what did you expect? Steps to reproduce help a lot!"
                          : category === "feature"
                          ? "What would you love Mochi to do?"
                          : "Tell us what's on your mind…",
                    }}
                    style={{ background: "transparent", boxShadow: "none" }}
                  />
                </div>
              </div>

              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
                  Photos &amp; videos <span className="normal-case tracking-normal">(optional, up to {MAX_FILES})</span>
                </p>
                {files.length > 0 && (
                  <ul className="mb-1.5 space-y-1">
                    {files.map((file, i) => (
                      <li
                        key={`${file.name}-${i}`}
                        className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs"
                        style={{ background: "var(--surface)" }}
                      >
                        <span aria-hidden>{file.type.startsWith("video/") ? "🎬" : "🖼️"}</span>
                        <span className="min-w-0 flex-1 truncate" style={{ color: "var(--foreground-soft)" }}>
                          {file.name}
                        </span>
                        <span className="shrink-0" style={{ color: "var(--muted)" }}>
                          {(file.size / (1024 * 1024)).toFixed(1)} MB
                        </span>
                        <button
                          onClick={() => setFiles(files.filter((_, j) => j !== i))}
                          className="btn-smooth shrink-0 px-1"
                          style={{ color: "var(--muted)" }}
                          aria-label={`Remove ${file.name}`}
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {files.length < MAX_FILES && (
                  <button
                    onClick={() => {
                      markFilePickerOpening();
                      fileInputRef.current?.click();
                    }}
                    className="btn-smooth w-full rounded-xl border border-dashed px-3 py-2 text-xs font-semibold"
                    style={{ borderColor: "var(--border-strong)", color: "var(--muted-strong)", background: "rgba(255,255,255,0.5)" }}
                  >
                    📎 Add a photo or video (max 25 MB each)
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={(e) => addFiles(e.target.files)}
                />
              </div>

              <div>
                <label htmlFor="help-contact" className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
                  Email or Discord <span className="normal-case tracking-normal">(optional, so we can reply)</span>
                </label>
                <input
                  id="help-contact"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  maxLength={120}
                  placeholder="you@example.com or @discordname"
                  className="input-soft w-full px-3 py-2 text-sm outline-none"
                />
              </div>

              <button
                onClick={() => void handleSubmit()}
                disabled={!canSubmit}
                className="btn-smooth btn-ripple w-full rounded-xl px-3 py-2.5 text-sm font-semibold text-white"
                style={{
                  background: "linear-gradient(135deg, var(--pink), var(--lavender))",
                  opacity: canSubmit ? 1 : 0.6,
                }}
              >
                {busy ? status || "Sending…" : "Send request"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
