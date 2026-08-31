import { json, privateFetch, safePayload } from "./_private.js";

export async function onRequestGet({ env }) {
  let upstream;
  try {
    upstream = await privateFetch(env, "/api/sinprisa/catalog", { method: "GET" });
  } catch {
    return json(502, { error: "El catálogo no está disponible" });
  }
  if (!upstream.ok) return json(502, { error: "El catálogo no está disponible" });

  const payload = await safePayload(upstream);
  return json(200, {
    collections: Array.isArray(payload.collections) ? payload.collections : [],
    products: Array.isArray(payload.products) ? payload.products : [],
    content: Array.isArray(payload.content) ? payload.content : []
  }, { "Cache-Control": "public, max-age=30, s-maxage=60" });
}

export function onRequest() {
  return json(405, { error: "Método no permitido" });
}
