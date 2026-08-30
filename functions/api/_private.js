const SESSION_COOKIE = "sinprisa_customer_session";

function privateOrigin(env) {
  if (!env.ORDER_INTAKE_URL) throw new Error("Falta la URL privada");
  return new URL(env.ORDER_INTAKE_URL).origin;
}

export function json(status, payload, headers = {}) {
  return Response.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
      "X-Content-Type-Options": "nosniff",
      ...headers
    }
  });
}

export function sameOrigin(request) {
  try {
    return new URL(request.headers.get("Origin") || "").host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export function sessionToken(request) {
  const cookies = request.headers.get("Cookie") || "";
  for (const part of cookies.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === SESSION_COOKIE) return decodeURIComponent(value.join("="));
  }
  return "";
}

export function sessionCookie(token) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export async function privateFetch(env, path, init = {}) {
  if (!env.CF_ACCESS_CLIENT_ID || !env.CF_ACCESS_CLIENT_SECRET || !env.ORDER_INTAKE_SECRET) {
    throw new Error("La API privada no está configurada");
  }
  return fetch(`${privateOrigin(env)}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "CF-Access-Client-Id": env.CF_ACCESS_CLIENT_ID,
      "CF-Access-Client-Secret": env.CF_ACCESS_CLIENT_SECRET,
      "X-Sinprisa-Intake-Secret": env.ORDER_INTAKE_SECRET,
      ...(init.headers || {})
    }
  });
}

export async function safePayload(response) {
  try { return await response.json(); }
  catch { return {}; }
}

