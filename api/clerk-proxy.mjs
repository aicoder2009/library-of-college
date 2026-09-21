// Proxies the Clerk PRODUCTION Frontend API through https://liboc.vercel.app/__clerk.
// Needed because liboc.vercel.app is a vercel.app subdomain — we can't point a
// clerk.liboc.vercel.app CNAME at Clerk, so the prod instance runs in proxy mode
// (configured in the Clerk dashboard: Domains → app proxy). vercel.json rewrites
// /__clerk/:path* here with the FAPI path in the `path` query param.
// CLERK_SECRET_KEY (sk_live) is a Vercel project env var — never in the repo.

// Edge runtime: gives us the web-standard Request/Response signature (the Node
// runtime here invokes (req, res) style and body/header relaying gets murky).
export const config = { runtime: "edge" };

// Self-hosters set CLERK_PROXY_URL (Vercel env) to their own https://<host>/__clerk.
const PROXY_URL = process.env.CLERK_PROXY_URL || "https://liboc.vercel.app/__clerk";
const FAPI = "https://frontend-api.clerk.dev";

// Hop-by-hop / transport headers that must not be relayed in either direction.
// fetch() already decompressed the body, so forwarding content-encoding (or the
// original content-length) would corrupt the response.
const DROP = new Set(["host", "connection", "content-length", "content-encoding",
  "transfer-encoding", "accept-encoding", "keep-alive", "set-cookie"]);

export default async function handler(request) {
  // request.url is path-relative here, and the rewrite preserves the original
  // /__clerk/... pathname (the `path` query param it injects is redundant).
  const url = new URL(request.url, PROXY_URL);
  const path = url.pathname.replace(/^\/__clerk\/?/, "");
  url.searchParams.delete("path");
  const qs = url.searchParams.toString();

  const headers = new Headers();
  for (const [k, v] of request.headers) if (!DROP.has(k)) headers.set(k, v);
  headers.set("Clerk-Proxy-Url", PROXY_URL);
  headers.set("Clerk-Secret-Key", process.env.CLERK_SECRET_KEY || "");
  headers.set("X-Forwarded-For", request.headers.get("x-forwarded-for") || "");

  const r = await fetch(`${FAPI}/${path}${qs ? "?" + qs : ""}`, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD"
      ? undefined : await request.arrayBuffer(),
    redirect: "manual", // OAuth flows 302 — relay the redirect to the browser as-is
  });

  const out = new Headers();
  for (const [k, v] of r.headers) if (!DROP.has(k)) out.set(k, v);
  // Set-Cookie must be appended one header per cookie — Headers.get() merges
  // them into a single comma-joined value that browsers can't parse.
  for (const c of r.headers.getSetCookie?.() || []) out.append("set-cookie", c);
  return new Response(r.body, { status: r.status, headers: out });
}
