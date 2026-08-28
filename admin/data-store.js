(function () {
  'use strict';

  const STORAGE_KEY = 'spca-admin-draft-v1';
  const DEFAULT_CATALOG_URL = '../data/catalog.json';

  function readConfig() {
    const config = globalThis.SPCA_ADMIN_CONFIG || {};
    return {
      mode: config.mode === 'pocketbase' ? 'pocketbase' : 'local',
      catalogUrl: config.catalogUrl || DEFAULT_CATALOG_URL,
      pocketbaseUrl: String(config.pocketbaseUrl || '').replace(/\/$/, ''),
      requestTimeoutMs: Number(config.requestTimeoutMs) > 0 ? Number(config.requestTimeoutMs) : 7000
    };
  }

  function withTimeout(promise, timeoutMs) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    return {
      signal: controller.signal,
      done: promise(controller.signal).finally(() => clearTimeout(timeout))
    };
  }

  async function fetchJson(url, options = {}) {
    const config = readConfig();
    const request = withTimeout(
      (signal) => fetch(url, { ...options, signal }),
      config.requestTimeoutMs
    );
    const response = await request.done;
    if (!response.ok) throw new Error(`HTTP ${response.status} · ${url}`);
    return response.status === 204 ? null : response.json();
  }

  function loadLocalDraft() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return stored && Array.isArray(stored.products) ? stored.products : null;
    } catch (error) {
      console.warn('No se pudo recuperar el borrador local.', error);
      return null;
    }
  }

  function saveLocalDraft(products) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ products }));
  }

  function clearLocalDraft() {
    localStorage.removeItem(STORAGE_KEY);
  }

  async function loadPublishedCatalog() {
    const config = readConfig();
    const catalog = await fetchJson(config.catalogUrl, { cache: 'no-store' });
    return Array.isArray(catalog?.products) ? catalog.products : [];
  }

  async function pocketBaseHealth() {
    const config = readConfig();
    if (config.mode !== 'pocketbase' || !config.pocketbaseUrl) {
      return { connected: false, reason: 'local-mode' };
    }

    try {
      await fetchJson(`${config.pocketbaseUrl}/api/health`, { cache: 'no-store' });
      return { connected: true, reason: 'ok' };
    } catch (error) {
      return { connected: false, reason: error.name === 'AbortError' ? 'timeout' : 'unreachable' };
    }
  }

  function mode() {
    return readConfig().mode;
  }

  globalThis.SPCAAdminStore = Object.freeze({
    mode,
    loadLocalDraft,
    saveLocalDraft,
    clearLocalDraft,
    loadPublishedCatalog,
    pocketBaseHealth
  });
}());
