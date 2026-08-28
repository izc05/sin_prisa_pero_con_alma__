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

  function normalizeImages(images) {
    if (!Array.isArray(images)) throw new TypeError("images debe ser un array");
    return images.map((image, index) => {
      if (!plainObject(image)) throw new TypeError("cada imagen debe ser un objeto");
      const src = String(image.src || "").trim();
      if (!src) throw new TypeError("cada imagen necesita src");
      return {
        id: String(image.id || `image-${index + 1}`),
        src,
        alt: String(image.alt || "").trim(),
        position: index,
        primary: index === 0
      };
    });
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
      if (storage.getItem(keys.collections) == null) write(keys.collections, seedCollections);
      if (storage.getItem(keys.orders) == null) write(keys.orders, []);
      if (storage.getItem(keys.messages) == null) write(keys.messages, []);
    }

    ensureSeed();

    return Object.freeze({
      kind: "local",
      isRemote: false,

      listProducts() {
        return safeArray(read(keys.products, seedProducts));
      },

      saveProducts(products) {
        if (!Array.isArray(products)) throw new TypeError("products debe ser un array");
        return write(keys.products, products);
      },

      listCollections() {
        return safeArray(read(keys.collections, seedCollections));
      },

      saveCollections(collections) {
        if (!Array.isArray(collections)) throw new TypeError("collections debe ser un array");
        return write(keys.collections, collections);
      },

      listOrders() {
        return safeArray(read(keys.orders, []));
      },

      saveOrders(orders) {
        if (!Array.isArray(orders)) throw new TypeError("orders debe ser un array");
        return write(keys.orders, orders);
      },

      listMessages() {
        return safeArray(read(keys.messages, []));
      },

      saveMessages(messages) {
        if (!Array.isArray(messages)) throw new TypeError("messages debe ser un array");
        return write(keys.messages, messages);
      },

      createProduct(product) {
        if (!plainObject(product)) throw new TypeError("product debe ser un objeto");
        const products = this.listProducts();
        if (products.some(item => item.id === product.id)) throw new Error("ya existe un producto con ese id");
        const next = clone(product);
        if (Array.isArray(next.images)) next.images = normalizeImages(next.images);
        products.unshift(next);
        this.saveProducts(products);
        return clone(next);
      },

      updateProduct(productId, patch) {
        if (!plainObject(patch)) throw new TypeError("patch debe ser un objeto");
        const products = this.listProducts();
        const product = products.find(item => item.id === productId);
        if (!product) return false;
        const safePatch = clone(patch);
        if (Object.hasOwn(safePatch, "images")) safePatch.images = normalizeImages(safePatch.images);
        Object.assign(product, safePatch, { id: product.id });
        this.saveProducts(products);
        return clone(product);
      },

      setProductImages(productId, images) {
        const normalized = normalizeImages(images);
        const result = this.updateProduct(productId, { images: normalized, image: normalized[0]?.src || "" });
        return result || false;
      },

      setProductAvailability(productId, available) {
        return Boolean(this.updateProduct(productId, { stock: Boolean(available) }));
      },

      deleteProduct(productId) {
        const products = this.listProducts();
        const next = products.filter(item => item.id !== productId);
        if (next.length === products.length) return false;
        this.saveProducts(next);
        return true;
      },

      createCollection(collection) {
        if (!plainObject(collection)) throw new TypeError("collection debe ser un objeto");
        const collections = this.listCollections();
        if (collections.some(item => item.id === collection.id)) throw new Error("ya existe una colección con ese id");
        const next = clone(collection);
        collections.push(next);
        this.saveCollections(collections);
        return clone(next);
      },

      updateCollection(collectionId, patch) {
        if (!plainObject(patch)) throw new TypeError("patch debe ser un objeto");
        const collections = this.listCollections();
        const collection = collections.find(item => item.id === collectionId);
        if (!collection) return false;
        Object.assign(collection, clone(patch), { id: collection.id });
        this.saveCollections(collections);
        return clone(collection);
      },

      deleteCollection(collectionId) {
        const collections = this.listCollections();
        const next = collections.filter(item => item.id !== collectionId);
        if (next.length === collections.length) return false;
        this.saveCollections(next);
        return true;
      },

      updateOrderStatus(orderId, status) {
        const orders = this.listOrders();
        const order = orders.find(item => item.id === orderId);
        if (!order) return false;
        order.status = String(status);
        this.saveOrders(orders);
        return true;
      },

      markMessageRead(messageId) {
        const messages = this.listMessages();
        const message = messages.find(item => item.id === messageId);
        if (!message) return false;
        message.status = "Leído";
        this.saveMessages(messages);
        return true;
      }
    });
  }

  global.AlmaAdminData = Object.freeze({
    version: 2,
    createLocalDriver
  });
})(window);