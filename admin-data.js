(function (global) {
  "use strict";

  const DEFAULT_KEYS = Object.freeze({
    products: "alma-v2-products",
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

  function createLocalDriver(options = {}) {
    const storage = options.storage || global.localStorage;
    const keys = { ...DEFAULT_KEYS, ...(options.keys || {}) };
    const seedProducts = safeArray(options.seedProducts, []);

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
        if (!product || typeof product !== "object") throw new TypeError("product debe ser un objeto");
        const products = this.listProducts();
        products.unshift(clone(product));
        this.saveProducts(products);
        return clone(product);
      },

      updateProduct(productId, patch) {
        if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new TypeError("patch debe ser un objeto");
        const products = this.listProducts();
        const product = products.find(item => item.id === productId);
        if (!product) return false;
        Object.assign(product, clone(patch), { id: product.id });
        this.saveProducts(products);
        return clone(product);
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
    version: 1,
    createLocalDriver
  });
})(window);
