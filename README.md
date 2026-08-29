# Sin prisa, pero con alma

Tienda multipágina de bordado artesanal con portada editorial, catálogo, encargos, diario, página de marca, solicitudes privadas de pedido, panel de administración e información legal.

## Desarrollo local

La versión de trabajo puede abrirse directamente desde `index.html`. Para comprobar exactamente la salida que se publicará:

```bash
npm run build
npm run preview
```

El comando genera `dist-public/` con todos los archivos públicos. El Admin, PocketBase y el prototipo de cuenta local quedan fuera de esa salida.

## Estructura

- `index.html`: entrada y portada.
- `tienda.html`: catálogo, filtros, búsqueda y cesta que envía una solicitud privada; Bizum queda pendiente de revisión.
- `encargos.html`: explicación del proceso y formulario de solicitud.
- `diario.html`: historias de taller y conexión directa con Instagram, sin API.
- `marca.html`: relato y valores de la marca.
- `cuenta.html`: prototipo local conservado para desarrollo; no forma parte del build público.
- `admin.html`: productos, pedidos y mensajes; en el mini PC usa autenticación privada de PocketBase.
- `legal.html`: textos base que deben completarse antes de vender.
- `site-v2.css` y `site-v2.js`: sistema visual y comportamiento compartido.

## Publicación

GitHub es la fuente del proyecto. Cloudflare Pages debe conectarse al repositorio `izc05/sin_prisa_pero_con_alma__` con:

- Comando de compilación: `npm run build`
- Directorio de salida: `dist-public`
- Rama de producción: `main`

El flujo de GitHub Actions también puede sincronizar `dist/` con un mini PC por SSH. La configuración completa está en [DEPLOYMENT.md](DEPLOYMENT.md).

## Antes de cobrar pedidos reales

- Completar `legal.html` con identidad fiscal, contacto, envíos, devoluciones y condiciones definitivas.
- Definir el número y el procedimiento operativo de Bizum. La solicitud se registra con pago pendiente y nunca cobra automáticamente.
- Mantener configurados los secretos de Pages y la política Service Auth de Access descritos en `docs/PEDIDOS_PRIVADOS.md`.
- Alojar fotografías subidas por administración en almacenamiento privado o gestionado, no en `localStorage`.

## Instagram sin API

El diario enlaza directamente al perfil oficial. Para automatizar publicaciones sin usar la API de una cuenta profesional, la opción estable es publicar primero en un CMS propio y reutilizar ese contenido en la web e Instagram, no extraerlo de Instagram mediante técnicas frágiles.
