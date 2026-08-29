import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

function jsonResponse(payload, status = 200) {
  return new Response(payload == null ? null : JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

const source = readFileSync(new URL("../admin-data.js", import.meta.url), "utf8");
const controllerSource = readFileSync(new URL("../admin-v2-page.js", import.meta.url), "utf8");
const window = { localStorage: null };
const context = vm.createContext({
  window,
  console,
  structuredClone,
  URL,
  URLSearchParams,
  FormData,
  Blob,
  TextEncoder,
  Uint8Array,
  atob
});
vm.runInContext(source, context, { filename: "admin-data.js" });

assert.equal(typeof window.AlmaAdminData.createLocalDriver, "function");
assert.equal(typeof window.AlmaAdminData.createPocketBaseDriver, "function");

let unauthenticatedFetches = 0;
const missingAuth = window.AlmaAdminData.createPocketBaseDriver({
  url: "https://pocketbase.invalid",
  token: "",
  fetch: async () => {
    unauthenticatedFetches += 1;
    return jsonResponse({});
  }
});
await assert.rejects(missingAuth.listProducts(), error => {
  assert.equal(error.name, "PocketBaseAuthError");
  assert.equal(error.status, 401);
  return true;
});
assert.equal(unauthenticatedFetches, 0);

const unauthorized = window.AlmaAdminData.createPocketBaseDriver({
  url: "https://pocketbase.invalid",
  token: () => "expired-runtime-value",
  fetch: async () => jsonResponse({ message: "unauthorized" }, 401)
});
await assert.rejects(unauthorized.listCollections(), error => {
  assert.equal(error.name, "PocketBaseAuthError");
  assert.equal(error.status, 401);
  return true;
});

const products = [
  {
    id: "product-number",
    name: "Babero",
    slug: "babero",
    collection: "collection-one",
    short_description: "Lino",
    description: "Hecho a mano",
    price: 28.5,
    price_mode: "fixed",
    status: "published",
    stock_mode: "available",
    featured: true,
    sort_order: 1,
    published_at: "2026-08-29 10:00:00.000Z",
    created: "2026-08-29 09:00:00.000Z",
    updated: "2026-08-29 09:00:00.000Z"
  },
  {
    id: "product-null",
    name: "Encargo",
    slug: "encargo",
    collection: "collection-one",
    short_description: "",
    description: "A medida",
    price: null,
    price_mode: "quote",
    status: "draft",
    stock_mode: "made_to_order",
    featured: false,
    sort_order: 2,
    published_at: "",
    created: "2026-08-29 09:00:00.000Z",
    updated: "2026-08-29 09:00:00.000Z"
  }
];
let images = [
  {
    id: "image-existing",
    product: "product-number",
    original: "babero_abc123.png",
    alt_text: "Detalle",
    sort_order: 0,
    is_cover: true,
    created: "2026-08-29 09:00:00.000Z"
  }
];
const collections = [{
  id: "collection-one",
  name: "Bebé",
  slug: "bebe",
  description: "",
  status: "published",
  sort_order: 0
}];
const requests = [];

function list(items) {
  return { page: 1, perPage: 500, totalItems: items.length, totalPages: 1, items };
}

async function mockFetch(input, init) {
  const url = new URL(input);
  const path = url.pathname;
  const method = init.method || "GET";
  assert.equal(init.headers.Authorization, "Bearer runtime-auth-value");
  requests.push({ path, search: url.search, method, body: init.body });

  if (path === "/api/collections/sinprisa_products/records" && method === "GET") {
    return jsonResponse(list(products));
  }
  if (path.startsWith("/api/collections/sinprisa_products/records/") && method === "GET") {
    const id = path.split("/").at(-1);
    const product = products.find(item => item.id === id);
    return product ? jsonResponse(product) : jsonResponse({}, 404);
  }
  if (path.startsWith("/api/collections/sinprisa_products/records/") && method === "PATCH") {
    const id = path.split("/").at(-1);
    const product = products.find(item => item.id === id);
    Object.assign(product, JSON.parse(init.body), { updated: "2026-08-29 11:00:00.000Z" });
    return jsonResponse(product);
  }
  if (path === "/api/collections/sinprisa_product_images/records" && method === "GET") {
    return jsonResponse(list(images));
  }
  if (path === "/api/collections/sinprisa_product_images/records" && method === "POST") {
    assert.ok(init.body instanceof FormData);
    assert.ok(init.body.get("original") instanceof Blob);
    assert.equal(init.body.get("product"), "product-number");
    assert.equal(init.body.get("is_cover"), "true");
    const created = {
      id: "image-uploaded",
      product: init.body.get("product"),
      original: init.body.get("original").name,
      alt_text: init.body.get("alt_text"),
      sort_order: Number(init.body.get("sort_order")),
      is_cover: init.body.get("is_cover") === "true"
    };
    images.push(created);
    return jsonResponse(created);
  }
  if (path.startsWith("/api/collections/sinprisa_product_images/records/") && method === "PATCH") {
    const id = path.split("/").at(-1);
    const image = images.find(item => item.id === id);
    const patch = init.body instanceof FormData
      ? Object.fromEntries(init.body.entries())
      : JSON.parse(init.body);
    Object.assign(image, patch, {
      sort_order: Number(patch.sort_order),
      is_cover: String(patch.is_cover) === "true"
    });
    return jsonResponse(image);
  }
  if (path === "/api/collections/sinprisa_collections/records" && method === "GET") {
    return jsonResponse(list(collections));
  }
  if (path === "/api/collections/sinprisa_orders/records" && method === "GET") {
    return jsonResponse(list([{ id: "order-one", number: "SP-1", customer: "customer-one", status: "pending", payment_status: "pending", subtotal: 20, shipping: 3, total: 23, internal_notes: "" }]));
  }
  if (path === "/api/collections/sinprisa_order_items/records" && method === "GET") {
    return jsonResponse(list([{ id: "item-one", order: "order-one", product: "product-number", product_name_snapshot: "Babero", quantity: 1, unit_price: 20, customization: "" }]));
  }
  if (path === "/api/collections/sinprisa_messages/records" && method === "GET") {
    return jsonResponse(list([{ id: "message-one", name: "Cliente", email: "client@example.invalid", subject: "Consulta", body: "Texto", status: "new" }]));
  }
  return jsonResponse({ message: "not mocked" }, 500);
}

const driver = window.AlmaAdminData.createPocketBaseDriver({
  url: "https://pocketbase.invalid/",
  token: () => "runtime-auth-value",
  fetch: mockFetch
});
assert.equal(driver.kind, "pocketbase");
assert.equal(driver.isRemote, true);
assert.equal(requests.length, 0);
assert.equal(controllerSource.includes("createLocalDriver("), true);
assert.equal(controllerSource.includes("createPocketBaseDriver("), true);
assert.equal(controllerSource.includes("normalizeRuntimeConfig(configured)"), true);
assert.equal(controllerSource.includes("if (isPocketBaseMode())"), true);

const listedProducts = await driver.listProducts();
assert.equal(listedProducts.length, 2);
assert.equal(listedProducts[0].price, 28.5);
assert.equal(listedProducts[1].price, null);
assert.equal(listedProducts[0].images[0].primary, true);
assert.equal(listedProducts[0].image.includes("image-existing"), true);

const numericUpdate = await driver.updateProduct("product-null", { priceMode: "fixed", price: 19.75 });
assert.equal(numericUpdate.price, 19.75);
const numericPatch = requests.findLast(request => request.path.endsWith("/product-null") && request.method === "PATCH");
assert.deepEqual(JSON.parse(numericPatch.body), { price_mode: "fixed", price: 19.75 });

const nullUpdate = await driver.updateProduct("product-number", { priceMode: "quote", price: null });
assert.equal(nullUpdate.price, null);
const nullPatch = requests.findLast(request => request.path.endsWith("/product-number") && request.method === "PATCH");
assert.deepEqual(JSON.parse(nullPatch.body), { price_mode: "quote", price: null });

const imageUpdate = await driver.setProductImages("product-number", [
  { id: "new-image", name: "portada.png", src: "data:image/png;base64,AQID", alt: "Nueva portada" },
  { id: "image-existing", src: "https://pocketbase.invalid/existing", alt: "Detalle actualizado" }
]);
assert.equal(imageUpdate.images[0].id, "image-uploaded");
assert.equal(imageUpdate.images[0].primary, true);
assert.equal(imageUpdate.images[1].primary, false);
const upload = requests.find(request => request.path === "/api/collections/sinprisa_product_images/records" && request.method === "POST");
assert.ok(upload.body instanceof FormData);
assert.ok(upload.body.get("original") instanceof Blob);
assert.equal(Array.from(upload.body.values()).some(value => typeof value === "string" && value.startsWith("data:")), false);

assert.equal((await driver.listCollections())[0].slug, "bebe");
assert.equal((await driver.listOrders())[0].items[0].name, "Babero");
assert.equal((await driver.listMessages())[0].status, "Nuevo");
assert.equal(requests.filter(request => request.method === "GET" && request.path.includes("/records")).some(request => request.search.includes("created")), false);

const forbidden = window.AlmaAdminData.createPocketBaseDriver({
  url: "https://pocketbase.invalid",
  token: () => "runtime-auth-value",
  fetch: async () => jsonResponse({ message: "forbidden" }, 403)
});
await assert.rejects(forbidden.listMessages(), error => {
  assert.equal(error.name, "PocketBasePermissionError");
  assert.equal(error.status, 403);
  return true;
});

const committedCode = [
  source,
  controllerSource,
  readFileSync(new URL("./test-pocketbase-driver.mjs", import.meta.url), "utf8")
].join("\n");
for (const pattern of [
  /sk-[A-Za-z0-9_-]{16,}/,
  /ghp_[A-Za-z0-9]{20,}/,
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/,
  /BEGIN (?:RSA |OPENSSH )?PRIVATE KEY/,
  /token\s*:\s*["'][A-Za-z0-9._~-]{24,}["']/i
]) {
  assert.equal(pattern.test(committedCode), false, `posible secreto detectado: ${pattern}`);
}
assert.equal(source.includes("127.0.0.1:8092"), false);

console.log("PocketBase adapter behavior OK");
