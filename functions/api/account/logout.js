import { clearSessionCookie, json, sameOrigin } from "../_private.js";

export function onRequestPost({ request }) {
  if (!sameOrigin(request)) return json(403, { error: "Origen no permitido" });
  return json(200, { authenticated: false }, { "Set-Cookie": clearSessionCookie() });
}

