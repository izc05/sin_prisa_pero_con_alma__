# Publicación y sincronización

La arquitectura prevista usa GitHub como única fuente del código. Cada cambio aceptado en `main` activa dos destinos independientes:

1. Cloudflare Pages publica la web pública desde GitHub.
2. GitHub Actions copia el resultado de `npm run build` al mini PC por SSH.

## Cloudflare Pages

En **Workers & Pages → Create application → Pages → Connect to Git**:

- Repositorio: `izc05/sin_prisa_pero_con_alma__`
- Rama de producción: `main`
- Comando de compilación: `npm run build`
- Directorio de salida: `dist`
- Directorio raíz: dejar vacío

Cada `push` a `main` generará una nueva publicación. Las demás ramas pueden usarse como vistas previas.

## Mini PC

El flujo `.github/workflows/deploy-mini-pc.yml` necesita estos secretos en el entorno de GitHub `production`:

- `MINI_PC_HOST`: IP, nombre DNS o host alcanzable por el runner.
- `MINI_PC_PORT`: puerto SSH; puede omitirse para usar 22.
- `MINI_PC_USER`: usuario de despliegue con permisos limitados.
- `MINI_PC_PATH`: ruta exacta servida por Nginx, Caddy o el servidor elegido.
- `MINI_PC_SSH_KEY`: clave privada dedicada exclusivamente al despliegue.

La acción no borra archivos remotos. Conviene usar un usuario y una carpeta dedicados, nunca una cuenta administradora ni una ruta general del sistema.

Si el mini PC no es accesible directamente desde Internet, la opción recomendada es un runner autoalojado o una red privada; no se deben publicar contraseñas ni abrir el panel de administración sin autenticación real.

## Antes de cobrar pedidos reales

La tienda, cuenta y administración funcionan ahora en modo local del navegador. Para compartir cuentas y pedidos entre dispositivos hay que conectar un backend seguro. En Cloudflare, una evolución natural sería Pages Functions o Workers con D1 para datos y R2 para fotografías, manteniendo el frontend actual.
