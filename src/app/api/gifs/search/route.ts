import { NextRequest, NextResponse } from "next/server";

const GIPHY_BASE = "https://api.giphy.com/v1/gifs/search";
const GIFAPI_BASE = "https://api.gifapi.io/v1/search";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "missing_query" }, { status: 400 });

  const provider = process.env.NEXT_PUBLIC_GIF_PROVIDER ?? "giphy";

  if (provider === "gifapi") {
    const key = process.env.GIFAPI_KEY;
    if (!key) return NextResponse.json({ error: "missing_gifapi_key" }, { status: 503 });
    const url = `${GIFAPI_BASE}?q=${encodeURIComponent(q)}&limit=18&api_key=${key}`;
    const res = await fetch(url);
    const json = await res.json();
    if (!res.ok) return NextResponse.json({ error: "search_failed" }, { status: 502 });
    return NextResponse.json(json);
  }

  // default: giphy
  const key = process.env.GIPHY_API_KEY;
  if (!key) return NextResponse.json({ error: "missing_giphy_key" }, { status: 503 });
  const url = `${GIPHY_BASE}?q=${encodeURIComponent(q)}&limit=18&rating=g&lang=en&api_key=${key}`;
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) return NextResponse.json({ error: "search_failed" }, { status: 502 });
  return NextResponse.json(json);
}
