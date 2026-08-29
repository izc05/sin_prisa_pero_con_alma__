import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";

const destination = process.argv[2];
if (!destination?.startsWith("/etc/")) throw new Error("Se necesita una ruta explícita dentro de /etc");

try {
  writeFileSync(destination, `SINPRISA_ORDER_INTAKE_SECRET=${randomBytes(32).toString("hex")}\n`, { flag: "wx", mode: 0o600 });
  console.log("Secreto privado creado");
} catch (error) {
  if (error?.code !== "EEXIST") throw error;
  console.log("Secreto privado existente conservado");
}
