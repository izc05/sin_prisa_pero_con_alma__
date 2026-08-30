import { clearSessionCookie, json, privateFetch, safePayload, sessionToken } from "../_private.js";

export async function onRequestGet({ request, env }) {
  const token = sessionToken(request);
  if (!token) return json(401, { error: "Inicia sesión para ver tus pedidos" });
  try {
    const response = await privateFetch(env, "/api/sinprisa/my-orders", { method: "GET", headers: { Authorization: `Bearer ${token}` } });
    const payload = await safePayload(response);
    if (response.status === 401) return json(401, { error: "Tu sesión ha caducado" }, { "Set-Cookie": clearSessionCookie() });
    if (!response.ok) return json(502, { error: "No se pudieron cargar tus pedidos" });
    return json(200, { orders: Array.isArray(payload.orders) ? payload.orders : [] });
  } catch { return json(502, { error: "El servicio de pedidos no está disponible" }); }
}
