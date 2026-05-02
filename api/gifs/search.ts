import type { IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";

const GIF_PROVIDER = (process.env.GIF_PROVIDER ?? "giphy").toLowerCase();
const GIPHY_KEY = process.env.GIPHY_API_KEY ?? "";
const GIFAPI_KEY = process.env.GIFAPI_KEY ?? "";
const GIFAPI_BASE_URL = process.env.GIFAPI_BASE_URL ?? "https://api.gifapi.com/v1";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "GET") {
    res.writeHead(405, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  const reqUrl = new URL(req.url ?? "", `http://${req.headers.host}`);
  const q = reqUrl.searchParams.get("q")?.trim();

  if (!q) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Missing query" }));
    return;
  }

  try {
    let url: string;
    if (GIF_PROVIDER === "giphy") {
      if (!GIPHY_KEY) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "missing_giphy_key" }));
        return;
      }
      url = `https://api.giphy.com/v1/gifs/search?${new URLSearchParams({ api_key: GIPHY_KEY, q, limit: "18", rating: "pg" })}`;
    } else {
      if (!GIFAPI_KEY) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "missing_gifapi_key" }));
        return;
      }
      url = `${GIFAPI_BASE_URL}/gifs/search?${new URLSearchParams({ api_key: GIFAPI_KEY, q, limit: "18", rating: "pg" })}`;
    }

    type HttpResponse = { ok: boolean; json(): Promise<unknown> };
    const fetchRes = await (fetch(url) as unknown as Promise<HttpResponse>);
    if (!fetchRes.ok) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "search_failed" }));
      return;
    }

    const data = await fetchRes.json();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  } catch {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "search_failed" }));
  }
}
