(function () {
  "use strict";

  const KEYS = {
    session: "alma-v2-session",
    adminPin: "alma-v2-admin-pin"
  };

  const seedProducts = [
    { id: "babero-danna", name: "Babero Danna", category: "bebé", description: "Lino lavado, volante y bordado de ocas y flores.", price: 28, priceMode: "fixed", image: "assets/babero-danna.jpeg", badge: "Disponible", stock: true, stockMode: "available", status: "published", featured: true },
    { id: "bolsa-jardin", name: "Bolsa Jardín", category: "regalo", description: "Bolsa de lino bordada puntada a puntada.", price: 22, priceMode: "fixed", image: "assets/bolsa-flores.jpeg", badge: "Pieza única", stock: true, stockMode: "available", status: "published", featured: false },
    { id: "bastidor-botanico", name: "Bastidor Botánico", category: "hogar", description: "Pequeño paisaje floral para guardar un recuerdo.", price: 35, priceMode: "fixed", image: "assets/detalle-bordado.jpeg", badge: "Hecho a mano", stock: true, stockMode: "available", status: "published", featured: false },
    { id: "encargo-personal", name: "Bordado a medida", category: "encargo", description: "Una pieza creada desde tu historia, nombre o idea.", price: null, priceMode: "quote", image: "assets/encargo-bordado.jpeg", badge: "Por encargo", stock: true, stockMode: "made_to_order", status: "published", featured: true }
  ];
  const seedCollections = [
    { id: "bebé", name: "Bebé", status: "published" },
    { id: "regalo", name: "Regalo", status: "published" },
    { id: "hogar", name: "Hogar", status: "published" },
    { id: "encargo", name: "Encargo", status: "published" }
  ];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const uid = (prefix) => `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const money = (value) => value == null ? "Consultar" : new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(value);
  const dateText = (value) => value ? new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value)) : "Sin fecha";
  const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  const priceModeLabel = (mode) => ({ fixed: "Precio fijo", from: "Desde", quote: "Consultar" })[mode] || "Precio fijo";
  const stockModeLabel = (mode) => ({ available: "Disponible", made_to_order: "Bajo pedido", sold_out: "Agotado" })[mode] || "Disponible";
  const statusLabel = (status) => ({ draft: "Borrador", published: "Publicado", hidden: "Oculto" })[status] || "Publicado";

  if (!window.AlmaAdminData?.createLocalDriver) {
    console.error("Admin V2: no se encontró el gateway de datos.");
    const feedback = $("#admin-lock-feedback");
    if (feedback) feedback.textContent = "No se pudo iniciar la capa de datos del panel.";
    return;
  }

  const adminData = window.AlmaAdminData.createLocalDriver({ seedProducts, seedCollections });

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

  function productMarkup(product) {
    const available = product.stock !== false && product.stockMode !== "sold_out";
    const status = product.status || "published";
    const priceMode = product.priceMode || (product.price == null ? "quote" : "fixed");
    const stockMode = product.stockMode || (available ? "available" : "sold_out");
    return `<article class="admin-product-row">
      <img src="${escapeHtml(product.image || "assets/detalle-bordado.jpeg")}" alt="">
      <div class="admin-product-copy"><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.category || "sin categoría")} · ${priceMode === "quote" ? "Consultar" : `${priceModeLabel(priceMode)} · ${money(product.price)}`}</small><div class="admin-product-tags"><span class="admin-product-state ${available ? "" : "is-hidden"}">${stockModeLabel(stockMode)}</span><span class="admin-product-state admin-product-state--status">${statusLabel(status)}</span>${product.featured ? `<span class="admin-product-state admin-product-state--featured">Destacado</span>` : ""}</div></div>
      <label class="admin-row-field"><span>Estado</span><select data-product-status="${escapeHtml(product.id)}"><option value="draft" ${status === "draft" ? "selected" : ""}>Borrador</option><option value="published" ${status === "published" ? "selected" : ""}>Publicado</option><option value="hidden" ${status === "hidden" ? "selected" : ""}>Oculto</option></select></label>
      <button class="button button--outline" type="button" data-toggle-stock="${escapeHtml(product.id)}">${available ? "Marcar agotado" : "Reactivar"}</button>
      ${product.custom ? `<button class="button danger" type="button" data-delete-product="${escapeHtml(product.id)}">Eliminar</button>` : ""}
    </article>`;
  }

  function collectionMarkup(collection) {
    return `<article class="admin-collection-row" data-collection-row="${escapeHtml(collection.id)}">
      <div class="admin-collection-copy"><strong>${escapeHtml(collection.name)}</strong><small>Posición ${Number(collection.position) + 1}</small></div>
      <label class="admin-row-field"><span>Nombre</span><input data-collection-name value="${escapeHtml(collection.name)}"></label>
      <label class="admin-row-field"><span>Estado</span><select data-collection-status="${escapeHtml(collection.id)}"><option value="draft" ${collection.status === "draft" ? "selected" : ""}>Borrador</option><option value="published" ${collection.status === "published" ? "selected" : ""}>Publicada</option><option value="hidden" ${collection.status === "hidden" ? "selected" : ""}>Oculta</option></select></label>
      <button class="button button--outline" type="button" data-save-collection="${escapeHtml(collection.id)}">Guardar</button>
      <button class="button danger" type="button" data-delete-collection="${escapeHtml(collection.id)}">Eliminar</button>
    </article>`;
  }

  async function renderAdmin() {
    const [products, orders, messages, collections] = await Promise.all([
      adminData.listProducts(),
      adminData.listOrders(),
      adminData.listMessages(),
      adminData.listCollections()
    ]);
    const visibleProducts = products.filter(product => (product.status || "published") === "published" && product.stock !== false && product.stockMode !== "sold_out").length;

    $("#metric-products").textContent = products.length;
    $("#metric-visible").textContent = visibleProducts;
    $("#metric-orders").textContent = orders.length;
    $("#metric-messages").textContent = messages.filter(item => item.status !== "Leído").length;
    $("#product-list-meta").textContent = `${products.length} ${products.length === 1 ? "pieza" : "piezas"} · ${visibleProducts} publicables`;

    $("#admin-products").innerHTML = products.length ? products.map(productMarkup).join("") : `<div class="empty-state">Todavía no hay productos.</div>`;
    $("#admin-collections").innerHTML = collections.length ? collections.map(collectionMarkup).join("") : `<div class="empty-state">Todavía no hay colecciones.</div>`;
    $("#admin-orders").innerHTML = orders.length ? orders.map(orderMarkup).join("") : `<div class="empty-state">No hay pedidos todavía.</div>`;
    $("#admin-messages").innerHTML = messages.length ? messages.map(message => `<article class="message-card">
      <span class="status">${escapeHtml(message.status || "Nuevo")}</span>
      <h3>${escapeHtml(message.subject || "Mensaje")}</h3>
      <p>${escapeHtml(message.name || "Cliente")}${message.email ? ` · ${escapeHtml(message.email)}` : ""} · ${dateText(message.createdAt)}</p>
      <p>${escapeHtml(message.body || "")}</p>
      ${message.status === "Leído" ? "" : `<button class="button button--quiet" type="button" data-read-message="${escapeHtml(message.id)}">Marcar como leído</button>`}
    </article>`).join("") : `<div class="empty-state">No hay mensajes todavía.</div>`;
  }

  async function unlockAdmin() {
    $("#admin-lock").hidden = true;
    $("#admin-dashboard").hidden = false;
    await renderAdmin();
  }

  function setupIdentity() {
    const session = readLocal(KEYS.session, null);
    const account = $(".account-link");
    if (account && session?.name) account.textContent = `Hola, ${String(session.name).split(" ")[0]}`;
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
        await unlockAdmin();
        return;
      }
      if (saved !== digest) {
        $("#admin-lock-feedback").textContent = "PIN incorrecto.";
        return;
      }
      await unlockAdmin();
    });

    $$("[data-admin-view]").forEach(button => button.addEventListener("click", () => {
      $$("[data-admin-view]").forEach(item => {
        const active = item === button;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-pressed", String(active));
      });
      $$(".admin-view").forEach(view => { view.hidden = view.id !== `admin-view-${button.dataset.adminView}`; });
    }));

    $("#product-form")?.addEventListener("submit", async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = new FormData(form);
      const file = data.get("image");
      const priceMode = String(data.get("priceMode") || "fixed");
      const stockMode = String(data.get("stockMode") || "available");
      let image = "assets/detalle-bordado.jpeg";
      try {
        if (file && file.size) image = await fileToDataUrl(file);
      } catch {
        toast("No se pudo leer la fotografía");
        return;
      }
      try {
        await adminData.createProduct({
          id: uid("PROD"),
          name: String(data.get("name") || "").trim(),
          category: String(data.get("category") || "regalo"),
          description: String(data.get("description") || "").trim(),
          price: priceMode === "quote" || !data.get("price") ? null : Number(data.get("price")),
          priceMode,
          image,
          badge: "Nueva pieza",
          stock: stockMode !== "sold_out",
          stockMode,
          status: String(data.get("status") || "draft"),
          featured: data.get("featured") === "on",
          custom: true
        });
      } catch (error) {
        toast(error.message || "No se pudo guardar la pieza");
        return;
      }
      form.reset();
      await renderAdmin();
      toast("Nueva pieza guardada en el catálogo local");
    });

    $("#collection-form")?.addEventListener("submit", async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = new FormData(form);
      try {
        await adminData.createCollection({
          id: uid("COL"),
          name: String(data.get("name") || "").trim(),
          status: String(data.get("status") || "draft")
        });
      } catch (error) {
        toast(error.message || "No se pudo crear la colección");
        return;
      }
      form.reset();
      await renderAdmin();
      toast("Colección creada en el catálogo local");
    });

    document.addEventListener("change", async event => {
      const orderStatus = event.target.closest("[data-order-status]");
      const productStatus = event.target.closest("[data-product-status]");
      const collectionStatus = event.target.closest("[data-collection-status]");
      if (orderStatus && await adminData.updateOrderStatus(orderStatus.dataset.orderStatus, orderStatus.value)) {
        await renderAdmin();
        toast("Estado del pedido actualizado");
      }
      if (productStatus && await adminData.updateProduct(productStatus.dataset.productStatus, { status: productStatus.value })) {
        await renderAdmin();
        toast("Estado de publicación actualizado");
      }
      if (collectionStatus && await adminData.updateCollection(collectionStatus.dataset.collectionStatus, { status: collectionStatus.value })) {
        await renderAdmin();
        toast("Estado de la colección actualizado");
      }
    });

    document.addEventListener("click", async event => {
      const stock = event.target.closest("[data-toggle-stock]");
      const remove = event.target.closest("[data-delete-product]");
      const readMessage = event.target.closest("[data-read-message]");
      const saveCollection = event.target.closest("[data-save-collection]");
      const removeCollection = event.target.closest("[data-delete-collection]");

      if (stock) {
        const product = (await adminData.listProducts()).find(item => item.id === stock.dataset.toggleStock);
        if (product) {
          const available = product.stock !== false && product.stockMode !== "sold_out";
          const patch = available ? { stock: false, stockMode: "sold_out" } : { stock: true, stockMode: "available" };
          if (await adminData.updateProduct(product.id, patch)) {
            await renderAdmin();
            toast(available ? "Producto marcado como agotado" : "Producto disponible de nuevo");
          }
        }
      }

      if (remove && await adminData.deleteProduct(remove.dataset.deleteProduct)) {
        await renderAdmin();
        toast("Producto eliminado del catálogo local");
      }

      if (readMessage && await adminData.markMessageRead(readMessage.dataset.readMessage)) {
        await renderAdmin();
        toast("Mensaje marcado como leído");
      }

      if (saveCollection) {
        const row = saveCollection.closest("[data-collection-row]");
        const name = row?.querySelector("[data-collection-name]")?.value || "";
        try {
          await adminData.updateCollection(saveCollection.dataset.saveCollection, { name: String(name).trim() });
          await renderAdmin();
          toast("Colección actualizada");
        } catch (error) {
          toast(error.message || "No se pudo actualizar la colección");
        }
      }

      if (removeCollection && window.confirm("¿Eliminar esta colección? Las piezas asociadas deben moverse antes a otra colección.")) {
        try {
          await adminData.deleteCollection(removeCollection.dataset.deleteCollection);
          await renderAdmin();
          toast("Colección eliminada");
        } catch (error) {
          toast(error.message || "No se pudo eliminar la colección");
        }
      }
    });
  }

  setupNavigation();
  setupIdentity();
  setupAdmin();
})();
