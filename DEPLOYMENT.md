# Publicación y sincronización

La arquitectura prevista usa GitHub como única fuente del código. Cada cambio aceptado en `main` activa dos destinos independientes:

1. Cloudflare Pages publica la web pública desde GitHub.
2. GitHub Actions copia el resultado de `npm run build` al mini PC por SSH.

## Arquitectura recomendada para Isivoltpro

No se deben sustituir los registros actuales de `isivoltpro.com` ni `www.isivoltpro.com`. La tienda y la gestión se separan en dos subdominios (nombres pendientes de confirmación):

- `sinprisa.isivoltpro.com`: escaparate público servido por Cloudflare Pages.
- `gestion-sinprisa.isivoltpro.com`: acceso privado al servicio del mini PC mediante Cloudflare Tunnel y Cloudflare Access.

El recorrido previsto es:

```text
GitHub (rama main)
  ├─ Cloudflare Pages ──> sinprisa.isivoltpro.com
  └─ GitHub Actions ────> copia compilada en el mini PC

Cloudflare Access ──> Cloudflare Tunnel ──> servicio privado del mini PC
```

GitHub conserva el código y el historial. Cloudflare controla el dominio, el certificado, la publicación pública y el acceso protegido. El mini PC no necesita puertos entrantes abiertos: el conector de Tunnel inicia una conexión saliente hacia Cloudflare.

## Cloudflare Pages

En **Workers & Pages → Create application → Pages → Connect to Git**:

- Repositorio: `izc05/sin_prisa_pero_con_alma__`
- Rama de producción: `main`
- Comando de compilación: `npm run build`
- Directorio de salida: `dist-public`
- Directorio raíz: dejar vacío

Cada `push` a `main` generará una nueva publicación. Las demás ramas pueden usarse como vistas previas.

Después de la primera publicación, el subdominio debe añadirse desde **Workers & Pages → proyecto → Custom domains**. No basta con crear manualmente un registro DNS: primero hay que asociarlo al proyecto de Pages.

## Mini PC

El flujo `.github/workflows/deploy-mini-pc.yml` necesita estos secretos en el entorno de GitHub `production`:

- `MINI_PC_HOST`: IP, nombre DNS o host alcanzable por el runner.
- `MINI_PC_PORT`: puerto SSH; puede omitirse para usar 22.
- `MINI_PC_USER`: usuario de despliegue con permisos limitados.
- `MINI_PC_PATH`: ruta exacta servida por Nginx, Caddy o el servidor elegido.
- `MINI_PC_SSH_KEY`: clave privada dedicada exclusivamente al despliegue.

La acción no borra archivos remotos. Conviene usar un usuario y una carpeta dedicados, nunca una cuenta administradora ni una ruta general del sistema.

Si el mini PC no es accesible directamente desde Internet, la opción recomendada es un runner autoalojado o una red privada; no se deben publicar contraseñas ni abrir el panel de administración sin autenticación real.

Para administrar o consultar el mini PC desde fuera:

1. Crear un Tunnel administrado desde **Zero Trust → Networks → Tunnels**.
2. Instalar `cloudflared` en el mini PC usando el token mostrado por Cloudflare; ese token es secreto y nunca se guarda en GitHub.
3. Publicar únicamente el servicio necesario en el subdominio privado.
4. Crear una aplicación de Cloudflare Access y autorizar solo los correos de administración.
5. Mantener cerrados los puertos del router y evitar publicar SSH o el panel directamente en Internet.

El Admin privado usa el build completo `dist/`; PocketBase en `127.0.0.1:8092` es la fuente central de pedidos. El servidor privado hace proxy del API con mismo origen y el hostname exclusivo de recepción bloquea cualquier ruta distinta de `POST /api/sinprisa/order-requests`.

## Antes de cobrar pedidos reales

La cesta envía solicitudes mediante una Pages Function y Cloudflare Access Service Auth hacia PocketBase. Los detalles y secretos operativos están en `docs/PEDIDOS_PRIVADOS.md`.

Orden de puesta en producción:

1. Publicar primero una rama preview y validar una solicitud completa.
2. Mantener `pedidos-sinprisa.isivoltpro.com` limitado a Service Auth y al endpoint de recepción.
3. Comprobar que el Admin privado muestra nombre, correo, líneas, cantidades y total.
4. Confirmar disponibilidad desde el Admin antes de solicitar Bizum.
5. Fusionar o publicar `main` únicamente con autorización expresa.
