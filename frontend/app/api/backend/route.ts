const DEFAULT_API = "https://ai-interview-web-sy7e.onrender.com";
const allowedRequestHeaders = ["authorization", "content-type", "idempotency-key", "range"];
// Fetch transparently decompresses upstream bodies. Forwarding the upstream
// Content-Length after decompression can leave browsers waiting for bytes that
// will never arrive, so length is deliberately recalculated by the host.
const allowedResponseHeaders = ["content-type", "content-range", "accept-ranges", "content-disposition", "cache-control"];

async function proxy(request: Request) {
  const url = new URL(request.url); const path = url.searchParams.get("path");
  if (!path || !path.startsWith("/api/") && path !== "/health") return Response.json({ error: { code: "INVALID_PROXY_PATH", message: "A valid API path is required." } }, { status: 400 });
  const apiBase = (process.env.API_BASE_URL || DEFAULT_API).replace(/\/$/, "");
  const headers = new Headers();
  for (const name of allowedRequestHeaders) { const value = request.headers.get(name); if (value) headers.set(name, value); }
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();
  try {
    const upstream = await fetch(`${apiBase}${path}`, { method: request.method, headers, body, redirect: "manual", signal: AbortSignal.timeout(10 * 60 * 1000) });
    const responseHeaders = new Headers();
    for (const name of allowedResponseHeaders) { const value = upstream.headers.get(name); if (value) responseHeaders.set(name, value); }
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return Response.json({ error: { code: "API_UNAVAILABLE", message: "The interview service is waking up or temporarily unavailable. Please retry shortly." } }, { status: 503 });
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
