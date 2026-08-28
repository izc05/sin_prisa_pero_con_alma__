(function () {
  "use strict";

  const KEYS = {
    cart: "alma-v2-cart",
    session: "alma-v2-session",
    adminPin: "alma-v2-admin-pin"
  };

  const seedProducts = [
    { id: "babero-danna", name: "Babero Danna", category: "bebé", description: "Lino lavado, volante y bordado de ocas y flores.", price: 28, image: "assets/babero-danna.jpeg", badge: "Disponible", stock: true },
    { id: "bolsa-jardin", name: "Bolsa Jardín", category: "regalo", description: "Bolsa de lino bordada puntada a puntada.", price: 22, image: "assets/bolsa-flores.jpeg", badge: "Pieza única", stock: true },
    { id: "bastidor-botanico", name: "Bastidor Botánico", category: "hogar", description: "Pequeño paisaje floral para guardar un recuerdo.", price: 35, image: "assets/detalle-bordado.jpeg", badge: "Hecho a mano", stock: true },
    { id: "encargo-personal", name: "Bordado a medida", category: "encargo", description: "Una pieza creada desde tu historia, nombre o idea.", price: null, image: "assets/encargo-bordado.jpeg", badge: "Por encargo", stock: true }
  ];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const uid = (prefix) => `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const money = (value) => value == null ? "Consultar" : new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(value);
  const dateText = (value) => value ? new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value)) : "Sin fecha";
  const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);

  if (!window.AlmaAdminData?.createLocalDriver) {
    console.error("Admin V2: no se encontró el gateway de datos.");
    const feedback = $("#admin-lock-feedback");
    if (feedback) feedback.textContent = "No se pudo iniciar la capa de datos del panel.";
    return;
  }

  const adminData = window.AlmaAdminData.createLocalDriver({ seedProducts });

  function readLocal(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
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
    toast.timer = window.setTimeout(() => node.classList.remove("is-visible"), 2600);
  }

  function setupNavigation() {
    const toggle = $(".menu-toggle");
    const nav = $(".main-nav");
    if (!toggle || !nav) return;
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    $$("a", nav).forEach(link => link.addEventListener("click", () => nav.classList.remove("is-open")));
  }

  async function hash(value) {
    if (!window.crypto?.subtle) return btoa(unescape(encodeURIComponent(value)));
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(bytes)).map(byte => byte.toString(16).padStart(2, "0")).join("");
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function orderMarkup(order) {
    const details = order.items?.length
      ? order.items.map(item => `${escapeHtml(item.name)} × ${Number(item.quantity) || 1}`).join(" · ")
      : escapeHtml(order.details || "Encargo personalizado");
    const options = ["Solicitud recibida", "Pendiente de Bizum", "En preparación", "Enviado", "Completado"];
    return `<article class="order-card">
      <div class="order-head"><div><h3>${escapeHtml(order.id)}</h3><span class="status">${escapeHtml(order.status)}</span></div><strong>${money(order.total)}</strong></div>
      <p>${escapeHtml(order.type || "Pedido")} · ${dateText(order.createdAt)}${order.email ? ` · ${escapeHtml(order.email)}` : ""}</p>
      <p>${details}</p>
      <label class="field"><span>Actualizar estado</span><select data-order-status="${escapeHtml(order.id)}">${options.map(option => `<option ${order.status === option ? "selected" : ""}>${option}</option>`).join("")}</select></label>
    </article>`;
  }

  function renderAdmin() {
    const products = adminData.listProducts();
    const orders = adminData.listOrders();
    const messages = adminData.listMessages();

    $("#metric-products").textContent = products.length;
    $("#metric-orders").textContent = orders.length;
    $("#metric-messages").textContent = messages.filter(item => item.status !== "Leído").length;

    $("#admin-products").innerHTML = products.length ? products.map(product => `<article class="admin-product-row">
      <img src="${escapeHtml(product.image || "assets/detalle-bordado.jpeg")}" alt="">
      <div class="admin-product-copy"><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.category || "sin categoría")} · ${money(product.price)}</small></div>
      <button class="button button--outline" type="button" data-toggle-stock="${escapeHtml(product.id)}">${product.stock === false ? "Activar" : "Ocultar"}</button>
      ${product.custom ? `<button class="button danger" type="button" data-delete-product="${escapeHtml(product.id)}">Eliminar</button>` : ""}
    </article>`).join("") : `<div class="empty-state">Todavía no hay productos.</div>`;

    $("#admin-orders").innerHTML = orders.length ? orders.map(orderMarkup).join("") : `<div class="empty-state">No hay pedidos todavía.</div>`;
    $("#admin-messages").innerHTML = messages.length ? messages.map(message => `<article class="message-card">
      <span class="status">${escapeHtml(message.status || "Nuevo")}</span>
      <h3>${escapeHtml(message.subject || "Mensaje")}</h3>
      <p>${escapeHtml(message.name || "Cliente")}${message.email ? ` · ${escapeHtml(message.email)}` : ""} · ${dateText(message.createdAt)}</p>
      <p>${escapeHtml(message.body || "")}</p>
      ${message.status === "Leído" ? "" : `<button class="button button--quiet" type="button" data-read-message="${escapeHtml(message.id)}">Marcar como leído</button>`}
    </article>`).join("") : `<div class="empty-state">No hay mensajes todavía.</div>`;
  }

  function unlockAdmin() {
    $("#admin-lock").hidden = true;
    $("#admin-dashboard").hidden = false;
    renderAdmin();
  }

  function setupIdentity() {
    const session = readLocal(KEYS.session, null);
    const account = $(".account-link");
    if (account && session?.name) account.textContent = `Hola, ${String(session.name).split(" ")[0]}`;
    const cart = readLocal(KEYS.cart, []);
    const count = Array.isArray(cart) ? cart.reduce((total, item) => total + (Number(item.quantity) || 0), 0) : 0;
    $$(".cart-count").forEach(node => { node.textContent = String(count); });
  }

  function setupAdmin() {
    const page = $("#admin-page");
    if (!page) return;

    const hasPin = Boolean(localStorage.getItem(KEYS.adminPin));
    $("#admin-lock-title").textContent = hasPin ? "Entrar en administración" : "Crear acceso local";
    $("#admin-pin-hint").textContent = hasPin ? "Introduce el PIN creado en este navegador." : "Crea un PIN de al menos 4 caracteres para proteger esta demo local.";

    $("#admin-pin-form").addEventListener("submit", async event => {
      event.preventDefault();
      const pin = String(new FormData(event.currentTarget).get("pin") || "");
      if (pin.length < 4) {
        $("#admin-lock-feedback").textContent = "El PIN debe tener al menos 4 caracteres.";
        return;
      }
      const digest = await hash(pin);
      const saved = localStorage.getItem(KEYS.adminPin);
      if (!saved) {
        localStorage.setItem(KEYS.adminPin, digest);
        unlockAdmin();
        return;
      }
      if (saved !== digest) {
        $("#admin-lock-feedback").textContent = "PIN incorrecto.";
        return;
      }
      unlockAdmin();
    });

    $$("[data-admin-view]").forEach(button => button.addEventListener("click", () => {
      $$("[data-admin-view]").forEach(item => item.classList.toggle("is-active", item === button));
      $$(".admin-view").forEach(view => { view.hidden = view.id !== `admin-view-${button.dataset.adminView}`; });
    }));

    $("#product-form")?.addEventListener("submit", async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = new FormData(form);
      const file = data.get("image");
      let image = "assets/detalle-bordado.jpeg";
      try {
        if (file && file.size) image = await fileToDataUrl(file);
      } catch {
        toast("No se pudo leer la fotografía");
        return;
      }
      adminData.createProduct({
        id: uid("PROD"),
        name: String(data.get("name") || "").trim(),
        category: String(data.get("category") || "regalo"),
        description: String(data.get("description") || "").trim(),
        price: data.get("price") ? Number(data.get("price")) : null,
        image,
        badge: "Nueva pieza",
        stock: true,
        custom: true
      });
      form.reset();
      renderAdmin();
      toast("Producto añadido al catálogo local");
    });

    document.addEventListener("change", event => {
      const select = event.target.closest("[data-order-status]");
      if (!select) return;
      if (adminData.updateOrderStatus(select.dataset.orderStatus, select.value)) {
        renderAdmin();
        toast("Estado actualizado");
      }
    });

    document.addEventListener("click", event => {
      const stock = event.target.closest("[data-toggle-stock]");
      const remove = event.target.closest("[data-delete-product]");
      const readMessage = event.target.closest("[data-read-message]");

      if (stock) {
        const product = adminData.listProducts().find(item => item.id === stock.dataset.toggleStock);
        if (product && adminData.setProductAvailability(product.id, product.stock === false)) {
          renderAdmin();
          toast(product.stock === false ? "Producto visible de nuevo" : "Producto ocultado");
        }
      }

      if (remove && adminData.deleteProduct(remove.dataset.deleteProduct)) {
        renderAdmin();
        toast("Producto eliminado del catálogo local");
      }

      if (readMessage && adminData.markMessageRead(readMessage.dataset.readMessage)) {
        renderAdmin();
        toast("Mensaje marcado como leído");
      }
    });
  }

  setupNavigation();
  setupIdentity();
  setupAdmin();
})();
