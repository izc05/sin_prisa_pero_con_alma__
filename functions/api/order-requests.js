const MAX_BODY_BYTES = 16 * 1024;
const MAX_ITEMS = 20;
const PRODUCT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REQUEST_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function jsonResponse(status, payload) {
  return Response.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

async function readBoundedJson(request) {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_BODY_BYTES) throw new RangeError("La solicitud es demasiado grande");
  if (!request.body) throw new TypeError("Falta el cuerpo de la solicitud");

  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new RangeError("La solicitud es demasiado grande");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export function normalizeOrderRequest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Solicitud inválida");
  const customer = value.customer;
  if (!customer || typeof customer !== "object" || Array.isArray(customer)) throw new TypeError("Faltan los datos de contacto");

  const name = String(customer.name || "").trim().replace(/\s+/g, " ");
  const email = String(customer.email || "").trim().toLowerCase();
  if (name.length < 2 || name.length > 120) throw new TypeError("Revisa el nombre");
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) throw new TypeError("Revisa el correo electrónico");
  if (!Array.isArray(value.items) || value.items.length < 1 || value.items.length > MAX_ITEMS) {
    throw new TypeError("La cesta no es válida");
  }

  const quantities = new Map();
  for (const item of value.items) {
    const productId = String(item?.productId || "").trim();
    const quantity = Number(item?.quantity);
    if (!PRODUCT_ID_PATTERN.test(productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      throw new TypeError("La cesta contiene una línea inválida");
    }
    const mergedQuantity = (quantities.get(productId) || 0) + quantity;
    if (mergedQuantity > 20) throw new TypeError("La cantidad solicitada es demasiado alta");
    quantities.set(productId, mergedQuantity);
  }

  return {
    customer: { name, email },
    items: Array.from(quantities, ([productId, quantity]) => ({ productId, quantity }))
  };
}

function isSameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!isSameOrigin(request)) return jsonResponse(403, { error: "Origen no permitido" });
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return jsonResponse(415, { error: "Formato no permitido" });
  }

  const requestKey = String(request.headers.get("idempotency-key") || "").trim();
  if (!REQUEST_KEY_PATTERN.test(requestKey)) return jsonResponse(400, { error: "Solicitud no válida" });

  if (!env.ORDER_INTAKE_URL || !env.CF_ACCESS_CLIENT_ID || !env.CF_ACCESS_CLIENT_SECRET || !env.ORDER_INTAKE_SECRET) {
    console.error(JSON.stringify({ event: "order_intake_misconfigured" }));
    return jsonResponse(503, { error: "El servicio de pedidos no está disponible" });
  }

  let rawBody;
  let order;
  try {
    rawBody = await readBoundedJson(request);
    if (String(rawBody.website || "").trim()) return jsonResponse(202, { received: true });
    order = normalizeOrderRequest(rawBody);
  } catch (error) {
    const status = error instanceof RangeError ? 413 : 400;
    return jsonResponse(status, { error: error instanceof SyntaxError ? "JSON no válido" : error.message });
  }

  let upstream;
  try {
    upstream = await fetch(env.ORDER_INTAKE_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "CF-Access-Client-Id": env.CF_ACCESS_CLIENT_ID,
        "CF-Access-Client-Secret": env.CF_ACCESS_CLIENT_SECRET,
        "Idempotency-Key": requestKey,
        "X-Sinprisa-Intake-Secret": env.ORDER_INTAKE_SECRET
      },
      body: JSON.stringify(order)
    });
  } catch {
    console.error(JSON.stringify({ event: "order_intake_unreachable" }));
    return jsonResponse(502, { error: "No hemos podido registrar la solicitud" });
  }

  if (!upstream.ok) {
    console.error(JSON.stringify({ event: "order_intake_rejected", status: upstream.status }));
    return jsonResponse(upstream.status === 409 ? 409 : 502, {
      error: upstream.status === 409 ? "Alguna pieza ya no está disponible" : "No hemos podido registrar la solicitud"
    });
  }

  const result = await upstream.json();
  return jsonResponse(201, {
    orderNumber: String(result.orderNumber || ""),
    total: Number(result.total || 0),
    status: "received",
    paymentStatus: "pending"
  });
}

export function onRequest() {
  return jsonResponse(405, { error: "Método no permitido" });
}
