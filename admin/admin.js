const STORAGE_KEY = 'spca-admin-draft-v1';
const CATALOG_URL = '../data/catalog.json';

const state = {
  products: [],
  activeView: 'dashboard'
};

const panels = document.querySelectorAll('[data-panel]');
const navItems = document.querySelectorAll('[data-view]');
const viewTitle = document.querySelector('#view-title');
const productList = document.querySelector('#product-list');
const form = document.querySelector('#product-form');
const editorTitle = document.querySelector('#editor-title');
const deleteButton = document.querySelector('#delete-product');

function categoryLabel(category) {
  return {
    bordados: 'Bordados',
    complementos: 'Complementos',
    eventos: 'Eventos'
  }[category] || 'Colección';
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || `producto-${Date.now()}`;
}

function createId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function persistDraft() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ products: state.products }));
  renderAll();
}

function loadStoredDraft() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (stored && Array.isArray(stored.products)) return stored.products;
  } catch (error) {
    console.warn('No se pudo recuperar el borrador local.', error);
  }
  return null;
}

async function fetchPublishedCatalog() {
  const response = await fetch(CATALOG_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Catalog HTTP ${response.status}`);
  const catalog = await response.json();
  return Array.isArray(catalog.products) ? catalog.products : [];
}

function switchView(view) {
  state.activeView = view;
  panels.forEach((panel) => panel.classList.toggle('is-visible', panel.dataset.panel === view));
  navItems.forEach((item) => item.classList.toggle('is-active', item.dataset.view === view));
  viewTitle.textContent = view === 'products' ? 'Productos' : 'Resumen';
}

function renderStats() {
  document.querySelector('#stat-products').textContent = state.products.length;
  document.querySelector('#stat-published').textContent = state.products.filter((p) => p.status === 'published').length;
  document.querySelector('#stat-drafts').textContent = state.products.filter((p) => p.status === 'draft').length;
  document.querySelector('#stat-featured').textContent = state.products.filter((p) => p.featured).length;
}

function renderProductList() {
  productList.replaceChildren();

  if (!state.products.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-list';
    empty.textContent = 'Todavía no hay productos en el borrador.';
    productList.append(empty);
    return;
  }

  state.products
    .slice()
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es'))
    .forEach((product) => {
      const row = document.createElement('article');
      row.className = 'product-row';

      const copy = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = product.name || 'Producto sin nombre';
      const meta = document.createElement('p');
      meta.textContent = `${categoryLabel(product.category)} · ${product.priceMode === 'quote' ? 'Consultar' : product.price ? `${Number(product.price).toFixed(2).replace('.', ',')} €` : 'Sin precio'}`;
      copy.append(name, meta);

      const action = document.createElement('div');
      const status = document.createElement('span');
      status.className = `status ${product.status || 'draft'}`;
      status.textContent = product.status === 'published' ? 'Publicado' : product.status === 'hidden' ? 'Oculto' : 'Borrador';
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.textContent = 'Editar';
      edit.addEventListener('click', () => editProduct(product.id));
      action.append(status, edit);

      row.append(copy, action);
      productList.append(row);
    });
}

function renderAll() {
  renderStats();
  renderProductList();
}

function clearForm() {
  form.reset();
  form.elements.id.value = '';
  form.elements.status.value = 'draft';
  form.elements.priceMode.value = 'quote';
  form.elements.category.value = 'bordados';
  editorTitle.textContent = 'Nuevo producto';
  deleteButton.hidden = true;
}

function editProduct(id) {
  const product = state.products.find((item) => item.id === id);
  if (!product) return;

  switchView('products');
  form.elements.id.value = product.id || '';
  form.elements.name.value = product.name || '';
  form.elements.category.value = product.category || 'bordados';
  form.elements.status.value = product.status || 'draft';
  form.elements.shortDescription.value = product.shortDescription || '';
  form.elements.price.value = Number.isFinite(product.price) ? product.price : '';
  form.elements.priceMode.value = product.priceMode || 'quote';
  form.elements.image.value = product.image || '';
  form.elements.featured.checked = Boolean(product.featured);
  editorTitle.textContent = product.name || 'Editar producto';
  deleteButton.hidden = false;
}

function productFromForm() {
  const data = new FormData(form);
  const rawPrice = String(data.get('price') || '').trim();
  const id = String(data.get('id') || '') || createId();
  const name = String(data.get('name') || '').trim();
  const category = String(data.get('category') || 'bordados');

  return {
    id,
    slug: slugify(name),
    name,
    category,
    categoryLabel: categoryLabel(category),
    shortDescription: String(data.get('shortDescription') || '').trim(),
    price: rawPrice === '' ? null : Number(rawPrice),
    priceMode: String(data.get('priceMode') || 'quote'),
    status: String(data.get('status') || 'draft'),
    featured: form.elements.featured.checked,
    image: String(data.get('image') || '').trim() || null,
    imageAlt: name ? `${name} · Sin prisa, pero con alma` : 'Producto artesanal',
    updatedAt: new Date().toISOString()
  };
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const product = productFromForm();
  const index = state.products.findIndex((item) => item.id === product.id);

  if (index >= 0) state.products[index] = { ...state.products[index], ...product };
  else state.products.push(product);

  persistDraft();
  editProduct(product.id);
});

deleteButton.addEventListener('click', () => {
  const id = form.elements.id.value;
  if (!id) return;
  const product = state.products.find((item) => item.id === id);
  if (!product) return;
  if (!window.confirm(`¿Eliminar "${product.name}" del borrador local?`)) return;

  state.products = state.products.filter((item) => item.id !== id);
  persistDraft();
  clearForm();
});

document.querySelector('#cancel-edit').addEventListener('click', clearForm);

document.querySelector('#new-product').addEventListener('click', clearForm);
document.querySelector('#new-product-dashboard').addEventListener('click', () => {
  switchView('products');
  clearForm();
});

navItems.forEach((item) => {
  item.addEventListener('click', () => switchView(item.dataset.view));
});

document.querySelector('#reset-draft').addEventListener('click', async () => {
  if (!window.confirm('¿Descartar los cambios locales y volver al catálogo publicado?')) return;
  try {
    state.products = await fetchPublishedCatalog();
    localStorage.removeItem(STORAGE_KEY);
    renderAll();
    clearForm();
  } catch (error) {
    window.alert('No se pudo recargar el catálogo publicado.');
    console.error(error);
  }
});

document.querySelector('#export-json').addEventListener('click', () => {
  const payload = JSON.stringify({
    version: 1,
    generatedAt: new Date().toISOString(),
    products: state.products
  }, null, 2);

  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `catalog-borrador-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
});

async function boot() {
  const localProducts = loadStoredDraft();
  if (localProducts) {
    state.products = localProducts;
  } else {
    try {
      state.products = await fetchPublishedCatalog();
    } catch (error) {
      console.error(error);
      state.products = [];
    }
  }
  renderAll();
  clearForm();
}

boot();
