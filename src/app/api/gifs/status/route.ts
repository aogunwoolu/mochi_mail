import { NextResponse } from "next/server";

export async function GET() {
  const provider = process.env.NEXT_PUBLIC_GIF_PROVIDER ?? "giphy";

  if (provider === "gifapi") {
    if (!process.env.GIFAPI_KEY) {
      return NextResponse.json({ ready: false, error: "missing_gifapi_key" });
    }
  } else {
    if (!process.env.GIPHY_API_KEY) {
      return NextResponse.json({ ready: false, error: "missing_giphy_key" });
    }
  }

  return NextResponse.json({ ready: true, provider });
}
