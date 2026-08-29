import { readFileSync } from "node:fs";

const admin = readFileSync(new URL("../admin.html", import.meta.url), "utf8");
const controller = readFileSync(new URL("../admin-v2-page.js", import.meta.url), "utf8");
const dataGateway = readFileSync(new URL("../admin-data.js", import.meta.url), "utf8");
const adminStyles = readFileSync(new URL("../admin-v2.css", import.meta.url), "utf8");
const adminControls = readFileSync(new URL("../admin-v2-controls.css", import.meta.url), "utf8");

const requiredAdminFragments = [
  'id="admin-page"',
  'id="admin-pin-form"',
  'data-admin-view="summary"',
  'data-admin-view="products"',
  'data-admin-view="collections"',
  'data-admin-view="orders"',
  'data-admin-view="messages"',
  'id="product-form"',
  'id="product-category"',
  'id="collection-form"',
  'id="admin-collections"',
  'name="priceMode"',
  'name="stockMode"',
  'name="status"',
  'name="featured"',
  'name="imageAlt"',
  'multiple',
  'id="admin-orders"',
  'id="admin-messages"',
  'id="metric-visible"',
  'id="product-list-meta"',
  'id="product-search"',
  'id="product-filter-collection"',
  'id="product-filter-status"',
  'id="product-filter-stock"',
  'href="admin-v2.css"',
  'href="admin-v2-controls.css"',
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

if (controller.includes('createPocketBaseDriver(')) {
  throw new Error("PocketBase driver must remain inactive until runtime authentication is integrated");
}

const requiredControllerFragments = [
  'window.AlmaAdminData.createLocalDriver',
  'function setupAdmin()',
  'async function renderAdmin()',
  'function productMarkup(product, collections)',
  'data-save-product',
  'adminData.listProducts()',
  'adminData.listOrders()',
  'adminData.listMessages()',
  'adminData.createProduct(',
  'adminData.createCollection(',
  'adminData.updateCollection(',
  'adminData.deleteCollection(',
  'adminData.setProductImages(',
  'data-add-product-images',
  'data-make-primary',
  'data-remove-image',
  'adminData.updateProduct(',
  'adminData.deleteProduct(',
  'adminData.updateOrderStatus(',
  'adminData.markMessageRead(',
  'metric-visible',
  'product-list-meta',
  'renderProductCatalog(products, collections)',
  'renderProductCategoryOptions(collections)',
  'product-filter-collection',
  'priceMode',
  'stockMode',
  'featured'
];

for (const fragment of requiredControllerFragments) {
  if (!controller.includes(fragment)) {
    throw new Error(`Admin V2 controller contract missing: ${fragment}`);
  }
}

const requiredGatewayFragments = [
  'global.AlmaAdminData',
  'createLocalDriver',
  'createPocketBaseDriver',
  'sinprisa_products',
  'sinprisa_collections',
  'sinprisa_product_images',
  'sinprisa_orders',
  'sinprisa_messages',
  'async listProducts()',
  'async createProduct(product)',
  'async updateProduct(productId, patch)',
  'listProducts()',
  'saveProducts(products)',
  'listOrders()',
  'saveOrders(orders)',
  'listMessages()',
  'saveMessages(messages)',
  'createProduct(product)',
  'updateProduct(productId, patch)',
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

const requiredStyleFragments = [
  'body[data-page="admin"]',
  '.admin-statusbar',
  '.admin-chip',
  '.admin-view-head',
  '.admin-product-state',
  '@media (max-width: 760px)'
];

for (const fragment of requiredStyleFragments) {
  if (!adminStyles.includes(fragment)) {
    throw new Error(`Admin V2 style contract missing: ${fragment}`);
  }
}

const requiredControlFragments = [
  '.admin-product-tags',
  '.admin-row-field',
  '.admin-check',
  '.admin-product-state--featured'
];

for (const fragment of requiredControlFragments) {
  if (!adminControls.includes(fragment)) {
    throw new Error(`Admin V2 control style contract missing: ${fragment}`);
  }
}

const forbiddenPatterns = [
  /sk-[A-Za-z0-9_-]{16,}/,
  /ghp_[A-Za-z0-9]{20,}/,
  /BEGIN OPENSSH PRIVATE KEY/,
  /cloudflare.{0,20}(token|secret).{0,5}[:=].{0,5}["'][^"']+/i,
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/,
  /BEGIN (?:RSA |OPENSSH )?PRIVATE KEY/,
  /token\s*:\s*["'][A-Za-z0-9._~-]{24,}["']/i
];

for (const pattern of forbiddenPatterns) {
  if (pattern.test(admin) || pattern.test(controller) || pattern.test(dataGateway) || pattern.test(adminStyles) || pattern.test(adminControls)) {
    throw new Error(`Potential secret detected by Admin V2 gate: ${pattern}`);
  }
}

if (dataGateway.includes("127.0.0.1:8092")) {
  throw new Error("PocketBase URL must be supplied at runtime");
}

console.log("Admin V2 contract OK");
