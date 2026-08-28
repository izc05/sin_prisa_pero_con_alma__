(function (global) {
  "use strict";

  const DEFAULT_KEYS = Object.freeze({
    products: "alma-v2-products",
    collections: "alma-v2-collections",
    orders: "alma-v2-orders",
    messages: "alma-v2-messages"
  });

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

  function normalizeCollections(collections) {
    if (!Array.isArray(collections)) throw new TypeError("collections debe ser un array");
    const normalized = collections.map((collection, index) => {
      if (!plainObject(collection)) throw new TypeError("cada colección debe ser un objeto");
      const id = String(collection.id || "").trim();
      if (!id) throw new TypeError("cada colección necesita id");
      return { ...clone(collection), id, position: index };
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
        return write(keys.products, products);
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
        if (!plainObject(product)) throw new TypeError("product debe ser un objeto");
        const products = await this.listProducts();
        if (products.some(item => item.id === product.id)) throw new Error("ya existe un producto con ese id");
        const next = clone(product);
        if (Array.isArray(next.images)) next.images = normalizeImages(next.images);
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
        if (Object.hasOwn(safePatch, "images")) safePatch.images = normalizeImages(safePatch.images);
        Object.assign(product, safePatch, { id: product.id });
        await this.saveProducts(products);
        return clone(product);
      },

      async setProductImages(productId, images) {
        const normalized = normalizeImages(images);
        const result = await this.updateProduct(productId, { images: normalized, image: normalized[0]?.src || "" });
        return result || false;
      },

      async setProductAvailability(productId, available) {
        return Boolean(await this.updateProduct(productId, { stock: Boolean(available) }));
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
        await this.saveCollections([...collections, next]);
        return clone(next);
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

  global.AlmaAdminData = Object.freeze({
    version: 2,
    createLocalDriver
  });
})(window);
