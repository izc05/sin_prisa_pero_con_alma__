import { json, privateFetch } from "./_private.js";

const IMAGE_ID = /^[a-z0-9]{15}$/;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function onRequestGet({ request, env }) {
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!IMAGE_ID.test(id)) return json(404, { error: "Imagen no encontrada" });

  let upstream;
  try {
    upstream = await privateFetch(env, `/api/sinprisa/catalog-image/${id}`, {
      method: "GET",
      headers: { Accept: "image/avif,image/webp,image/png,image/jpeg" }
    });
  } catch {
    return json(502, { error: "La imagen no está disponible" });
  }
  const contentType = String(upstream.headers.get("Content-Type") || "").split(";", 1)[0].toLowerCase();
  if (!upstream.ok || !ALLOWED_TYPES.has(contentType) || !upstream.body) {
    return json(upstream.status === 404 ? 404 : 502, { error: "La imagen no está disponible" });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=3600",
      "Content-Type": contentType,
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

export function onRequest() {
  return json(405, { error: "Método no permitido" });
}
