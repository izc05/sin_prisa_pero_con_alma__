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
    storageNotice: "alma-storage-notice"
  };

  const seedProducts = [
    { id: "babero-danna", name: "Babero Danna", category: "bebé", description: "Lino lavado, volante y bordado de ocas y flores.", price: 28, image: "assets/babero-danna.jpeg", badge: "Disponible", stock: true },
    { id: "bolsa-jardin", name: "Bolsa Jardín", category: "regalo", description: "Bolsa de lino bordada puntada a puntada.", price: 22, image: "assets/bolsa-flores.jpeg", badge: "Pieza única", stock: true },
    { id: "bastidor-botanico", name: "Bastidor Botánico", category: "hogar", description: "Pequeño paisaje floral para guardar un recuerdo.", price: 35, image: "assets/detalle-bordado.jpeg", badge: "Hecho a mano", stock: true },
    { id: "encargo-personal", name: "Bordado a medida", category: "encargo", description: "Una pieza creada desde tu historia, nombre o idea.", price: null, image: "assets/encargo-bordado.jpeg", badge: "Por encargo", stock: true }
  ];

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
  const dateText = (value) => new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));
  const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);

  if (!localStorage.getItem(KEYS.products)) write(KEYS.products, seedProducts);
  if (!localStorage.getItem(KEYS.orders)) write(KEYS.orders, []);
  if (!localStorage.getItem(KEYS.messages)) write(KEYS.messages, []);

  const getProducts = () => read(KEYS.products, seedProducts);
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
      video?.pause();
      welcome.classList.add("is-hidden");
      document.body.classList.remove("no-scroll");
      window.removeEventListener("keydown", onKeydown);
      window.setTimeout(() => welcome.remove(), 650);
    };
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
    const detailUrl = `producto.html#pieza=${encodeURIComponent(product.id)}`;
    const customLink = `<a class="product-custom-link" href="encargos.html#formulario?pieza=${encodeURIComponent(product.id)}">Personalizar esta pieza</a>`;
    const action = product.price == null
      ? `<a class="button button--outline" href="encargos.html#formulario?pieza=${encodeURIComponent(product.id)}">Contar mi idea</a>`
      : `<div class="product-actions"><button class="button button--outline" type="button" data-add-cart="${escapeHtml(product.id)}">Añadir a la cesta</button>${customLink}</div>`;
    return `<article class="product-card" data-category="${escapeHtml(product.category)}">
      <a class="product-image-wrap" href="${detailUrl}" aria-label="Ver ficha de ${escapeHtml(product.name)}">
        <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy">
        <span class="product-badge">${escapeHtml(product.badge || "Hecho a mano")}</span>
      </a>
      <div class="product-info">
        <h3><a href="${detailUrl}">${escapeHtml(product.name)}</a></h3>
        <span class="product-price">${money(product.price)}</span>
        <p>${escapeHtml(product.description)}</p>
        ${action}
      </div>
    </article>`;
  }

  function renderProducts() {
    $$("[data-product-grid]").forEach(grid => {
      const limit = Number(grid.dataset.limit || 0);
      const products = getProducts().filter(product => product.stock !== false);
      grid.innerHTML = (limit ? products.slice(0, limit) : products).map(productCard).join("");
    });
  }

  function setupShopFilters() {
    const grid = $("#shop-grid");
    if (!grid) return;
    const filters = $$("[data-filter]");
    const search = $("#shop-search");
    const sort = $("#shop-sort");
    let active = "todos";
    const update = () => {
      const term = (search?.value || "").trim().toLowerCase();
      let products = getProducts().filter(p => p.stock !== false && (active === "todos" || p.category === active) && `${p.name} ${p.description}`.toLowerCase().includes(term));
      if (sort?.value === "price-asc") products.sort((a,b) => (a.price ?? 9999) - (b.price ?? 9999));
      if (sort?.value === "price-desc") products.sort((a,b) => (b.price ?? -1) - (a.price ?? -1));
      grid.innerHTML = products.length ? products.map(productCard).join("") : `<div class="empty-state">No hay piezas con estos filtros.</div>`;
    };
    filters.forEach(button => button.addEventListener("click", () => {
      active = button.dataset.filter;
      filters.forEach(item => item.classList.toggle("is-active", item === button));
      update();
    }));
    search?.addEventListener("input", update);
    sort?.addEventListener("change", update);
  }

  function setupProductDetail() {
    const root = $("#product-detail-root");
    if (!root) return;
    const selectedProductId = new URLSearchParams(window.location.hash.split("?")[1] || window.location.search).get("pieza");
    const product = getProducts().find(item => item.id === selectedProductId && item.stock !== false);
    if (!product) {
      root.innerHTML = `<div class="detail-empty"><p class="eyebrow">La pieza no está disponible</p><h1 class="section-title">Volvamos a la colección.</h1><p class="section-copy">Puede que esta pieza ya haya encontrado su casa o que el enlace no sea correcto.</p><a class="button button--primary" href="tienda.html">Ver la tienda</a></div>`;
      return;
    }
    const customUrl = `encargos.html#formulario?pieza=${encodeURIComponent(product.id)}`;
    const purchaseAction = product.price == null
      ? `<a class="button button--primary" href="${customUrl}">Contar mi idea</a>`
      : `<button class="button button--primary" type="button" data-add-cart="${escapeHtml(product.id)}">Añadir a la cesta</button>`;
    const availability = product.price == null ? "Diseñamos esta pieza contigo" : "Disponible · confirmaremos el pedido contigo";
    root.innerHTML = `<nav class="breadcrumb" aria-label="Ruta"><a href="tienda.html">Tienda</a><span aria-hidden="true">/</span><span>${escapeHtml(product.name)}</span></nav>
      <article class="product-detail">
        <div class="product-detail__image"><img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}"></div>
        <div class="product-detail__content"><p class="eyebrow">${escapeHtml(product.badge || "Hecho a mano")}</p><h1 class="display-title">${escapeHtml(product.name)}</h1><p class="product-detail__price">${money(product.price)}</p><p class="section-copy">${escapeHtml(product.description)}</p><p class="product-detail__availability">${availability}</p><div class="product-detail__actions">${purchaseAction}<a class="button button--outline" href="${customUrl}">Personalizar esta pieza</a></div><div class="product-detail__note"><strong>Hecho con calma.</strong><p>Cada pieza se prepara y se revisa a mano. Si tienes dudas sobre medidas, materiales o envío, escríbenos antes de pedirla.</p><a class="text-link" href="https://www.instagram.com/sin_prisa_pero_con_alma__/" target="_blank" rel="noreferrer">Hablar por Instagram</a></div></div>
      </article>`;
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

  function orderMarkup(order, admin = false) {
    const details = order.items?.length ? order.items.map(item => `${escapeHtml(item.name)} × ${item.quantity}`).join(" · ") : escapeHtml(order.details || "Encargo personalizado");
    return `<article class="order-card">
      <div class="order-head"><div><h3>${escapeHtml(order.id)}</h3><span class="status">${escapeHtml(order.status)}</span></div><strong>${money(order.total)}</strong></div>
      <p>${escapeHtml(order.type)} · ${dateText(order.createdAt)}${admin ? ` · ${escapeHtml(order.email)}` : ""}</p>
      <p>${details}</p>
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
  }

  function setupAccount() {
    if (!$("#account-page")) return;
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
        toast("Cuenta creada de forma segura");
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
        toast("Sesión iniciada");
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
    renderAccount();
  }

  function setupCustomOrder() {
    const form = $("#custom-order-form");
    if (!form) return;
    const session = getSession();
    const authRequired = $("#custom-auth-required");
    if (!session) {
      form.hidden = true;
      if (authRequired) authRequired.hidden = false;
      return;
    }
    form.hidden = false;
    if (authRequired) authRequired.hidden = true;
    if (session) {
      form.elements.name.value = session.name;
      form.elements.email.value = session.email;
    }
    const selectedProductId = new URLSearchParams(window.location.hash.split("?")[1] || window.location.search).get("pieza");
    const selectedProduct = getProducts().find(product => product.id === selectedProductId);
    if (selectedProduct) {
      const pieceByCategory = { bebé: "Babero", regalo: "Bolsa o saquito", hogar: "Bastidor decorativo" };
      form.elements.piece.value = pieceByCategory[selectedProduct.category] || "Otra idea";
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
  setupProductDetail();
  renderCart();
  setupCartEvents();
  setupAdmin();
  (async () => {
    await loadCustomerSession();
    setupAccount();
    setupCustomOrder();
    updateIdentityLinks();
  })();
})();
