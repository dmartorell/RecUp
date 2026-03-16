# RecUp — Guia de funcionamiento

## Que es RecUp

RecUp es una herramienta interna para reportar bugs. El usuario describe el problema hablando o escribiendo, y RecUp se encarga de todo lo demas: transcribe el audio, genera un resumen con IA y crea el ticket en ClickUp listo para que el equipo lo investigue.

Funciona como una web en el navegador (localhost:3000) y tiene una extension de Chrome para enviar texto seleccionado directamente.

### Piezas principales

- **Servidor** — Recibe las peticiones, guarda datos, habla con Claude y con ClickUp
- **Web** — Lo que el usuario ve y usa en el navegador
- **Extension Chrome** — Un atajo para enviar texto desde cualquier pagina
- **Base de datos** — Un archivo SQLite donde se guardan usuarios e incidencias
- **Claude (IA)** — Analiza el texto y decide si es un bug, le pone titulo y puntos clave
- **ClickUp** — Donde se crean los tickets finales

---

## Como funciona la autenticacion (paso a paso)

### Registro

1. El usuario escribe su nombre, email y contrasena en el formulario
2. La web envia esos datos al servidor
3. El servidor comprueba que el email es valido y la contrasena tiene al menos 6 caracteres
4. Si hay un dominio restringido configurado (por ejemplo, solo emails de `@alfredsmart.com`), comprueba que el email coincide
5. El servidor convierte la contrasena en un hash (una cadena irreconocible) usando bcrypt. La contrasena original nunca se guarda
6. Guarda el usuario en la base de datos (nombre, email, hash)
7. El servidor genera un **token JWT**: un texto largo y firmado que dice "este usuario es el numero X, se llama Y, su email es Z" y que caduca en 7 dias
8. Devuelve el token y los datos del usuario a la web
9. La web guarda todo en localStorage (`recup_session`)

### Login

1. El usuario escribe email y contrasena
2. La web envia esos datos al servidor
3. El servidor busca el email en la base de datos
4. Si no existe, responde "credenciales incorrectas"
5. Si existe, compara la contrasena con el hash guardado usando bcrypt
6. Si no coincide, responde "credenciales incorrectas" (mismo mensaje para no revelar si el email existe)
7. Si coincide, genera un token JWT nuevo y lo devuelve
8. La web guarda el token en localStorage

### Que pasa despues del login

Cada vez que la web necesita hacer algo protegido (ver incidencias, crear una, borrarla...), envia el token JWT en la cabecera de la peticion:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

El servidor recibe la peticion, lee el token, comprueba que:
- No esta manipulado (la firma coincide con el secreto del servidor)
- No ha caducado (menos de 7 dias)

Si todo esta bien, extrae del token quien es el usuario y deja pasar la peticion. Si no, responde "no autorizado" y la web mostrara la pantalla de login.

### Cerrar sesion

No hay cierre de sesion en el servidor. Simplemente la web borra el token de localStorage y recarga la pagina. El token sigue siendo valido hasta que caduque, pero como ya no esta guardado en ningun sitio, nadie lo usa.

### Proteccion contra intentos masivos

Si alguien intenta hacer login o registro mas de 10 veces en un minuto desde la misma IP, el servidor bloquea temporalmente esa IP. Pasado el minuto, puede volver a intentarlo.

---

## Como funciona una incidencia de audio

### Paso 1 — Grabar

1. El usuario pulsa el boton del microfono
2. El navegador pide permiso para usar el microfono (si es la primera vez)
3. Empieza la grabacion: se ve una animacion de ondas y un cronometro
4. Mientras graba, el navegador usa la Web Speech API para convertir la voz en texto en tiempo real (en espanol)
5. Si pasan 5 minutos, la grabacion se detiene automaticamente

### Paso 2 — Parar y procesar

1. El usuario pulsa de nuevo para parar
2. Se obtiene la transcripcion final del audio
3. Aparece una tarjeta en el feed con el texto, un badge "Procesando" y un spinner
4. La incidencia se guarda en la base de datos con estado "procesando"

