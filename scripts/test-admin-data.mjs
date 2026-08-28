import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

class MemoryStorage {
  #data = new Map();

  getItem(key) {
    return this.#data.has(key) ? this.#data.get(key) : null;
  }

  setItem(key, value) {
    this.#data.set(key, String(value));
  }

  removeItem(key) {
    this.#data.delete(key);
  }
}

const storage = new MemoryStorage();
const window = { localStorage: storage };
const context = vm.createContext({ window, console, structuredClone });
const source = readFileSync(new URL("../admin-data.js", import.meta.url), "utf8");
vm.runInContext(source, context, { filename: "admin-data.js" });

assert.equal(window.AlmaAdminData.version, 2);
assert.equal(typeof window.AlmaAdminData.createLocalDriver, "function");

const driver = window.AlmaAdminData.createLocalDriver({
  storage,
  seedProducts: [{ id: "seed-1", name: "Semilla", stock: true, status: "published" }],
  seedCollections: [{ id: "col-1", name: "Bebé", status: "published", position: 8 }]
});

const productIds = async () => Array.from(await driver.listProducts(), item => item.id);
const collectionIds = async () => Array.from(await driver.listCollections(), item => item.id);

assert.equal(driver.kind, "local");
assert.equal(driver.isRemote, false);
assert.equal(typeof driver.listProducts().then, "function");
const asyncProbe = driver.createProduct({ id: "async-probe", name: "Prueba asíncrona" });
assert.equal(typeof asyncProbe.then, "function");
await asyncProbe;
await driver.deleteProduct("async-probe");
assert.deepEqual(await productIds(), ["seed-1"]);
assert.deepEqual(await collectionIds(), ["col-1"]);
assert.equal((await driver.listCollections())[0].position, 0);

await driver.createProduct({ id: "prod-2", name: "Producto dos", stock: true, status: "draft" });
assert.deepEqual(await productIds(), ["prod-2", "seed-1"]);
await assert.rejects(driver.createProduct({ id: "prod-2", name: "Duplicado" }), /ya existe/);
await assert.rejects(driver.createProduct({ id: "", name: "Sin id" }), /necesita id/);
await assert.rejects(driver.createProduct({ id: "sin-nombre", name: "" }), /necesita nombre/);
await assert.rejects(driver.createProduct({ id: "precio-inválido", name: "Precio", priceMode: "fixed", price: -1 }), /precio inválido/);
await assert.rejects(driver.createProduct({ id: "estado-inválido", name: "Estado", status: "borrador" }), /status/);

const updated = await driver.updateProduct("prod-2", { status: "published", featured: true, id: "tampered" });
assert.equal(updated.id, "prod-2");
assert.equal(updated.status, "published");
assert.equal(updated.featured, true);
assert.equal(await driver.updateProduct("missing", { status: "hidden" }), false);
await assert.rejects(driver.updateProduct("prod-2", { stockMode: "agotado" }), /stockMode/);

const mediaUpdated = await driver.setProductImages("prod-2", [
  { id: "img-b", src: "assets/segunda.jpeg", alt: "Detalle del bordado" },
  { id: "img-a", src: "assets/primera.jpeg", alt: "Vista completa" }
]);
assert.equal(mediaUpdated.image, "assets/segunda.jpeg");
assert.deepEqual(Array.from(mediaUpdated.images, item => [item.id, item.position, item.primary]), [
  ["img-b", 0, true],
  ["img-a", 1, false]
]);
assert.equal(mediaUpdated.images[0].alt, "Detalle del bordado");
await assert.rejects(driver.setProductImages("prod-2", [{ id: "bad", alt: "Sin fuente" }]), /src/);
await assert.rejects(driver.setProductImages("prod-2", [
  { id: "same", src: "assets/uno.jpeg" },
  { id: "same", src: "assets/dos.jpeg" }
]), /duplicados/);
assert.equal(await driver.setProductImages("missing", []), false);

assert.equal(await driver.setProductAvailability("prod-2", false), true);
assert.equal((await driver.listProducts())[0].stock, false);
assert.equal(await driver.setProductAvailability("missing", true), false);

await driver.createCollection({ id: "col-2", name: "Regalos", status: "draft", position: 99 });
await driver.createCollection({ id: "col-3", name: "Hogar", status: "draft" });
assert.deepEqual(await collectionIds(), ["col-1", "col-2", "col-3"]);
assert.deepEqual(Array.from(await driver.listCollections(), item => item.position), [0, 1, 2]);
await assert.rejects(driver.createCollection({ id: "col-2", name: "Duplicada" }), /ya existe/);
await assert.rejects(driver.createCollection({ id: "col-4", name: "" }), /necesita nombre/);
await assert.rejects(driver.createCollection({ id: "col-4", name: "Hogar" }), /nombres duplicados/);
await assert.rejects(driver.createCollection({ id: "col-4", name: "Otra", status: "visible" }), /status/);

const collectionUpdated = await driver.updateCollection("col-2", { name: "Regalos con alma", id: "tampered", position: 999, status: "published" });
assert.equal(collectionUpdated.id, "col-2");
assert.equal(collectionUpdated.name, "Regalos con alma");
assert.equal(collectionUpdated.status, "published");
assert.equal(collectionUpdated.position, 1);
assert.equal(await driver.updateCollection("missing", { status: "hidden" }), false);

const reordered = await driver.reorderCollections(["col-3", "col-1", "col-2"]);
assert.deepEqual(Array.from(reordered, item => item.id), ["col-3", "col-1", "col-2"]);
assert.deepEqual(Array.from(reordered, item => item.position), [0, 1, 2]);
await assert.rejects(driver.reorderCollections(["col-3", "col-3", "col-2"]), /duplicados/);
await assert.rejects(driver.reorderCollections(["col-3", "col-1"]), /todas/);
await assert.rejects(driver.reorderCollections(["col-3", "col-1", "missing"]), /desconocidas/);

await driver.updateProduct("prod-2", { category: "col-2" });
await assert.rejects(driver.deleteCollection("col-2"), /productos asociados/);
await driver.updateProduct("prod-2", { category: "" });
assert.equal(await driver.deleteCollection("col-2"), true);
assert.deepEqual(await collectionIds(), ["col-3", "col-1"]);
assert.deepEqual(Array.from(await driver.listCollections(), item => item.position), [0, 1]);
assert.equal(await driver.deleteCollection("missing"), false);

await driver.saveOrders([{ id: "order-1", status: "Solicitud recibida" }]);
assert.equal(await driver.updateOrderStatus("order-1", "En preparación"), true);
assert.equal((await driver.listOrders())[0].status, "En preparación");
assert.equal(await driver.updateOrderStatus("missing", "En preparación"), false);

await driver.saveMessages([{ id: "message-1", status: "Nuevo" }]);
assert.equal(await driver.markMessageRead("message-1"), true);
assert.equal((await driver.listMessages())[0].status, "Leído");
assert.equal(await driver.markMessageRead("missing"), false);

assert.equal(await driver.deleteProduct("prod-2"), true);
assert.deepEqual(await productIds(), ["seed-1"]);
assert.equal(await driver.deleteProduct("missing"), false);

const isolatedCopy = await driver.listProducts();
isolatedCopy[0].name = "Mutado fuera";
assert.equal((await driver.listProducts())[0].name, "Semilla");

const isolatedCollections = await driver.listCollections();
isolatedCollections[0].name = "Mutada fuera";
assert.equal((await driver.listCollections())[0].name, "Hogar");

console.log("Admin data gateway behavior OK");
