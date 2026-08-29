# Puesta en marcha — Sin prisa, pero con alma

Este documento fija el orden de trabajo para publicar la tienda sin hacer que
la disponibilidad de la web pública dependa del mini PC.

## Arquitectura aprobada

```text
sinprisa.isivoltpro.com
  Cloudflare Pages
  └─ catálogo público estático

gestion-sinprisa.isivoltpro.com
  Cloudflare Access → Cloudflare Tunnel → mini PC
  └─ admin privado + PocketBase

mini PC
  PocketBase + imágenes originales + copias de seguridad
```

La web pública debe servir siempre el último snapshot publicado. El mini PC no
debe ser una dependencia en tiempo real para navegar o comprar en el catálogo.

## Principios no negociables

1. No abrir puertos entrantes del router para SSH, PocketBase o el admin.
2. No guardar tokens, contraseñas ni claves privadas en Git.
3. No exponer PocketBase superuser ni credenciales de servicio al navegador.
4. El PIN local actual es solo una demo: no protege producción.
5. Las fotos originales, clientes, pedidos y notas internas nunca entran en el
   snapshot público.
6. Cada despliegue debe poder revertirse y cada base de datos debe poder
   restaurarse desde una copia comprobada.

## Bloque 1 — Web pública y vídeo

Objetivo: cerrar la experiencia pública sin introducir dependencia del backend.

- Integrar el vídeo de patitos únicamente en la bienvenida: sin sonido,
  `autoplay`, `muted`, `loop` y `playsinline`.
- Mantener el logo como imagen estática y accesible; el vídeo lo acompaña, no lo
  sustituye.
- Crear poster y formatos optimizados; respetar `prefers-reduced-motion`.
- Publicar la web desde `main` en Cloudflare Pages y probar móvil, escritorio,
  enlaces, formulario y carrito local.

Criterio de salida: la web pública está disponible en su dominio definitivo y
funciona aunque el mini PC esté apagado.

## Bloque 2 — Admin preparado para backend

Objetivo: eliminar las decisiones locales que bloquearían PocketBase.

- Convertir el contrato de `admin-data.js` a asíncrono, incluido driver local.
- Añadir estados de carga, error, reintento y confirmación de operaciones.
- Validar productos, precios, stock, estados, colecciones e imágenes en una
  única capa de dominio.
- Terminar la interfaz de colecciones, edición de producto y galería ordenada.
- Limitar tipo, peso y dimensiones de archivos; abandonar DataURL como almacén
  persistente.
- Añadir pruebas de navegador, accesibilidad, almacenamiento corrupto y fallos
  de escritura.

Criterio de salida: el Admin puede cambiar de driver sin reescribir las vistas
y no conserva datos privados o imágenes grandes en `localStorage`.

## Bloque 3 — Preparación del mini PC

Objetivo: tener una máquina privada, actualizable y recuperable.

- Confirmar sistema operativo, arquitectura, disco disponible y actualizaciones.
- Crear un usuario de despliegue sin permisos de administración innecesarios.
- Instalar PocketBase como servicio local; debe escuchar solo en loopback.
- Instalar Caddy o Nginx para servir el Admin y hacer proxy local a PocketBase.
- Instalar Cloudflare Tunnel como servicio saliente.
- Configurar copias diarias de `pb_data` y de originales en un destino externo
  cifrado; probar restauración antes de usar datos reales.

Criterio de salida: reiniciar el mini PC recupera todos los servicios y una
copia restaurada abre correctamente en un entorno de prueba.

## Bloque 4 — Acceso privado y autenticación

Objetivo: el admin solo es visible para personal autorizado.

- Crear `gestion-sinprisa.isivoltpro.com` mediante Tunnel.
- Protegerlo con Cloudflare Access, limitado a las direcciones autorizadas.
- Configurar usuarios, roles `owner` y `editor`, y reglas PocketBase en servidor.
- Sustituir definitivamente el PIN local.
- Registrar errores y eventos administrativos sin registrar secretos.

Criterio de salida: una persona no autorizada no puede ver ni la interfaz ni la
API; un editor no puede realizar operaciones reservadas al owner.

## Bloque 5 — Datos, publicación y operación

Objetivo: publicar catálogo sin filtrar datos privados.

- Implementar driver PocketBase, relaciones, paginación y subidas de archivos.
- Generar derivados WebP/AVIF y un snapshot público versionado.
- Publicar únicamente productos `published`, imágenes derivadas y campos
  explícitamente públicos.
- Añadir historial mínimo de cambios para pedidos, encargos y publicación.
- Crear un flujo de despliegue al mini PC con runner autoalojado o canal privado;
  no hacer SSH público desde GitHub.

Criterio de salida: un cambio publicado aparece en Pages; apagar el mini PC no
rompe el último catálogo público.

## Puesta en marcha de pedidos y cobros

No activar pedidos reales ni cobros hasta completar los cinco bloques y validar:

- privacidad de clientes y direcciones;
- estados, cancelaciones y reembolsos;
- copias y restauración;
- avisos operativos;
- pruebas desde móvil y escritorio;
- procedimiento de incidencia y reversión.

## Información necesaria antes del Bloque 3

- modelo del mini PC, sistema operativo y arquitectura;
- espacio disponible y disco destinado a fotos/copias;
- si Docker ya está instalado;
- dominio de Cloudflare y cuenta que lo administra;
- correos que tendrán acceso de administración;
- destino externo previsto para las copias de seguridad.
