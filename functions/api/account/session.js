import { clearSessionCookie, json, privateFetch, safePayload, sessionCookie, sessionToken } from "../_private.js";

export async function onRequestGet({ request, env }) {
  const token = sessionToken(request);
  if (!token) return json(401, { authenticated: false });
  try {
    const response = await privateFetch(env, "/api/collections/sinprisa_customer_accounts/auth-refresh", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    });
    const payload = await safePayload(response);
    if (!response.ok || !payload.token) return json(401, { authenticated: false }, { "Set-Cookie": clearSessionCookie() });
    return json(200, { authenticated: true, user: { id: payload.record.id, name: payload.record.name, email: payload.record.email } }, { "Set-Cookie": sessionCookie(payload.token) });
  } catch {
    return json(502, { error: "No se pudo comprobar la sesión" });
  }
}

