# Admin V2 — checkpoint 0

- Rama de trabajo: `feat/admin-v2-pocketbase-ready`
- Base: estado actual de `main` en el momento de creación de la rama.
- Web oficial: sin cambios.
- Objetivo del checkpoint: consolidar arquitectura, esquema PocketBase y validación automática antes de sustituir almacenamiento local.

## Incluido

- Plan de integración segura del Admin V2.
- Esquema PocketBase V1 para usuarios, categorías, productos, imágenes, clientes, pedidos, líneas de pedido, encargos y contenido.
- Gate `scripts/validate-admin-v2.mjs` para proteger el contrato mínimo del admin y detectar patrones obvios de secretos.
- Workflow `Admin V2 Check` que ejecuta el gate y `npm run build` en cambios del admin.

## Siguiente checkpoint

Crear una capa de datos desacoplada de la UI que permita mantener el modo local actual y cambiar posteriormente a PocketBase sin reescribir las pantallas. Después se abordará autenticación real y CRUD de productos.
