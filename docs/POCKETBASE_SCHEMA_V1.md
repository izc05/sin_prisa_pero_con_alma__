# PocketBase: esquema de producción V1

Este documento prepara la conexión del panel **Sin prisa, pero con alma**. No instala ni modifica PocketBase: es el contrato que debe aplicarse de forma aislada cuando se haga la puesta en marcha en el mini PC.

## Límites de la instalación

- Usar la instancia PocketBase ya existente, únicamente tras confirmar que se puede aislar por datos y acceso.
- No abrir el puerto `8090` a Internet.
- No reutilizar superusuarios en el navegador ni guardar sus tokens en el código.
- Exponer el panel solo detrás de Cloudflare Access y con una segunda autenticación en PocketBase.
- No modificar Language School, Atelier, Nginx, Docker, cloudflared ni sus servicios durante esta fase.

## Colección de acceso

Crear una colección de tipo **Auth** llamada `sinprisa_staff`.

Campos propios:

| Campo | Tipo | Valores / regla |
| --- | --- | --- |
| `name` | texto | obligatorio |
| `role` | selección única | `owner`, `editor` |
| `active` | booleano | obligatorio, predeterminado `true` |

Cuenta inicial:

- Correo: la dirección personal de Isivoltpro que elija el propietario.
- Rol: `owner`.
- `active`: `true`.
- Contraseña única y larga, creada en el momento de configuración.
- Activar MFA tras comprobar la entrega de correo.

No se usará el nombre `isivoltpro` como contraseña. Si se desea, podrá ser el identificador visible, pero el inicio de sesión será con correo y contraseña.

## Datos del atelier

Crear colecciones de tipo **Base**. Las reglas usan `@request.auth` y el rol de `sinprisa_staff`.

| Colección | Campos principales | Lectura pública | Escritura staff |
| --- | --- | --- | --- |
| `sinprisa_collections` | `name`, `slug`, `status`, `position` | solo `status = "published"` | `@request.auth.role = "owner" || @request.auth.role = "editor"` |
| `sinprisa_products` | `name`, `slug`, `collection` (relación), `description`, `price`, `price_mode`, `stock_mode`, `status`, `featured`, `images` (archivo múltiple) | solo `status = "published"` | `@request.auth.role = "owner" || @request.auth.role = "editor"` |
| `sinprisa_orders` | `reference`, `email`, `customer_name`, `items` (JSON), `total`, `status`, `notes` | ninguna | `@request.auth.role = "owner" || @request.auth.role = "editor"` |
| `sinprisa_messages` | `name`, `email`, `subject`, `body`, `status` | creación pública controlada; sin lectura pública | lectura/actualización para staff |

Para cada operación de creación, actualización y borrado de las tres primeras colecciones, usar esta regla:

```
@request.auth.role = "owner" || @request.auth.role = "editor"
```

Para `sinprisa_messages`, permitir crear un mensaje público solo con validación de campos y límite de frecuencia en la capa del servidor/proxy. La lista y cualquier modificación requieren personal autorizado.

## Migración desde la demo local

1. Exportar los registros de `alma-v2-products` y `alma-v2-collections` desde el navegador de administración, una vez se añada el asistente de migración.
2. Crear primero las colecciones y comprobar sus estados.
3. Importar productos como borradores.
4. Subir las imágenes a archivos de PocketBase; no migrar Data URLs de la demo como solución definitiva.
5. Revisar manualmente una muestra de productos y publicar solo los validados.
6. Cambiar el driver local del panel por el driver PocketBase y comprobar altas, edición, archivado y cierre de sesión.

## Criterios de aceptación

- Una persona sin Cloudflare Access no llega al panel.
- Una persona con Access pero sin cuenta `sinprisa_staff` no puede administrar nada.
- Una cuenta `editor` no obtiene permisos de superusuario.
- Una petición anónima no puede leer pedidos, mensajes ni borradores.
- Las fotografías se sirven desde archivos de PocketBase y las reglas no revelan datos privados.
- El panel conserva el modo local únicamente como desarrollo, nunca como fuente de datos de producción.

## Campos operativos que no deben perderse

El esquema de tablas anterior es la versión compacta de implantación. Al crear los campos, conservar además estas necesidades funcionales:

- `sinprisa_products`: `slug` único, `short_description`, `sort_order` y `published_at` opcional.
- Las imágenes se modelarán como una colección `sinprisa_product_images`, relacionada con producto, con `original` (archivo), `alt_text`, `sort_order` e `is_cover`. Esto permite una galería ordenable y una portada inequívoca.
- `sinprisa_orders`: relación con `sinprisa_customers`, `payment_status`, `subtotal`, `shipping` e `internal_notes` privados.
- `sinprisa_order_items`: conserva `product_name_snapshot`, cantidad, precio unitario y personalización, de modo que un pedido siga siendo correcto aunque el producto cambie.
- `sinprisa_commissions`: cliente, idea, fecha del evento, cantidad, detalles, precio presupuestado, notas internas y estado `new | reviewing | quoted | accepted | making | completed | cancelled`.
- `sinprisa_content_blocks`: `key` único, título, cuerpo, imagen y `enabled`, para contenido editorial sin editar código.

Los clientes, direcciones, teléfonos, pedidos, encargos, notas internas, originales de imágenes y cualquier token quedan siempre fuera del snapshot público.
