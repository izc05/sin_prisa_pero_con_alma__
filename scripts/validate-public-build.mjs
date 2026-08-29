import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "dist-public");
const requiredFiles = [
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
const forbiddenFiles = [
  "admin.html",
  "admin-auth.js",
  "admin-data.js",
  "admin-runtime-config.js",
  "admin-runtime-config-loader.js",
  "admin-v2-controls.css",
  "admin-v2-page.js",
  "admin-v2.css"
];

for (const file of requiredFiles) {
  if (!existsSync(resolve(output, file))) throw new Error(`Falta en el build público: ${file}`);
}

for (const file of forbiddenFiles) {
  if (existsSync(resolve(output, file))) throw new Error(`El build público incluye un archivo privado: ${file}`);
}

for (const file of readdirSync(output).filter(name => name.endsWith(".html"))) {
  const html = readFileSync(resolve(output, file), "utf8");
  if (/href=["']admin\.html["']/.test(html)) throw new Error(`El build público enlaza al Admin desde ${file}`);
}

console.log("Build público sin Admin OK");
