import { NextRequest, NextResponse } from "next/server";

// Creates a forum post in the Discord support channel via a channel webhook.
// A webhook attached to a Forum channel creates a new post when `thread_name`
// is included in the payload. Attachments are uploaded to Supabase storage by
// the client; we post their public URLs as a follow-up message in the same
// thread so Discord renders inline previews (images and video players).

const CATEGORIES = {
  help: { label: "Help", emoji: "🌸", color: 0xf7a8c4, casePrefix: "HELP" },
  bug: { label: "Bug", emoji: "🐛", color: 0xe36767, casePrefix: "BUG" },
  feature: { label: "Feature idea", emoji: "✨", color: 0xb79ced, casePrefix: "FEAT" },
  other: { label: "Other", emoji: "💬", color: 0xa8c8f7, casePrefix: "MISC" },
} as const;

type Category = keyof typeof CATEGORIES;

const MAX_SUBJECT = 90;
const MAX_MESSAGE = 2000;
const MAX_CONTACT = 120;
const MAX_ATTACHMENTS = 6;
const THREAD_NAME_LIMIT = 100; // Discord hard limit

// Unambiguous alphabet (no 0/O, 1/I/L) so case numbers survive being read aloud.
const CASE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function generateCaseNumber(category: Category): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let suffix = "";
  for (const b of bytes) suffix += CASE_ALPHABET[b % CASE_ALPHABET.length];
  return `MM-${CATEGORIES[category].casePrefix}-${suffix}`;
}

// Best-effort in-memory rate limit (per server instance): 3 requests/minute per IP.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 3;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) return true;
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return false;
}

/** Only accept attachment URLs that live in our own support-attachments bucket,
 *  so the form can't be used to relay arbitrary links into the Discord server. */
function isOwnAttachmentUrl(url: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return false;
  return url.startsWith(`${base.replace(/\/$/, "")}/storage/v1/object/public/support-attachments/`);
}

export async function POST(req: NextRequest) {
  const webhookUrl = process.env.DISCORD_SUPPORT_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json({ error: "Support requests aren't configured yet." }, { status: 503 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "Too many requests — please wait a minute and try again." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { category, subject, message, contact, username, attachments } = (body ?? {}) as Record<string, unknown>;

  if (typeof category !== "string" || !(category in CATEGORIES)) {
    return NextResponse.json({ error: "Please pick a category." }, { status: 400 });
  }
  if (typeof subject !== "string" || !subject.trim()) {
    return NextResponse.json({ error: "Please add a short title." }, { status: 400 });
  }
  if (typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "Please describe your request." }, { status: 400 });
  }

  const attachmentUrls: string[] = [];
  if (attachments !== undefined) {
    if (!Array.isArray(attachments) || attachments.length > MAX_ATTACHMENTS) {
      return NextResponse.json({ error: "Too many attachments." }, { status: 400 });
    }
    for (const url of attachments) {
      if (typeof url !== "string" || !isOwnAttachmentUrl(url)) {
        return NextResponse.json({ error: "Invalid attachment." }, { status: 400 });
      }
      attachmentUrls.push(url);
    }
  }

  const cat = CATEGORIES[category as Category];
  const caseNumber = generateCaseNumber(category as Category);
  const cleanSubject = subject.trim().slice(0, MAX_SUBJECT);
  const cleanMessage = message.trim().slice(0, MAX_MESSAGE);
  const cleanContact = typeof contact === "string" ? contact.trim().slice(0, MAX_CONTACT) : "";
  const cleanUsername = typeof username === "string" ? username.trim().slice(0, 60) : "";

  const fields: { name: string; value: string; inline?: boolean }[] = [
    { name: "Case", value: caseNumber, inline: true },
    { name: "Category", value: `${cat.emoji} ${cat.label}`, inline: true },
  ];
  if (cleanUsername) fields.push({ name: "User", value: cleanUsername, inline: true });
  if (cleanContact) fields.push({ name: "Contact", value: cleanContact, inline: true });

  const threadName = `${cat.emoji} [${caseNumber}] ${cleanSubject}`.slice(0, THREAD_NAME_LIMIT);

  const res = await fetch(`${webhookUrl}?wait=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      thread_name: threadName,
      embeds: [
        {
          title: cleanSubject,
          description: cleanMessage, // embed descriptions render Discord markdown
          color: cat.color,
          fields,
          footer: { text: caseNumber },
          timestamp: new Date().toISOString(),
        },
      ],
      allowed_mentions: { parse: [] },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("Discord support webhook failed:", res.status, detail);
    return NextResponse.json({ error: "Couldn't send your request right now. Please try again later." }, { status: 502 });
  }

  // Post attachment links into the newly created thread. With ?wait=true the
  // response is the created message; for forum webhooks its channel_id is the
  // new thread's id.
  if (attachmentUrls.length > 0) {
    const created = (await res.json().catch(() => null)) as { channel_id?: string } | null;
    const threadId = created?.channel_id;
    if (threadId) {
      const followUp = await fetch(`${webhookUrl}?thread_id=${threadId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `📎 Attachments for **${caseNumber}**:\n${attachmentUrls.join("\n")}`,
          allowed_mentions: { parse: [] },
        }),
      });
      if (!followUp.ok) {
        console.error("Discord attachment follow-up failed:", followUp.status, await followUp.text().catch(() => ""));
        // The post itself succeeded — don't fail the whole request.
      }
    }
  }

  return NextResponse.json({ ok: true, caseNumber });
}
