const fallbackProducts = [
  {
    id: 'sample-bastidor',
    name: 'Bastidor personalizado',
    category: 'bordados',
    categoryLabel: 'Bordados',
    shortDescription: 'Pieza de muestra · sustituir por trabajo real',
    tone: 'linen',
    status: 'published'
  },
  {
    id: 'sample-inicial',
    name: 'Inicial bordada',
    category: 'bordados',
    categoryLabel: 'Bordados',
    shortDescription: 'Pieza de muestra · sustituir por trabajo real',
    tone: 'rose',
    status: 'published'
  },
  {
    id: 'sample-complemento',
    name: 'Complemento artesanal',
    category: 'complementos',
    categoryLabel: 'Complementos',
    shortDescription: 'Pieza de muestra · sustituir por trabajo real',
    tone: 'sand',
    status: 'published'
  }
];

const tones = {
  linen: 'linear-gradient(145deg, #ddd0c2, #f2e9df)',
  rose: 'linear-gradient(145deg, #dbc2bc, #efe1dd)',
  sand: 'linear-gradient(145deg, #d8c4ad, #eee1d2)',
  clay: 'linear-gradient(145deg, #cfb0a2, #ead9d1)',
  pearl: 'linear-gradient(145deg, #e4ddd3, #f5f0e8)',
  blush: 'linear-gradient(145deg, #dfc8c1, #f1e3df)'
};

let products = [];
let activeFilter = 'all';

const grid = document.querySelector('#product-grid');
const filters = document.querySelectorAll('.filter');

function categoryLabel(category) {
  return {
    bordados: 'Bordados',
    complementos: 'Complementos',
    eventos: 'Eventos'
  }[category] || 'Colección';
}

function formatPrice(product) {
  if (product.priceMode === 'from' && Number.isFinite(product.price)) {
    return `Desde ${product.price.toFixed(2).replace('.', ',')} €`;
  }
  if (Number.isFinite(product.price)) {
    return `${product.price.toFixed(2).replace('.', ',')} €`;
  }
  return '';
}

function createProductCard(product) {
  const article = document.createElement('article');
  article.className = 'product-card';
  article.dataset.category = product.category || '';

  const visual = document.createElement('div');
  visual.className = 'product-image placeholder';

  if (product.image) {
    const image = document.createElement('img');
    image.src = product.image;
    image.alt = product.imageAlt || product.name || 'Producto artesanal';
    image.loading = 'lazy';
    image.style.width = '100%';
    image.style.height = '100%';
    image.style.objectFit = 'cover';
    visual.classList.remove('placeholder');
    visual.append(image);
  } else {
    visual.style.background = tones[product.tone] || tones.linen;
    const label = document.createElement('span');
    label.textContent = 'Foto del producto';
    visual.append(label);
  }

  const meta = document.createElement('div');
  meta.className = 'product-meta';
  const content = document.createElement('div');

  const category = document.createElement('p');
  category.className = 'product-category';
  category.textContent = product.categoryLabel || categoryLabel(product.category);

  const title = document.createElement('h3');
  title.textContent = product.name || 'Producto';

  const note = document.createElement('p');
  note.className = 'product-note';
  note.textContent = product.shortDescription || product.note || '';

  content.append(category, title, note);

  const price = formatPrice(product);
  if (price) {
    const priceElement = document.createElement('p');
    priceElement.className = 'product-price';
    priceElement.textContent = price;
    priceElement.style.margin = '8px 0 0';
    priceElement.style.fontWeight = '700';
    content.append(priceElement);
  }

  const link = document.createElement('a');
  link.className = 'product-link';
  link.href = '#encargos';
  link.textContent = 'Consultar / encargar';
  content.append(link);

  meta.append(content);
  article.append(visual, meta);
  return article;
}

function renderProducts(filter = activeFilter) {
  activeFilter = filter;
  const visible = products.filter((product) => {
    const published = !product.status || product.status === 'published';
    return published && (filter === 'all' || product.category === filter);
  });

  grid.replaceChildren(...visible.map(createProductCard));

  if (!visible.length) {
    const empty = document.createElement('p');
    empty.className = 'product-empty';
    empty.textContent = 'Todavía no hay piezas publicadas en esta colección.';
    grid.append(empty);
  }
}

async function loadCatalog() {
  try {
    const response = await fetch('./data/catalog.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Catalog HTTP ${response.status}`);
    const catalog = await response.json();
    products = Array.isArray(catalog.products) ? catalog.products : [];
  } catch (error) {
    console.warn('No se pudo cargar el catálogo publicado; se usa el catálogo de respaldo.', error);
    products = fallbackProducts;
  }
  renderProducts();
}

filters.forEach((button) => {
  button.addEventListener('click', () => {
    filters.forEach((item) => item.classList.remove('is-active'));
    button.classList.add('is-active');
    renderProducts(button.dataset.filter);
  });
});

const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('#main-nav');

menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!open));
  nav.classList.toggle('is-open', !open);
});

nav.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    nav.classList.remove('is-open');
    menuButton.setAttribute('aria-expanded', 'false');
  });
});

const commissionForm = document.querySelector('#commission-form');
const requestResult = document.querySelector('#request-result');

commissionForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(commissionForm);

  const summary = [
    'SOLICITUD DE ENCARGO',
    '',
    `Nombre: ${data.get('nombre') || '—'}`,
    `Idea: ${data.get('idea') || '—'}`,
    `Fecha: ${data.get('fecha') || 'Por concretar'}`,
    `Cantidad: ${data.get('cantidad') || 'Por concretar'}`,
    `Detalles: ${data.get('detalles') || '—'}`
  ].join('\n');

  requestResult.hidden = false;
  requestResult.textContent = `${summary}\n\nEsta es una vista previa. Cuando conectemos el mini PC, este formulario podrá enviar y guardar el encargo de forma segura.`;

  try {
    await navigator.clipboard.writeText(summary);
    requestResult.textContent += '\n\n✓ Solicitud copiada al portapapeles.';
  } catch {
    requestResult.textContent += '\n\nPuedes seleccionar y copiar este texto manualmente.';
  }
});

document.querySelector('#year').textContent = new Date().getFullYear();
loadCatalog();
