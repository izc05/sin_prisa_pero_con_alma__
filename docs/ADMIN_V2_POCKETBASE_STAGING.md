# Admin V2: configuración local de PocketBase

El panel conserva el driver local salvo que exista una configuración explícita de staging.

1. Copiar `admin-runtime-config.example.js` como `admin-runtime-config.js`.
2. Ajustar únicamente `pocketbaseUrl` a una URL local autorizada.
3. Servir la carpeta con un servidor ligado a loopback.
4. Abrir `admin.html` e iniciar sesión manualmente.

`admin-runtime-config.js` está ignorado por Git y no se copia a `dist`. Solo puede contener el modo y la URL. No debe incluir email, contraseña, token, cookie ni otros datos personales.

Sin ese archivo, el cargador resuelve el modo local y no realiza ninguna petición a PocketBase.
