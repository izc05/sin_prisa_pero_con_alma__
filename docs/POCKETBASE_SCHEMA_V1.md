# PocketBase — esquema V1 del Admin

Este documento define el contrato inicial de datos del Admin V2. No contiene credenciales ni configuración privada.

## `users` (auth)

Campos adicionales:
- `name` — text, required
- `role` — select: `owner | editor`
- `active` — bool

Reglas objetivo:
- lectura del propio usuario autenticado;
- escritura de negocio solo para `owner` o `editor` activos;
- cambios de rol solo para `owner`.

## `categories`

- `name` — text, required
- `slug` — text, required, unique
- `description` — text
- `sort_order` — number
- `active` — bool

## `products`

- `name` — text, required
- `slug` — text, required, unique
- `category` — relation -> `categories`
- `short_description` — text
- `description` — editor/text
- `price` — number nullable
- `price_mode` — select: `fixed | from | quote`
- `status` — select: `draft | published | hidden | archived`
- `stock_mode` — select: `available | made_to_order | sold_out`
- `featured` — bool
- `sort_order` — number
- `published_at` — date nullable

## `product_images`

- `product` — relation -> `products`, required
- `original` — file, required
- `alt_text` — text
- `sort_order` — number
- `is_cover` — bool

Reglas:
- originales accesibles únicamente a usuarios autorizados;
- derivados públicos fuera de PocketBase cuando se publique el snapshot.

## `customers`

- `name` — text, required
- `email` — email
- `phone` — text
- `address` — text
- `notes` — text privado

Nunca forma parte del snapshot público.

## `orders`

- `number` — text, required, unique
- `customer` — relation -> `customers`
- `status` — select: `new | confirmed | preparing | ready | shipped | delivered | cancelled`
- `payment_status` — select: `pending | paid | refunded`
- `subtotal` — number
- `shipping` — number
- `total` — number
- `internal_notes` — text privado

## `order_items`

- `order` — relation -> `orders`, required
- `product` — relation -> `products` nullable
- `product_name_snapshot` — text, required
- `quantity` — number, required
- `unit_price` — number nullable
- `customization` — text

Los campos snapshot preservan el pedido aunque el producto cambie posteriormente.

## `commissions`

- `customer` — relation -> `customers`
- `idea` — text, required
- `event_date` — date nullable
- `quantity` — number nullable
- `details` — text
- `status` — select: `new | reviewing | quoted | accepted | making | completed | cancelled`
- `quoted_price` — number nullable
- `internal_notes` — text privado

## `content_blocks`

- `key` — text, required, unique
- `title` — text
- `body` — editor/text
- `image` — file nullable
- `enabled` — bool

## Snapshot público

El snapshot publicado solo puede incluir datos expresamente públicos:

- id público / slug;
- nombre;
- categoría;
- descripción pública;
- precio y modo de precio;
- disponibilidad pública;
- destacado;
- imágenes derivadas públicas y `alt`;
- orden.

Debe excluir siempre:

- usuarios;
- clientes;
- direcciones;
- teléfonos privados;
- pedidos;
- notas internas;
- originales privados;
- tokens o configuración del mini PC.
