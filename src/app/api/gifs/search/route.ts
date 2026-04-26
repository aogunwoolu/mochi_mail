import { NextRequest, NextResponse } from "next/server";

const GIF_PROVIDER = (process.env.NEXT_PUBLIC_GIF_PROVIDER ?? "giphy").toLowerCase();
const GIPHY_KEY = process.env.GIPHY_API_KEY ?? "";
const GIFAPI_KEY = process.env.NEXT_PUBLIC_GIFAPI_KEY ?? "";
const GIFAPI_BASE_URL = process.env.NEXT_PUBLIC_GIFAPI_BASE_URL ?? "https://api.gifapi.com/v1";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "Missing query" }, { status: 400 });

  try {
    let url: string;
    if (GIF_PROVIDER === "giphy") {
      if (!GIPHY_KEY) return NextResponse.json({ error: "missing_giphy_key" }, { status: 500 });
      url = `https://api.giphy.com/v1/gifs/search?${new URLSearchParams({ api_key: GIPHY_KEY, q, limit: "18", rating: "pg" })}`;
    } else {
      if (!GIFAPI_KEY) return NextResponse.json({ error: "missing_gifapi_key" }, { status: 500 });
      url = `${GIFAPI_BASE_URL}/gifs/search?${new URLSearchParams({ api_key: GIFAPI_KEY, q, limit: "18", rating: "pg" })}`;
    }

    const res = await fetch(url);
    if (!res.ok) return NextResponse.json({ error: "search_failed" }, { status: 502 });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "search_failed" }, { status: 500 });
  }
}
