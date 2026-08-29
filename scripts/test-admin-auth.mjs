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

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

const authSource = readFileSync(new URL("../admin-auth.js", import.meta.url), "utf8");
const sessionStorage = new MemoryStorage();
const localStorage = new MemoryStorage();
const window = { sessionStorage };
const context = vm.createContext({ window, console, URL });
vm.runInContext(authSource, context, { filename: "admin-auth.js" });

assert.deepEqual({ ...window.AlmaAdminAuth.normalizeRuntimeConfig(null) }, { mode: "local" });
assert.deepEqual(
  { ...window.AlmaAdminAuth.normalizeRuntimeConfig({ mode: "pocketbase", pocketbaseUrl: "http://127.0.0.1:8092/" }) },
  { mode: "pocketbase", pocketbaseUrl: "http://127.0.0.1:8092" }
);
assert.equal(authSource.includes("localStorage"), false);
assert.equal(authSource.includes("sessionStorage"), true);

localStorage.setItem("unrelated", "preserved");
let fetchCount = 0;
let lastRequest = null;
const firstRuntimeValue = ["runtime", "session", "one"].join("-");
const refreshedRuntimeValue = ["runtime", "session", "two"].join("-");
const suppliedSecret = ["only", "for", "this", "test"].join("-");

const runtimeFetch = async (url, init) => {
  fetchCount += 1;
  lastRequest = { url, init };
  if (url.endsWith("/auth-with-password")) {
    return jsonResponse({
      token: firstRuntimeValue,
      record: { id: "staff-record", name: "Prueba", role: "owner", active: true }
    });
  }
  if (url.endsWith("/auth-refresh")) {
    return jsonResponse({
      token: refreshedRuntimeValue,
      record: { id: "staff-record", name: "Prueba", role: "owner", active: true }
    });
  }
  return jsonResponse({}, 500);
};

const session = window.AlmaAdminAuth.createPocketBaseSession({
  url: "http://127.0.0.1:8092",
  fetch: runtimeFetch,
  storage: sessionStorage
});
assert.equal(fetchCount, 0);
assert.equal(session.getToken(), "");

const user = await session.login("staff@example.invalid", suppliedSecret);
assert.deepEqual({ ...user }, { id: "staff-record", name: "Prueba", role: "owner", active: true });
assert.equal(fetchCount, 1);
assert.equal(lastRequest.url.endsWith("/api/collections/sinprisa_staff/auth-with-password"), true);
assert.deepEqual(JSON.parse(lastRequest.init.body), {
  identity: "staff@example.invalid",
  password: suppliedSecret
});
assert.equal(session.getToken(), firstRuntimeValue);
assert.equal(localStorage.getItem("unrelated"), "preserved");
assert.equal(localStorage.getItem(window.AlmaAdminAuth.sessionKey), null);
assert.equal(JSON.parse(sessionStorage.getItem(window.AlmaAdminAuth.sessionKey)).token, firstRuntimeValue);

const restoredSession = window.AlmaAdminAuth.createPocketBaseSession({
  url: "http://127.0.0.1:8092",
  fetch: runtimeFetch,
  storage: sessionStorage
});
const restoredUser = await restoredSession.restore();
assert.equal(restoredUser.name, "Prueba");
assert.equal(restoredSession.getToken(), refreshedRuntimeValue);
assert.equal(lastRequest.init.headers.Authorization, `Bearer ${firstRuntimeValue}`);

restoredSession.logout();
assert.equal(restoredSession.getToken(), "");
assert.equal(restoredSession.getUser(), null);
assert.equal(sessionStorage.getItem(window.AlmaAdminAuth.sessionKey), null);

const rejectedStorage = new MemoryStorage();
const rejected = window.AlmaAdminAuth.createPocketBaseSession({
  url: "http://127.0.0.1:8092",
  fetch: async () => jsonResponse({}, 401),
  storage: rejectedStorage
});
await assert.rejects(rejected.login("staff@example.invalid", suppliedSecret), /incorrectos/);
assert.equal(rejectedStorage.getItem(window.AlmaAdminAuth.sessionKey), null);

for (const pattern of [
  /sk-[A-Za-z0-9_-]{16,}/,
  /ghp_[A-Za-z0-9]{20,}/,
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/,
  /BEGIN (?:RSA |OPENSSH )?PRIVATE KEY/
]) {
  assert.equal(pattern.test(authSource), false, `posible secreto detectado: ${pattern}`);
}

console.log("Admin PocketBase authentication behavior OK");
