# Admin V2 — plan de integración segura

## Principio rector

El desarrollo del Admin V2 se realiza sobre una rama aislada que parte del estado actual de `main`. `main` y la web oficial no se modifican durante el desarrollo. La integración solo se considerará cuando el checkpoint esté validado y se apruebe expresamente.

## Objetivo

Convertir el panel local actual en una administración real para **Sin prisa, pero con alma**, manteniendo la experiencia visual de la tienda actual y trasladando los datos privados al mini PC.

## Arquitectura objetivo

- **Web pública:** estática, rápida y disponible aunque el mini PC esté apagado.
- **Admin:** interfaz privada de gestión.
- **PocketBase en mini PC:** fuente maestra de productos, categorías, imágenes originales, clientes, pedidos, encargos y contenido editable.
- **Cloudflare Tunnel:** acceso seguro al backend sin abrir puertos del router.
- **Snapshot público:** catálogo publicado y derivados de imagen disponibles fuera del mini PC.

## Fases

### Fase 0 — consolidación
- Mantener `admin.html` actual como referencia visual.
- Inventariar flujos existentes: productos, pedidos, mensajes, cuenta y cesta.
- Separar datos locales de la lógica de interfaz.
- Añadir validación automática de estructura y build.

### Fase 1 — modelo de datos
- Definir colecciones PocketBase y relaciones.
- Definir estados de producto, stock, publicación y precio.
- Definir contratos de imágenes, pedidos y encargos.
- Preparar migración desde los datos demo/locales sin perder la tienda actual.

### Fase 2 — autenticación real
- Sustituir el PIN local por autenticación PocketBase.
- Roles iniciales: `owner` y `editor`.
- Mantener la sesión fuera de secretos versionados.
- Aplicar reglas de acceso de servidor.

### Fase 3 — productos y colecciones
- CRUD real de productos.
- Categorías/colecciones editables.
- Borrador, publicado, oculto y archivado.
- Precio fijo, desde o consultar.
- Disponible, bajo pedido o agotado.
- Destacados y orden manual.

### Fase 4 — imágenes
- Varias imágenes por producto.
- Imagen principal.
- Ordenación.
- Texto alternativo.
- Original privado + derivados WebP/AVIF publicados.
- Validación de tamaño y formato.

### Fase 5 — pedidos, encargos y clientes
- Clientes.
- Pedidos y líneas de pedido.
- Estados y pago.
- Encargos personalizados.
- Notas internas.
- Historial mínimo de cambios.

### Fase 6 — contenido
- Portada.
- Textos de marca.
- Bloques editoriales.
- Promociones y avisos.

### Fase 7 — publicación
- Generar catálogo público limpio.
- Publicar assets derivados.
- Mantener disponible el último snapshot si el mini PC cae.
- No publicar datos privados, notas internas ni clientes.

## Reglas de calidad

1. No hacer push directo a `main`.
2. No mezclar secretos con código.
3. No considerar el PIN local una medida de seguridad real.
4. No acoplar la web pública a la disponibilidad del mini PC.
5. Cada cambio del admin debe conservar responsive y accesibilidad.
6. Cada nueva fase debe incluir una validación ejecutable cuando sea posible.
7. No integrar el antiguo PR #2 de forma ciega: reutilizar únicamente las ideas compatibles con la web actual.
8. La capa de datos debe poder cambiar de driver sin reescribir las pantallas del admin.
9. Antes de conectar PocketBase, el driver local debe conservar exactamente los flujos actuales.

## Estado actual

Checkpoint 0 cerrado: arquitectura, esquema y gate versionados.

Checkpoint 1 cerrado: `admin-data.js` está conectado al controlador aislado y expone un contrato asíncrono tanto para el driver local como para el futuro driver PocketBase. La interfaz mantiene datos locales mientras no exista backend.

## Siguiente cambio funcional

Completar la validación de dominio, los estados de carga/error y la interfaz de colecciones y galerías antes de implementar el driver PocketBase y el login real.
