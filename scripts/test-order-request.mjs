import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeOrderRequest, onRequestPost } from "../functions/api/order-requests.js";

const validRequest = {
  customer: { name: "  Ana   López ", email: " ANA@example.com " },
  items: [
    { productId: "babero-danna", quantity: 1 },
    { productId: "babero-danna", quantity: 2 },
    { productId: "bolsa-jardin", quantity: 1 }
  ]
};

assert.deepEqual(normalizeOrderRequest(validRequest), {
  customer: { name: "Ana López", email: "ana@example.com" },
  items: [
    { productId: "babero-danna", quantity: 3 },
    { productId: "bolsa-jardin", quantity: 1 }
  ]
});
assert.throws(() => normalizeOrderRequest({ customer: { name: "A", email: "no" }, items: [] }));
assert.throws(() => normalizeOrderRequest({ customer: { name: "Ana", email: "ana@example.com" }, items: [{ productId: "../admin", quantity: 1 }] }));

const originalFetch = globalThis.fetch;
let forwarded;
globalThis.fetch = async (url, init) => {
  forwarded = { url, init };
  return Response.json({ orderNumber: "SOL-20260829-ABC123", total: 106 }, { status: 201 });
};

try {
  const request = new Request("https://sinprisa.example/api/order-requests", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://sinprisa.example",
      "Idempotency-Key": "4c41d456-78ab-4d90-8c15-123456789abc"
    },
    body: JSON.stringify(validRequest)
  });
  const response = await onRequestPost({
    request,
    env: {
      ORDER_INTAKE_URL: "https://private.example/api/sinprisa/order-requests",
      CF_ACCESS_CLIENT_ID: "runtime-client-id",
      CF_ACCESS_CLIENT_SECRET: "runtime-client-secret",
      ORDER_INTAKE_SECRET: "runtime-intake-secret"
    }
  });
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), {
    orderNumber: "SOL-20260829-ABC123",
    total: 106,
    status: "received",
    paymentStatus: "pending"
  });
  assert.equal(forwarded.url, "https://private.example/api/sinprisa/order-requests");
  assert.equal(forwarded.init.headers["CF-Access-Client-Secret"], "runtime-client-secret");
  assert.equal(forwarded.init.headers["X-Sinprisa-Intake-Secret"], "runtime-intake-secret");
  assert.deepEqual(JSON.parse(forwarded.init.body), normalizeOrderRequest(validRequest));

  const wrongOrigin = await onRequestPost({
    request: new Request("https://sinprisa.example/api/order-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://attacker.example", "Idempotency-Key": "4c41d456-78ab-4d90-8c15-123456789abc" },
      body: JSON.stringify(validRequest)
    }),
    env: {}
  });
  assert.equal(wrongOrigin.status, 403);
} finally {
  globalThis.fetch = originalFetch;
}

const publicSource = readFileSync(new URL("../site-v2.js", import.meta.url), "utf8");
const functionSource = readFileSync(new URL("../functions/api/order-requests.js", import.meta.url), "utf8");
assert.equal(publicSource.includes("/api/order-requests"), true);
assert.equal(/pocketbase|CF_ACCESS_CLIENT_SECRET|ORDER_INTAKE_SECRET/i.test(publicSource), false);
assert.equal(functionSource.includes("CF-Access-Client-Secret"), true);

console.log("Private order request behavior OK");
