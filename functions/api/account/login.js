import { json, privateFetch, safePayload, sameOrigin, sessionCookie } from "../_private.js";

function userPayload(record = {}) {
  return { id: record.id, name: record.name, email: record.email, phone: record.phone || "", address_line1: record.address_line1 || "", address_line2: record.address_line2 || "", postal_code: record.postal_code || "", city: record.city || "", province: record.province || "", country: record.country || "" };
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json(403, { error: "Origen no permitido" });
  let body;
  try { body = await request.json(); } catch { return json(400, { error: "Datos no válidos" }); }
  try {
    const response = await privateFetch(env, "/api/collections/sinprisa_customer_accounts/auth-with-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity: String(body.email || "").trim().toLowerCase(), password: String(body.password || "") })
    });
    const payload = await safePayload(response);
    if (!response.ok || !payload.token) return json(401, { error: "Correo o contraseña incorrectos" });
    return json(200, { user: userPayload(payload.record) }, { "Set-Cookie": sessionCookie(payload.token) });
  } catch {
    return json(502, { error: "El servicio de cuentas no está disponible" });
  }
}
