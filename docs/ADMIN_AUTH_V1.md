# Acceso privado del Admin V2

## Decisión

El acceso al panel tendrá dos capas independientes:

1. **Cloudflare Access** limita quién puede abrir `gestion-sinprisa.isivoltpro.com`.
2. **PocketBase** autentica a la persona y aplica los permisos sobre los datos.

La cuenta de entrada de la propietaria puede ser el correo de Isivoltpro que ya
usa para la gestión, por ejemplo `isivoltpro@gmail.com`. Debe existir como un
registro individual en la colección auth `users`, con el rol `owner`.

## Roles

| Rol | Uso |
| --- | --- |
| `owner` | Gestiona catálogo, pedidos, clientes, contenido y usuarios editor. |
| `editor` | Gestiona catálogo y contenido autorizado; nunca roles, configuración ni datos sensibles no asignados. |

No se usará una cuenta genérica compartida para varias personas. Cada editor
tendrá correo y credenciales propios para poder revocar accesos sin cambiar la
contraseña de la propietaria.

## Reglas de seguridad

- El superusuario `_superusers` de PocketBase se crea y utiliza solo desde la
  máquina privada para la configuración inicial; nunca desde el frontend.
- El navegador solo recibe el token de la cuenta auth de PocketBase, nunca un
  token de superusuario, GitHub, Cloudflare ni del Tunnel.
- La autenticación por contraseña se habilitará para `users` con correo único,
  contraseña larga y MFA activado cuando el backend esté disponible.
- Cloudflare Access exigirá la identidad autorizada y MFA antes de cargar el
  Admin.
- Cerrar sesión eliminará el token local de PocketBase; el backend seguirá
  validando cada petición mediante sus reglas de colección.

## Orden de puesta en marcha

1. Crear PocketBase aislado para Sin Prisa en el mini PC, sin puerto público.
2. Crear la colección auth `users` y el registro `owner` de Isivoltpro.
3. Definir y probar reglas de colección con datos de prueba.
4. Configurar Cloudflare Access para el dominio privado.
5. Sustituir el PIN demo por login PocketBase y flujo de cierre de sesión.
6. Probar un `editor` y verificar que no puede escalar privilegios.

No se crearán credenciales ni se activará Cloudflare Access hasta terminar las
pruebas del Admin V2 y la configuración aislada de PocketBase.
