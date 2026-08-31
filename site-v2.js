(function () {
  "use strict";

  const KEYS = {
    products: "alma-v2-products",
    cart: "alma-v2-cart",
    users: "alma-v2-users",
    session: "alma-v2-session",
    orders: "alma-v2-orders",
    orderRequest: "alma-v2-order-request",
    messages: "alma-v2-messages",
    adminPin: "alma-v2-admin-pin",
    welcomeSeen: "alma-welcome-seen",
    storageNotice: "alma-storage-notice",
    catalogSnapshot: "alma-v2-public-catalog-snapshot"
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const uid = (prefix) => `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const requestId = () => {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0"));
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
  };
  const money = (value) => value == null ? "Consultar" : new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(value);
  const dateText = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Sin fecha" : new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "long", year: "numeric" }).format(date);
  };
  const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  const statusTone = (status = "") => `status--${String(status).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-")}`;

  if (!localStorage.getItem(KEYS.orders)) write(KEYS.orders, []);
  if (!localStorage.getItem(KEYS.messages)) write(KEYS.messages, []);

  let catalogProducts = [];
  let catalogCollections = [];
  const shopParams = new URLSearchParams(window.location.search);
  let activeShopFilter = shopParams.get("categoria") || "todos";
  let activeAvailabilityFilter = shopParams.get("disponibilidad") || "all";
  let customerCommissions = [];
  let customerCommissionsError = "";
  let customerOrders = [];
  let customerOrdersError = "";
  let refreshShopFilters = () => {};
  const getProducts = () => catalogProducts;
  const getCart = () => read(KEYS.cart, []);
  let customerSession = null;
  const getSession = () => customerSession;

  async function apiJson(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      ...options,
      headers: { Accept: "application/json", ...(options.headers || {}) }
    });
    let payload = {};
    try { payload = await response.json(); } catch {}
    if (!response.ok) {
      const error = new Error(payload.error || "No se pudo completar la solicitud");
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  async function loadCustomerSession() {
    try {
      const payload = await apiJson("/api/account/session");
      customerSession = payload.user || null;
    } catch {
      customerSession = null;
    }
    return customerSession;
  }

  async function loadCatalog() {
    let payload;
    try {
      payload = await apiJson("/api/catalog");
      write(KEYS.catalogSnapshot, payload);
    } catch {
      payload = read(KEYS.catalogSnapshot, null);
      if (!payload && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
        try { payload = await fetch("assets/catalog-preview.json").then(response => response.ok ? response.json() : Promise.reject()); } catch {}
      }
      if (!payload) { catalogCollections = []; catalogProducts = []; return catalogProducts; }
    }
    try {
      catalogCollections = (Array.isArray(payload.collections) ? payload.collections : [])
        .filter(collection => collection && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(collection.id || "")))
        .map(collection => ({ id: String(collection.id), name: String(collection.name || "") }))
        .filter(collection => collection.name);
      catalogProducts = (Array.isArray(payload.products) ? payload.products : [])
        .filter(product => product && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(product.id || "")))
        .map(product => ({
          id: String(product.id),
          name: String(product.name || ""),
          category: String(product.category || ""),
          description: String(product.description || ""),
          price: product.price == null ? null : Number(product.price),
          priceMode: String(product.priceMode || (product.price == null ? "quote" : "fixed")),
          stockMode: String(product.stockMode || "available"),
          stock: product.stockMode !== "sold_out",
          featured: Boolean(product.featured),
          image: String(product.image || ""),
          imageAlt: String(product.imageAlt || product.name || ""),
          images: (Array.isArray(product.images) ? product.images : []).map(image => ({ src: String(image.src || ""), alt: String(image.alt || product.name || "") })).filter(image => image.src),
          badge: product.stockMode === "made_to_order" ? "Bajo pedido" : "Disponible"
        }))
        .filter(product => product.name && product.category && product.image && (product.price == null || Number.isFinite(product.price)));
    } catch { catalogCollections = []; catalogProducts = []; }
    return catalogProducts;
  }

  function toast(message) {
    let node = $("#site-toast");
    if (!node) {
      node = document.createElement("div");
      node.id = "site-toast";
      node.className = "toast";
      node.setAttribute("role", "status");
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.classList.add("is-visible");
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => node.classList.remove("is-visible"), 2800);
  }

  function setupNavigation() {
    const toggle = $(".menu-toggle");
    const nav = $(".main-nav");
    if (toggle && nav) {
      toggle.addEventListener("click", () => {
        const open = nav.classList.toggle("is-open");
        toggle.setAttribute("aria-expanded", String(open));
      });
      $$('a', nav).forEach(link => link.addEventListener("click", () => nav.classList.remove("is-open")));
    }
  }

  function setupWelcome() {
    const welcome = $("#welcome");
    if (!welcome) return;
    document.body.classList.add("no-scroll");
    const video = $(".welcome-video", welcome);
    let closed = false;
    const onKeydown = event => {
      if (event.key === "Escape") closeWelcome();
    };
    const closeWelcome = () => {
      if (closed) return;
      closed = true;
      write(KEYS.welcomeSeen, true);
      video?.pause();
      welcome.classList.add("is-hidden");
      document.body.classList.remove("no-scroll");
      window.removeEventListener("keydown", onKeydown);
      window.setTimeout(() => welcome.remove(), 650);
    };
    if (read(KEYS.welcomeSeen, false)) {
      closeWelcome();
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      closeWelcome();
      return;
    }
    $("[data-welcome-enter]", welcome)?.addEventListener("click", closeWelcome, { once: true });
    video?.addEventListener("ended", closeWelcome, { once: true });
    video?.addEventListener("error", closeWelcome, { once: true });
    window.addEventListener("keydown", onKeydown);
    video?.play().catch(closeWelcome);
  }

  function setupStorageNotice() {
    if (read(KEYS.storageNotice, false)) return;
    const notice = document.createElement("section");
    notice.className = "cookie-notice";
    notice.setAttribute("role", "dialog");
    notice.setAttribute("aria-labelledby", "cookie-notice-title");
    notice.innerHTML = `<div><strong id="cookie-notice-title">Tu privacidad, con calma</strong><p>Esta web solo usa almacenamiento funcional para la cesta y las preferencias de uso. No incorpora analítica ni publicidad.</p><a href="legal.html#cookies">Ver política de cookies</a></div><button type="button" class="button button--primary" data-storage-notice-close>Entendido</button>`;
    document.body.appendChild(notice);
    $("[data-storage-notice-close]", notice).addEventListener("click", () => {
      write(KEYS.storageNotice, true);
      notice.remove();
    });
  }

  function productCard(product) {
    const detailUrl = `producto.html?pieza=${encodeURIComponent(product.id)}`;
    const customLink = `<a class="product-custom-link" href="encargos.html#formulario?pieza=${encodeURIComponent(product.id)}">Personalizar esta pieza</a>`;
    const action = product.price == null
      ? `<a class="button button--outline" href="encargos.html#formulario?pieza=${encodeURIComponent(product.id)}">Contar mi idea</a>`
      : `<div class="product-actions"><button class="button button--outline" type="button" data-add-cart="${escapeHtml(product.id)}">Añadir a la cesta</button>${customLink}</div>`;
    const availability = product.stockMode === "made_to_order" ? "Bajo pedido · lo preparamos para ti" : "Disponible ahora";
    return `<article class="product-card" data-category="${escapeHtml(product.category)}">
      <a class="product-image-wrap" href="${detailUrl}" aria-label="Ver ficha de ${escapeHtml(product.name)}">
        <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.imageAlt || product.name)}" loading="lazy">
        <span class="product-badge">${escapeHtml(product.badge || "Hecho a mano")}</span>
      </a>
      <div class="product-info">
        <h3><a href="${detailUrl}">${escapeHtml(product.name)}</a></h3>
        <span class="product-price">${money(product.price)}</span>
        <p>${escapeHtml(product.description)}</p>
        <small class="product-availability product-availability--${escapeHtml(product.stockMode)}">${availability}</small>
        ${action}
      </div>
    </article>`;
  }

  function renderProducts() {
    $$("[data-product-grid]").forEach(grid => {
      const limit = Number(grid.dataset.limit || 0);
      const products = getProducts().filter(product => product.stock !== false);
      grid.innerHTML = products.length
        ? (limit ? products.slice(0, limit) : products).map(productCard).join("")
        : `<div class="empty-state catalog-empty"><strong>Estamos preparando nuevas piezas.</strong><p>Muy pronto aparecerán aquí. Mientras tanto, puedes contarnos tu idea para crear algo único.</p><a class="button button--primary" href="encargos.html">Crear un encargo</a></div>`;
    });
  }

  function renderCategoryFilters() {
    const group = $("[data-category-filters]");
    if (!group) return;
    group.innerHTML = [
      { id: "todos", name: "Todo" },
      ...catalogCollections
    ].map(collection => `<button class="filter-button${activeShopFilter === collection.id ? " is-active" : ""}" type="button" data-filter="${escapeHtml(collection.id)}">${escapeHtml(collection.name)}</button>`).join("");
  }

  function renderCategoryCovers() {
    const root = $("[data-category-covers]");
    if (!root) return;
    const coverByCategory = {
      bebe: "assets/category-covers/bebe-generica.webp",
      regalo: "assets/category-covers/regalo-generica.webp",
      hogar: "assets/category-covers/hogar-generica.webp",
      encargo: "assets/category-covers/encargo-generica.webp",
      "bautizos-comuniones": "assets/category-covers/bautizos-comuniones-generica.webp",
      bodas: "assets/category-covers/bodas-generica.webp",
      navidad: "assets/category-covers/navidad-generica.webp",
      complementos: "assets/category-covers/complementos-generica.webp"
    };
    root.innerHTML = catalogCollections.map(collection => {
      const cover = coverByCategory[collection.id];
      if (!cover) return "";
      return `<a class="category-cover" href="tienda.html?categoria=${encodeURIComponent(collection.id)}#catalogo"><img src="${cover}" alt="Inspiración para la categoría ${escapeHtml(collection.name)}" loading="lazy"><span>${escapeHtml(collection.name)}</span></a>`;
    }).join("");
  }

  function setupShopFilters() {
    const grid = $("#shop-grid");
    if (!grid) return;
    const filterGroup = $("[data-category-filters]");
    const search = $("#shop-search");
    const availability = $("#shop-availability");
    const sort = $("#shop-sort");
    const results = $("#shop-results");
    if (!catalogCollections.some(collection => collection.id === activeShopFilter)) activeShopFilter = "todos";
    if (!["all", "available", "made_to_order"].includes(activeAvailabilityFilter)) activeAvailabilityFilter = "all";
    if (availability) availability.value = activeAvailabilityFilter;
    const update = () => {
      const term = (search?.value || "").trim().toLowerCase();
      let products = getProducts().filter(p => p.stock !== false && (activeShopFilter === "todos" || p.category === activeShopFilter) && (activeAvailabilityFilter === "all" || p.stockMode === activeAvailabilityFilter) && `${p.name} ${p.description}`.toLowerCase().includes(term));
      if (sort?.value === "price-asc") products.sort((a,b) => (a.price ?? 9999) - (b.price ?? 9999));
      if (sort?.value === "price-desc") products.sort((a,b) => (b.price ?? -1) - (a.price ?? -1));
      if (results) results.textContent = `${products.length} ${products.length === 1 ? "pieza encontrada" : "piezas encontradas"}`;
      grid.innerHTML = products.length ? products.map(productCard).join("") : `<div class="empty-state catalog-empty"><strong>Estamos preparando nuevas piezas.</strong><p>Muy pronto aparecerán aquí. Mientras tanto, puedes contarnos tu idea para crear algo único.</p><a class="button button--primary" href="encargos.html">Crear un encargo</a></div>`;
    };
    filterGroup?.addEventListener("click", event => {
      const button = event.target.closest("[data-filter]");
      if (!button || !filterGroup.contains(button)) return;
      activeShopFilter = button.dataset.filter;
      $$("[data-filter]", filterGroup).forEach(item => item.classList.toggle("is-active", item === button));
      update();
    });
    search?.addEventListener("input", update);
    availability?.addEventListener("change", () => { activeAvailabilityFilter = availability.value; update(); });
    sort?.addEventListener("change", update);
    refreshShopFilters = update;
    update();
  }

  function setupProductDetail() {
    const root = $("#product-detail-root");
    if (!root) return;
    const hash = window.location.hash.slice(1);
    const hashParams = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : hash;
    const selectedProductId = new URLSearchParams(window.location.search).get("pieza") || new URLSearchParams(hashParams).get("pieza");
    const product = getProducts().find(item => item.id === selectedProductId && item.stock !== false);
    if (!product) {
      root.innerHTML = `<div class="detail-empty"><p class="eyebrow">La pieza no está disponible</p><h1 class="section-title">Volvamos a la colección.</h1><p class="section-copy">Puede que esta pieza ya haya encontrado su casa o que el enlace no sea correcto.</p><a class="button button--primary" href="tienda.html">Ver la tienda</a></div>`;
      return;
    }
    const purchaseAction = product.price == null
      ? `<button class="button button--primary" type="button" data-open-personalizer>Personalizar esta pieza</button>`
      : `<button class="button button--primary" type="button" data-add-cart="${escapeHtml(product.id)}">Añadir a la cesta</button>`;
    const customAction = product.price == null ? "" : `<button class="button button--outline" type="button" data-open-personalizer>Personalizar esta pieza</button>`;
    const availability = product.stockMode === "made_to_order" || product.price == null ? "Bajo pedido · diseñamos y preparamos esta pieza contigo" : "Disponible ahora · confirmaremos el pedido contigo";
    const gallery = product.images?.length ? product.images : [{ src: product.image, alt: product.imageAlt || product.name }];
    root.innerHTML = `<nav class="breadcrumb" aria-label="Ruta"><a href="tienda.html">Tienda</a><span aria-hidden="true">/</span><span>${escapeHtml(product.name)}</span></nav>
      <article class="product-detail">
        <div class="product-detail__gallery"><button class="product-detail__image" type="button" data-product-image-zoom aria-label="Ampliar imagen de ${escapeHtml(product.name)}"><img data-product-main-image src="${escapeHtml(gallery[0].src)}" alt="${escapeHtml(gallery[0].alt)}"><span>Ampliar imagen</span></button>${gallery.length > 1 ? `<div class="product-detail__thumbs">${gallery.map((image, index) => `<button type="button" class="${index === 0 ? "is-active" : ""}" data-product-image-select="${index}" aria-label="Ver imagen ${index + 1}"><img src="${escapeHtml(image.src)}" alt=""></button>`).join("")}</div>` : ""}</div>
        <div class="product-detail__content"><p class="eyebrow">${escapeHtml(product.badge || "Hecho a mano")}</p><h1 class="display-title">${escapeHtml(product.name)}</h1><p class="product-detail__price">${money(product.price)}</p><p class="section-copy">${escapeHtml(product.description)}</p><p class="product-detail__availability">${availability}</p><div class="product-detail__actions">${purchaseAction}${customAction}</div><div class="product-detail__note"><strong>Hecho con calma.</strong><p>Cada pieza se prepara y se revisa a mano. Si tienes dudas sobre medidas, materiales o envío, escríbenos antes de pedirla.</p><a class="text-link" href="https://www.instagram.com/sin_prisa_pero_con_alma__/" target="_blank" rel="noreferrer">Hablar por Instagram</a></div></div>
      </article><section class="product-personalizer panel" id="product-personalizer" hidden></section>`;
    const personalizer = $("#product-personalizer", root);
    $("[data-product-image-zoom]", root)?.addEventListener("click", () => {
      const dialog = document.createElement("dialog");
      dialog.className = "product-image-lightbox";
      const image = $("[data-product-main-image]", root);
      dialog.innerHTML = `<button class="button button--quiet" type="button">Cerrar</button><img src="${escapeHtml(image?.src || product.image)}" alt="${escapeHtml(image?.alt || product.imageAlt || product.name)}">`;
      dialog.addEventListener("click", event => { if (event.target === dialog || event.target.closest("button")) dialog.close(); });
      dialog.addEventListener("close", () => dialog.remove());
      document.body.appendChild(dialog); dialog.showModal();
    });
    $$("[data-product-image-select]", root).forEach(button => button.addEventListener("click", () => {
      const selected = gallery[Number(button.dataset.productImageSelect) || 0];
      const image = $("[data-product-main-image]", root);
      if (image && selected) { image.src = selected.src; image.alt = selected.alt; }
      $$("[data-product-image-select]", root).forEach(item => item.classList.toggle("is-active", item === button));
    }));
    root.addEventListener("click", event => {
      if (!event.target.closest("[data-open-personalizer]")) return;
      const session = getSession();
      if (!session) {
        personalizer.hidden = false;
        personalizer.innerHTML = `<h2 class="section-title">Personaliza esta pieza</h2><p>Para guardar tu idea y tus imágenes de forma privada, entra primero en tu cuenta.</p><a class="button button--primary" href="cuenta.html?continuar=${encodeURIComponent(`producto.html?pieza=${product.id}`)}">Entrar o crear una cuenta</a>`;
      } else {
        personalizer.hidden = false;
        personalizer.innerHTML = `<p class="eyebrow">Personalizar ${escapeHtml(product.name)}</p><h2 class="section-title">Cuéntanos cómo la imaginas.</h2><form class="form-grid" id="product-custom-form"><input type="hidden" name="product_reference" value="${escapeHtml(product.id)}"><input type="hidden" name="product_name" value="${escapeHtml(product.name)}"><div class="field"><label>Tipo de pieza<input name="piece" value="${escapeHtml(product.name)}" readonly></label></div><div class="field"><label>Cantidad<input name="quantity" type="number" min="1" max="20" value="1" required></label></div><div class="field field--full"><label>Fecha u ocasión<input name="occasion" maxlength="200" placeholder="Nacimiento, regalo, boda…"></label></div><div class="field field--full"><label>Tu idea<textarea name="details" minlength="10" maxlength="4000" required placeholder="Cuéntanos colores, nombre, historia o cambios…"></textarea></label></div><div class="field field--full"><label>Imágenes de referencia<input name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple><small>Hasta 4 imágenes de 4 MB cada una.</small></label></div><div class="field field--full"><button class="button button--primary" type="submit">Enviar solicitud privada</button><p class="form-feedback" role="status"></p></div></form>`;
      }
      personalizer.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    root.addEventListener("submit", async event => {
      const form = event.target.closest("#product-custom-form"); if (!form) return;
      event.preventDefault(); const feedback = $(".form-feedback", form); const submit = $("button[type=submit]", form); const data = new FormData(form);
      const files = data.getAll("images").filter(file => file && file.size);
      if (files.length > 4 || files.some(file => file.size > 4 * 1024 * 1024)) { feedback.textContent = "Máximo 4 imágenes de 4 MB cada una."; return; }
      submit.disabled = true; feedback.textContent = "Enviando tu idea de forma privada…";
      try { const payload = await apiJson("/api/commissions", { method: "POST", body: data }); feedback.textContent = `Solicitud ${payload.reference} recibida. Te responderemos pronto.`; form.reset(); }
      catch (error) { feedback.textContent = error.message || "No se pudo enviar la solicitud"; }
      finally { submit.disabled = false; }
    });
  }

  function addToCart(id) {
    const cart = getCart();
    const existing = cart.find(item => item.id === id);
    if (existing) existing.quantity += 1;
    else cart.push({ id, quantity: 1 });
    write(KEYS.cart, cart);
    renderCart();
    toast("Pieza añadida a la cesta");
  }

  function removeFromCart(id) {
    write(KEYS.cart, getCart().filter(item => item.id !== id));
    renderCart();
  }

  function renderCart() {
    const root = $("#cart-root");
    if (!root) return;
    const products = getProducts();
    const cart = getCart();
    const items = cart.map(item => ({ ...item, product: products.find(product => product.id === item.id) })).filter(item => item.product);
    const count = items.reduce((total, item) => total + item.quantity, 0);
    const total = items.reduce((sum, item) => sum + (item.product.price || 0) * item.quantity, 0);
    const session = getSession();
    $$(".cart-count").forEach(node => node.textContent = count);
    root.innerHTML = `<aside class="cart-drawer" id="cart-drawer" aria-label="Cesta" aria-hidden="true">
      <button class="cart-backdrop" type="button" data-close-cart aria-label="Cerrar la cesta"></button>
      <div class="cart-panel">
        <div class="cart-head"><h2>Tu cesta</h2><button type="button" data-close-cart>Cerrar</button></div>
        <div class="cart-items">
          ${items.length ? items.map(item => `<div class="cart-item">
            <img src="${escapeHtml(item.product.image)}" alt="">
            <div><strong>${escapeHtml(item.product.name)}</strong><small>${item.quantity} × ${money(item.product.price)}</small></div>
            <span>${money((item.product.price || 0) * item.quantity)}</span>
            <button type="button" data-remove-cart="${escapeHtml(item.id)}">Quitar</button>
          </div>`).join("") : `<div class="empty-state">La cesta está vacía.<br>Elige una pieza hecha con alma.</div>`}
        </div>
        <div class="cart-footer">
          <div class="cart-total"><strong>Total</strong><strong>${money(total)}</strong></div>
          <form class="cart-checkout" id="checkout-form">
            <div class="cart-checkout__fields">
              <label><span>Nombre</span><input name="name" autocomplete="name" maxlength="120" required value="${escapeHtml(session?.name || "")}"></label>
              <label><span>Correo</span><input name="email" type="email" autocomplete="email" maxlength="254" required value="${escapeHtml(session?.email || "")}"></label>
              <label class="checkout-honeypot" aria-hidden="true"><span>Web</span><input name="website" tabindex="-1" autocomplete="off"></label>
            </div>
            <button class="button button--primary" type="submit" id="checkout-button" ${items.length ? "" : "disabled"}>Enviar solicitud de pedido</button>
            <p class="form-feedback" id="checkout-feedback" role="status"></p>
          </form>
          <p class="form-note">Revisaremos la disponibilidad antes de enviarte los datos de Bizum. Esta solicitud todavía no implica ningún pago.</p>
        </div>
      </div>
    </aside>`;
  }

  function openCart() {
    const drawer = $("#cart-drawer");
    if (!drawer) return;
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    document.body.classList.add("no-scroll");
  }

  function closeCart() {
    const drawer = $("#cart-drawer");
    drawer?.classList.remove("is-open");
    drawer?.setAttribute("aria-hidden", "true");
    document.body.classList.remove("no-scroll");
  }

  async function checkout(form) {
    const cart = getCart();
    const products = getProducts();
    const items = cart.map(item => ({ ...item, product: products.find(p => p.id === item.id) })).filter(i => i.product);
    if (!items.length) return;
    const data = new FormData(form);
    const customer = {
      name: String(data.get("name") || "").trim(),
      email: String(data.get("email") || "").trim().toLowerCase()
    };
    const payload = {
      customer,
      items: items.map(item => ({ productId: item.id, quantity: item.quantity })),
      website: String(data.get("website") || "")
    };
    const fingerprint = await hash(JSON.stringify({ customer, items: payload.items }));
    const previousRequest = read(KEYS.orderRequest, null);
    const idempotencyKey = previousRequest?.fingerprint === fingerprint ? previousRequest.key : requestId();
    write(KEYS.orderRequest, { fingerprint, key: idempotencyKey });

    const submit = $("#checkout-button", form);
    const feedback = $("#checkout-feedback", form);
    submit.disabled = true;
    submit.textContent = "Enviando solicitud…";
    feedback.textContent = "";

    try {
      const response = await fetch("/api/order-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "No hemos podido registrar la solicitud");

      const order = {
        id: result.orderNumber,
        type: "Solicitud de pedido",
        email: customer.email,
        customer: customer.name,
        createdAt: new Date().toISOString(),
        status: "Solicitud recibida",
        paymentStatus: "Pendiente",
        total: Number(result.total || 0),
        items: items.map(item => ({ id: item.id, name: item.product.name, price: item.product.price, quantity: item.quantity }))
      };
      const orders = read(KEYS.orders, []).filter(item => item.id !== order.id);
      orders.unshift(order);
      write(KEYS.orders, orders);
      write(KEYS.cart, []);
      localStorage.removeItem(KEYS.orderRequest);
      renderCart();
      closeCart();
      toast(`Solicitud ${order.id} recibida. Te confirmaremos disponibilidad antes del Bizum.`);
    } catch (error) {
      feedback.textContent = error.message || "No hemos podido registrar la solicitud. Inténtalo de nuevo.";
      submit.disabled = false;
      submit.textContent = "Reintentar solicitud";
    }
  }

  function setupCartEvents() {
    document.addEventListener("click", event => {
      const add = event.target.closest("[data-add-cart]");
      const remove = event.target.closest("[data-remove-cart]");
      if (add) addToCart(add.dataset.addCart);
      if (remove) removeFromCart(remove.dataset.removeCart);
      if (event.target.closest("[data-cart-open]")) openCart();
      if (event.target.closest("[data-close-cart]")) closeCart();
    });
    document.addEventListener("submit", event => {
      if (!event.target.matches("#checkout-form")) return;
      event.preventDefault();
      checkout(event.target);
    });
  }

  async function hash(value) {
    if (!window.crypto?.subtle) return btoa(unescape(encodeURIComponent(value)));
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(bytes)).map(byte => byte.toString(16).padStart(2, "0")).join("");
  }

  function progressMarkup(stages, currentIndex, note = "") {
    const safeIndex = Math.max(0, Math.min(stages.length - 1, Number(currentIndex) || 0));
    return `<div class="customer-progress" aria-label="Progreso: ${escapeHtml(stages[safeIndex])}"><div class="customer-progress__steps">${stages.map((stage, index) => `<span class="${index <= safeIndex ? "is-done" : ""} ${index === safeIndex ? "is-current" : ""}"><i aria-hidden="true"></i>${escapeHtml(stage)}</span>`).join("")}</div>${note ? `<p>${escapeHtml(note)}</p>` : ""}</div>`;
  }

  function orderProgress(order) {
    const stages = ["Recibido", "Preparación", "Completado"];
    const status = String(order.status || "").toLowerCase();
    if (status.includes("cancel")) return `<p class="customer-status-note is-cancelled">Este pedido fue cancelado. Si tienes dudas, escríbenos desde tu encargo o por contacto.</p>`;
    const current = status.includes("complet") || status.includes("enviado") ? 2 : status.includes("prepar") ? 1 : 0;
    const note = current === 0 ? "Hemos recibido tu solicitud y la revisaremos contigo." : current === 1 ? "Tu pedido está siendo preparado con calma." : "El pedido ha completado esta fase.";
    return progressMarkup(stages, current, note);
  }

  function commissionProgress(commission) {
    const stages = ["Recibido", "Presupuesto", "Aceptado", "En proceso", "Terminado"];
    const status = String(commission.status || "new");
    if (status === "cancelled" || status === "rejected") return `<p class="customer-status-note is-cancelled">Este encargo está cerrado. Puedes crear otro cuando quieras.</p>`;
    const position = { new: 0, reviewing: 0, quoted: 1, accepted: 2, in_progress: 3, completed: 4 }[status] ?? 0;
    const notes = ["Hemos recibido tu idea y la estamos revisando.", "Te enviaremos los detalles del presupuesto en la conversación.", "El encargo está reservado para ti.", "Estamos preparando tu pieza.", "Tu encargo está terminado."];
    return progressMarkup(stages, position, notes[position]);
  }

  function orderMarkup(order, admin = false) {
    const tone = String(order.status || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-");
    const details = order.items?.length ? order.items.map(item => `${escapeHtml(item.name)} × ${item.quantity}`).join(" · ") : escapeHtml(order.details || "Encargo personalizado");
    return `<article class="order-card">
      <div class="order-head"><div><h3>${escapeHtml(order.number || order.id)}</h3><span class="status status--${tone}">${escapeHtml(order.status)}</span></div><strong>${money(order.total)}</strong></div>
      <p>${escapeHtml(order.type)} · ${dateText(order.createdAt)}${admin ? ` · ${escapeHtml(order.email)}` : ""}</p>
      <p>${details}</p>
      ${admin ? "" : orderProgress(order)}
      ${admin ? `<label class="field"><span>Actualizar estado</span><select data-order-status="${escapeHtml(order.id)}"><option ${order.status === "Solicitud recibida" ? "selected" : ""}>Solicitud recibida</option><option ${order.status === "Pendiente de Bizum" ? "selected" : ""}>Pendiente de Bizum</option><option ${order.status === "En preparación" ? "selected" : ""}>En preparación</option><option ${order.status === "Enviado" ? "selected" : ""}>Enviado</option><option ${order.status === "Completado" ? "selected" : ""}>Completado</option></select></label>` : ""}
    </article>`;
  }

  function renderAccount() {
    const page = $("#account-page");
    if (!page) return;
    const session = getSession();
    const auth = $("#auth-panel");
    const dashboard = $("#account-dashboard");
    auth.hidden = Boolean(session);
    dashboard.hidden = !session;
    if (!session) return;
    $("#account-name").textContent = session.name;
    $("#account-email").textContent = session.email;
    const profileForm = $("#account-profile-form");
    if (profileForm) {
      for (const field of ["name", "phone", "address_line1", "address_line2", "postal_code", "city", "province", "country"]) {
        if (profileForm.elements[field]) profileForm.elements[field].value = session[field] || (field === "country" ? "España" : "");
      }
    }
    const activeOrders = customerOrders.filter(order => !/cancelado|completado/i.test(String(order.status || "")));
    const activeCommissions = customerCommissions.filter(commission => !["cancelled", "rejected", "completed"].includes(String(commission.status || "")));
    const setAccountText = (selector, value) => { const node = $(selector); if (node) node.textContent = value; };
    setAccountText("#account-order-count", customerOrders.length);
    setAccountText("#account-order-copy", customerOrders.length ? `${activeOrders.length} ${activeOrders.length === 1 ? "en curso" : "en curso"}` : "Aún no tienes pedidos");
    setAccountText("#account-commission-count", customerCommissions.length);
    setAccountText("#account-commission-copy", customerCommissions.length ? `${activeCommissions.length} ${activeCommissions.length === 1 ? "activo" : "activos"}` : "Aún no tienes encargos");
    const pendingQuote = customerCommissions.find(commission => String(commission.status) === "quoted");
    const pendingReview = customerCommissions.find(commission => ["new", "reviewing"].includes(String(commission.status)));
    const activeCommission = customerCommissions.find(commission => ["accepted", "in_progress"].includes(String(commission.status)));
    if (pendingQuote) {
      setAccountText("#account-next-title", "Tienes un presupuesto");
      setAccountText("#account-next-copy", `Revisa la conversación de ${pendingQuote.reference} para continuar.`);
    } else if (pendingReview) {
      setAccountText("#account-next-title", "Estamos revisando tu idea");
      setAccountText("#account-next-copy", `Te escribiremos en ${pendingReview.reference} cuando haya novedades.`);
    } else if (activeCommission) {
      setAccountText("#account-next-title", "Tu encargo está en marcha");
      setAccountText("#account-next-copy", `Puedes consultar el progreso de ${activeCommission.reference} abajo.`);
    } else if (activeOrders.length) {
      setAccountText("#account-next-title", "Tienes un pedido en curso");
      setAccountText("#account-next-copy", "Consulta abajo el estado actualizado.");
    } else {
      setAccountText("#account-next-title", "Todo al día");
      setAccountText("#account-next-copy", "Aquí verás las novedades de tus pedidos y encargos.");
    }
    const ordersList = $("#customer-orders");
    if (ordersList) {
      ordersList.innerHTML = customerOrders.length ? customerOrders.map(order => orderMarkup(order)).join("") : `<div class="empty-state">${customerOrdersError ? `No hemos podido cargar tus pedidos ahora mismo. ${escapeHtml(customerOrdersError)}` : "Aún no tienes pedidos. Cuando confirmes uno, verás aquí su estado."}</div>`;
    }
    const list = $("#customer-commissions");
    if (list) {
      const statusLabels = { new: "Solicitud recibida", reviewing: "En revisión", quoted: "Presupuesto enviado", accepted: "Aceptado", in_progress: "En preparación", completed: "Completado", rejected: "No viable", cancelled: "Cancelado" };
      list.innerHTML = customerCommissions.length ? customerCommissions.map(commission => {
        const messages = Array.isArray(commission.messages) ? commission.messages : [];
        const messageCount = messages.length;
        const conversation = messages.length ? `<div class="customer-commission-conversation">${messages.map(message => `<article class="customer-chat-message ${message.author === "atelier" ? "is-atelier" : "is-customer"}"><strong>${message.author === "atelier" ? "Atelier" : "Tú"}</strong><p>${escapeHtml(message.body)}</p></article>`).join("")}</div>` : `<p class="customer-commission-pending">Todavía no hay mensajes. Puedes añadir un detalle si lo necesitas.</p>`;
        const visibleStatus = statusLabels[commission.status] || commission.status || "Solicitud recibida";
        const archiveNote = commission.archived ? `<p class="customer-status-note">Conversación archivada: conservamos este historial para ti.</p>` : "";
        const messageComposer = commission.archived ? "" : `<form data-customer-commission-chat="${escapeHtml(commission.id || "")}"><label><span>Añadir un mensaje</span><textarea name="message" maxlength="4000" required placeholder="Escribe aquí cualquier detalle o respuesta…"></textarea></label><button class="button button--outline" type="submit">Enviar mensaje</button><p class="form-feedback" role="status"></p></form>`;
        const history = Array.isArray(commission.history) ? commission.history : [];
        const historyMarkup = history.length ? `<details class="customer-status-history"><summary>Historial de estados <small>${history.length}</small></summary><ol>${history.map(item => `<li><span class="status ${statusTone(item.status || "new")}">${escapeHtml(statusLabels[item.status] || item.status)}</span><time>${escapeHtml(dateText(item.createdAt))}</time></li>`).join("")}</ol></details>` : "";
        return `<article class="order-card customer-commission-card"><div class="order-head"><div><h3>${escapeHtml(commission.reference)}</h3><span class="status ${statusTone(commission.status || "new")}">${escapeHtml(visibleStatus)}</span></div><strong>${Number(commission.quantity) || 1} ud.</strong></div><p>${escapeHtml(commission.piece || "Encargo personalizado")} · ${dateText(commission.createdAt)}</p><p>${escapeHtml(commission.details || "Tu solicitud está guardada de forma privada.")}</p>${commissionProgress(commission)}${historyMarkup}<details class="customer-commission-thread"><summary><span>Conversación con el atelier</span><small>${messageCount ? `${messageCount} ${messageCount === 1 ? "mensaje" : "mensajes"}` : "Sin mensajes"}</small></summary><div class="customer-commission-thread__content">${conversation}${archiveNote}${messageComposer}</div></details></article>`;
      }).join("") : `<div class="empty-state">${customerCommissionsError ? `No hemos podido cargar tus encargos ahora mismo. ${escapeHtml(customerCommissionsError)} Recarga la página e inténtalo de nuevo.` : "Aún no tienes encargos. Cuando envíes una solicitud, aparecerá aquí."}</div>`;
    }
  }

  async function loadCustomerCommissions() {
    if (!getSession()) {
      customerCommissions = [];
      customerCommissionsError = "";
      renderAccount();
      return;
    }
    try {
      customerCommissionsError = "";
      const payload = await apiJson("/api/account/commissions");
      customerCommissions = Array.isArray(payload.commissions) ? payload.commissions : [];
    } catch (error) {
      customerCommissions = [];
      customerCommissionsError = error.message || "No se pudo conectar con el servidor privado.";
    }
    renderAccount();
  }

  async function loadCustomerOrders() {
    if (!getSession()) { customerOrders = []; customerOrdersError = ""; renderAccount(); return; }
    try {
      customerOrdersError = "";
      const payload = await apiJson("/api/account/orders");
      customerOrders = Array.isArray(payload.orders) ? payload.orders : [];
    } catch (error) { customerOrders = []; customerOrdersError = error.message || "No se pudo conectar con el servidor privado."; }
    renderAccount();
  }

  function setupAccount() {
    if (!$("#account-page")) return;
    const continuation = new URLSearchParams(window.location.search).get("continuar") || "";
    const safeContinuation = /^(?:encargos\.html\?pieza=[a-z0-9]+(?:-[a-z0-9]+)*#formulario|producto\.html\?pieza=[a-z0-9]+(?:-[a-z0-9]+)*)$/.test(continuation) ? continuation : "";
    const continueAfterAuth = () => {
      if (safeContinuation) window.location.assign(safeContinuation);
    };
    const tabs = $$("[data-auth-tab]");
    tabs.forEach(tab => tab.addEventListener("click", () => {
      tabs.forEach(item => item.classList.toggle("is-active", item === tab));
      $("#login-form").hidden = tab.dataset.authTab !== "login";
      $("#register-form").hidden = tab.dataset.authTab !== "register";
    }));
    $("#register-form")?.addEventListener("submit", async event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const feedback = $("#auth-feedback");
      feedback.textContent = "Creando tu cuenta…";
      try {
        const payload = await apiJson("/api/account/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: data.get("name"), email: data.get("email"), password: data.get("password") })
        });
        customerSession = payload.user;
        renderAccount();
        updateIdentityLinks();
        feedback.textContent = "";
        await Promise.all([loadCustomerCommissions(), loadCustomerOrders()]);
        toast("Cuenta creada de forma segura");
        continueAfterAuth();
      } catch (error) {
        feedback.textContent = error.message;
      }
    });
    $("#login-form")?.addEventListener("submit", async event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const feedback = $("#auth-feedback");
      feedback.textContent = "Comprobando tus datos…";
      try {
        const payload = await apiJson("/api/account/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: data.get("email"), password: data.get("password") })
        });
        customerSession = payload.user;
        renderAccount();
        updateIdentityLinks();
        feedback.textContent = "";
        await Promise.all([loadCustomerCommissions(), loadCustomerOrders()]);
        toast("Sesión iniciada");
        continueAfterAuth();
      } catch (error) {
        feedback.textContent = error.message;
      }
    });
    $("#logout-button")?.addEventListener("click", async () => {
      try { await apiJson("/api/account/logout", { method: "POST" }); } catch {}
      customerSession = null;
      renderAccount();
      updateIdentityLinks();
    });
    $("#account-profile-form")?.addEventListener("submit", async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const feedback = $("#profile-feedback");
      const submit = $("button[type=submit]", form);
      feedback.textContent = "Guardando tus datos…";
      submit.disabled = true;
      try {
        const data = new FormData(form);
        const body = Object.fromEntries(["name", "phone", "address_line1", "address_line2", "postal_code", "city", "province", "country"].map(field => [field, data.get(field)]));
        const payload = await apiJson("/api/account/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        customerSession = payload.user || customerSession;
        renderAccount();
        updateIdentityLinks();
        feedback.textContent = "Tus datos se han guardado.";
      } catch (error) {
        feedback.textContent = error.message || "No se pudieron guardar tus datos";
      } finally {
        submit.disabled = false;
      }
    });
    $("#customer-commissions")?.addEventListener("submit", async event => {
      const form = event.target.closest("[data-customer-commission-chat]");
      if (!form) return;
      event.preventDefault();
      const feedback = $(".form-feedback", form);
      const submit = $("button[type=submit]", form);
      const message = String(new FormData(form).get("message") || "").trim();
      feedback.textContent = "Enviando mensaje…";
      submit.disabled = true;
      try {
        await apiJson("/api/account/commission-messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ commission: form.dataset.customerCommissionChat, message }) });
        await loadCustomerCommissions();
      } catch (error) {
        feedback.textContent = error.message || "No se pudo enviar el mensaje";
        submit.disabled = false;
      }
    });
    renderAccount();
  }

  function setupCustomOrder() {
    const form = $("#custom-order-form");
    if (!form) return;
    const session = getSession();
    const authRequired = $("#custom-auth-required");
    if (!session) {
      form.hidden = true;
      if (authRequired) {
        authRequired.hidden = false;
        const selectedProductId = new URLSearchParams(window.location.search).get("pieza");
        const continuation = selectedProductId ? `encargos.html?pieza=${selectedProductId}#formulario` : "encargos.html#formulario";
        const loginLink = $("a", authRequired);
        if (loginLink) loginLink.href = `cuenta.html?continuar=${encodeURIComponent(continuation)}`;
      }
      return;
    }
    form.hidden = false;
    if (authRequired) authRequired.hidden = true;
    if (session) {
      form.elements.name.value = session.name;
      form.elements.email.value = session.email;
    }
    const selectedProductId = new URLSearchParams(window.location.search).get("pieza") || new URLSearchParams(window.location.hash.split("?")[1] || "").get("pieza");
    const selectedProduct = getProducts().find(product => product.id === selectedProductId);
    if (selectedProduct) {
      const pieceByCategory = { bebe: "Babero", regalo: "Bolsa o saquito", hogar: "Bastidor decorativo" };
      form.elements.piece.value = pieceByCategory[selectedProduct.category] || "Otra idea";
      form.elements.product_reference.value = selectedProduct.id;
      form.elements.product_name.value = selectedProduct.name;
      form.elements.details.value = `Quiero personalizar la pieza “${selectedProduct.name}”. `;
      const note = $("#custom-order-prefill");
      if (note) {
        note.hidden = false;
        note.textContent = `Has elegido personalizar: ${selectedProduct.name}. Cuéntanos cómo la imaginas.`;
      }
      form.scrollIntoView({ block: "center" });
    }
    const imageInput = $("#custom-images");
    imageInput?.addEventListener("change", () => {
      const files = Array.from(imageInput.files || []);
      const preview = $("#custom-image-preview");
      if (files.length > 4 || files.some(file => file.size > 4 * 1024 * 1024)) {
        imageInput.value = "";
        preview.textContent = "Máximo 4 imágenes de 4 MB cada una.";
        return;
      }
      preview.innerHTML = files.map(file => `<span>${escapeHtml(file.name)}</span>`).join("");
    });
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const data = new FormData(form);
      const feedback = $("#custom-feedback");
      const submit = form.querySelector("button[type=submit]");
      feedback.textContent = "Enviando tu idea de forma privada…";
      submit.disabled = true;
      try {
        const payload = await apiJson("/api/commissions", { method: "POST", body: data });
        feedback.textContent = `Solicitud ${payload.reference} recibida. Te responderemos para concretar diseño y presupuesto.`;
        form.reset();
        if ($("#custom-image-preview")) $("#custom-image-preview").innerHTML = "";
        form.elements.name.value = session.name;
        form.elements.email.value = session.email;
      } catch (error) {
        feedback.textContent = error.message;
        if (error.status === 401 && authRequired) {
          customerSession = null;
          form.hidden = true;
          authRequired.hidden = false;
        }
      } finally {
        submit.disabled = false;
      }
    });
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function renderAdmin() {
    const orders = read(KEYS.orders, []);
    const messages = read(KEYS.messages, []);
    const products = getProducts();
    $("#metric-products").textContent = products.length;
    $("#metric-orders").textContent = orders.length;
    $("#metric-messages").textContent = messages.filter(item => item.status !== "Leído").length;
    $("#admin-orders").innerHTML = orders.length ? orders.map(order => orderMarkup(order, true)).join("") : `<div class="empty-state">No hay pedidos todavía.</div>`;
    $("#admin-messages").innerHTML = messages.length ? messages.map(message => `<article class="message-card"><span class="status">${escapeHtml(message.status)}</span><h3>${escapeHtml(message.subject)}</h3><p>${escapeHtml(message.name)} · ${escapeHtml(message.email)} · ${dateText(message.createdAt)}</p><p>${escapeHtml(message.body)}</p><button class="button button--quiet" type="button" data-read-message="${escapeHtml(message.id)}">Marcar como leído</button></article>`).join("") : `<div class="empty-state">No hay mensajes todavía.</div>`;
    $("#admin-products").innerHTML = products.map(product => `<article class="admin-product-row"><img src="${escapeHtml(product.image)}" alt=""><div class="admin-product-copy"><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.category)} · ${money(product.price)}</small></div><button class="button button--outline" type="button" data-toggle-stock="${escapeHtml(product.id)}">${product.stock === false ? "Activar" : "Ocultar"}</button>${product.custom ? `<button class="button danger" type="button" data-delete-product="${escapeHtml(product.id)}">Eliminar</button>` : ""}</article>`).join("");
  }

  function unlockAdmin() {
    $("#admin-lock").hidden = true;
    $("#admin-dashboard").hidden = false;
    renderAdmin();
  }

  function setupAdmin() {
    if (!$("#admin-page")) return;
    const hasPin = Boolean(localStorage.getItem(KEYS.adminPin));
    $("#admin-lock-title").textContent = hasPin ? "Entrar en administración" : "Crear acceso local";
    $("#admin-pin-hint").textContent = hasPin ? "Introduce el PIN creado en este navegador." : "Crea un PIN de al menos 4 cifras para proteger esta demo local.";
    $("#admin-pin-form").addEventListener("submit", async event => {
      event.preventDefault();
      const pin = String(new FormData(event.currentTarget).get("pin"));
      if (pin.length < 4) { $("#admin-lock-feedback").textContent = "El PIN debe tener al menos 4 caracteres."; return; }
      const digest = await hash(pin);
      const saved = localStorage.getItem(KEYS.adminPin);
      if (!saved) { localStorage.setItem(KEYS.adminPin, digest); unlockAdmin(); return; }
      if (saved !== digest) { $("#admin-lock-feedback").textContent = "PIN incorrecto."; return; }
      unlockAdmin();
    });
    $$("[data-admin-view]").forEach(button => button.addEventListener("click", () => {
      $$("[data-admin-view]").forEach(item => item.classList.toggle("is-active", item === button));
      $$(".admin-view").forEach(view => view.hidden = view.id !== `admin-view-${button.dataset.adminView}`);
    }));
    $("#product-form")?.addEventListener("submit", async event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const file = data.get("image");
      const image = file && file.size ? await fileToDataUrl(file) : "assets/detalle-bordado.jpeg";
      const products = getProducts();
      products.unshift({ id: uid("PROD"), name: String(data.get("name")), category: String(data.get("category")), description: String(data.get("description")), price: data.get("price") ? Number(data.get("price")) : null, image, badge: "Nueva pieza", stock: true, custom: true });
      write(KEYS.products, products);
      event.currentTarget.reset();
      renderAdmin();
      toast("Producto añadido al catálogo local");
    });
    document.addEventListener("change", event => {
      if (!event.target.matches("[data-order-status]")) return;
      const orders = read(KEYS.orders, []);
      const order = orders.find(item => item.id === event.target.dataset.orderStatus);
      if (order) order.status = event.target.value;
      write(KEYS.orders, orders);
      toast("Estado actualizado");
    });
    document.addEventListener("click", event => {
      const stock = event.target.closest("[data-toggle-stock]");
      const remove = event.target.closest("[data-delete-product]");
      const readMessage = event.target.closest("[data-read-message]");
      if (stock) { const products = getProducts(); const product = products.find(item => item.id === stock.dataset.toggleStock); if (product) product.stock = product.stock === false; write(KEYS.products, products); renderAdmin(); }
      if (remove) { write(KEYS.products, getProducts().filter(item => item.id !== remove.dataset.deleteProduct)); renderAdmin(); }
      if (readMessage) { const messages = read(KEYS.messages, []); const message = messages.find(item => item.id === readMessage.dataset.readMessage); if (message) message.status = "Leído"; write(KEYS.messages, messages); renderAdmin(); }
    });
  }

  function updateIdentityLinks() {
    const session = getSession();
    $$(".account-link").forEach(link => link.textContent = session ? `Hola, ${session.name.split(" ")[0]}` : "Mi cuenta");
  }

  setupNavigation();
  setupWelcome();
  setupStorageNotice();
  renderProducts();
  setupShopFilters();
  renderCart();
  setupCartEvents();
  setupAdmin();
  (async () => {
    await Promise.all([loadCustomerSession(), loadCatalog()]);
    renderCategoryFilters();
    renderCategoryCovers();
    renderProducts();
    refreshShopFilters();
    setupProductDetail();
    renderCart();
    setupAccount();
    await Promise.all([loadCustomerCommissions(), loadCustomerOrders()]);
    setupCustomOrder();
    updateIdentityLinks();
  })();
})();
