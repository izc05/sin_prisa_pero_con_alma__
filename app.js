const products = [
  {
    name: 'Bastidor personalizado',
    category: 'bordados',
    categoryLabel: 'Bordados',
    note: 'Pieza de muestra · sustituir por trabajo real',
    tone: 'linen'
  },
  {
    name: 'Inicial bordada',
    category: 'bordados',
    categoryLabel: 'Bordados',
    note: 'Pieza de muestra · sustituir por trabajo real',
    tone: 'rose'
  },
  {
    name: 'Complemento artesanal',
    category: 'complementos',
    categoryLabel: 'Complementos',
    note: 'Pieza de muestra · sustituir por trabajo real',
    tone: 'sand'
  },
  {
    name: 'Detalle para invitado',
    category: 'eventos',
    categoryLabel: 'Eventos',
    note: 'Pieza de muestra · sustituir por trabajo real',
    tone: 'clay'
  },
  {
    name: 'Recuerdo personalizado',
    category: 'eventos',
    categoryLabel: 'Eventos',
    note: 'Pieza de muestra · sustituir por trabajo real',
    tone: 'pearl'
  },
  {
    name: 'Pieza especial',
    category: 'complementos',
    categoryLabel: 'Complementos',
    note: 'Pieza de muestra · sustituir por trabajo real',
    tone: 'blush'
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

const grid = document.querySelector('#product-grid');
const filters = document.querySelectorAll('.filter');

function renderProducts(filter = 'all') {
  const visible = filter === 'all' ? products : products.filter((product) => product.category === filter);

  grid.innerHTML = visible.map((product) => `
    <article class="product-card" data-category="${product.category}">
      <div class="product-image placeholder" style="background:${tones[product.tone]}">
        <span>Foto del producto</span>
      </div>
      <div class="product-meta">
        <div>
          <p class="product-category">${product.categoryLabel}</p>
          <h3>${product.name}</h3>
          <p class="product-note">${product.note}</p>
          <a class="product-link" href="#encargos">Consultar / encargar</a>
        </div>
      </div>
    </article>
  `).join('');
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
renderProducts();
