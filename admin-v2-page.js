(function () {
  "use strict";

  const KEYS = {
    session: "alma-v2-session",
    adminPin: "alma-v2-admin-pin"
  };
  const MAX_IMAGES_PER_PRODUCT = 4;
  const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

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
  const statusLabel = (status) => ({ draft: "Borrador", published: "Publicado", hidden: "Oculto", archived: "Archivado" })[status] || "Publicado";

  if (!window.AlmaAdminData?.createLocalDriver || !window.AlmaAdminData?.createPocketBaseDriver || !window.AlmaAdminAuth) {
    console.error("Admin V2: no se encontró el gateway de datos.");
    const feedback = $("#admin-lock-feedback");
    if (feedback) feedback.textContent = "No se pudo iniciar la capa de datos del panel.";
    return;
  }

  let adminData;
  let runtimeConfig = Object.freeze({ mode: "disabled" });
  let pocketBaseSession = null;
  let pocketBaseUser = null;

  function isPocketBaseMode() {
    return runtimeConfig.mode === "pocketbase";
  }

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
      <div class="order-head"><div><h3>${escapeHtml(order.number || order.id)}</h3><span class="status">${escapeHtml(order.status)}</span></div><strong>${money(order.total)}</strong></div>
      <p>${escapeHtml(order.type || "Pedido")} · ${dateText(order.createdAt)}${order.customerName ? ` · ${escapeHtml(order.customerName)}` : ""}${order.email ? ` · ${escapeHtml(order.email)}` : ""}</p>
      <p>${details}</p>
      <label class="field"><span>Actualizar estado</span><select data-order-status="${escapeHtml(order.id)}">${options.map(option => `<option ${order.status === option ? "selected" : ""}>${option}</option>`).join("")}</select></label>
    </article>`;
  }

  function commissionMarkup(commission) {
    const labels = { new: "Nuevo", reviewing: "Revisando", quoted: "Presupuestado", accepted: "Aceptado", in_progress: "En proceso", completed: "Completado", rejected: "No viable", cancelled: "Cancelado" };
    const options = Object.entries(labels).map(([value, label]) => `<option value="${value}" ${commission.status === value ? "selected" : ""}>${label}</option>`).join("");
    const images = commission.images?.length
      ? `<div class="commission-gallery">${commission.images.map((image, index) => `<a href="${escapeHtml(image.src)}" target="_blank" rel="noreferrer"><img src="${escapeHtml(image.src)}" alt="Referencia ${index + 1} del encargo ${escapeHtml(commission.reference)}"></a>`).join("")}</div>`
      : `<p class="empty-state">Sin imágenes de referencia.</p>`;
    return `<article class="commission-card"><div class="order-head"><div><h3>${escapeHtml(commission.reference)}</h3><span class="status">${escapeHtml(labels[commission.status] || commission.status)}</span></div><strong>${Number(commission.quantity) || 1} ud.</strong></div><p>${escapeHtml(commission.name)} · ${escapeHtml(commission.email)} · ${dateText(commission.createdAt)}</p><h4>${escapeHtml(commission.idea)}</h4><p class="commission-details">${escapeHtml(commission.details)}</p>${images}<label class="field"><span>Estado del encargo</span><select data-commission-status="${escapeHtml(commission.id)}">${options}</select></label></article>`;
  }

  function galleryMarkup(product) {
    const images = productImages(product);
    const items = images.map((image, index) => `<article class="admin-gallery__item">
      <img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}">
      <label class="field"><span>Texto alternativo</span><input maxlength="160" value="${escapeHtml(image.alt)}" data-image-alt="${escapeHtml(image.id)}" data-product-image-alt="${escapeHtml(product.id)}"></label>
      <div class="admin-gallery__actions">${index === 0 ? `<span class="admin-product-state admin-product-state--featured">Portada</span>` : `<button class="button button--quiet" type="button" data-make-primary="${escapeHtml(image.id)}" data-product-images="${escapeHtml(product.id)}">Portada</button>`}<button class="button danger" type="button" data-remove-image="${escapeHtml(image.id)}" data-product-images="${escapeHtml(product.id)}">Quitar</button></div>
    </article>`).join("");
    return `<div class="admin-gallery"><div class="admin-gallery__head"><strong>Galería</strong><label class="button button--quiet"><span>Añadir fotos</span><input type="file" accept="image/*" multiple data-add-product-images="${escapeHtml(product.id)}"></label></div>${items || `<p class="empty-state">Aún no hay fotografías.</p>`}</div>`;
  }

  function productMarkup(product, collections) {
    const available = product.stock !== false && product.stockMode !== "sold_out";
    const status = product.status || "published";
    const priceMode = product.priceMode || (product.price == null ? "quote" : "fixed");
    const stockMode = product.stockMode || (available ? "available" : "sold_out");
    const imageCount = productImages(product).length;
    return `<article class="admin-product-row">
      <img src="${escapeHtml(product.image || "assets/detalle-bordado.jpeg")}" alt="">
      <div class="admin-product-copy"><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.category || "sin categoría")} · ${priceMode === "quote" ? "Consultar" : `${priceModeLabel(priceMode)} · ${money(product.price)}`} · ${imageCount} ${imageCount === 1 ? "foto" : "fotos"}</small><div class="admin-product-tags"><span class="admin-product-state ${available ? "" : "is-hidden"}">${stockModeLabel(stockMode)}</span><span class="admin-product-state admin-product-state--status">${statusLabel(status)}</span>${product.featured ? `<span class="admin-product-state admin-product-state--featured">Destacado</span>` : ""}</div></div>
      <label class="admin-row-field"><span>Estado</span><select data-product-status="${escapeHtml(product.id)}"><option value="draft" ${status === "draft" ? "selected" : ""}>Borrador</option><option value="published" ${status === "published" ? "selected" : ""}>Publicado</option><option value="hidden" ${status === "hidden" ? "selected" : ""}>Oculto</option><option value="archived" ${status === "archived" ? "selected" : ""}>Archivado</option></select></label>
      <button class="button button--outline" type="button" data-toggle-stock="${escapeHtml(product.id)}">${available ? "Marcar agotado" : "Reactivar"}</button>
      ${product.custom ? `<button class="button danger" type="button" data-delete-product="${escapeHtml(product.id)}">Eliminar</button>` : ""}
      <details class="admin-product-editor" data-product-editor="${escapeHtml(product.id)}"><summary>Editar pieza</summary><div class="form-grid"><div class="field"><label>Nombre<input data-product-name value="${escapeHtml(product.name)}"></label></div><div class="field"><label>Colección<select data-product-category><option value="">Sin colección</option>${collections.map(collection => `<option value="${escapeHtml(collection.id)}" ${product.category === collection.id ? "selected" : ""}>${escapeHtml(collection.name)}</option>`).join("")}</select></label></div><div class="field"><label>Tipo de precio<select data-product-price-mode><option value="fixed" ${priceMode === "fixed" ? "selected" : ""}>Precio fijo</option><option value="from" ${priceMode === "from" ? "selected" : ""}>Desde</option><option value="quote" ${priceMode === "quote" ? "selected" : ""}>Consultar</option></select></label></div><div class="field"><label>Precio<input data-product-price type="number" min="0" step="0.01" value="${product.price == null ? "" : escapeHtml(product.price)}"></label></div><div class="field"><label>Disponibilidad<select data-product-stock-mode><option value="available" ${stockMode === "available" ? "selected" : ""}>Disponible</option><option value="made_to_order" ${stockMode === "made_to_order" ? "selected" : ""}>Bajo pedido</option><option value="sold_out" ${stockMode === "sold_out" ? "selected" : ""}>Agotado</option></select></label></div><div class="field"><label>Estado<select data-product-edit-status><option value="draft" ${status === "draft" ? "selected" : ""}>Borrador</option><option value="published" ${status === "published" ? "selected" : ""}>Publicado</option><option value="hidden" ${status === "hidden" ? "selected" : ""}>Oculto</option><option value="archived" ${status === "archived" ? "selected" : ""}>Archivado</option></select></label></div><div class="field field--full"><label>Descripción<textarea data-product-description>${escapeHtml(product.description || "")}</textarea></label></div><label class="admin-check field--full"><input data-product-featured type="checkbox" ${product.featured ? "checked" : ""}><span><strong>Destacar esta pieza</strong></span></label><div class="field field--full"><button class="button button--primary" type="button" data-save-product="${escapeHtml(product.id)}">Guardar cambios</button></div></div></details>
      ${galleryMarkup(product)}
    </article>`;
  }

  function productImages(product) {
    if (Array.isArray(product.images)) return product.images;
    return product.image ? [{ id: `${product.id}-legacy`, src: product.image, alt: "", position: 0, primary: true }] : [];
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

  function renderProductCatalog(products, collections) {
    const search = String($("#product-search")?.value || "").trim().toLocaleLowerCase("es-ES");
    const selectedCollection = $("#product-filter-collection")?.value || "";
    const selectedStatus = $("#product-filter-status")?.value || "";
    const selectedStock = $("#product-filter-stock")?.value || "";
    const collectionFilter = $("#product-filter-collection");

    if (collectionFilter) {
      collectionFilter.innerHTML = `<option value="">Todas</option>${collections.map(collection => `<option value="${escapeHtml(collection.id)}" ${collection.id === selectedCollection ? "selected" : ""}>${escapeHtml(collection.name)}</option>`).join("")}`;
    }

    const filteredProducts = products.filter(product => {
      const text = `${product.name || ""} ${product.description || ""}`.toLocaleLowerCase("es-ES");
      const stockMode = product.stockMode || (product.stock === false ? "sold_out" : "available");
      return (!search || text.includes(search))
        && (!selectedCollection || product.category === selectedCollection)
        && (!selectedStatus || (product.status || "draft") === selectedStatus)
        && (!selectedStock || stockMode === selectedStock);
    });

    $("#product-list-meta").textContent = `${filteredProducts.length} de ${products.length} ${products.length === 1 ? "pieza" : "piezas"}`;
    $("#admin-products").innerHTML = filteredProducts.length ? filteredProducts.map(product => productMarkup(product, collections)).join("") : `<div class="empty-state">No hay piezas que coincidan con los filtros.</div>`;
  }

  function renderProductCategoryOptions(collections) {
    const categoryInput = $("#product-category");
    if (!categoryInput) return;
    const selectedCollection = categoryInput.value;
    categoryInput.required = true;
    categoryInput.innerHTML = `<option value="">Selecciona una colección</option>${collections.map(collection => `<option value="${escapeHtml(collection.id)}" ${collection.id === selectedCollection ? "selected" : ""}>${escapeHtml(collection.name)}</option>`).join("")}`;
  }

  async function renderAdmin() {
    const [products, orders, messages, collections, commissions] = await Promise.all([
      adminData.listProducts(),
      adminData.listOrders(),
      adminData.listMessages(),
      adminData.listCollections(),
      adminData.listCommissions()
    ]);
    const visibleProducts = products.filter(product => (product.status || "published") === "published" && product.stock !== false && product.stockMode !== "sold_out").length;

    $("#metric-products").textContent = products.length;
    $("#metric-visible").textContent = visibleProducts;
    $("#metric-orders").textContent = orders.length;
    $("#metric-messages").textContent = messages.filter(item => item.status !== "Leído").length;
    $("#metric-commissions").textContent = commissions.filter(item => !["completed", "rejected", "cancelled"].includes(item.status)).length;
    renderProductCatalog(products, collections);
    renderProductCategoryOptions(collections);
    $("#admin-collections").innerHTML = collections.length ? collections.map(collectionMarkup).join("") : `<div class="empty-state">Todavía no hay colecciones.</div>`;
    $("#admin-orders").innerHTML = orders.length ? orders.map(orderMarkup).join("") : `<div class="empty-state">No hay pedidos todavía.</div>`;
    $("#admin-messages").innerHTML = messages.length ? messages.map(message => `<article class="message-card">
      <span class="status">${escapeHtml(message.status || "Nuevo")}</span>
      <h3>${escapeHtml(message.subject || "Mensaje")}</h3>
      <p>${escapeHtml(message.name || "Cliente")}${message.email ? ` · ${escapeHtml(message.email)}` : ""} · ${dateText(message.createdAt)}</p>
      <p>${escapeHtml(message.body || "")}</p>
      ${message.status === "Leído" ? "" : `<button class="button button--quiet" type="button" data-read-message="${escapeHtml(message.id)}">Marcar como leído</button>`}
    </article>`).join("") : `<div class="empty-state">No hay mensajes todavía.</div>`;
    $("#admin-commissions").innerHTML = commissions.length ? commissions.map(commissionMarkup).join("") : `<div class="empty-state">Todavía no hay encargos personalizados.</div>`;
  }

  async function unlockAdmin() {
    $("#admin-lock").hidden = true;
    $("#admin-dashboard").hidden = false;
    $("#admin-logout").hidden = !isPocketBaseMode();
    await renderAdmin();
  }

  function setupIdentity() {
    if (isPocketBaseMode()) {
      const account = $(".account-link");
      if (account) account.textContent = pocketBaseUser?.name ? `Hola, ${pocketBaseUser.name}` : "Acceso staff";
      $("#admin-auth-name").textContent = pocketBaseUser?.name || "PocketBase privado";
      $("#admin-auth-role").textContent = pocketBaseUser?.role ? `Rol: ${pocketBaseUser.role}` : "Sesión no iniciada";
      return;
    }
    const session = readLocal(KEYS.session, null);
    const account = $(".account-link");
    if (account && session?.name) account.textContent = `Hola, ${String(session.name).split(" ")[0]}`;
  }

  function configureLoginUi() {
    const emailField = $("#admin-email-field");
    const emailInput = $("#admin-email");
    const secretInput = $("#admin-pin");
    const secretLabel = $("#admin-secret-label");

    if (isPocketBaseMode()) {
      localStorage.removeItem(KEYS.adminPin);
      emailField.hidden = false;
      emailInput.required = true;
      secretInput.name = "password";
      secretInput.removeAttribute("minlength");
      secretLabel.textContent = "Contraseña";
      $("#admin-lock-title").textContent = "Entrar en el Admin V2";
      $("#admin-pin-hint").textContent = "Usa tu cuenta staff de PocketBase. La sesión termina al cerrar esta pestaña.";
      $("#admin-lock-notice").textContent = "La sesión se guarda únicamente en esta pestaña y el Admin no usa un PIN local.";
      $("#admin-login-submit").textContent = "Iniciar sesión";
      $("#admin-data-mode").textContent = "PocketBase privado activo";
      setupIdentity();
      return;
    }

    throw new Error("El Admin privado no tiene una conexión válida con PocketBase");
  }

  function lockPocketBaseAdmin() {
    $("#admin-dashboard").hidden = true;
    $("#admin-lock").hidden = false;
    $("#admin-logout").hidden = true;
    $("#admin-pin").value = "";
    pocketBaseUser = null;
    setupIdentity();
  }

  function setupAdmin() {
    const page = $("#admin-page");
    if (!page) return;

    configureLoginUi();

    $("#admin-pin-form").addEventListener("submit", async event => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const secretInput = $("#admin-pin");
      const submit = $("#admin-login-submit");
      $("#admin-lock-feedback").textContent = "";

      if (isPocketBaseMode()) {
        submit.disabled = true;
        try {
          pocketBaseUser = await pocketBaseSession.login(
            String(formData.get("email") || ""),
            String(formData.get("password") || "")
          );
          secretInput.value = "";
          setupIdentity();
          await unlockAdmin();
        } catch (error) {
          $("#admin-lock-feedback").textContent = error.message || "No se pudo iniciar sesión";
        } finally {
          secretInput.value = "";
          submit.disabled = false;
        }
        return;
      }

      const pin = String(formData.get("pin") || "");
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

    $("#admin-logout").addEventListener("click", () => {
      if (!isPocketBaseMode()) return;
      pocketBaseSession.logout();
      lockPocketBaseAdmin();
      $("#admin-lock-feedback").textContent = "Sesión cerrada correctamente.";
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
      const files = Array.from(data.getAll("image")).filter(file => file && file.size);
      const priceMode = String(data.get("priceMode") || "fixed");
      const stockMode = String(data.get("stockMode") || "available");
      let images = [];
      try {
        if (files.length > MAX_IMAGES_PER_PRODUCT) throw new Error("Demasiadas fotografías");
        if (files.some(file => file.size > MAX_IMAGE_BYTES)) throw new Error("Una fotografía supera 4 MB");
        images = await Promise.all(files.map(async (file, index) => ({
          id: uid("IMG"),
          src: await fileToDataUrl(file),
          alt: index === 0 ? String(data.get("imageAlt") || "").trim() : ""
        })));
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
          image: images[0]?.src || "assets/detalle-bordado.jpeg",
          images,
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
      if ($("#product-image-preview")) $("#product-image-preview").innerHTML = "";
      await renderAdmin();
      toast(isPocketBaseMode() ? "Nueva pieza guardada en PocketBase" : "Nueva pieza guardada en el catálogo local");
    });

    const productImageInput = $("#product-image");
    const productImageHelp = productImageInput?.closest(".field")?.querySelector(".field-help");
    if (productImageHelp) productImageHelp.textContent = "Máximo 4 imágenes de 4 MB cada una. La primera será la portada.";
    if (productImageInput && !$("#product-image-preview")) {
      const preview = document.createElement("div");
      preview.id = "product-image-preview";
      preview.className = "product-upload-preview";
      preview.setAttribute("aria-live", "polite");
      productImageInput.closest(".field")?.appendChild(preview);
    }
    productImageInput?.addEventListener("change", async event => {
      const files = Array.from(event.target.files || []);
      const preview = $("#product-image-preview");
      if (!preview) return;
      if (files.length > MAX_IMAGES_PER_PRODUCT || files.some(file => file.size > MAX_IMAGE_BYTES)) {
        event.target.value = "";
        preview.textContent = `Máximo ${MAX_IMAGES_PER_PRODUCT} fotos de 4 MB cada una`;
        return;
      }
      const sources = await Promise.all(files.map(fileToDataUrl));
      preview.innerHTML = sources.map((src, index) => `<figure><img src="${escapeHtml(src)}" alt="Vista previa ${index + 1}"><figcaption>${escapeHtml(files[index].name)}${index === 0 ? " · Portada" : ""}</figcaption></figure>`).join("");
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
      toast(isPocketBaseMode() ? "Colección creada en PocketBase" : "Colección creada en el catálogo local");
    });

    ["#product-search", "#product-filter-collection", "#product-filter-status", "#product-filter-stock"].forEach(selector => {
      $(selector)?.addEventListener(selector === "#product-search" ? "input" : "change", async () => {
        const [products, collections] = await Promise.all([adminData.listProducts(), adminData.listCollections()]);
        renderProductCatalog(products, collections);
      });
    });

    document.addEventListener("change", async event => {
      const orderStatus = event.target.closest("[data-order-status]");
      const commissionStatus = event.target.closest("[data-commission-status]");
      const productStatus = event.target.closest("[data-product-status]");
      const collectionStatus = event.target.closest("[data-collection-status]");
      const imageAlt = event.target.closest("[data-image-alt]");
      const imageFiles = event.target.closest("[data-add-product-images]");
      if (orderStatus && await adminData.updateOrderStatus(orderStatus.dataset.orderStatus, orderStatus.value)) {
        await renderAdmin();
        toast("Estado del pedido actualizado");
      }
      if (commissionStatus && await adminData.updateCommissionStatus(commissionStatus.dataset.commissionStatus, commissionStatus.value)) {
        await renderAdmin();
        toast("Estado del encargo actualizado");
      }
      if (productStatus && await adminData.updateProduct(productStatus.dataset.productStatus, { status: productStatus.value })) {
        await renderAdmin();
        toast("Estado de publicación actualizado");
      }
      if (collectionStatus && await adminData.updateCollection(collectionStatus.dataset.collectionStatus, { status: collectionStatus.value })) {
        await renderAdmin();
        toast("Estado de la colección actualizado");
      }
      if (imageAlt) {
        const product = (await adminData.listProducts()).find(item => item.id === imageAlt.dataset.productImageAlt);
        if (product) {
          const images = productImages(product).map(image => image.id === imageAlt.dataset.imageAlt ? { ...image, alt: imageAlt.value.trim() } : image);
          await adminData.setProductImages(product.id, images);
          toast("Texto alternativo actualizado");
        }
      }
      if (imageFiles?.files?.length) {
        const product = (await adminData.listProducts()).find(item => item.id === imageFiles.dataset.addProductImages);
        const files = Array.from(imageFiles.files);
        if (!product) return;
        if (productImages(product).length + files.length > MAX_IMAGES_PER_PRODUCT || files.some(file => file.size > MAX_IMAGE_BYTES)) {
          toast(`Máximo ${MAX_IMAGES_PER_PRODUCT} fotos de 4 MB cada una`);
          imageFiles.value = "";
          return;
        }
        try {
          const added = await Promise.all(files.map(async file => ({ id: uid("IMG"), src: await fileToDataUrl(file), alt: "" })));
          await adminData.setProductImages(product.id, [...productImages(product), ...added]);
          await renderAdmin();
          toast("Fotografías añadidas");
        } catch {
          toast("No se pudieron añadir las fotografías");
        }
      }
    });

    document.addEventListener("click", async event => {
      const stock = event.target.closest("[data-toggle-stock]");
      const remove = event.target.closest("[data-delete-product]");
      const readMessage = event.target.closest("[data-read-message]");
      const saveCollection = event.target.closest("[data-save-collection]");
      const removeCollection = event.target.closest("[data-delete-collection]");
      const makePrimary = event.target.closest("[data-make-primary]");
      const removeImage = event.target.closest("[data-remove-image]");
      const saveProduct = event.target.closest("[data-save-product]");

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

      if (remove && window.confirm("¿Eliminar esta pieza? Esta acción no se puede deshacer.")) {
        try {
          if (await adminData.deleteProduct(remove.dataset.deleteProduct)) {
            await renderAdmin();
            toast(isPocketBaseMode() ? "Producto eliminado de PocketBase" : "Producto eliminado del catálogo local");
          }
        } catch (error) {
          toast(error.message || "No se pudo eliminar la pieza");
        }
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

      if (makePrimary) {
        const product = (await adminData.listProducts()).find(item => item.id === makePrimary.dataset.productImages);
        if (product) {
          const images = productImages(product);
          const selected = images.find(image => image.id === makePrimary.dataset.makePrimary);
          if (selected) {
            await adminData.setProductImages(product.id, [selected, ...images.filter(image => image.id !== selected.id)]);
            await renderAdmin();
            toast("Portada actualizada");
          }
        }
      }

      if (removeImage && window.confirm("¿Quitar esta fotografía de la galería?")) {
        const product = (await adminData.listProducts()).find(item => item.id === removeImage.dataset.productImages);
        if (product) {
          await adminData.setProductImages(product.id, productImages(product).filter(image => image.id !== removeImage.dataset.removeImage));
          await renderAdmin();
          toast("Fotografía eliminada");
        }
      }

      if (saveProduct) {
        const editor = saveProduct.closest("[data-product-editor]");
        const value = selector => editor?.querySelector(selector)?.value || "";
        const priceMode = value("[data-product-price-mode]");
        const rawPrice = value("[data-product-price]");
        try {
          await adminData.updateProduct(saveProduct.dataset.saveProduct, {
            name: value("[data-product-name]").trim(),
            category: value("[data-product-category]"),
            description: value("[data-product-description]").trim(),
            priceMode,
            price: priceMode === "quote" ? null : rawPrice === "" ? Number.NaN : Number(rawPrice),
            stockMode: value("[data-product-stock-mode]"),
            status: value("[data-product-edit-status]"),
            featured: Boolean(editor?.querySelector("[data-product-featured]")?.checked)
          });
          await renderAdmin();
          toast("Pieza actualizada");
        } catch (error) {
          toast(error.message || "No se pudo actualizar la pieza");
        }
      }
    });
  }

  async function startAdmin() {
    try {
      const configured = await (window.AlmaAdminRuntimeConfigReady || Promise.resolve(null));
      runtimeConfig = window.AlmaAdminAuth.normalizeRuntimeConfig(configured);

      if (!isPocketBaseMode()) {
        throw new Error("El Admin privado no tiene una conexión válida con PocketBase");
      }

      const runtimeFetch = window.fetch.bind(window);
      pocketBaseSession = window.AlmaAdminAuth.createPocketBaseSession({
        url: runtimeConfig.pocketbaseUrl,
        fetch: runtimeFetch,
        storage: window.sessionStorage
      });
      adminData = window.AlmaAdminData.createPocketBaseDriver({
        url: runtimeConfig.pocketbaseUrl,
        token: () => pocketBaseSession.getToken(),
        fetch: runtimeFetch
      });
      localStorage.removeItem(KEYS.adminPin);
      try {
        pocketBaseUser = await pocketBaseSession.restore();
      } catch {
        pocketBaseSession.logout();
        $("#admin-lock-feedback").textContent = "No se pudo conectar con PocketBase privado.";
      }

      setupNavigation();
      setupIdentity();
      setupAdmin();
      if (pocketBaseUser) await unlockAdmin();
    } catch (error) {
      console.error("Admin V2: no se pudo iniciar el runtime.", error?.name, error?.message);
      $("#admin-lock-feedback").textContent = error.message || "No se pudo iniciar el Admin V2";
    }
  }

  startAdmin();
})();
