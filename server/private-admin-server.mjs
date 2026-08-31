import http from "node:http";
import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import path from "node:path";

const HOST = process.env.SINPRISA_ADMIN_HOST || "127.0.0.1";
const PORT = Number(process.env.SINPRISA_ADMIN_PORT || 8084);
const DOCUMENT_ROOT = await realpath(process.env.SINPRISA_DOCUMENT_ROOT || "/srv/sin-prisa/source/dist");
const POCKETBASE_URL = new URL(process.env.SINPRISA_POCKETBASE_URL || "http://127.0.0.1:8092");
const ORDER_INGRESS_HOST = process.env.SINPRISA_ORDER_INGRESS_HOST || "pedidos-sinprisa.isivoltpro.com";
const ORDER_PATH = "/api/sinprisa/order-requests";
const PUBLIC_SITE_URL = new URL(process.env.SINPRISA_PUBLIC_SITE_URL || "https://sinprisa.isivoltpro.com");
const PUBLIC_WRITE_PATHS = new Set([
  ORDER_PATH,
  "/api/sinprisa/commissions",
  "/api/sinprisa/commission-messages",
  "/api/collections/sinprisa_customer_accounts/records",
  "/api/collections/sinprisa_customer_accounts/auth-with-password",
  "/api/collections/sinprisa_customer_accounts/auth-refresh"
]);
const PUBLIC_GET_PATHS = new Set(["/api/sinprisa/catalog", "/api/sinprisa/my-commissions", "/api/sinprisa/my-orders"]);
const PUBLIC_CATALOG_IMAGE_PATH = /^\/api\/sinprisa\/catalog-image\/[a-z0-9]{15}$/;
const HOP_BY_HOP_HEADERS = new Set(["connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade"]);

const MIME_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".mp4", "video/mp4"],
  [".ico", "image/x-icon"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"]
]);

function sendText(response, statusCode, message) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": Buffer.byteLength(message),
    "Cache-Control": "no-store"
  });
  response.end(message);
}

function isInsideDocumentRoot(filePath) {
  return filePath === DOCUMENT_ROOT || filePath.startsWith(`${DOCUMENT_ROOT}${path.sep}`);
}

function requestHostname(request) {
  return String(request.headers.host || "").split(":", 1)[0].toLowerCase();
}

function allowedPublicIngress(method, pathname) {
  if (method === "POST" || method === "DELETE") return PUBLIC_WRITE_PATHS.has(pathname);
  if (method === "GET") return PUBLIC_GET_PATHS.has(pathname) || PUBLIC_CATALOG_IMAGE_PATH.test(pathname);
  return false;
}

function proxyToPocketBase(request, response) {
  const headers = {};
  for (const [name, value] of Object.entries(request.headers)) {
    if (!HOP_BY_HOP_HEADERS.has(name) && name !== "host" && value != null) headers[name] = value;
  }
  headers.host = POCKETBASE_URL.host;

  const upstream = http.request({
    protocol: POCKETBASE_URL.protocol,
    hostname: POCKETBASE_URL.hostname,
    port: POCKETBASE_URL.port,
    method: request.method,
    path: request.url,
    headers
  }, upstreamResponse => {
    const responseHeaders = {};
    for (const [name, value] of Object.entries(upstreamResponse.headers)) {
      if (!HOP_BY_HOP_HEADERS.has(name) && value != null) responseHeaders[name] = value;
    }
    response.writeHead(upstreamResponse.statusCode || 502, responseHeaders);
    upstreamResponse.pipe(response);
  });

  upstream.on("error", () => {
    if (!response.headersSent) sendText(response, 502, "Bad Gateway\n");
    else response.destroy();
  });
  request.on("aborted", () => upstream.destroy());
  request.pipe(upstream);
}

async function serveStatic(request, response, pathname) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.setHeader("Allow", "GET, HEAD");
    sendText(response, 405, "Method Not Allowed\n");
    return;
  }

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    sendText(response, 400, "Bad Request\n");
    return;
  }
  if (decodedPath.includes("\0") || decodedPath.split(/[\\/]+/u).includes("..")) {
    sendText(response, 403, "Forbidden\n");
    return;
  }
  if (decodedPath === "/") decodedPath = "/admin.html";

  const candidate = path.resolve(DOCUMENT_ROOT, decodedPath.replace(/^[/\\]+/u, ""));
  if (!isInsideDocumentRoot(candidate)) {
    sendText(response, 403, "Forbidden\n");
    return;
  }

  let resolvedFile;
  let fileStats;
  try {
    resolvedFile = await realpath(candidate);
    if (!isInsideDocumentRoot(resolvedFile)) throw Object.assign(new Error("outside root"), { code: "EACCES" });
    fileStats = await stat(resolvedFile);
  } catch (error) {
    sendText(response, error?.code === "EACCES" ? 403 : 404, error?.code === "EACCES" ? "Forbidden\n" : "Not Found\n");
    return;
  }
  if (!fileStats.isFile()) {
    sendText(response, 404, "Not Found\n");
    return;
  }

  response.writeHead(200, {
    "Content-Type": MIME_TYPES.get(path.extname(resolvedFile).toLowerCase()) || "application/octet-stream",
    "Content-Length": fileStats.size,
    "Cache-Control": resolvedFile.endsWith("admin-runtime-config.js") ? "no-store" : "private, max-age=300"
  });
  if (request.method === "HEAD") return response.end();
  const stream = createReadStream(resolvedFile);
  stream.on("error", () => response.destroy());
  stream.pipe(response);
}

const server = http.createServer(async (request, response) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "SAMEORIGIN");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  const pathname = (() => {
    try { return new URL(request.url || "/", "http://localhost").pathname; }
    catch { return ""; }
  })();
  const orderIngress = requestHostname(request) === ORDER_INGRESS_HOST;
  if (orderIngress && !allowedPublicIngress(request.method || "GET", pathname)) {
    sendText(response, 404, "Not Found\n");
    return;
  }
  if (pathname.startsWith("/api/")) {
    proxyToPocketBase(request, response);
    return;
  }
  if (!orderIngress && pathname === "/cuenta.html") {
    response.writeHead(302, { Location: new URL("/cuenta.html", PUBLIC_SITE_URL).toString(), "Cache-Control": "no-store" });
    response.end();
    return;
  }
  if (orderIngress) {
    sendText(response, 404, "Not Found\n");
    return;
  }
  await serveStatic(request, response, pathname);
});

server.on("error", error => {
  console.error(JSON.stringify({ event: "private_admin_server_failed", code: error.code || "unknown" }));
  process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
  const address = server.address();
  console.log(JSON.stringify({ event: "private_admin_server_started", host: HOST, port: typeof address === "object" && address ? address.port : PORT }));
});
