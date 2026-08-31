import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "dist-public");
const requiredFiles = [
  "index.html",
  "tienda.html",
  "producto.html",
  "encargos.html",
  "diario.html",
  "marca.html",
  "cuenta.html",
  "legal.html",
  "site-v2.css",
  "site-v2.js",
  "_headers",
  "_routes.json",
  ".nojekyll",
  "robots.txt",
  "sitemap.xml"
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

const routes = JSON.parse(readFileSync(resolve(output, "_routes.json"), "utf8"));
if (JSON.stringify(routes.include) !== JSON.stringify(["/api/*"])) {
  throw new Error("El build público ejecuta Functions fuera del endpoint de pedidos");
}

const publicScript = readFileSync(resolve(output, "site-v2.js"), "utf8");
if (/pocketbase|CF_ACCESS_CLIENT_SECRET|ORDER_INTAKE_SECRET/i.test(publicScript)) {
  throw new Error("El JavaScript público contiene referencias a credenciales o PocketBase");
}
if (!publicScript.includes('apiJson("/api/catalog")') || !publicScript.includes("producto.html?pieza=")) {
  throw new Error("El escaparate público no consume el catálogo seguro o no enlaza sus fichas");
}
for (const demoId of ["babero-danna", "bolsa-jardin", "bastidor-botanico", "encargo-personal"]) {
  if (publicScript.includes(demoId)) throw new Error(`El catálogo público conserva el ejemplo ${demoId}`);
}

console.log("Build público sin Admin OK");
