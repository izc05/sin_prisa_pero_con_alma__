import { readFileSync } from "node:fs";

const admin = readFileSync(new URL("../admin.html", import.meta.url), "utf8");
const controller = readFileSync(new URL("../admin-v2-page.js", import.meta.url), "utf8");
const dataGateway = readFileSync(new URL("../admin-data.js", import.meta.url), "utf8");

const requiredAdminFragments = [
  'id="admin-page"',
  'id="admin-pin-form"',
  'data-admin-view="summary"',
  'data-admin-view="products"',
  'data-admin-view="orders"',
  'data-admin-view="messages"',
  'id="product-form"',
  'id="admin-orders"',
  'id="admin-messages"',
  'src="admin-data.js"',
  'src="admin-v2-page.js"'
];

for (const fragment of requiredAdminFragments) {
  if (!admin.includes(fragment)) {
    throw new Error(`Admin V2 contract missing: ${fragment}`);
  }
}

if (admin.includes('src="site-v2.js"')) {
  throw new Error("Admin V2 must not load the storefront runtime");
}

const requiredControllerFragments = [
  'window.AlmaAdminData.createLocalDriver',
  'function setupAdmin()',
  'function renderAdmin()',
  'adminData.listProducts()',
  'adminData.listOrders()',
  'adminData.listMessages()',
  'adminData.createProduct(',
  'adminData.setProductAvailability(',
  'adminData.deleteProduct(',
  'adminData.updateOrderStatus(',
  'adminData.markMessageRead('
];

for (const fragment of requiredControllerFragments) {
  if (!controller.includes(fragment)) {
    throw new Error(`Admin V2 controller contract missing: ${fragment}`);
  }
}

const requiredGatewayFragments = [
  'global.AlmaAdminData',
  'createLocalDriver',
  'listProducts()',
  'saveProducts(products)',
  'listOrders()',
  'saveOrders(orders)',
  'listMessages()',
  'saveMessages(messages)',
  'createProduct(product)',
  'setProductAvailability(productId, available)',
  'deleteProduct(productId)',
  'updateOrderStatus(orderId, status)',
  'markMessageRead(messageId)'
];

for (const fragment of requiredGatewayFragments) {
  if (!dataGateway.includes(fragment)) {
    throw new Error(`Admin data gateway contract missing: ${fragment}`);
  }
}

const forbiddenPatterns = [
  /sk-[A-Za-z0-9_-]{16,}/,
  /ghp_[A-Za-z0-9]{20,}/,
  /BEGIN OPENSSH PRIVATE KEY/,
  /cloudflare.{0,20}(token|secret).{0,5}[:=].{0,5}["'][^"']+/i
];

for (const pattern of forbiddenPatterns) {
  if (pattern.test(admin) || pattern.test(controller) || pattern.test(dataGateway)) {
    throw new Error(`Potential secret detected by Admin V2 gate: ${pattern}`);
  }
}

console.log("Admin V2 contract OK");
