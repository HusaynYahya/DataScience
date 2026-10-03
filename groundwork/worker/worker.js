// Optional Cloudflare Worker that holds the Anthropic API key for Groundwork,
// so the key never has to be pasted into a browser.
//
// Secrets / variables (set in the Cloudflare dashboard or with `wrangler secret put`):
//   ANTHROPIC_API_KEY  required: your Anthropic API key
//   ALLOWED_ORIGINS    optional: comma-separated origins, default https://falak1259.com
//   ACCESS_CODE        optional: visitors must enter this code in Groundwork's Claude tab
//
// The Origin check only stops other websites. Scripts can fake the Origin header,
// so set ACCESS_CODE and a spend limit on the key if the proxy URL might get out.

const MODEL = "claude-opus-5-5";
const MAX_TOKENS = 16000;

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGINS || "https://falak1259.com").split(",").map(s => s.trim());
    const cors = {
      "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0],
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin",
    };
    const fail = (status, message) => new Response(
      JSON.stringify({ type: "error", error: { type: "proxy_error", message } }),
      { status, headers: { ...cors, "content-type": "application/json" } },
    );

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/v1/messages") return fail(404, "Not found");
    if (!allowed.includes(origin)) return fail(403, "Origin not allowed");
    if (env.ACCESS_CODE && request.headers.get("x-groundwork-code") !== env.ACCESS_CODE) {
      return fail(401, "Wrong access code");
    }

    let body;
    try { body = await request.json(); } catch { return fail(400, "Invalid JSON"); }
    // Only allow the request shape Groundwork sends, so the proxy can't be used as a general API.
    body.model = MODEL;
    body.max_tokens = Math.min(Number(body.max_tokens) || 1024, MAX_TOKENS);
    delete body.stream;
    delete body.tools;

    const headers = {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": request.headers.get("anthropic-version") || "2023-06-01",
    };
    const beta = request.headers.get("anthropic-beta");
    if (beta) headers["anthropic-beta"] = beta;

    const upstream = await fetch("https://api.anthropic.com/v1/messages" + url.search, {
      method: "POST", headers, body: JSON.stringify(body),
    });
    const response = new Response(upstream.body, upstream);
    for (const [k, v] of Object.entries(cors)) response.headers.set(k, v);
    return response;
  },
};
