# Admin V2 — checkpoints

- Rama de trabajo: `feat/admin-v2-pocketbase-ready`
- Base inicial: estado de `main` en el momento de creación de la rama.
- Web oficial: sin cambios.
- Regla: el trabajo permanece en Draft PR y no se integra ni despliega sin autorización expresa.

## Checkpoint 0 — arquitectura y gate

Incluido:

- Plan de integración segura del Admin V2.
- Esquema PocketBase V1 para usuarios, categorías, productos, imágenes, clientes, pedidos, líneas de pedido, encargos y contenido.
- Gate `scripts/validate-admin-v2.mjs` para proteger el contrato mínimo del admin y detectar patrones obvios de secretos.
- Workflow `Admin V2 Check` con sintaxis, contrato y build estático.

Estado: cerrado a nivel de código versionado.

## Checkpoint 1 — capa de datos sustituible

Incluido:

- `admin-data.js` como gateway independiente de la interfaz.
- Driver local compatible con las claves actuales de productos, pedidos y mensajes.
- Operaciones explícitas para listar/guardar productos, pedidos y mensajes.
- Operaciones de negocio actuales: crear/eliminar producto, cambiar disponibilidad, actualizar estado de pedido y marcar mensaje como leído.
- Copias defensivas al leer/escribir para evitar mutaciones accidentales fuera del gateway.
- `scripts/test-admin-data.mjs` con pruebas de comportamiento en memoria.
- El workflow ejecuta sintaxis, prueba del gateway, contrato y build.
- El build incluye `admin-data.js` como artefacto, pero la interfaz actual todavía no lo carga: el comportamiento visible permanece sin cambios en este checkpoint.

Estado: código base completo. La confirmación automática de CI queda separada de esta afirmación; no se declara verde hasta observar una ejecución real del workflow.

## Checkpoint 2 — conexión de la UI

Pendiente:

1. Cargar `admin-data.js` únicamente en la administración.
2. Conectar `renderAdmin()` y `setupAdmin()` al gateway local sin alterar tienda, cesta ni cuenta.
3. Validar equivalencia de productos, pedidos y mensajes.
4. Solo después añadir driver PocketBase y autenticación real.
