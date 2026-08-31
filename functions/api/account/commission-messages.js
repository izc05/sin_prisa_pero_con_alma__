import { json, privateFetch, safePayload, sameOrigin, sessionToken } from "../_private.js";

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json(403, { error: "Origen no permitido" });
  const token = sessionToken(request);
  if (!token) return json(401, { error: "Inicia sesión para responder" });
  let body;
  try { body = await request.json(); } catch { return json(400, { error: "Mensaje no válido" }); }
  const commission = String(body.commission || "").trim();
  const message = String(body.message || "").trim();
  if (!/^[a-z0-9]{15}$/.test(commission) || !message || message.length > 4000) return json(400, { error: "Revisa el mensaje antes de enviarlo" });
  try {
    const response = await privateFetch(env, "/api/sinprisa/commission-messages", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ commission, message })
    });
    const payload = await safePayload(response);
    if (response.status === 401 || response.status === 404) return json(403, { error: "No tienes acceso a este encargo" });
    if (!response.ok) return json(502, { error: "No se pudo enviar tu mensaje" });
    return json(201, { message: payload.message || null });
  } catch {
    return json(502, { error: "El servicio de encargos no está disponible" });
  }
}

export async function onRequestDelete({ request, env }) {
  if (!sameOrigin(request)) return json(403, { error: "Origen no permitido" });
  const token = sessionToken(request);
  if (!token) return json(401, { error: "Inicia sesión para gestionar tus mensajes" });
  let body;
  try { body = await request.json(); } catch { return json(400, { error: "Conversación no válida" }); }
  const commission = String(body.commission || "").trim();
  if (!/^[a-z0-9]{15}$/.test(commission)) return json(400, { error: "Conversación no válida" });
  try {
    const response = await privateFetch(env, "/api/sinprisa/commission-messages", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ commission })
    });
    if (response.status === 401 || response.status === 404) return json(403, { error: "No tienes acceso a este encargo" });
    if (!response.ok) return json(502, { error: "No se pudo eliminar la conversación" });
    return json(200, { cleared: true });
  } catch {
    return json(502, { error: "El servicio de encargos no está disponible" });
  }
}
