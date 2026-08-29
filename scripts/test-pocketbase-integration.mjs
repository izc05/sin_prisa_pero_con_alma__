import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const POCKETBASE_URL = "http://127.0.0.1:8092";
const STAFF_EMAIL = "sin_prisa_pero_con_alma@outlook.es";
const COLLECTIONS = Object.freeze({
  collections: "sinprisa_collections",
  products: "sinprisa_products",
  images: "sinprisa_product_images"
});

function readHidden(prompt) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
    throw new Error("La contraseña debe introducirse desde una terminal interactiva");
  }

  process.stderr.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  return new Promise((resolve, reject) => {
    let value = "";

    function finish() {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener("data", onData);
      process.stderr.write("\n");
    }

    function onData(chunk) {
      for (const character of chunk) {
        if (character === "\u0003") {
          finish();
          reject(new Error("Prueba cancelada"));
          return;
        }
        if (character === "\r" || character === "\n") {
          finish();
          resolve(value);
          return;
        }
        if (character === "\u007f" || character === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        if (character >= " ") value += character;
      }
    }

    process.stdin.on("data", onData);
  });
}

function loadDriverFactory() {
  const source = readFileSync(new URL("../admin-data.js", import.meta.url), "utf8");
  const window = { localStorage: null };
  const context = vm.createContext({
    window,
    console,
    structuredClone,
    URL,
    URLSearchParams,
    FormData,
    Blob,
    File: globalThis.File,
    TextEncoder,
    Uint8Array,
    atob
  });
  vm.runInContext(source, context, { filename: "admin-data.js" });
  return window.AlmaAdminData.createPocketBaseDriver;
}

function temporaryPng(name) {
  const bytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64"
  );
  const file = new Blob([bytes], { type: "image/png" });
  Object.defineProperty(file, "name", { value: name });
  return file;
}

async function authenticate(password) {
  const response = await fetch(`${POCKETBASE_URL}/api/collections/sinprisa_staff/auth-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ identity: STAFF_EMAIL, password })
  });
  if (!response.ok) throw new Error(`Autenticación rechazada con HTTP ${response.status}`);
  const payload = await response.json();
  const token = String(payload?.token || "");
  if (!token) throw new Error("PocketBase no devolvió una sesión válida");
  return token;
}

async function countAuthenticated(token, collection, filter) {
  const query = new URLSearchParams({ page: "1", perPage: "1", filter });
  const response = await fetch(`${POCKETBASE_URL}/api/collections/${collection}/records?${query}`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error(`No se pudo verificar la limpieza de ${collection}: HTTP ${response.status}`);
  const payload = await response.json();
  return Number(payload.totalItems || 0);
}

async function assertDraftIsPrivate(productId) {
  const query = new URLSearchParams({ page: "1", perPage: "1", filter: `id="${productId}"` });
  const response = await fetch(`${POCKETBASE_URL}/api/collections/${COLLECTIONS.products}/records?${query}`, {
    headers: { Accept: "application/json" }
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.totalItems, 0, "una petición anónima pudo leer el borrador");
}

let password = "";
let token = "";
let driver;
let temporaryCollectionId = "";
let temporaryProductId = "";
let testError = null;
const cleanupErrors = [];

try {
  password = await readHidden("Contraseña owner de Sin Prisa (no se mostrará): ");
  if (!password) throw new Error("No se introdujo ninguna contraseña");
  token = await authenticate(password);
  password = "";
  console.log("✓ Autenticación de sinprisa_staff");

  const createPocketBaseDriver = loadDriverFactory();
  driver = createPocketBaseDriver({
    url: POCKETBASE_URL,
    token: () => token,
    fetch
  });

  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  const temporaryCollection = await driver.createCollection({
    id: `integration-${suffix}`,
    name: `Integración temporal ${suffix}`,
    slug: `integration-${suffix}`,
    description: "Registro efímero de prueba automatizada",
    status: "draft",
    position: 9999
  });
  temporaryCollectionId = temporaryCollection.id;
  assert.equal(temporaryCollection.status, "draft");
  console.log("✓ Colección temporal en borrador");

  const temporaryProduct = await driver.createProduct({
    id: `integration-product-${suffix}`,
    name: `Producto temporal ${suffix}`,
    slug: `integration-product-${suffix}`,
    category: temporaryCollectionId,
    shortDescription: "Prueba reversible",
    description: "Registro efímero de prueba automatizada",
    price: 12.34,
    priceMode: "fixed",
    status: "draft",
    stockMode: "available",
    featured: false,
    position: 9999,
    images: []
  });
  temporaryProductId = temporaryProduct.id;
  assert.equal(temporaryProduct.price, 12.34);
  assert.equal(temporaryProduct.status, "draft");
  console.log("✓ Producto temporal con precio numérico");

  const quotedProduct = await driver.updateProduct(temporaryProductId, {
    priceMode: "quote",
    price: null
  });
  assert.equal(quotedProduct.priceMode, "quote");
  assert.equal(quotedProduct.price, null);
  console.log("✓ Conversión de precio a null/quote");

  const withImages = await driver.setProductImages(temporaryProductId, [
    { id: "new-cover", file: temporaryPng(`cover-${suffix}.png`), alt: "Portada temporal" },
    { id: "new-detail", file: temporaryPng(`detail-${suffix}.png`), alt: "Detalle temporal" }
  ]);
  assert.equal(withImages.images.length, 2);
  assert.equal(withImages.images[0].primary, true);
  assert.equal(withImages.images[0].position, 0);
  assert.equal(withImages.images[1].primary, false);
  assert.equal(withImages.images[1].position, 1);
  console.log("✓ Dos imágenes multipart, portada y orden");

  await assertDraftIsPrivate(temporaryProductId);
  console.log("✓ Borrador invisible para petición anónima");
} catch (error) {
  testError = error;
} finally {
  password = "";

  if (driver && temporaryProductId) {
    try {
      await driver.setProductImages(temporaryProductId, []);
    } catch (error) {
      cleanupErrors.push(`imágenes: ${error.message}`);
    }
    try {
      await driver.deleteProduct(temporaryProductId);
    } catch (error) {
      cleanupErrors.push(`producto: ${error.message}`);
    }
  }

  if (driver && temporaryCollectionId) {
    try {
      await driver.deleteCollection(temporaryCollectionId);
    } catch (error) {
      cleanupErrors.push(`colección: ${error.message}`);
    }
  }

  if (token) {
    try {
      if (temporaryProductId) {
        assert.equal(await countAuthenticated(token, COLLECTIONS.products, `id="${temporaryProductId}"`), 0);
        assert.equal(await countAuthenticated(token, COLLECTIONS.images, `product="${temporaryProductId}"`), 0);
      }
      if (temporaryCollectionId) {
        assert.equal(await countAuthenticated(token, COLLECTIONS.collections, `id="${temporaryCollectionId}"`), 0);
      }
      console.log("✓ Limpieza autenticada verificada");
    } catch (error) {
      cleanupErrors.push(`verificación: ${error.message}`);
    }
  }

  token = "";
  driver = null;
}

if (cleanupErrors.length) {
  console.error("✗ La limpieza necesita revisión:", cleanupErrors.join("; "));
  process.exitCode = 1;
} else if (testError) {
  console.error(`✗ Prueba fallida tras limpiar: ${testError.message}`);
  process.exitCode = 1;
} else {
  console.log("Integración real reversible OK; credenciales descartadas de memoria");
}
