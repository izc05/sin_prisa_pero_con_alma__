# Solicitudes privadas de pedido

## Recorrido

```text
Navegador público
  POST /api/order-requests (mismo origen)
    -> Pages Function (valida y elimina campos no permitidos)
      -> Cloudflare Access Service Auth
        -> Tunnel: pedidos-sinprisa.isivoltpro.com
          -> PocketBase /api/sinprisa/order-requests
            -> cliente + pedido + líneas privadas
```

El navegador solo envía nombre, correo, `slug` de producto y cantidad. PocketBase
comprueba que cada producto siga publicado y disponible y recalcula el total con
su precio canónico. El pedido nace con `status=pending` y
`payment_status=pending`. La confirmación de Bizum es una acción posterior del
Admin.

## Secretos y configuración privada

La Pages Function requiere tres secretos cifrados, nunca incluidos en Git:

- `CF_ACCESS_CLIENT_ID`
- `CF_ACCESS_CLIENT_SECRET`
- `ORDER_INTAKE_SECRET`

PocketBase recibe `SINPRISA_ORDER_INTAKE_SECRET` únicamente desde su entorno de
servicio. Debe contener el mismo valor que `ORDER_INTAKE_SECRET`.

El mini PC carga `/etc/sin-prisa-pocketbase-orders.env` mediante el drop-in
`deploy/sin-prisa-pocketbase-orders.conf`. El instalador genera el valor con
entropía criptográfica y conserva uno ya existente:

```bash
sudo node scripts/install-pocketbase-order-secret.mjs /etc/sin-prisa-pocketbase-orders.env
```

`ORDER_INTAKE_URL` no es secreto y se declara en `wrangler.jsonc`. La ruta de
Tunnel debe apuntar al PocketBase aislado `http://127.0.0.1:8092` y la aplicación
Access del hostname debe aceptar exclusivamente el Service Token creado para
Pages. No se habilitan reglas anónimas de escritura en ninguna colección.

## Archivos del mini PC

- `pocketbase/pb_hooks/order_requests.pb.js`: ruta privada, validación, cálculo y escritura transaccional.
- `pocketbase/pb_migrations/1788034500_private_order_requests.js`: idempotencia y catálogo inicial.

Antes de desplegarlos se debe crear una copia de `pb_data`. PocketBase recarga
los hooks automáticamente; la migración se aplica al reiniciar o ejecutar
`pocketbase migrate up`.

## Prueba real

1. Enviar una cesta desde la URL de preview de la rama.
2. Comprobar una respuesta `201` con referencia `SOL-...`.
3. Entrar al Admin privado con una cuenta `sinprisa_staff`.
4. Verificar nombre, correo, líneas, cantidades, total, estado “Solicitud recibida” y pago pendiente.
5. Para una prueba reversible, eliminar después los registros de líneas, pedido y cliente creados para QA desde PocketBase.
