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
  "legal.html",
  "site-v2.css",
  "site-v2.js",
  "_headers",
  "_routes.json",
  ".nojekyll"
];
const adminFooterLink = '<a href="admin.html">Administración</a>';
const accountHeaderLink = /<a class="account-link" href="cuenta\.html"(?: aria-current="page")?>Mi cuenta<\/a>/g;
const accountFooterLinks = '<a href="cuenta.html">Mi cuenta</a><a href="cuenta.html">Estado de pedidos</a>';
const publicOrderLinks = '<a href="encargos.html">Solicitar un encargo</a><a href="legal.html">Envíos y devoluciones</a>';

if (existsSync(output)) rmSync(output, { recursive: true });
mkdirSync(output, { recursive: true });

for (const file of publicFiles) {
  const source = resolve(root, file);
  const destination = resolve(output, file);
  if (file.endsWith(".html")) {
    writeFileSync(
      destination,
      readFileSync(source, "utf8")
        .replaceAll(adminFooterLink, "")
        .replace(accountHeaderLink, "")
        .replaceAll(accountFooterLinks, publicOrderLinks)
    );
  } else {
    cpSync(source, destination);
  }
}

cpSync(resolve(root, "assets"), resolve(output, "assets"), { recursive: true });
console.log(`Sitio público preparado en ${output}`);
