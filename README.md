# Sin prisa, pero con alma

Tienda multipágina de bordado artesanal con portada editorial, catálogo, encargos, diario, página de marca, cuenta de cliente, seguimiento de pedidos, panel de administración e información legal.

## Desarrollo local

La versión de trabajo puede abrirse directamente desde `index.html`. Para comprobar exactamente la salida que se publicará:

```bash
npm run build
npm run preview
```

El comando genera `dist/` con todos los archivos públicos.

## Estructura

- `index.html`: entrada y portada.
- `tienda.html`: catálogo, filtros, búsqueda, cesta y pedido por Bizum pendiente de confirmación.
- `encargos.html`: explicación del proceso y formulario de solicitud.
- `diario.html`: historias de taller y conexión directa con Instagram, sin API.
- `marca.html`: relato y valores de la marca.
- `cuenta.html`: registro local y seguimiento de pedidos.
- `admin.html`: productos, pedidos y mensajes en modo local protegido por PIN.
- `legal.html`: textos base que deben completarse antes de vender.
- `site-v2.css` y `site-v2.js`: sistema visual y comportamiento compartido.

## Publicación

GitHub es la fuente del proyecto. Cloudflare Pages debe conectarse al repositorio `izc05/sin_prisa_pero_con_alma__` con:

- Comando de compilación: `npm run build`
- Directorio de salida: `dist`
- Rama de producción: `main`

El flujo de GitHub Actions también puede sincronizar `dist/` con un mini PC por SSH. La configuración completa está en [DEPLOYMENT.md](DEPLOYMENT.md).

## Antes de cobrar pedidos reales

- Completar `legal.html` con identidad fiscal, contacto, envíos, devoluciones y condiciones definitivas.
- Definir el número y el proceso real de Bizum; la web actual crea un pedido pendiente, pero no procesa pagos.
- Conectar cuenta, pedidos, productos y mensajes a un backend seguro. Ahora funcionan en el navegador local para validar toda la experiencia, pero todavía no se comparten entre dispositivos.
- Alojar fotografías subidas por administración en almacenamiento privado o gestionado, no en `localStorage`.

## Instagram sin API

El diario enlaza directamente al perfil oficial. Para automatizar publicaciones sin usar la API de una cuenta profesional, la opción estable es publicar primero en un CMS propio y reutilizar ese contenido en la web e Instagram, no extraerlo de Instagram mediante técnicas frágiles.
