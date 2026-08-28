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
- Directorio de salida: `dist`
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

La copia estática del mini PC sirve como réplica y recuperación. No debe considerarse todavía la base de datos central de pedidos.

## Antes de cobrar pedidos reales

La tienda, cuenta y administración funcionan ahora en modo local del navegador. Para compartir cuentas y pedidos entre dispositivos hay que conectar un backend seguro. En Cloudflare, una evolución natural sería Pages Functions o Workers con D1 para datos y R2 para fotografías, manteniendo el frontend actual.

Orden de puesta en producción:

1. Publicar el frontend en Pages y validar el subdominio público.
2. Configurar Tunnel y Access para el mini PC.
3. Incorporar D1 para clientes, encargos y pedidos, y R2 para imágenes.
4. Sustituir el PIN local del administrador por autenticación real y permisos de servidor.
5. Activar el cobro solo después de probar estados de pedido, avisos, privacidad y copias de seguridad.
