import { NextRequest, NextResponse } from "next/server";

// Only ever proxy image bytes from the GIF providers this app actually
// searches (Giphy / GifAPI CDNs) - never an arbitrary attacker-supplied host,
// otherwise this endpoint would be an open SSRF proxy.
const ALLOWED_HOST_SUFFIXES = [".giphy.com", "giphy.com", ".gifapi.io", "gifapi.io", ".tenor.com", "tenor.com"];

function isAllowedHost(hostname: string): boolean {
  return ALLOWED_HOST_SUFFIXES.some((suffix) => hostname === suffix || hostname.endsWith(suffix));
}

/** Streams a GIF/image from an allow-listed provider CDN back to the client
 *  same-origin. This exists so the browser can inline the bytes as a data URL
 *  before drawing them on a <canvas> - fetching the remote CDN URL directly
 *  with crossOrigin="anonymous" taints the canvas whenever that CDN doesn't
 *  send permissive CORS headers, which silently breaks letter export/send. */
export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get("url");
  if (!target) return NextResponse.json({ error: "Query parameter 'url' is required" }, { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  if (parsed.protocol !== "https:" || !isAllowedHost(parsed.hostname)) {
    return NextResponse.json({ error: "URL host is not an allowed GIF provider" }, { status: 400 });
  }

  try {
    const upstream = await fetch(parsed.toString());
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: `Upstream fetch failed: ${upstream.status}` }, { status: 502 });
    }
    const contentType = upstream.headers.get("content-type") ?? "image/gif";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "Upstream did not return an image" }, { status: 502 });
    }
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (err) {
    console.error("[gifs/proxy] fetch failed:", err);
    return NextResponse.json({ error: "Failed to fetch GIF" }, { status: 502 });
  }
}
