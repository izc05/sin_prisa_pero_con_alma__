import { json, privateFetch, safePayload, sameOrigin, sessionCookie } from "../_private.js";

function userPayload(record = {}) {
  return { id: record.id, name: record.name, email: record.email, phone: record.phone || "", address_line1: record.address_line1 || "", address_line2: record.address_line2 || "", postal_code: record.postal_code || "", city: record.city || "", province: record.province || "", country: record.country || "" };
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json(403, { error: "Origen no permitido" });
  let body;
  try { body = await request.json(); } catch { return json(400, { error: "Datos no válidos" }); }
  const name = String(body.name || "").trim().replace(/\s+/g, " ");
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (name.length < 2 || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 10 || password.length > 128) {
    return json(400, { error: "Revisa el nombre, correo y contraseña (mínimo 10 caracteres)" });
  }
  try {
    const created = await privateFetch(env, "/api/collections/sinprisa_customer_accounts/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, passwordConfirm: password })
    });
    if (!created.ok) return json(created.status === 400 ? 409 : 502, { error: created.status === 400 ? "No se pudo crear la cuenta; quizá ese correo ya está registrado" : "No se pudo crear la cuenta" });
    const auth = await privateFetch(env, "/api/collections/sinprisa_customer_accounts/auth-with-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identity: email, password })
    });
    const payload = await safePayload(auth);
    if (!auth.ok || !payload.token) return json(502, { error: "Cuenta creada, pero no se pudo iniciar la sesión" });
    return json(201, { user: userPayload(payload.record) }, { "Set-Cookie": sessionCookie(payload.token) });
  } catch {
    return json(502, { error: "El servicio de cuentas no está disponible" });
  }
}
