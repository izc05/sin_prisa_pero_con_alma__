import { clearSessionCookie, json, privateFetch, safePayload, sessionToken } from "../_private.js";

export async function onRequestGet({ request, env }) {
  const token = sessionToken(request);
  if (!token) return json(401, { error: "Inicia sesión para ver tus encargos" });
  try {
    const response = await privateFetch(env, "/api/sinprisa/my-commissions", {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` }
    });
    const payload = await safePayload(response);
    if (response.status === 401) return json(401, { error: "Tu sesión ha caducado" }, { "Set-Cookie": clearSessionCookie() });
    if (!response.ok) return json(502, { error: "No se pudieron cargar tus encargos" });
    const commissions = Array.isArray(payload.commissions) ? payload.commissions : [];
    return json(200, { commissions });
  } catch {
    return json(502, { error: "El servicio de encargos no está disponible" });
  }
}
