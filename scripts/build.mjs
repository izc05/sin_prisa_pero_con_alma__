import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
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
  "admin-data.js",
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
console.log(`Sitio preparado en ${output}`);
