import { json, privateFetch, safePayload, sameOrigin, sessionToken } from "../_private.js";

export async function onRequestPatch({ request, env }) {
  if (!sameOrigin(request)) return json(403, { error: "Origen no permitido" });
  const token = sessionToken(request);
  if (!token) return json(401, { error: "Inicia sesión para actualizar tus datos" });
  let body;
  try { body = await request.json(); } catch { return json(400, { error: "Datos no válidos" }); }
  const limits = { name: 120, phone: 32, address_line1: 160, address_line2: 160, postal_code: 16, city: 120, province: 120, country: 80 };
  const profile = {};
  for (const [field, max] of Object.entries(limits)) {
    const value = String(body[field] || "").trim().replace(/\s+/g, " ");
    if (value.length > max) return json(400, { error: "Revisa los datos del perfil" });
    profile[field] = value;
  }
  if (profile.name.length < 2) return json(400, { error: "Escribe tu nombre" });
  try {
    const response = await privateFetch(env, "/api/sinprisa/my-profile", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(profile)
    });
    const payload = await safePayload(response);
    if (response.status === 401) return json(401, { error: "Tu sesión ha caducado" });
    if (!response.ok) return json(502, { error: "No se pudieron guardar tus datos" });
    return json(200, { user: payload.user || null });
  } catch {
    return json(502, { error: "El servicio de cuentas no está disponible" });
  }
}
