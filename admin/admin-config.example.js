// Copia este archivo como admin-config.js en el entorno desplegado.
// No incluyas contraseñas, tokens ni secretos: el navegador puede leer este archivo.
globalThis.SPCA_ADMIN_CONFIG = {
  mode: 'local', // Cambiar a 'pocketbase' cuando el mini PC esté operativo.
  catalogUrl: '../data/catalog.json',
  pocketbaseUrl: 'https://admin-api.example.com',
  requestTimeoutMs: 7000
};