### Paso 3 — Analisis con IA

1. La web envia la transcripcion al servidor, que la reenvia a Claude (IA de Anthropic)
2. Claude analiza el texto y decide:
   - **Si es un bug**: devuelve un titulo corto y una lista de puntos clave (solo hechos, sin sugerencias)
   - **Si no es un bug** (por ejemplo, "hola, probando microfono"): lo marca como no-bug
3. El servidor tiene 30 segundos para recibir respuesta. Si tarda mas, da error de timeout
4. La tarjeta se actualiza: el badge cambia a "Completado" y aparecen los puntos clave

### Paso 4 — Crear ticket en ClickUp

1. Si Claude detecto un bug, se abre automaticamente el modal de crear ticket
2. El titulo y la descripcion ya vienen pre-rellenados con lo que genero la IA
3. El usuario puede elegir producto (Alfred Smart, Lavidda, etc.), plataforma (iOS, Android, Web), version y un ID de asset
4. Si faltan datos opcionales, aparece un aviso amarillo, pero puede enviar igualmente
5. Al pulsar "Crear ticket":
   - El servidor busca el email del usuario en los miembros del workspace de ClickUp
   - Si no lo encuentra, muestra error (el usuario tiene que estar dado de alta en ClickUp)
   - Si lo encuentra, crea la tarea en la lista configurada de ClickUp con todos los campos
   - Si hay adjuntos (fotos, archivos), los sube a la tarea
6. La tarjeta cambia su badge a "Enviado" y muestra un enlace para ver el ticket en ClickUp
7. Se actualiza la incidencia en la base de datos con el ID y URL del ticket de ClickUp

---

## Como funciona una incidencia de texto

Igual que la de audio pero sin grabar. El usuario cambia al modo texto (boton de teclado), escribe la descripcion del problema en un textarea y le da a enviar. A partir de ahi, el flujo es identico: se procesa con Claude, se muestra el resultado y se puede crear ticket.

---

## Como funciona la extension de Chrome

### Menu contextual ("Enviar a RecUp")

1. El usuario selecciona texto en cualquier pagina web
2. Click derecho y elige "Enviar a RecUp"
3. La extension coge el texto seleccionado y las credenciales guardadas (si hay sesion)
4. Abre la web de RecUp (o reutiliza la pestana si ya estaba abierta) con todo en la URL:
   - `contextText` = el texto seleccionado
   - `token`, `email`, `name` = credenciales para que la web tenga sesion
5. La web recibe esos datos:
   - Si no tenia sesion, adopta las credenciales de la extension
   - Crea una incidencia automaticamente con el texto
   - Se procesa con Claude como cualquier otra incidencia
6. Los parametros se limpian de la URL para que no queden visibles

### Popup de la extension

1. Al hacer clic en el icono de RecUp en Chrome, se abre un popup pequeno
2. Si no hay sesion, muestra un formulario de login
3. Si hay sesion, el usuario puede grabar audio o escribir texto directamente desde el popup
4. Al enviar, la extension crea la incidencia en el servidor y redirige a la web para ver el resultado y crear el ticket

### Sesion en la extension

La extension guarda sus credenciales por separado (en `chrome.storage.local`, no en localStorage). Cada vez que se abre el popup, valida que el token siga siendo valido haciendo una peticion de prueba al servidor. Si el token ha caducado, muestra el login.

---

## Como se guardan los datos

### Usuarios

Cada usuario tiene: nombre, email (unico), contrasena hasheada y la fecha en que se registro.

### Incidencias

Cada incidencia pertenece a un usuario y guarda:
- **Transcripcion** — el texto original (lo que dijo o escribio)
- **Titulo** — generado por Claude (si detecto bug)
- **Puntos clave** — lista generada por Claude, guardada como texto JSON
- **Estado** — "procesando" (esperando a Claude), "completado" (ya analizado) o "error" (algo fallo)
- **Origen** — si vino de audio, texto o la extension
- **Duracion** — cuanto duro la grabacion (solo audio)
- **Datos de ClickUp** — ID y URL del ticket, si se creo uno

