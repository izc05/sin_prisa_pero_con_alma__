# Arquitectura del panel de administración

## Objetivo

La tienda pública debe seguir visible aunque el mini PC esté apagado. El mini PC será la fuente maestra de datos y el lugar donde residan la base de datos, autenticación, pedidos y encargos.

## Componentes

### Web pública
- Se publica como sitio estático mediante GitHub Pages/Cloudflare.
- Lee un snapshot público de catálogo desde `data/catalog.json`.
- Las imágenes publicadas deben quedar también fuera del mini PC para evitar que desaparezcan si el servidor doméstico se apaga.
- Nunca contiene credenciales ni secretos de administración.

### Mini PC
- PocketBase como primera opción de backend ligero.
- Base de datos maestra y almacenamiento privado.
- Acceso mediante Cloudflare Tunnel, sin abrir puertos del router.
- Backups periódicos fuera del propio disco del mini PC.

### Admin
- Interfaz visual para productos, categorías, contenido, encargos, pedidos y clientes.
- Primera fase: borrador local en el navegador para validar UX y esquema.
- Fase operativa: autenticación real y CRUD contra PocketBase.
- La publicación genera un snapshot limpio del catálogo público y los derivados de imagen optimizados.

## Flujo de publicación previsto

1. El administrador crea o edita un producto.
2. El cambio se guarda en PocketBase en el mini PC.
3. Las fotos originales permanecen privadas en el mini PC.
4. Al pulsar `Publicar`, se generan versiones WebP/AVIF optimizadas.
5. Se actualiza el snapshot público `data/catalog.json` y los assets publicados.
6. GitHub Pages/Cloudflare vuelve a desplegar la tienda.
7. Si el mini PC se apaga después, la tienda mantiene el último catálogo publicado.

## Colecciones PocketBase propuestas

### `users`
Colección auth. Roles iniciales: `owner`, `editor`.

### `categories`
- `name`
- `slug`
- `description`
- `sort_order`
- `active`

### `products`
- `name`
- `slug`
- `category`
- `short_description`
- `description`
- `price`
- `price_mode`: `fixed | from | quote`
- `status`: `draft | published | hidden | archived`
- `featured`
- `stock_mode`: `available | made_to_order | sold_out`
- `sort_order`
- `published_at`

### `product_images`
- `product`
- `original`
- `alt_text`
- `sort_order`
- `is_cover`

### `customers`
- `name`
- `email`
- `phone`
- `address`
- `notes`

### `orders`
- `number`
- `customer`
- `status`: `new | confirmed | preparing | ready | shipped | delivered | cancelled`
- `payment_status`: `pending | paid | refunded`
- `subtotal`
- `shipping`
- `total`
- `internal_notes`

### `order_items`
- `order`
- `product`
- `product_name_snapshot`
- `quantity`
- `unit_price`
- `customization`

### `commissions`
- `customer`
- `idea`
- `event_date`
- `quantity`
- `details`
- `status`: `new | reviewing | quoted | accepted | making | completed | cancelled`
- `quoted_price`
- `internal_notes`

### `content_blocks`
- `key`
- `title`
- `body`
- `image`
- `enabled`

## Seguridad mínima

- Cloudflare Tunnel: no exponer directamente el puerto de PocketBase.
- Panel admin protegido con autenticación; posteriormente se puede añadir Cloudflare Access como segunda barrera.
- CORS limitado a los dominios de la tienda/admin.
- Reglas PocketBase: escritura solo para usuarios autorizados.
- Formularios públicos con rate limiting y validación de servidor.
- Nunca guardar tokens de GitHub, Cloudflare o correo en el repositorio.
- Backups cifrados y probados.

## Fases

1. Catálogo externo + admin local de prueba.
2. PocketBase en mini PC + login real.
3. Productos/categorías/fotos con CRUD completo.
4. Publicación automática del snapshot y assets públicos.
5. Encargos, clientes y pedidos.
6. Edición de portada/contenidos, promociones y estadísticas.
