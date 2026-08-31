import assert from "node:assert/strict";
import { onRequestGet as getCatalog } from "../functions/api/catalog.js";
import { onRequestGet as getCatalogImage } from "../functions/api/catalog-image.js";

const env = {
  ORDER_INTAKE_URL: "https://private.example/api/sinprisa/order-requests",
  CF_ACCESS_CLIENT_ID: "test-client-id",
  CF_ACCESS_CLIENT_SECRET: "test-client-secret",
  ORDER_INTAKE_SECRET: "test-intake-secret"
};
const originalFetch = globalThis.fetch;
const calls = [];

try {
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith("/api/sinprisa/catalog")) {
      return Response.json({
        collections: [{ id: "bebe", name: "Bebé", position: 0 }],
        products: [{ id: "babero-real", name: "Babero real", image: "/api/catalog-image?id=abcdefghijklmno" }],
        content: [{ key: "home_notice", title: "Desde el atelier", body: "Un texto editorial publicado." }]
      });
    }
    if (String(url).endsWith("/api/sinprisa/catalog-image/abcdefghijklmno")) {
      return new Response(new Uint8Array([137, 80, 78, 71]), { headers: { "Content-Type": "image/png" } });
    }
    return Response.json({}, { status: 404 });
  };

  const catalogResponse = await getCatalog({ env });
  assert.equal(catalogResponse.status, 200);
  const catalog = await catalogResponse.json();
  assert.equal(catalog.products[0].id, "babero-real");
  assert.equal(catalog.content[0].key, "home_notice");
  assert.equal(calls[0].url, "https://private.example/api/sinprisa/catalog");
  assert.equal(calls[0].init.headers["CF-Access-Client-Id"], "test-client-id");
  assert.equal(calls[0].init.headers["X-Sinprisa-Intake-Secret"], "test-intake-secret");

  const imageResponse = await getCatalogImage({
    request: new Request("https://public.example/api/catalog-image?id=abcdefghijklmno"),
    env
  });
  assert.equal(imageResponse.status, 200);
  assert.equal(imageResponse.headers.get("Content-Type"), "image/png");
  assert.deepEqual(Array.from(new Uint8Array(await imageResponse.arrayBuffer())), [137, 80, 78, 71]);
  assert.equal(calls[1].url, "https://private.example/api/sinprisa/catalog-image/abcdefghijklmno");

  const callCount = calls.length;
  const invalidImage = await getCatalogImage({
    request: new Request("https://public.example/api/catalog-image?id=../private"),
    env
  });
  assert.equal(invalidImage.status, 404);
  assert.equal(calls.length, callCount);
} finally {
  globalThis.fetch = originalFetch;
}

console.log("Public catalog gateway behavior OK");