### Paginacion

La web carga las incidencias de 25 en 25. Si hay mas, aparece un boton "Cargar mas" al final del feed. Al recargar la pagina, las incidencias que estaban "procesando" se vuelven a enviar a Claude automaticamente.

---

## Como funciona la conexion con ClickUp

### Crear un ticket

1. El servidor recibe el titulo, descripcion, email del reporter, producto, plataforma, version y asset ID
2. Primero necesita saber el ID de ClickUp del usuario. Para ello, pide la lista de miembros del workspace a la API de ClickUp
3. Esa lista se guarda en memoria durante 10 minutos para no pedirla cada vez
4. Busca el email del usuario en esa lista. Si no lo encuentra, devuelve error
5. Crea la tarea en la lista de ClickUp configurada, con prioridad Normal
6. Rellena los campos personalizados: reporter, asset ID, dispositivo (plataforma) y version
7. Devuelve el ID y la URL del ticket creado

### Subir adjuntos

Si el usuario adjunto fotos o archivos al ticket:
1. Se envian al servidor como un formulario multipart
2. El servidor los reenvia a la API de ClickUp, asociandolos a la tarea recien creada
3. Se permite un maximo de 5 archivos, cada uno de hasta 100 MB

---

## Como funciona la IA (Claude)

RecUp usa Claude Haiku 4.5 (un modelo rapido y economico) para analizar las transcripciones.

### Que hace exactamente

Recibe el texto que dijo o escribio el usuario y responde con un JSON que dice:

- **Si es un bug**: titulo corto (maximo 10 palabras) + transcripcion corregida + lista de puntos clave
- **Si no es un bug**: solo la transcripcion corregida

### Reglas de la IA

- Es muy permisiva: si el usuario menciona que algo no funciona, falta, esta roto o le sale un error, lo cuenta como bug
- Solo marca como "no es bug" si el mensaje es un saludo, prueba de microfono o algo sin ninguna queja
- Los puntos clave son solo hechos ("el usuario no puede iniciar sesion"), nunca hipotesis ni sugerencias ("posible problema de red")

---

## Configuracion necesaria

Para que RecUp funcione, necesitas configurar estas variables de entorno (en un archivo `.env`):

| Variable | Necesaria | Para que sirve |
|---|---|---|
| `ANTHROPIC_API_KEY` | Si | La clave para usar Claude (IA). Sin esto no se pueden analizar incidencias |
| `CLICKUP_API_KEY` | Si | La clave para crear tickets en ClickUp |
| `CLICKUP_LIST_ID` | Si | El ID de la lista de ClickUp donde se crean los tickets |
| `JWT_SECRET` | Si | Una frase secreta para firmar los tokens de sesion. Puede ser cualquier texto largo y aleatorio |
| `PORT` | No | En que puerto arranca el servidor. Si no se pone, usa el 3000 |
| `ALLOWED_EMAIL_DOMAIN` | No | Si se pone (ej: `alfredsmart.com`), solo se pueden registrar emails de ese dominio |

---

## Seguridad

- **Contrasenas**: nunca se guardan tal cual. Se convierten en un hash irreversible con bcrypt
- **Sesiones**: el token JWT va firmado con un secreto que solo conoce el servidor. Si alguien lo manipula, el servidor lo detecta
- **Propiedad**: cada usuario solo puede ver, editar y borrar sus propias incidencias
- **Limite de intentos**: si alguien intenta hacer login muchas veces seguidas (fuerza bruta), se le bloquea temporalmente
- **Subida de archivos**: limitada a 5 archivos de 100 MB cada uno
- **Sin HTTPS**: la app corre solo en localhost, asi que no necesita cifrado de red
