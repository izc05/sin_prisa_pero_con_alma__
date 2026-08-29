import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "dist-public");
const publicFiles = [
  "index.html",
  "tienda.html",
  "encargos.html",
  "diario.html",
  "marca.html",
  "cuenta.html",
  "legal.html",
  "site-v2.css",
  "site-v2.js",
  "_headers",
  ".nojekyll"
];
const adminFooterLink = '<a href="admin.html">Administración</a>';

if (existsSync(output)) rmSync(output, { recursive: true });
mkdirSync(output, { recursive: true });

for (const file of publicFiles) {
  const source = resolve(root, file);
  const destination = resolve(output, file);
  if (file.endsWith(".html")) {
    writeFileSync(destination, readFileSync(source, "utf8").replaceAll(adminFooterLink, ""));
  } else {
    cpSync(source, destination);
  }
}

cpSync(resolve(root, "assets"), resolve(output, "assets"), { recursive: true });
console.log(`Sitio público preparado en ${output}`);
