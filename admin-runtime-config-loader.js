(function (global) {
  "use strict";

  global.AlmaAdminRuntimeConfigReady = new Promise(resolve => {
    if (global.AlmaAdminRuntimeConfig) {
      resolve(global.AlmaAdminRuntimeConfig);
      return;
    }

    const script = document.createElement("script");
    script.src = "admin-runtime-config.js";
    script.async = true;
    script.onload = () => resolve(global.AlmaAdminRuntimeConfig || null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
})(window);
