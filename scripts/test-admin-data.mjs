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
const context = vm.createContext({
  window,
  console,
  structuredClone
});

const source = readFileSync(new URL("../admin-data.js", import.meta.url), "utf8");
vm.runInContext(source, context, { filename: "admin-data.js" });

assert.equal(window.AlmaAdminData.version, 1);
assert.equal(typeof window.AlmaAdminData.createLocalDriver, "function");

const driver = window.AlmaAdminData.createLocalDriver({
  storage,
  seedProducts: [
    { id: "seed-1", name: "Semilla", stock: true, status: "published" }
  ]
});

const productIds = () => Array.from(driver.listProducts(), item => item.id);

assert.equal(driver.kind, "local");
assert.equal(driver.isRemote, false);
assert.deepEqual(productIds(), ["seed-1"]);

driver.createProduct({ id: "prod-2", name: "Producto dos", stock: true, status: "draft" });
assert.deepEqual(productIds(), ["prod-2", "seed-1"]);

const updated = driver.updateProduct("prod-2", { status: "published", featured: true, id: "tampered" });
assert.equal(updated.id, "prod-2");
assert.equal(updated.status, "published");
assert.equal(updated.featured, true);
assert.equal(driver.updateProduct("missing", { status: "hidden" }), false);

assert.equal(driver.setProductAvailability("prod-2", false), true);
assert.equal(driver.listProducts()[0].stock, false);
assert.equal(driver.setProductAvailability("missing", true), false);

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

console.log("Admin data gateway behavior OK");
