import assert from "node:assert/strict";
import { onRequestPost as register } from "../functions/api/account/register.js";
import { onRequestPost as login } from "../functions/api/account/login.js";
import { onRequestGet as session } from "../functions/api/account/session.js";
import { onRequestGet as customerCommissions } from "../functions/api/account/commissions.js";
import { onRequestPost as commission } from "../functions/api/commissions.js";

const env = {
  ORDER_INTAKE_URL: "https://private.example/api/sinprisa/order-requests",
  CF_ACCESS_CLIENT_ID: "client-id",
  CF_ACCESS_CLIENT_SECRET: "client-secret",
  ORDER_INTAKE_SECRET: "intake-secret"
};
const originalFetch = globalThis.fetch;
const calls = [];
globalThis.fetch = async (url, init) => {
  calls.push({ url, init });
  if (String(url).endsWith("/records")) return Response.json({ id: "account-1", name: "Ana", email: "ana@example.com" }, { status: 201 });
  if (String(url).endsWith("/auth-with-password") || String(url).endsWith("/auth-refresh")) {
    return Response.json({ token: "private-auth-token", record: { id: "account-1", name: "Ana", email: "ana@example.com" } });
  }
  if (String(url).endsWith("/api/sinprisa/commissions")) return Response.json({ reference: "ENC-TEST", images: 1 }, { status: 201 });
  if (String(url).endsWith("/api/sinprisa/my-commissions")) return Response.json({ commissions: [{ reference: "ENC-TEST", piece: "Babero", status: "new", quantity: 1 }] });
  return Response.json({}, { status: 404 });
};

try {
  const registerResponse = await register({
    env,
    request: new Request("https://sinprisa.example/api/account/register", {
      method: "POST",
      headers: { Origin: "https://sinprisa.example", "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Ana", email: "ana@example.com", password: "Una-clave-segura" })
    })
  });
  assert.equal(registerResponse.status, 201);
  assert.match(registerResponse.headers.get("Set-Cookie"), /HttpOnly; Secure; SameSite=Lax/);
  assert.equal(JSON.stringify(await registerResponse.json()).includes("private-auth-token"), false);

  const loginResponse = await login({
    env,
    request: new Request("https://sinprisa.example/api/account/login", {
      method: "POST",
      headers: { Origin: "https://sinprisa.example", "Content-Type": "application/json" },
      body: JSON.stringify({ email: "ana@example.com", password: "Una-clave-segura" })
    })
  });
  assert.equal(loginResponse.status, 200);

  const sessionResponse = await session({
    env,
    request: new Request("https://sinprisa.example/api/account/session", { headers: { Cookie: "sinprisa_customer_session=private-auth-token" } })
  });
  assert.equal(sessionResponse.status, 200);
  assert.deepEqual((await sessionResponse.json()).user, { id: "account-1", name: "Ana", email: "ana@example.com" });

  const form = new FormData();
  form.set("piece", "Bastidor");
  form.set("occasion", "Regalo");
  form.set("details", "Flores silvestres en tonos suaves");
  form.set("quantity", "2");
  form.set("product_reference", "bastidor-botanico");
  form.set("product_name", "Bastidor Botánico");
  form.append("images", new File([new Uint8Array([1, 2, 3])], "referencia.jpg", { type: "image/jpeg" }));
  const commissionResponse = await commission({
    env,
    request: new Request("https://sinprisa.example/api/commissions", {
      method: "POST",
      headers: { Origin: "https://sinprisa.example", Cookie: "sinprisa_customer_session=private-auth-token" },
      body: form
    })
  });
  assert.equal(commissionResponse.status, 201);
  assert.equal((await commissionResponse.json()).reference, "ENC-TEST");
  const forwarded = calls.find(call => String(call.url).endsWith("/api/sinprisa/commissions"));
  assert.equal(forwarded.init.headers.Authorization, "Bearer private-auth-token");
  assert.equal(forwarded.init.headers["CF-Access-Client-Secret"], "client-secret");
  const forwardedForm = forwarded.init.body;
  assert.equal(forwardedForm.get("product_reference"), "bastidor-botanico");
  assert.equal(forwardedForm.get("product_name"), "Bastidor Botánico");

  const commissionsResponse = await customerCommissions({
    env,
    request: new Request("https://sinprisa.example/api/account/commissions", { headers: { Cookie: "sinprisa_customer_session=private-auth-token" } })
  });
  assert.equal(commissionsResponse.status, 200);
  assert.equal((await commissionsResponse.json()).commissions[0].reference, "ENC-TEST");
  const historyRequest = calls.find(call => String(call.url).endsWith("/api/sinprisa/my-commissions"));
  assert.equal(historyRequest.init.headers.Authorization, "Bearer private-auth-token");

  const anonymous = await commission({
    env,
    request: new Request("https://sinprisa.example/api/commissions", { method: "POST", headers: { Origin: "https://sinprisa.example" }, body: new FormData() })
  });
  assert.equal(anonymous.status, 401);
} finally {
  globalThis.fetch = originalFetch;
}

console.log("Customer account and private commission behavior OK");
