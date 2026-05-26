import { NextResponse } from "next/server";

export async function GET() {
  const provider = process.env.NEXT_PUBLIC_GIF_PROVIDER ?? "giphy";

  if (provider === "gifapi") {
    if (!process.env.GIFAPI_KEY) {
      return NextResponse.json({ ready: false, error: "GifAPI key not configured in environment variables" });
    }
  } else {
    if (!process.env.GIPHY_API_KEY) {
      return NextResponse.json({ ready: false, error: "Giphy API key not configured in environment variables" });
    }
  }

  return NextResponse.json({ ready: true, provider });
}
