/**
 * Same-origin proxy so the Vercel site can keep calling /api.
 * The browser cookie is first-party on the Vercel host. Supabase still receives it.
 *
 * Nested paths are rewritten here because a non-Next.js project only routes
 * one segment under /api. vercel.json sends /api/* to this function and keeps
 * the original path in ?path= when the URL is rewritten.
 *
 * Vercel project env (server only):
 *   SUPABASE_FUNCTIONS_URL=https://<project-ref>.supabase.co/functions/v1
 *   SUPABASE_ANON_KEY=<anon or publishable key>
 */

export function incomingPath(url) {
  const parsed = new URL(url);
  const rewritten = parsed.pathname === "/api/index" || parsed.pathname === "/api/index.mjs";
  if (rewritten && parsed.searchParams.has("path")) {
    const rest = String(parsed.searchParams.get("path") || "").replace(/^\/+/, "");
    const params = new URLSearchParams(parsed.searchParams);
    params.delete("path");
    const search = params.toString();
    return `/api${rest ? `/${rest}` : ""}${search ? `?${search}` : ""}`;
  }
  const { pathname, search } = parsed;
  if (pathname === "/api" || pathname.startsWith("/api/")) return `${pathname}${search}`;
  return `/api${pathname}${search}`;
}

export default {
  async fetch(request) {
    const base = String(process.env.SUPABASE_FUNCTIONS_URL || "").replace(/\/$/, "");
    const anon = process.env.SUPABASE_ANON_KEY || "";
    if (!base || !anon) {
      return Response.json({ detail: "Supabase proxy is not configured" }, { status: 500 });
    }

    const headers = new Headers();
    const cookie = request.headers.get("cookie");
    if (cookie) headers.set("cookie", cookie);
    const contentType = request.headers.get("content-type");
    if (contentType) headers.set("content-type", contentType);
    const webhook = request.headers.get("x-webhook-id");
    if (webhook) headers.set("x-webhook-id", webhook);
    headers.set("apikey", anon);
    headers.set("authorization", `Bearer ${anon}`);

    const init = { method: request.method, headers, redirect: "manual" };
    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = await request.arrayBuffer();
    }

    let upstream;
    try {
      upstream = await fetch(`${base}${incomingPath(request.url)}`, init);
    } catch {
      return Response.json({ detail: "Supabase function is unavailable" }, { status: 502 });
    }

    const outHeaders = new Headers();
    const upstreamType = upstream.headers.get("content-type");
    if (upstreamType) outHeaders.set("content-type", upstreamType);
    const disposition = upstream.headers.get("content-disposition");
    if (disposition) outHeaders.set("content-disposition", disposition);
    const cookies = typeof upstream.headers.getSetCookie === "function" ? upstream.headers.getSetCookie() : [];
    if (cookies.length) {
      for (const value of cookies) outHeaders.append("set-cookie", value);
    } else {
      const single = upstream.headers.get("set-cookie");
      if (single) outHeaders.append("set-cookie", single);
    }
    return new Response(await upstream.arrayBuffer(), { status: upstream.status, headers: outHeaders });
  },
};
