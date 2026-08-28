# PocketBase · contrato inicial para el mini PC

Este documento fija el contrato de datos del panel de administración. El objetivo es que PocketBase sea la fuente maestra sin convertir la web pública en dependiente del servidor doméstico.

## Principios

- El mini PC contiene datos maestros, originales privados y operaciones de administración.
- La web pública consume únicamente un snapshot saneado y assets publicados.
- El navegador del admin nunca contiene credenciales de servicio, tokens de GitHub ni secretos de Cloudflare.
- Ninguna colección sensible se expone con reglas públicas de escritura.
- Las bajas de productos deben preferir `archived` antes que borrado físico cuando existan pedidos relacionados.

## Colección auth `users`

Campos adicionales:

- `name`: text, requerido.
- `role`: select `owner | editor`, requerido.
- `active`: bool, requerido, default `true`.

Reglas previstas:

- list/view: usuario autenticado y activo.
- create/update/delete: solo `owner`.
- El primer owner se crea directamente durante el bootstrap del mini PC.

## `categories`

Campos:

- `name`: text, requerido.
- `slug`: text, requerido, único.
- `description`: text.
- `sort_order`: number, default `0`.
- `active`: bool, default `true`.

Índices:

- UNIQUE `slug`.

Reglas:

- lectura/escritura: `owner` o `editor` autenticado y activo.

## `products`

Campos:

- `name`: text, requerido.
- `slug`: text, requerido, único.
- `category`: relation -> `categories`, máximo 1, requerido.
- `short_description`: text, max 280.
- `description`: editor/text.
- `price`: number, min 0.
- `price_mode`: select `fixed | from | quote`, requerido.
- `status`: select `draft | published | hidden | archived`, requerido.
- `featured`: bool, default `false`.
- `stock_mode`: select `available | made_to_order | sold_out`, requerido.
- `sort_order`: number, default `0`.
- `published_at`: date.

Índices:

- UNIQUE `slug`.
- índice compuesto recomendado sobre `status, sort_order`.

Reglas:

- lectura/escritura admin: `owner` o `editor` autenticado y activo.
- no se habilita acceso público directo; la tienda usa snapshot estático.

## `product_images`

Campos:

- `product`: relation -> `products`, requerido.
- `original`: file, máximo inicial 12 MiB, imágenes solamente.
- `alt_text`: text, requerido.
- `sort_order`: number, default `0`.
- `is_cover`: bool, default `false`.
- `published_url`: url/text, opcional; URL del derivado público.

Reglas:

- lectura/escritura: `owner` o `editor` autenticado y activo.
- los originales no se publican directamente desde PocketBase.

Invariante de aplicación:

- un producto puede tener varias imágenes, pero solo una portada efectiva.
- si se marca una nueva `is_cover`, la anterior debe desmarcarse de forma atómica en la operación de publicación.

## `customers`

Campos:

- `name`: text, requerido.
- `email`: email.
- `phone`: text.
- `address`: text.
- `notes`: text.

Reglas:

- solo administración autenticada.
- nunca entra en el snapshot público.

## `orders`

Campos:

- `number`: text, requerido, único.
- `customer`: relation -> `customers`.
- `status`: select `new | confirmed | preparing | ready | shipped | delivered | cancelled`.
- `payment_status`: select `pending | paid | refunded`.
- `subtotal`: number, min 0.
- `shipping`: number, min 0.
- `total`: number, min 0.
- `internal_notes`: text.

Índices:

- UNIQUE `number`.
- índice recomendado `status, created`.

Reglas:

- solo administración autenticada.

## `order_items`

Campos:

- `order`: relation -> `orders`, requerido.
- `product`: relation -> `products`, opcional para conservar histórico si el producto se archiva.
- `product_name_snapshot`: text, requerido.
- `quantity`: number, min 1.
- `unit_price`: number, min 0.
- `customization`: text.

Reglas:

- solo administración autenticada.

## `commissions`

Campos:

- `customer`: relation -> `customers`.
- `idea`: text, requerido.
- `event_date`: date.
- `quantity`: number, min 1.
- `details`: text.
- `status`: select `new | reviewing | quoted | accepted | making | completed | cancelled`.
- `quoted_price`: number, min 0.
- `internal_notes`: text.

Reglas:

- administración autenticada para lectura/escritura.
- la entrada pública futura debe pasar por un endpoint/flujo con validación y rate limit, no por permisos abiertos sobre la colección.

## `content_blocks`

Campos:

- `key`: text, requerido, único.
- `title`: text.
- `body`: editor/text.
- `image`: file opcional.
- `enabled`: bool, default `true`.

Claves iniciales previstas:

- `home.hero`
- `home.intro`
- `brand.story`
- `commissions.intro`
- `contact.intro`

## Snapshot público

La publicación debe generar un documento versionado con este mínimo:

```json
{
  "version": 1,
  "generatedAt": "ISO-8601",
  "products": []
}
```

Solo se exportan productos con `status = published`. Se excluyen IDs internos que no sean necesarios, notas, clientes, pedidos, originales privados y cualquier dato de autenticación.

## Configuración de red

- PocketBase escucha únicamente en la interfaz necesaria del mini PC.
- Cloudflare Tunnel publica un hostname dedicado, por ejemplo `admin-api.<dominio>`.
- No se abre el puerto de PocketBase en el router.
- CORS debe limitarse al origen real del panel admin.
- Cloudflare Access puede proteger el hostname como segunda barrera, además del login PocketBase.

## Backups

Mínimo recomendado:

- copia diaria de `pb_data` con retención rotativa;
- una copia fuera del mini PC;
- prueba periódica de restauración;
- los originales de imágenes deben entrar también en el plan de backup.

## Orden de implementación

1. Instalar PocketBase en el mini PC y crear owner inicial.
2. Crear colecciones e índices anteriores.
3. Aplicar reglas de acceso y CORS.
4. Configurar Cloudflare Tunnel/Access.
5. Añadir login real al admin.
6. Sustituir las escrituras locales por CRUD autenticado.
7. Implementar subida de imágenes.
8. Implementar publicación del snapshot y derivados.
9. Añadir encargos, clientes y pedidos.
