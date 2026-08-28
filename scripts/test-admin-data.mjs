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

const productIds = () => Array.from(driver.listProducts(), item => item.id);
const collectionIds = () => Array.from(driver.listCollections(), item => item.id);

assert.equal(driver.kind, "local");
assert.equal(driver.isRemote, false);
assert.deepEqual(productIds(), ["seed-1"]);
assert.deepEqual(collectionIds(), ["col-1"]);
assert.equal(driver.listCollections()[0].position, 0);

driver.createProduct({ id: "prod-2", name: "Producto dos", stock: true, status: "draft" });
assert.deepEqual(productIds(), ["prod-2", "seed-1"]);
assert.throws(() => driver.createProduct({ id: "prod-2", name: "Duplicado" }), /ya existe/);

const updated = driver.updateProduct("prod-2", { status: "published", featured: true, id: "tampered" });
assert.equal(updated.id, "prod-2");
assert.equal(updated.status, "published");
assert.equal(updated.featured, true);
assert.equal(driver.updateProduct("missing", { status: "hidden" }), false);

const mediaUpdated = driver.setProductImages("prod-2", [
  { id: "img-b", src: "assets/segunda.jpeg", alt: "Detalle del bordado" },
  { id: "img-a", src: "assets/primera.jpeg", alt: "Vista completa" }
]);
assert.equal(mediaUpdated.image, "assets/segunda.jpeg");
assert.deepEqual(Array.from(mediaUpdated.images, item => [item.id, item.position, item.primary]), [
  ["img-b", 0, true],
  ["img-a", 1, false]
]);
assert.equal(mediaUpdated.images[0].alt, "Detalle del bordado");
assert.throws(() => driver.setProductImages("prod-2", [{ id: "bad", alt: "Sin fuente" }]), /src/);
assert.throws(() => driver.setProductImages("prod-2", [
  { id: "same", src: "assets/uno.jpeg" },
  { id: "same", src: "assets/dos.jpeg" }
]), /duplicados/);
assert.equal(driver.setProductImages("missing", []), false);

assert.equal(driver.setProductAvailability("prod-2", false), true);
assert.equal(driver.listProducts()[0].stock, false);
assert.equal(driver.setProductAvailability("missing", true), false);

driver.createCollection({ id: "col-2", name: "Regalos", status: "draft", position: 99 });
driver.createCollection({ id: "col-3", name: "Hogar", status: "draft" });
assert.deepEqual(collectionIds(), ["col-1", "col-2", "col-3"]);
assert.deepEqual(Array.from(driver.listCollections(), item => item.position), [0, 1, 2]);
assert.throws(() => driver.createCollection({ id: "col-2", name: "Duplicada" }), /ya existe/);

const collectionUpdated = driver.updateCollection("col-2", { name: "Regalos con alma", id: "tampered", position: 999, status: "published" });
assert.equal(collectionUpdated.id, "col-2");
assert.equal(collectionUpdated.name, "Regalos con alma");
assert.equal(collectionUpdated.status, "published");
assert.equal(collectionUpdated.position, 1);
assert.equal(driver.updateCollection("missing", { status: "hidden" }), false);

const reordered = driver.reorderCollections(["col-3", "col-1", "col-2"]);
assert.deepEqual(Array.from(reordered, item => item.id), ["col-3", "col-1", "col-2"]);
assert.deepEqual(Array.from(reordered, item => item.position), [0, 1, 2]);
assert.throws(() => driver.reorderCollections(["col-3", "col-3", "col-2"]), /duplicados/);
assert.throws(() => driver.reorderCollections(["col-3", "col-1"]), /todas/);
assert.throws(() => driver.reorderCollections(["col-3", "col-1", "missing"]), /desconocidas/);

assert.equal(driver.deleteCollection("col-2"), true);
assert.deepEqual(collectionIds(), ["col-3", "col-1"]);
assert.deepEqual(Array.from(driver.listCollections(), item => item.position), [0, 1]);
assert.equal(driver.deleteCollection("missing"), false);

driver.saveOrders([{ id: "order-1", status: "Solicitud recibida" }]);
assert.equal(driver.updateOrderStatus("order-1", "En preparación"), true);
assert.equal(driver.listOrders()[0].status, "En preparación");
assert.equal(driver.updateOrderStatus("missing", "En preparación"), false);

driver.saveMessages([{ id: "message-1", status: "Nuevo" }]);
assert.equal(driver.markMessageRead("message-1"), true);
assert.equal(driver.listMessages()[0].status, "Leído");
assert.equal(driver.markMessageRead("missing"), false);

assert.equal(driver.deleteProduct("prod-2"), true);
assert.deepEqual(productIds(), ["seed-1"]);
assert.equal(driver.deleteProduct("missing"), false);

const isolatedCopy = driver.listProducts();
isolatedCopy[0].name = "Mutado fuera";
assert.equal(driver.listProducts()[0].name, "Semilla");

const isolatedCollections = driver.listCollections();
isolatedCollections[0].name = "Mutada fuera";
assert.equal(driver.listCollections()[0].name, "Hogar");

console.log("Admin data gateway behavior OK");