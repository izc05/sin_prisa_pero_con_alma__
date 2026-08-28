# Admin V2 — checkpoints

- Rama de trabajo: `feat/admin-v2-pocketbase-ready`
- Base inicial: estado de `main` en el momento de creación de la rama.
- Web oficial: sin cambios.
- Regla: el trabajo permanece en Draft PR y no se integra ni despliega sin autorización expresa.

## Checkpoint 0 — arquitectura y gate

- Plan de integración segura del Admin V2.
- Esquema PocketBase V1 para usuarios, categorías, productos, imágenes, clientes, pedidos, líneas de pedido, encargos y contenido.
- Gate `scripts/validate-admin-v2.mjs`.
- Workflow `Admin V2 Check` con sintaxis, contrato y build estático.

Estado: cerrado.

## Checkpoint 1 — capa de datos y runtime aislado

- `admin-data.js` como gateway independiente de la interfaz.
- Driver local compatible con productos, pedidos y mensajes.
- Pruebas de comportamiento del gateway en memoria.
- Controlador propio `admin-v2-page.js`.
- `admin.html` ya no carga `site-v2.js`.
- Tienda pública, cesta y cuenta quedan fuera del runtime del admin.
- CI verde: sintaxis, gateway, contrato, build y salida final.

Estado: cerrado.

## Checkpoint 2 — refinado visual y catálogo profesional

- Estilo propio del admin en `admin-v2.css`, manteniendo la identidad de **Sin prisa, pero con alma** sin contaminar la CSS de la tienda.
- Barra de estado del entorno, jerarquía visual reforzada, navegación más clara, métricas y responsive específico.
- Controles responsive adicionales en `admin-v2-controls.css`.
- Estado de producto visible en la lista.
- Contrato comercial de producto ampliado: `priceMode` (`fixed`, `from`, `quote`), `stockMode` (`available`, `made_to_order`, `sold_out`), `status` (`draft`, `published`, `hidden`) y `featured`.
- Las nuevas piezas nacen como borrador por defecto para reducir publicaciones accidentales.
- Cambio del estado de publicación directamente desde la lista.
- Gateway ampliado con `updateProduct(productId, patch)` preservando el ID del producto.
- Prueba añadida para actualizaciones parciales de producto.
- CI verde después del refinado: sintaxis, comportamiento del gateway, contrato, build y archivos finales.

Estado: cerrado.

## Siguiente checkpoint

1. Colecciones/categorías editables.
2. Varias imágenes por producto, imagen principal, orden y texto alternativo.
3. Driver PocketBase compatible con el mismo contrato del gateway.
4. Sustituir el PIN local por autenticación real cuando el backend esté listo.
5. Mantener el último catálogo público como snapshot independiente del mini PC.
