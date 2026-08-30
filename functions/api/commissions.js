import { json, privateFetch, safePayload, sameOrigin, sessionToken } from "./_private.js";

const ALLOWED_IMAGES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json(403, { error: "Origen no permitido" });
  const token = sessionToken(request);
  if (!token) return json(401, { error: "Inicia sesión para enviar un encargo" });
  let form;
  try { form = await request.formData(); } catch { return json(400, { error: "Formulario no válido" }); }
  const idea = String(form.get("details") || "").trim();
  const piece = String(form.get("piece") || "").trim();
  const occasion = String(form.get("occasion") || "").trim();
  const quantity = Math.max(1, Math.min(20, Number(form.get("quantity") || 1)));
  const images = form.getAll("images").filter(value => typeof value !== "string" && value.size);
  if (idea.length < 10 || idea.length > 4000 || piece.length < 2 || piece.length > 120 || occasion.length > 200 || !Number.isInteger(quantity)) {
    return json(400, { error: "Revisa los datos del encargo" });
  }
  if (images.length > 4 || images.some(file => file.size > 4 * 1024 * 1024 || !ALLOWED_IMAGES.has(file.type))) {
    return json(400, { error: "Puedes adjuntar hasta 4 imágenes JPG, PNG o WebP de 4 MB" });
  }
  const outbound = new FormData();
  outbound.set("piece", piece);
  outbound.set("occasion", occasion);
  outbound.set("details", idea);
  outbound.set("quantity", String(quantity));
  for (const file of images) outbound.append("images", file, file.name);
  try {
    const response = await privateFetch(env, "/api/sinprisa/commissions", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: outbound
    });
    const payload = await safePayload(response);
    if (response.status === 401) return json(401, { error: "Tu sesión ha caducado; vuelve a entrar" });
    if (!response.ok) return json(502, { error: "No se pudo registrar el encargo" });
    return json(201, { reference: payload.reference, status: "received", images: Number(payload.images || 0) });
  } catch {
    return json(502, { error: "El servicio de encargos no está disponible" });
  }
}

