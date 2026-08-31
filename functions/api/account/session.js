import { clearSessionCookie, json, privateFetch, safePayload, sessionCookie, sessionToken } from "../_private.js";

function userPayload(record = {}) {
  return { id: record.id, name: record.name, email: record.email, phone: record.phone || "", address_line1: record.address_line1 || "", address_line2: record.address_line2 || "", postal_code: record.postal_code || "", city: record.city || "", province: record.province || "", country: record.country || "" };
}

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
    return json(200, { authenticated: true, user: userPayload(payload.record) }, { "Set-Cookie": sessionCookie(payload.token) });
  } catch {
    return json(502, { error: "No se pudo comprobar la sesión" });
  }
}
