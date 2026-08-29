(function (global) {
  "use strict";

  const DEFAULT_KEYS = Object.freeze({
    products: "alma-v2-products",
    collections: "alma-v2-collections",
    orders: "alma-v2-orders",
    messages: "alma-v2-messages"
  });
  const PRODUCT_STATUSES = new Set(["draft", "published", "hidden", "archived"]);
  const PRICE_MODES = new Set(["fixed", "from", "quote"]);
  const STOCK_MODES = new Set(["available", "made_to_order", "sold_out"]);
  const COLLECTION_STATUSES = new Set(["draft", "published", "hidden", "archived"]);

  function clone(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function safeArray(value, fallback = []) {
    return Array.isArray(value) ? value : fallback;
  }

  function plainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function uniqueIds(items, label) {
    const ids = new Set();
    for (const item of items) {
      const id = String(item.id || "").trim();
      if (!id) throw new TypeError(`${label} necesita id`);
      if (ids.has(id)) throw new Error(`${label} contiene ids duplicados`);
      ids.add(id);
    }
  }

  function normalizeImages(images) {
    if (!Array.isArray(images)) throw new TypeError("images debe ser un array");
    const normalized = images.map((image, index) => {
      if (!plainObject(image)) throw new TypeError("cada imagen debe ser un objeto");
      const src = String(image.src || "").trim();
      if (!src) throw new TypeError("cada imagen necesita src");
      return {
        id: String(image.id || `image-${index + 1}`).trim(),
        src,
        alt: String(image.alt || "").trim(),
        position: index,
        primary: index === 0
      };
    });
    uniqueIds(normalized, "images");
    return normalized;
  }

  function normalizeProduct(product) {
    if (!plainObject(product)) throw new TypeError("product debe ser un objeto");
    const normalized = clone(product);
    const id = String(normalized.id || "").trim();
    const name = String(normalized.name || "").trim();
    if (!id) throw new TypeError("product necesita id");
    if (!name) throw new TypeError("product necesita nombre");

    const status = String(normalized.status || "draft");
    if (!PRODUCT_STATUSES.has(status)) throw new TypeError("status de producto inválido");
    const priceMode = String(normalized.priceMode || (normalized.price == null ? "quote" : "fixed"));
    if (!PRICE_MODES.has(priceMode)) throw new TypeError("priceMode inválido");
    const stockMode = String(normalized.stockMode || (normalized.stock === false ? "sold_out" : "available"));
    if (!STOCK_MODES.has(stockMode)) throw new TypeError("stockMode inválido");

    let price = normalized.price;
    if (priceMode === "quote") {
      price = null;
    } else {
      price = Number(price);
      if (!Number.isFinite(price) || price < 0) throw new TypeError("precio inválido");
    }

    normalized.id = id;
    normalized.name = name;
    normalized.category = String(normalized.category || "").trim();
    normalized.description = String(normalized.description || "").trim();
    normalized.status = status;
    normalized.priceMode = priceMode;
    normalized.price = price;
    normalized.stockMode = stockMode;
    normalized.stock = stockMode !== "sold_out";
    normalized.featured = Boolean(normalized.featured);
    if (Array.isArray(normalized.images)) {
      normalized.images = normalizeImages(normalized.images);
      normalized.image = normalized.images[0]?.src || "";
    }
    return normalized;
  }

  function normalizeCollections(collections) {
    if (!Array.isArray(collections)) throw new TypeError("collections debe ser un array");
    const names = new Set();
    const normalized = collections.map((collection, index) => {
      if (!plainObject(collection)) throw new TypeError("cada colección debe ser un objeto");
      const id = String(collection.id || "").trim();
      const name = String(collection.name || "").trim();
      const status = String(collection.status || "draft");
      if (!id) throw new TypeError("cada colección necesita id");
      if (!name) throw new TypeError("cada colección necesita nombre");
      if (!COLLECTION_STATUSES.has(status)) throw new TypeError("status de colección inválido");
      const normalizedName = name.toLocaleLowerCase("es-ES");
      if (names.has(normalizedName)) throw new Error("collections contiene nombres duplicados");
      names.add(normalizedName);
      return { ...clone(collection), id, name, status, position: index };
    });
    uniqueIds(normalized, "collections");
    return normalized;
  }

  function createLocalDriver(options = {}) {
    const storage = options.storage || global.localStorage;
    const keys = { ...DEFAULT_KEYS, ...(options.keys || {}) };
    const seedProducts = safeArray(options.seedProducts, []);
    const seedCollections = safeArray(options.seedCollections, []);

    function read(key, fallback) {
      try {
        const raw = storage.getItem(key);
        if (raw == null) return clone(fallback);
        const parsed = JSON.parse(raw);
        return parsed ?? clone(fallback);
      } catch (error) {
        console.warn(`Admin data: no se pudo leer ${key}.`, error);
        return clone(fallback);
      }
    }

    function write(key, value) {
      storage.setItem(key, JSON.stringify(value));
      return clone(value);
    }

    function ensureSeed() {
      if (storage.getItem(keys.products) == null) write(keys.products, seedProducts);
      if (storage.getItem(keys.collections) == null) write(keys.collections, normalizeCollections(seedCollections));
      if (storage.getItem(keys.orders) == null) write(keys.orders, []);
      if (storage.getItem(keys.messages) == null) write(keys.messages, []);
    }

    ensureSeed();

    return Object.freeze({
      kind: "local",
      isRemote: false,

      async listProducts() {
        return safeArray(read(keys.products, seedProducts));
      },

      async saveProducts(products) {
        if (!Array.isArray(products)) throw new TypeError("products debe ser un array");
        const normalized = products.map(normalizeProduct);
        uniqueIds(normalized, "products");
        return write(keys.products, normalized);
      },

      async listCollections() {
        return safeArray(read(keys.collections, normalizeCollections(seedCollections)));
      },

      async saveCollections(collections) {
        return write(keys.collections, normalizeCollections(collections));
      },

      async listOrders() {
        return safeArray(read(keys.orders, []));
      },

      async saveOrders(orders) {
        if (!Array.isArray(orders)) throw new TypeError("orders debe ser un array");
        return write(keys.orders, orders);
      },

      async listMessages() {
        return safeArray(read(keys.messages, []));
      },

      async saveMessages(messages) {
        if (!Array.isArray(messages)) throw new TypeError("messages debe ser un array");
        return write(keys.messages, messages);
      },

      async createProduct(product) {
        const next = normalizeProduct(product);
        const products = await this.listProducts();
        if (products.some(item => item.id === next.id)) throw new Error("ya existe un producto con ese id");
        products.unshift(next);
        await this.saveProducts(products);
        return clone(next);
      },

      async updateProduct(productId, patch) {
        if (!plainObject(patch)) throw new TypeError("patch debe ser un objeto");
        const products = await this.listProducts();
        const product = products.find(item => item.id === productId);
        if (!product) return false;
        const safePatch = clone(patch);
        Object.assign(product, safePatch, { id: product.id });
        Object.assign(product, normalizeProduct(product), { id: product.id });
        await this.saveProducts(products);
        return clone(product);
      },

      async setProductImages(productId, images) {
        const normalized = normalizeImages(images);
        const result = await this.updateProduct(productId, { images: normalized, image: normalized[0]?.src || "" });
        return result || false;
      },

      async setProductAvailability(productId, available) {
        return Boolean(await this.updateProduct(productId, {
          stock: Boolean(available),
          stockMode: available ? "available" : "sold_out"
        }));
      },

      async deleteProduct(productId) {
        const products = await this.listProducts();
        const next = products.filter(item => item.id !== productId);
        if (next.length === products.length) return false;
        await this.saveProducts(next);
        return true;
      },

      async createCollection(collection) {
        if (!plainObject(collection)) throw new TypeError("collection debe ser un objeto");
        const collections = await this.listCollections();
        if (collections.some(item => item.id === collection.id)) throw new Error("ya existe una colección con ese id");
        const next = { ...clone(collection), position: collections.length };
        const saved = await this.saveCollections([...collections, next]);
        return clone(saved.find(item => item.id === next.id));
      },

      async updateCollection(collectionId, patch) {
        if (!plainObject(patch)) throw new TypeError("patch debe ser un objeto");
        const collections = await this.listCollections();
        const collection = collections.find(item => item.id === collectionId);
        if (!collection) return false;
        const position = collection.position;
        Object.assign(collection, clone(patch), { id: collection.id, position });
        await this.saveCollections(collections);
        return clone((await this.listCollections()).find(item => item.id === collectionId));
      },

      async reorderCollections(collectionIds) {
        if (!Array.isArray(collectionIds)) throw new TypeError("collectionIds debe ser un array");
        const collections = await this.listCollections();
        if (collectionIds.length !== collections.length) throw new Error("el orden debe incluir todas las colecciones");
        const requested = collectionIds.map(id => String(id));
        if (new Set(requested).size !== requested.length) throw new Error("el orden contiene ids duplicados");
        const byId = new Map(collections.map(collection => [collection.id, collection]));
        if (requested.some(id => !byId.has(id))) throw new Error("el orden contiene colecciones desconocidas");
        return this.saveCollections(requested.map(id => byId.get(id)));
      },

      async deleteCollection(collectionId) {
        const collections = await this.listCollections();
        const next = collections.filter(item => item.id !== collectionId);
        if (next.length === collections.length) return false;
        const products = await this.listProducts();
        if (products.some(product => product.category === collectionId)) {
          throw new Error("no se puede eliminar una colección con productos asociados");
        }
        await this.saveCollections(next);
        return true;
      },

      async updateOrderStatus(orderId, status) {
        const orders = await this.listOrders();
        const order = orders.find(item => item.id === orderId);
        if (!order) return false;
        order.status = String(status);
        await this.saveOrders(orders);
        return true;
      },

      async markMessageRead(messageId) {
        const messages = await this.listMessages();
        const message = messages.find(item => item.id === messageId);
        if (!message) return false;
        message.status = "Leído";
        await this.saveMessages(messages);
        return true;
      }
    });
  }

  const POCKETBASE_COLLECTIONS = Object.freeze({
    products: "sinprisa_products",
    collections: "sinprisa_collections",
    images: "sinprisa_product_images",
    orders: "sinprisa_orders",
    orderItems: "sinprisa_order_items",
    messages: "sinprisa_messages"
  });
  const ORDER_STATUS_TO_POCKETBASE = Object.freeze({
    "Solicitud recibida": "pending",
    "Pendiente de Bizum": "confirmed",
    "En preparación": "preparing",
    "Enviado": "shipped",
    "Completado": "completed",
    "Cancelado": "cancelled"
  });
  const ORDER_STATUS_FROM_POCKETBASE = Object.freeze({
    pending: "Solicitud recibida",
    confirmed: "Pendiente de Bizum",
    preparing: "En preparación",
    ready: "En preparación",
    shipped: "Enviado",
    completed: "Completado",
    cancelled: "Cancelado"
  });
  const MESSAGE_STATUS_TO_POCKETBASE = Object.freeze({
    Nuevo: "new",
    "Leído": "read",
    Respondido: "replied",
    Archivado: "archived"
  });
  const MESSAGE_STATUS_FROM_POCKETBASE = Object.freeze({
    new: "Nuevo",
    read: "Leído",
    replied: "Respondido",
    archived: "Archivado"
  });

  function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function slugify(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function numericOrNull(value, priceMode) {
    if (priceMode === "quote" || value == null || value === "") return null;
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) throw new TypeError("precio inválido");
    return number;
  }

  function createPocketBaseError(name, message, status) {
    const error = new Error(message);
    error.name = name;
    error.status = status;
    return error;
  }

  function createPocketBaseDriver(options = {}) {
    const configuredUrl = String(options.url || "").trim();
    if (!configuredUrl) throw new TypeError("PocketBase necesita una URL en tiempo de ejecución");
    if (typeof options.fetch !== "function") throw new TypeError("PocketBase necesita fetch en tiempo de ejecución");

    let parsedUrl;
    try {
      parsedUrl = new URL(configuredUrl);
    } catch {
      throw new TypeError("URL de PocketBase inválida");
    }
    if (!/^https?:$/.test(parsedUrl.protocol)) throw new TypeError("PocketBase requiere una URL HTTP o HTTPS");

    const baseUrl = parsedUrl.toString().replace(/\/$/, "");
    const runtimeFetch = options.fetch;
    const tokenSource = options.token;

    async function runtimeToken() {
      const value = typeof tokenSource === "function" ? await tokenSource() : tokenSource;
      const token = String(value || "").trim();
      if (!token) {
        throw createPocketBaseError("PocketBaseAuthError", "Falta autenticación de PocketBase", 401);
      }
      return token;
    }

    async function request(path, requestOptions = {}) {
      const token = await runtimeToken();
      const query = new URLSearchParams(requestOptions.query || {});
      const url = `${baseUrl}${path}${query.size ? `?${query}` : ""}`;
      const headers = {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(requestOptions.headers || {})
      };
      let body = requestOptions.body;
      const formDataBody = typeof FormData !== "undefined" && body instanceof FormData;
      if (body != null && !formDataBody) {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(body);
      }

      const response = await runtimeFetch(url, {
        method: requestOptions.method || "GET",
        headers,
        body
      });

      if (response.status === 404 && requestOptions.allowNotFound) return null;
      if (response.status === 401) {
        throw createPocketBaseError("PocketBaseAuthError", "La sesión de PocketBase no es válida", 401);
      }
      if (response.status === 403) {
        throw createPocketBaseError("PocketBasePermissionError", "PocketBase denegó la operación", 403);
      }
      if (!response.ok) {
        throw createPocketBaseError("PocketBaseRequestError", `PocketBase respondió con HTTP ${response.status}`, response.status);
      }
      if (response.status === 204) return null;

      const text = await response.text();
      return text ? JSON.parse(text) : null;
    }

    function recordsPath(collection, recordId = "") {
      const base = `/api/collections/${encodeURIComponent(collection)}/records`;
      return recordId ? `${base}/${encodeURIComponent(recordId)}` : base;
    }

    async function listRecords(collection, query = {}) {
      const payload = await request(recordsPath(collection), {
        query: { perPage: "500", ...query }
      });
      return safeArray(payload?.items, []);
    }

    async function findRecord(collection, recordId) {
      return request(recordsPath(collection, recordId), { allowNotFound: true });
    }

    function imageSource(record) {
      const filename = String(record.original || "");
      if (!filename) return "";
      return `${baseUrl}/api/files/${encodeURIComponent(POCKETBASE_COLLECTIONS.images)}/${encodeURIComponent(record.id)}/${encodeURIComponent(filename)}`;
    }

    function mapImage(record, index) {
      return {
        id: String(record.id),
        src: imageSource(record),
        alt: String(record.alt_text || ""),
        position: Number(record.sort_order ?? index),
        primary: Boolean(record.is_cover),
        filename: String(record.original || "")
      };
    }

    function mapProduct(record, imageRecords = []) {
      const priceMode = String(record.price_mode || (record.price == null ? "quote" : "fixed"));
      const images = imageRecords
        .filter(image => image.product === record.id)
        .sort((left, right) => Number(right.is_cover) - Number(left.is_cover) || Number(left.sort_order) - Number(right.sort_order))
        .map(mapImage)
        .map((image, index) => ({ ...image, position: index, primary: index === 0 }));
      const price = numericOrNull(record.price, priceMode);
      return {
        id: String(record.id),
        name: String(record.name || ""),
        slug: String(record.slug || ""),
        category: String(record.collection || ""),
        shortDescription: String(record.short_description || ""),
        description: String(record.description || ""),
        price,
        priceMode,
        status: String(record.status || "draft"),
        stockMode: String(record.stock_mode || "available"),
        stock: record.stock_mode !== "sold_out",
        featured: Boolean(record.featured),
        position: Number(record.sort_order || 0),
        publishedAt: record.published_at || null,
        images,
        image: images[0]?.src || "",
        createdAt: record.created || null,
        updatedAt: record.updated || null,
        custom: true
      };
    }

    function mapCollection(record, index = 0) {
      return {
        id: String(record.id),
        name: String(record.name || ""),
        slug: String(record.slug || ""),
        description: String(record.description || ""),
        status: String(record.status || "draft"),
        position: Number(record.sort_order ?? index),
        createdAt: record.created || null,
        updatedAt: record.updated || null
      };
    }

    function productPayload(product, partial = false) {
      if (!plainObject(product)) throw new TypeError("product debe ser un objeto");
      const payload = {};
      const set = (sourceKey, targetKey, transform = value => value) => {
        if (!partial || hasOwn(product, sourceKey)) payload[targetKey] = transform(product[sourceKey]);
      };
      set("name", "name", value => String(value || "").trim());
      if (!partial || hasOwn(product, "slug") || hasOwn(product, "name")) {
        payload.slug = slugify(product.slug || product.name || product.id);
      }
      set("category", "collection", value => String(value || "").trim());
      set("shortDescription", "short_description", value => String(value || "").trim());
      set("description", "description", value => String(value || "").trim());
      set("priceMode", "price_mode", value => String(value || "fixed"));
      if (!partial || hasOwn(product, "price") || product.priceMode === "quote") {
        payload.price = numericOrNull(product.price, product.priceMode || payload.price_mode);
      }
      set("status", "status", value => String(value || "draft"));
      set("stockMode", "stock_mode", value => String(value || "available"));
      set("featured", "featured", Boolean);
      set("position", "sort_order", value => Math.max(0, Number(value) || 0));
      set("publishedAt", "published_at", value => value || "");
      return payload;
    }

    function collectionPayload(collection, partial = false) {
      if (!plainObject(collection)) throw new TypeError("collection debe ser un objeto");
      const payload = {};
      if (!partial || hasOwn(collection, "name")) payload.name = String(collection.name || "").trim();
      if (!partial || hasOwn(collection, "slug") || hasOwn(collection, "name")) {
        payload.slug = slugify(collection.slug || collection.name || collection.id);
      }
      if (!partial || hasOwn(collection, "description")) payload.description = String(collection.description || "");
      if (!partial || hasOwn(collection, "status")) payload.status = String(collection.status || "draft");
      if (!partial || hasOwn(collection, "position")) payload.sort_order = Math.max(0, Number(collection.position) || 0);
      return payload;
    }

    function dataUrlFile(image, index) {
      if (typeof Blob !== "undefined" && image.file instanceof Blob) return image.file;
      const source = String(image.src || "");
      const match = source.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
      if (!match) return null;
      const mimeType = match[1] || "application/octet-stream";
      let bytes;
      if (match[2]) {
        const decoded = atob(match[3]);
        bytes = Uint8Array.from(decoded, char => char.charCodeAt(0));
      } else {
        bytes = new TextEncoder().encode(decodeURIComponent(match[3]));
      }
      const extension = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" })[mimeType] || "bin";
      const filename = image.name || `image-${index + 1}.${extension}`;
      if (typeof File !== "undefined") return new File([bytes], filename, { type: mimeType });
      const blob = new Blob([bytes], { type: mimeType });
      Object.defineProperty(blob, "name", { value: filename });
      return blob;
    }

    function imageForm(productId, image, index, file) {
      const form = new FormData();
      form.append("product", productId);
      form.append("alt_text", String(image.alt || ""));
      form.append("sort_order", String(index));
      form.append("is_cover", String(index === 0));
      const filename = image.name || file.name || `image-${index + 1}`;
      form.append("original", file, filename);
      return form;
    }

    function mapOrderItem(record) {
      return {
        id: String(record.id),
        product: record.product || null,
        name: String(record.product_name_snapshot || ""),
        quantity: Number(record.quantity || 0),
        unitPrice: Number(record.unit_price || 0),
        customization: String(record.customization || "")
      };
    }

    function mapOrder(record, orderItems = []) {
      return {
        id: String(record.id),
        number: String(record.number || ""),
        customer: String(record.customer || ""),
        status: ORDER_STATUS_FROM_POCKETBASE[record.status] || String(record.status || ""),
        paymentStatus: String(record.payment_status || ""),
        subtotal: Number(record.subtotal || 0),
        shipping: Number(record.shipping || 0),
        total: Number(record.total || 0),
        internalNotes: String(record.internal_notes || ""),
        items: orderItems.filter(item => item.order === record.id).map(mapOrderItem),
        createdAt: record.created || null,
        updatedAt: record.updated || null
      };
    }

    function orderPayload(order, partial = false) {
      if (!plainObject(order)) throw new TypeError("order debe ser un objeto");
      const payload = {};
      const put = (sourceKey, targetKey, transform = value => value) => {
        if (!partial || hasOwn(order, sourceKey)) payload[targetKey] = transform(order[sourceKey]);
      };
      put("number", "number", value => String(value || order.reference || order.id || ""));
      put("customer", "customer", value => String(value || ""));
      put("status", "status", value => ORDER_STATUS_TO_POCKETBASE[value] || String(value || "pending"));
      put("paymentStatus", "payment_status", value => String(value || "pending"));
      put("subtotal", "subtotal", value => Math.max(0, Number(value) || 0));
      put("shipping", "shipping", value => Math.max(0, Number(value) || 0));
      put("total", "total", value => Math.max(0, Number(value) || 0));
      put("internalNotes", "internal_notes", value => String(value || ""));
      return payload;
    }

    function mapMessage(record) {
      return {
        id: String(record.id),
        name: String(record.name || ""),
        email: String(record.email || ""),
        subject: String(record.subject || ""),
        body: String(record.body || ""),
        status: MESSAGE_STATUS_FROM_POCKETBASE[record.status] || String(record.status || ""),
        createdAt: record.created || null,
        updatedAt: record.updated || null
      };
    }

    function messagePayload(message, partial = false) {
      if (!plainObject(message)) throw new TypeError("message debe ser un objeto");
      const payload = {};
      for (const field of ["name", "email", "subject", "body"]) {
        if (!partial || hasOwn(message, field)) payload[field] = String(message[field] || "");
      }
      if (!partial || hasOwn(message, "status")) {
        payload.status = MESSAGE_STATUS_TO_POCKETBASE[message.status] || String(message.status || "new");
      }
      return payload;
    }

    const driver = {
      kind: "pocketbase",
      isRemote: true,

      async listProducts() {
        const [products, images] = await Promise.all([
          listRecords(POCKETBASE_COLLECTIONS.products, { sort: "sort_order,created" }),
          listRecords(POCKETBASE_COLLECTIONS.images, { sort: "sort_order,created" })
        ]);
        return products.map(product => mapProduct(product, images));
      },

      async saveProducts(products) {
        if (!Array.isArray(products)) throw new TypeError("products debe ser un array");
        const current = await this.listProducts();
        const currentIds = new Set(current.map(product => product.id));
        const requestedIds = new Set(products.map(product => String(product.id || "")));
        for (const product of products) {
          if (currentIds.has(String(product.id))) await this.updateProduct(String(product.id), product);
          else await this.createProduct(product);
        }
        for (const product of current) {
          if (!requestedIds.has(product.id)) await this.deleteProduct(product.id);
        }
        return this.listProducts();
      },

      async createProduct(product) {
        const normalized = normalizeProduct({ ...product, id: product.id || "remote-product" });
        if (!normalized.category) throw new TypeError("product necesita colección");
        const created = await request(recordsPath(POCKETBASE_COLLECTIONS.products), {
          method: "POST",
          body: productPayload(normalized)
        });
        try {
          if (safeArray(product.images, []).length) await this.setProductImages(created.id, product.images);
        } catch (error) {
          try {
            await request(recordsPath(POCKETBASE_COLLECTIONS.products, created.id), { method: "DELETE" });
          } catch {
            // Preserve the upload error; cleanup can be retried explicitly.
          }
          throw error;
        }
        const images = await listRecords(POCKETBASE_COLLECTIONS.images, { filter: `product="${created.id}"`, sort: "sort_order" });
        return mapProduct(created, images);
      },

      async updateProduct(productId, patch) {
        if (!plainObject(patch)) throw new TypeError("patch debe ser un objeto");
        const current = await findRecord(POCKETBASE_COLLECTIONS.products, productId);
        if (!current) return false;
        const updated = await request(recordsPath(POCKETBASE_COLLECTIONS.products, productId), {
          method: "PATCH",
          body: productPayload(patch, true)
        });
        if (hasOwn(patch, "images")) return this.setProductImages(productId, patch.images);
        const images = await listRecords(POCKETBASE_COLLECTIONS.images, { filter: `product="${productId}"`, sort: "sort_order" });
        return mapProduct(updated, images);
      },

      async setProductImages(productId, images) {
        if (!Array.isArray(images)) throw new TypeError("images debe ser un array");
        const product = await findRecord(POCKETBASE_COLLECTIONS.products, productId);
        if (!product) return false;
        const current = await listRecords(POCKETBASE_COLLECTIONS.images, { filter: `product="${productId}"`, sort: "sort_order" });
        const currentById = new Map(current.map(image => [String(image.id), image]));
        const retained = new Set();

        for (const [index, image] of images.entries()) {
          if (!plainObject(image)) throw new TypeError("cada imagen debe ser un objeto");
          const currentImage = currentById.get(String(image.id || ""));
          const file = dataUrlFile(image, index);
          if (currentImage) {
            retained.add(String(currentImage.id));
            const body = file ? imageForm(productId, image, index, file) : {
              alt_text: String(image.alt || ""),
              sort_order: index,
              is_cover: index === 0
            };
            await request(recordsPath(POCKETBASE_COLLECTIONS.images, currentImage.id), { method: "PATCH", body });
          } else {
            if (!file) throw new TypeError("cada imagen nueva necesita un archivo o Data URL");
            const created = await request(recordsPath(POCKETBASE_COLLECTIONS.images), {
              method: "POST",
              body: imageForm(productId, image, index, file)
            });
            retained.add(String(created.id));
          }
        }

        for (const image of current) {
          if (!retained.has(String(image.id))) {
            await request(recordsPath(POCKETBASE_COLLECTIONS.images, image.id), { method: "DELETE" });
          }
        }
        const savedImages = await listRecords(POCKETBASE_COLLECTIONS.images, { filter: `product="${productId}"`, sort: "sort_order" });
        return mapProduct(product, savedImages);
      },

      async setProductAvailability(productId, available) {
        return Boolean(await this.updateProduct(productId, {
          stockMode: available ? "available" : "sold_out"
        }));
      },

      async deleteProduct(productId) {
        const current = await findRecord(POCKETBASE_COLLECTIONS.products, productId);
        if (!current) return false;
        await request(recordsPath(POCKETBASE_COLLECTIONS.products, productId), { method: "DELETE" });
        return true;
      },

      async listCollections() {
        const records = await listRecords(POCKETBASE_COLLECTIONS.collections, { sort: "sort_order,created" });
        return records.map(mapCollection);
      },

      async saveCollections(collections) {
        const normalized = normalizeCollections(collections);
        const current = await this.listCollections();
        const currentIds = new Set(current.map(collection => collection.id));
        const requestedIds = new Set(normalized.map(collection => collection.id));
        for (const collection of normalized) {
          if (currentIds.has(collection.id)) await this.updateCollection(collection.id, collection);
          else await this.createCollection(collection);
        }
        for (const collection of current) {
          if (!requestedIds.has(collection.id)) await this.deleteCollection(collection.id);
        }
        return this.listCollections();
      },

      async createCollection(collection) {
        const normalized = normalizeCollections([{ ...collection, id: collection.id || "remote-collection" }])[0];
        const created = await request(recordsPath(POCKETBASE_COLLECTIONS.collections), {
          method: "POST",
          body: collectionPayload(normalized)
        });
        return mapCollection(created);
      },

      async updateCollection(collectionId, patch) {
        if (!plainObject(patch)) throw new TypeError("patch debe ser un objeto");
        const current = await findRecord(POCKETBASE_COLLECTIONS.collections, collectionId);
        if (!current) return false;
        const updated = await request(recordsPath(POCKETBASE_COLLECTIONS.collections, collectionId), {
          method: "PATCH",
          body: collectionPayload(patch, true)
        });
        return mapCollection(updated);
      },

      async reorderCollections(collectionIds) {
        if (!Array.isArray(collectionIds)) throw new TypeError("collectionIds debe ser un array");
        const collections = await this.listCollections();
        const requested = collectionIds.map(String);
        if (requested.length !== collections.length) throw new Error("el orden debe incluir todas las colecciones");
        if (new Set(requested).size !== requested.length) throw new Error("el orden contiene ids duplicados");
        const byId = new Map(collections.map(collection => [collection.id, collection]));
        if (requested.some(id => !byId.has(id))) throw new Error("el orden contiene colecciones desconocidas");
        await Promise.all(requested.map((id, position) => this.updateCollection(id, { position })));
        return this.listCollections();
      },

      async deleteCollection(collectionId) {
        const current = await findRecord(POCKETBASE_COLLECTIONS.collections, collectionId);
        if (!current) return false;
        await request(recordsPath(POCKETBASE_COLLECTIONS.collections, collectionId), { method: "DELETE" });
        return true;
      },

      async listOrders() {
        const [orders, items] = await Promise.all([
          listRecords(POCKETBASE_COLLECTIONS.orders, { sort: "-created" }),
          listRecords(POCKETBASE_COLLECTIONS.orderItems, { sort: "created" })
        ]);
        return orders.map(order => mapOrder(order, items));
      },

      async saveOrders(orders) {
        if (!Array.isArray(orders)) throw new TypeError("orders debe ser un array");
        const saved = [];
        for (const order of orders) {
          const current = order.id ? await findRecord(POCKETBASE_COLLECTIONS.orders, order.id) : null;
          const record = await request(recordsPath(POCKETBASE_COLLECTIONS.orders, current ? order.id : ""), {
            method: current ? "PATCH" : "POST",
            body: orderPayload(order, Boolean(current))
          });
          saved.push(mapOrder(record));
        }
        return saved;
      },

      async updateOrderStatus(orderId, status) {
        const current = await findRecord(POCKETBASE_COLLECTIONS.orders, orderId);
        if (!current) return false;
        await request(recordsPath(POCKETBASE_COLLECTIONS.orders, orderId), {
          method: "PATCH",
          body: { status: ORDER_STATUS_TO_POCKETBASE[status] || String(status) }
        });
        return true;
      },

      async listMessages() {
        const records = await listRecords(POCKETBASE_COLLECTIONS.messages, { sort: "-created" });
        return records.map(mapMessage);
      },

      async saveMessages(messages) {
        if (!Array.isArray(messages)) throw new TypeError("messages debe ser un array");
        const saved = [];
        for (const message of messages) {
          const current = message.id ? await findRecord(POCKETBASE_COLLECTIONS.messages, message.id) : null;
          const record = await request(recordsPath(POCKETBASE_COLLECTIONS.messages, current ? message.id : ""), {
            method: current ? "PATCH" : "POST",
            body: messagePayload(message, Boolean(current))
          });
          saved.push(mapMessage(record));
        }
        return saved;
      },

      async markMessageRead(messageId) {
        const current = await findRecord(POCKETBASE_COLLECTIONS.messages, messageId);
        if (!current) return false;
        await request(recordsPath(POCKETBASE_COLLECTIONS.messages, messageId), {
          method: "PATCH",
          body: { status: "read" }
        });
        return true;
      }
    };

    return Object.freeze(driver);
  }

  global.AlmaAdminData = Object.freeze({
    version: 2,
    createLocalDriver,
    createPocketBaseDriver
  });
})(window);
