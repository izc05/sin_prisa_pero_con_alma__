import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import http from "node:http";

function requestStatus(port, path, host, method = "GET") {
  return new Promise((resolve, reject) => {
    const request = http.request({ hostname: "127.0.0.1", port, path, method, headers: { Host: host } }, response => {
      response.resume();
      response.once("end", () => resolve(response.statusCode));
    });
    request.once("error", reject);
    request.end();
  });
}

const root = mkdtempSync(join(tmpdir(), "sinprisa-private-server-"));
writeFileSync(join(root, "admin.html"), "admin privado");
const child = spawn(process.execPath, [fileURLToPath(new URL("../server/private-admin-server.mjs", import.meta.url))], {
  env: { ...process.env, SINPRISA_DOCUMENT_ROOT: root, SINPRISA_ADMIN_PORT: "0", SINPRISA_POCKETBASE_URL: "http://127.0.0.1:1" },
  stdio: ["ignore", "pipe", "pipe"]
});

let port;
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("El servidor privado no arrancó")), 5000);
    child.stdout.once("data", chunk => {
      clearTimeout(timer);
      port = JSON.parse(String(chunk)).port;
      resolve();
    });
    child.once("exit", code => {
      const error = new Error(`El servidor terminó con ${code}`);
      child.stderr.once("data", chunk => { error.cause = String(chunk); });
      reject(error);
    });
  });
  const admin = await fetch(`http://127.0.0.1:${port}/`);
  assert.equal(admin.status, 200);
  assert.equal(await admin.text(), "admin privado");

  assert.equal(await requestStatus(port, "/", "pedidos-sinprisa.isivoltpro.com"), 404);
  assert.equal(await requestStatus(port, "/api/collections/sinprisa_orders/records", "pedidos-sinprisa.isivoltpro.com"), 404);
  assert.equal(await requestStatus(port, "/api/sinprisa/catalog", "pedidos-sinprisa.isivoltpro.com"), 502);
  assert.equal(await requestStatus(port, "/api/sinprisa/my-commissions", "pedidos-sinprisa.isivoltpro.com"), 502);
  assert.equal(await requestStatus(port, "/api/sinprisa/commission-messages", "pedidos-sinprisa.isivoltpro.com", "POST"), 502);
  assert.equal(await requestStatus(port, "/api/sinprisa/commission-messages", "pedidos-sinprisa.isivoltpro.com", "DELETE"), 502);
  assert.equal(await requestStatus(port, "/api/sinprisa/catalog-image/abcdefghijklmno", "pedidos-sinprisa.isivoltpro.com"), 502);
  assert.equal(await requestStatus(port, "/api/sinprisa/catalog-image/not-valid", "pedidos-sinprisa.isivoltpro.com"), 404);
  assert.equal(await requestStatus(port, "/api/sinprisa/catalog", "pedidos-sinprisa.isivoltpro.com", "POST"), 404);
} finally {
  child.kill("SIGTERM");
}

console.log("Private Admin server boundary OK");
