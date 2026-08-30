import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "dist");
const files = [
  "index.html",
  "tienda.html",
  "encargos.html",
  "diario.html",
  "marca.html",
  "cuenta.html",
  "admin.html",
  "legal.html",
  "site-v2.css",
  "site-v2.js",
  "admin-v2.css",
  "admin-v2-controls.css",
  "admin-runtime-config-loader.js",
  "admin-data.js",
  "admin-auth.js",
  "admin-v2-page.js",
  "_headers",
  ".nojekyll"
];

if (existsSync(output)) rmSync(output, { recursive: true });
mkdirSync(output, { recursive: true });

for (const file of files) {
  cpSync(resolve(root, file), resolve(output, file));
}

cpSync(resolve(root, "assets"), resolve(output, "assets"), { recursive: true });
writeFileSync(resolve(output, "admin-runtime-config.js"), `window.AlmaAdminRuntimeConfig = Object.freeze({\n  mode: "pocketbase",\n  pocketbaseUrl: window.location.origin\n});\n`);
console.log(`Sitio preparado en ${output}`);
