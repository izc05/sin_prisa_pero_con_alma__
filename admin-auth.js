(function (global) {
  "use strict";

  const SESSION_KEY = "alma-v2-pocketbase-session";

  function normalizeRuntimeConfig(value) {
    if (!value || value.mode !== "pocketbase") return Object.freeze({ mode: "local" });
    const configuredUrl = String(value.pocketbaseUrl || "").trim();
    if (!configuredUrl) return Object.freeze({ mode: "local" });

    let url;
    try {
      url = new URL(configuredUrl);
    } catch {
      throw new TypeError("La URL de PocketBase de staging no es válida");
    }
    if (!/^https?:$/.test(url.protocol)) throw new TypeError("PocketBase necesita una URL HTTP o HTTPS");

    return Object.freeze({
      mode: "pocketbase",
      pocketbaseUrl: url.toString().replace(/\/$/, "")
    });
  }

  function createPocketBaseSession(options = {}) {
    const url = String(options.url || "").replace(/\/$/, "");
    const runtimeFetch = options.fetch;
    const storage = options.storage || global.sessionStorage;
    if (!url) throw new TypeError("Falta la URL de PocketBase");
    if (typeof runtimeFetch !== "function") throw new TypeError("Falta fetch para PocketBase");
    if (!storage) throw new TypeError("sessionStorage no está disponible");

    let authToken = "";
    let user = null;

    function publicUser(record) {
      return Object.freeze({
        id: String(record?.id || ""),
        name: String(record?.name || ""),
        role: String(record?.role || ""),
        active: Boolean(record?.active)
      });
    }

    function assertAllowed(record) {
      const normalized = publicUser(record);
      if (!normalized.id || !normalized.active || !["owner", "editor"].includes(normalized.role)) {
        throw new Error("La cuenta no tiene acceso activo al Admin V2");
      }
      return normalized;
    }

    function persist(token, record) {
      authToken = String(token || "");
      user = assertAllowed(record);
      if (!authToken) throw new Error("PocketBase no devolvió una sesión válida");
      storage.setItem(SESSION_KEY, JSON.stringify({ token: authToken, user }));
      return user;
    }

    function clear() {
      authToken = "";
      user = null;
      storage.removeItem(SESSION_KEY);
    }

    async function parseAuthResponse(response) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Email o contraseña incorrectos");
      }
      if (!response.ok) throw new Error(`PocketBase respondió con HTTP ${response.status}`);
      const payload = await response.json();
      return persist(payload?.token, payload?.record);
    }

    return Object.freeze({
      async login(email, password) {
        const identity = String(email || "").trim();
        if (!identity || !password) throw new Error("Introduce email y contraseña");
        const response = await runtimeFetch(`${url}/api/collections/sinprisa_staff/auth-with-password`, {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({ identity, password: String(password) })
        });
        return parseAuthResponse(response);
      },

      async restore() {
        let saved;
        try {
          saved = JSON.parse(storage.getItem(SESSION_KEY));
        } catch {
          clear();
          return null;
        }
        const savedToken = String(saved?.token || "");
        if (!savedToken) {
          clear();
          return null;
        }

        authToken = savedToken;
        const response = await runtimeFetch(`${url}/api/collections/sinprisa_staff/auth-refresh`, {
          method: "POST",
          headers: { Accept: "application/json", Authorization: `Bearer ${authToken}` }
        });
        if (!response.ok) {
          clear();
          return null;
        }
        return parseAuthResponse(response);
      },

      logout() {
        clear();
      },

      getToken() {
        return authToken;
      },

      getUser() {
        return user;
      }
    });
  }

  global.AlmaAdminAuth = Object.freeze({
    sessionKey: SESSION_KEY,
    normalizeRuntimeConfig,
    createPocketBaseSession
  });
})(window);
