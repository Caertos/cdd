# CDD — CLI Docker Dashboard

<p align="center">
  <img src="https://img.shields.io/npm/v/cdd-cli?color=blue&label=npm%20package" alt="npm version"/>
  <img src="https://img.shields.io/npm/dt/cdd-cli?color=green&label=downloads" alt="npm downloads"/>
  <a href="https://github.com/Caertos/cdd/actions/workflows/ci.yml"><img src="https://github.com/Caertos/cdd/actions/workflows/ci.yml/badge.svg" alt="tests"/></a>
  <a href="https://deepwiki.com/Caertos/cdd"><img src="https://img.shields.io/badge/DeepWiki-Ask-2f6feb?logo=data%3Aimage%2Fpng%3Bbase64%2CiVBORw0KGgoAAAANSUhEUgAAACwAAAAyCAMAAAAQhsnYAAAAG1BMVEX%2F%2F%2F8qbs0qbc4pbc4ewZsdwpwdwZwYleEXluKUtKvnAAAAAXRSTlMAQObYZgAAAQtJREFUSMfVltsSwiAMRLlsoP%2F%2FxQICDSS0dPRB91HPbDZhZ9QYTdZsy7qkTdS7Ir9ru4kz1jn7H7C%2Fh22%2Fq1NgEM2z%2FRyiwqCQRFrMQYUNVRCDB99sHJjUyf7MQBzGBPdgdbcrWLTh6zAaHO5htLviFq4EGYxsmNogzEZjXh4rUiZ%2FGtn6MFZJSf0i4M1sbcScsuDQ%2BwxhfCHIlYTicRUDNKBZqwXBh7zRpKicuZ%2BORvZtvn6UjDO2eDccGDuXo3DjmjtDUIukwWdHt%2BBF%2BT%2BAYztQ3IAzFNmQCTbHUvM55lcRY4wo%2F%2FnVoWwgyt83UuB8bb2sKrxS%2FEH49uf4gTHH494fgwdoia5%2B%2BgJ3fRfe3V5gGAAAAABJRU5ErkJggg%3D%3D" alt="Ask DeepWiki"/>
</p>

> **Un dashboard de Docker para la terminal — monitorea, gestiona y crea contenedores sin salir del teclado.**

---

## 🎉 Novedades en v4.10

**CDD explica por qué murió un contenedor — y te ofrece arreglarlo.**

Todas las demás herramientas de este nicho — lazydocker, ctop, Docker Desktop — te enseñan `EXITED (1)` y te pasan el log. Ninguna te dice por qué. Quien instala una TUI para no escribir `docker ps` es exactamente quien no quiere leer 200 líneas de arranque de Postgres para descubrir que faltaba una variable.

Selecciona un contenedor que está fallando y el panel aparece solo:

```
╭─ Diagnosis: mi-basedatos ─────────────────────────────────────╮
│                                                                │
│  It keeps dying after 2s and Docker restarts it.              │
│                                                                │
│  Likely cause:                                                 │
│    Postgres refuses to start without a password. The image     │
│    needs POSTGRES_PASSWORD defined.                           │
│                                                                │
│  Last lines:                                                   │
│    Error: Database is uninitialized and superuser password…   │
│                                                                │
│  [F] Recreate and set POSTGRES_PASSWORD  [L] Full log          │
╰────────────────────────────────────────────────────────────────╯
```

- **Sin pulsar ninguna tecla.** Si algo está mal, se explica solo. Un contenedor que paraste tú no recibe panel alguno.
- **`F` lo recrea con la corrección aplicada** — el asistente se abre ya relleno y ya en el paso de revisión, con cada valor que CDD cambió marcado como `↑ changed by CDD`. Nada se aplica a tus espaldas, y el contenedor que falló conserva su nombre: el nuevo se llama `mi-basedatos-2`.
- **Después pregunta.** *"Created mi-basedatos-2. Delete mi-basedatos, the container that failed?"* Responde "no" y se queda exactamente donde estaba.
- **Cuando no lo sabe, lo dice** — y muestra las últimas líneas. Esa es la regla, no un plan B: una causa plausible pero equivocada cuesta más confianza de la que construyen diez aciertos.

**Once reglas se publican ya:** credenciales faltantes de Postgres / MySQL / SQL Server, puerto de host ocupado, imagen sin comando, falta de memoria, permiso denegado en un volumen, ejecutable no encontrado, un job que terminó en vez de servir, y conexión rechazada a otro host. El catálogo es **datos**, no código: añadir una regla es añadir un elemento a una lista.

### v4.8 — Arranca Docker sin salir de la terminal

Cuando Docker no es accesible, CDD comprueba si sabe cómo iniciarlo. Si lo sabe, aparece la tecla `S` en la pantalla de conexión y te guía para lanzar Docker.

- **Windows** — encuentra Docker Desktop en sus ubicaciones de instalación estándar y lo inicia directamente, sin contraseña (plataforma principal)
- **macOS** — abre Docker Desktop con `open -a Docker`
- **Linux (rootless)** — inicia el servicio de usuario sin contraseña
- **Linux (servicio del sistema)** — cede la terminal a `sudo` para que escribas tu contraseña
- **Espera en vivo** — muestra el tiempo transcurrido y la espera típica, y recarga tus contenedores automáticamente cuando Docker está listo

### v4.7 — Teclas en la pantalla de conexión

**Cuenta atrás de reintento en vivo y teclas en la pantalla de conexión.**

Cuando Docker no es accesible, CDD ya no te deja sin explicaciones. La pantalla de conexión muestra la cuenta atrás hasta el siguiente reintento automático y te da teclas directas para actuar.

- **Cuenta atrás en vivo** — segundos hasta el siguiente intento de reconexión automática
- **`R` reintenta al instante** — fuerza la carga de contenedores sin esperar al temporizador
- **`Q` sale directamente** — sin confirmación; la app ya está en un estado degradado
- **Aviso más simple** — `ConnectionNotice` solo recibe `{ error, nextRetryIn }`

### v4.6 — Gestión de secretos

**Gestión de secretos — las contraseñas permanecen ocultas.**

CDD ahora protege las variables de entorno sensibles por defecto. Contraseñas, tokens y claves de API aparecen enmascarados en el asistente y la pantalla de revisión, y nunca aparecen en los logs de debug.

- **Enmascaramiento automático** — variables como `POSTGRES_PASSWORD`, `JWT_SECRET` o `API_KEY` se muestran como `••••••` mientras escribes
- **`Ctrl+R` para revelar** — alterna la visibilidad de valores secretos cuando necesitas verificarlos
- **`Ctrl+G` para generar** — crea contraseñas fuertes y sin caracteres ambiguos directamente en el asistente
- **Sin contraseñas de ejemplo** — los perfiles de imagen ya no sugieren `secret` o `change-me` como valores por defecto
- **Advertencias de contraseña débil** — la pantalla de revisión señala contraseñas comunes o cortas y sugiere generar una más fuerte
- **Seguro para debug** — los secretos se redactan de toda salida de log, incluso en modo debug

### Por qué es importante

Antes de v4.6, seleccionar un perfil de Postgres pre-rellenaba `POSTGRES_PASSWORD=secret`. La mayoría de usuarios acepta esto sin pensarlo — y termina con una base de datos protegida por una contraseña literal `secret`. Peor aún, si compartes tu pantalla o revisas tu historial de terminal dos días después, cada contraseña es visible en texto plano.

Ahora CDD fomenta prácticas seguras sin frenarte: valores vacíos para secretos, generación con una tecla y enmascaramiento que puedes alternar cuando lo necesites.

### v4.6.1 — Manejo de conexión Docker

**Mensajes de error claros cuando Docker no es accesible.**

Antes de v4.6.1, si Docker estaba detenido o no era accesible, CDD mostraba "No containers found" — un mensaje engañoso que hacía pensar que algo estaba mal con los contenedores. Ahora CDD detecta fallos de conexión y muestra una pantalla de error clara y accionable.

- **Pantalla de error clara** — "Can't reach Docker" con detalles técnicos específicos
- **Sugerencias accionables** — te dice exactamente cómo solucionarlo (`sudo systemctl start docker`, abrir Docker Desktop)
- **Auto-reintento** — CDD sigue intentando conectarse cada 5 segundos en segundo plano
- **Reintento manual** — presiona `R` para reintentar inmediatamente sin esperar
- **Indicador de datos obsoletos** — al reconectarse, los datos antiguos de contenedores se atenuan visualmente hasta que llegan datos frescos
- **Strings centralizados** — todo el texto de la UI se movió a `src/helpers/strings.js` para futura internacionalización

---

## Versiones anteriores

### v4.1 — Shell interactivo

**Abre un shell dentro de cualquier contenedor con una sola tecla.**

Presiona `S` y CDD te lleva a un shell interactivo completo (`bash` o `sh`) dentro del contenedor seleccionado — sin necesidad de escribir `docker exec`.

- **Shell auto-detectado** — CDD sondea el contenedor y elige `bash` o `sh` automáticamente
- **Soporte de terminal completo** — ejecuta `psql`, `python3`, `node`, `redis-cli`, o cualquier comando dentro del contenedor
- **Salida limpia** — escribe `exit` o presiona `Ctrl+D` para volver al dashboard

### v4.5 — Asistente de creación interactivo

Olvídate de los flags de `docker run`, las variables de entorno olvidadas y los tags `:latest` que fallan en silencio. Presiona `C` y CDD te guía para crear un contenedor en segundos:

- **20 perfiles de imagen curados** disponibles sin conexión — postgres, redis, nginx, node, mysql, mongo y más
- **Tags por defecto que realmente funcionan**: `postgres:17-alpine`, `redis:7-alpine`, `nginx:1.27-alpine` — sin más fallos silenciosos por `:latest`
- **Búsqueda en vivo en Docker Hub** con un solo `Tab` — con indicador `[searching Docker Hub...]` para que siempre sepas qué está pasando
- **Sugerencias contextuales de variables de entorno** — ¿creando un contenedor de Postgres? CDD sugiere `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` automáticamente
- **Revisa antes de crear** — ves exactamente qué se va a crear (tag de imagen resuelto, puertos auto-asignados, advertencias) antes de que el contenedor exista
- **HUD sensible al contexto** — solo se muestran las teclas que tienen sentido en ese momento, nada más

Así debería sentirse la experiencia de desarrollo.

---

## Características

- 🐳 Vista en vivo de todos los contenedores Docker con estadísticas de CPU/memoria
- 🔄 Auto-refresco cada pocos segundos — siempre actualizado
- ⌨️ Acciones controladas por teclado: iniciar, detener, reiniciar, ver logs, eliminar
- 🎨 **Veredictos de salud** — running, starting, stopped, crashed, crash-loop, restarting o unhealthy, leídos de los propios datos de Docker
- ⚪ Detenido vs caído — un contenedor que paraste tú se ve gris; el rojo se reserva para fallos reales
- 🔍 **Explica por qué falló** — un panel con la causa probable y las últimas líneas del log, sin que tengas que pedirlo
- 🔧 **Arreglo en una tecla** — `F` recrea el contenedor con la corrección aplicada, en una revisión que muestra exactamente qué cambió
- 🤝 **"No lo reconozco"** — cuando ninguna regla encaja, CDD lo dice en vez de adivinar, y muestra la evidencia
- ✨ **Asistente de creación interactivo** — configuración paso a paso con perfiles curados y búsqueda en Hub
- 🪵 Streaming de logs en tiempo real para el contenedor seleccionado
- 🐛 Panel de debug en vivo activable con la tecla `D`
- 🚨 **Manejo inteligente de conexión** — pantalla de error clara con sugerencias accionables cuando Docker no es accesible

---

## Instalación global

```bash
npm install -g cdd-cli
cdd
```

---

## Inicio rápido (local)

```bash
git clone https://github.com/caertos/cdd.git
cd cdd
pnpm install
pnpm run build
node dist/index.js
```

Para usar como comando global durante el desarrollo:

```bash
pnpm link --global
cdd
```

---

## Uso

Usa `↑` / `↓` para navegar por los contenedores. El **HUD** en la parte inferior muestra las teclas disponibles para el contexto actual. Presiona `?` para ayuda completa.

### Lista de Contenedores

| Tecla     | Acción                                                      |
| --------- | ----------------------------------------------------------- |
| `↑` / `↓` | Navegar la lista de contenedores                            |
| `I`       | Iniciar el contenedor seleccionado                          |
| `P`       | Detener el contenedor seleccionado                          |
| `R`       | Reiniciar el contenedor seleccionado                        |
| `C`       | Abrir el asistente de creación                              |
| `F`       | **Arreglar** — recrear con el diagnóstico aplicado (solo aparece cuando hay arreglo) |
| `L`       | Ver logs del contenedor seleccionado en tiempo real         |
| `S`       | Abrir shell interactivo dentro del contenedor seleccionado  |
| `E`       | Eliminar el contenedor seleccionado — requiere confirmación |
| `D`       | Activar/desactivar panel de debug en vivo                   |
| `Q`       | Salir                                                       |
| `?`       | Mostrar la ayuda de la pantalla actual                      |

Tras crear el reemplazo con `F`, `y` borra el contenedor que falló y `n` lo conserva. Esas dos teclas solo existen mientras la pregunta está en pantalla.

### Pantalla de Conexión

| Tecla     | Acción                                                |
| --------- | ----------------------------------------------------- |
| `S`       | Iniciar Docker (solo cuando CDD sabe cómo)            |
| `R`       | Reintentar la carga de contenedores al instante       |
| `Q`       | Salir de CDD (sin confirmación)                       |
| —         | Reintento automático cada 5 segundos (cuenta atrás)   |

### Iniciar Docker desde la pantalla de conexión

Cuando Docker no es accesible, CDD comprueba si sabe cómo iniciarlo. Si lo sabe, aparece la tecla `S` y te guía para lanzar Docker sin salir de la terminal.

- **Windows** — CDD encuentra Docker Desktop en sus ubicaciones de instalación estándar y lo inicia directamente, sin contraseña. Es la plataforma principal.
- **macOS** — abre Docker Desktop con `open -a Docker`.
- **Linux (rootless)** — inicia el servicio de usuario (`systemctl --user start docker`) sin contraseña.
- **Linux (servicio del sistema)** — cede la terminal a `sudo systemctl start docker` para que escribas tu contraseña.

Después de iniciarlo, CDD espera a que el daemon responda y recarga tus contenedores automáticamente. En Windows, un arranque lento suele significar que el motor WSL2 todavía se está inicializando; CDD ofrece seguir esperando.

`S` solo aparece cuando CDD sabe cómo iniciar Docker, y CDD nunca ofrece detener Docker.

### Asistente de Creación

| Tecla     | Acción                                          |
| --------- | ----------------------------------------------- |
| `Enter`   | Confirmar y continuar al siguiente paso (o crear en revisión) |
| `Esc`     | Volver un paso atrás (o cancelar en paso 0)     |
| `Tab`     | Buscar en Docker Hub (paso 0) o insertar env    |
| `↑` / `↓` | Navegar sugerencias                             |
| `Ctrl+G`  | Generar un secreto fuerte (paso 3)              |
| `Ctrl+R`  | Alternar visibilidad de secretos (paso 3)       |
| `1`–`4`   | Editar un campo desde la pantalla de revisión   |
| `?`       | Mostrar panel de ayuda                          |

### Visor de Logs

| Tecla     | Acción                      |
| --------- | --------------------------- |
| `↑` / `↓` | Desplazar arriba/abajo      |
| `PgUp` / `PgDn` | Página arriba/abajo  |
| `f`       | Activar/desactivar auto-follow |
| `Esc` / `Q` | Cerrar visor de logs     |
| `?`       | Mostrar panel de ayuda      |

### Confirmación

| Tecla | Acción                  |
| ----- | ----------------------- |
| `y`   | Confirmar la acción     |
| `n`   | Cancelar la acción      |

---

## El Panel de Diagnóstico

Cuando el contenedor seleccionado está fallando, CDD lo explica. No tienes que pulsar nada.

**Aparece solo cuando hay algo que decir.** Un contenedor que paraste tú, o uno que todavía está arrancando, no recibe panel: no hay nada que explicar y ese espacio está mejor reservado.

**Siempre tiene las mismas tres partes**, en este orden:

1. **Qué pasó** — a partir del veredicto de salud. Siempre está.
2. **Causa probable** — del catálogo de reglas. Puede faltar, y cuando falta el panel lo dice.
3. **Últimas líneas** — las últimas cinco líneas de su log. Es justo lo que ibas a ir a mirar.

### Cuando CDD no lo sabe

```
  Likely cause:
    I don't recognise it. This is the last thing the container
    said before it died:
```

Esto es el principio 5 del proyecto y no se negocia. Una causa plausible pero equivocada cuesta más confianza de la que construyen diez aciertos — y "no lo sé, pero aquí está la evidencia" sigue siendo útil, porque te ahorra abrir el visor de logs.

### Las reglas

| Regla | Se reconoce por | Qué ofrece |
|---|---|---|
| Falta la contraseña de Postgres | `superuser password is not specified` | Recrear con `POSTGRES_PASSWORD` |
| Falta la contraseña de MySQL / MariaDB | `you need to specify one of MYSQL_ROOT_PASSWORD` | Recrear con la variable |
| Falta la EULA de SQL Server | `ACCEPT_EULA` en el log | Recrear con `ACCEPT_EULA=Y` |
| Puerto de host ocupado | `port is already allocated` / `address already in use` | Recrear con otro puerto libre |
| La imagen no trae comando | `no command specified` | Explica; sin arreglo automático |
| Sin memoria | `OOMKilled` en los propios datos de Docker | Explica; sugiere subir el límite |
| Permiso denegado en un volumen | `permission denied` sobre una ruta | Explica; sin arreglo automático |
| Ejecutable no encontrado | `executable file not found in $PATH` | Explica |
| Salida limpia inmediata | Código 0 en menos de 2 segundos | Explica que la imagen terminó su trabajo y no es un servicio |
| Conexión rechazada | `connection refused` | Explica; puede faltar una red compartida |

Son **datos**, no código: un array de reglas con prioridad. Una regla solo dispara con evidencia que CDD leyó de verdad — una línea de log o un dato del inspect. Añadir una es añadir un elemento a una lista y un caso a su fichero de test.

### Recrear con la corrección

`F` abre el asistente ya relleno y **ya en el paso de revisión**, porque lo interesante de revisar es el diff, no el nombre de la imagen:

```
[4] Env    POSTGRES_PASSWORD=(empty)  ↑ changed by CDD
           POSTGRES_DB=app
```

- **Nada se aplica a tus espaldas.** El arreglo pasa por la revisión y tú lo confirmas.
- **El contenedor que falló conserva su nombre**, así que el reemplazo se llama `mi-basedatos-2`.
- **El campo de env del asistente viene filtrado.** Docker mezcla las variables de la imagen en las del contenedor, así que `PATH`, `LANG` y `PG_VERSION` llenarían el formulario. CDD resta las propias de la imagen antes de mostrar las tuyas.
- **Los secretos empiezan enmascarados**, siempre, aunque los hayas revelado en un asistente anterior.
- **Cuando el arreglo necesita un valor que solo tienes tú** — una contraseña — la tecla dice *"Recreate and set POSTGRES_PASSWORD"* y la revisión avisa de que la variable está puesta pero vacía. CDD no inventa contraseñas.

### Dos límites que conviene conocer

- Recrear arrastra imagen, nombre, puertos y variables. **No** arrastra `Cmd`, `Entrypoint`, volúmenes, redes ni política de reinicio: el asistente no tiene campos para ellos.
- El campo de env se separa por comas y Docker permite comas dentro del valor. Una variable con coma se parte. El perfil de `kafka` ya trae una.

---

## El Asistente de Creación

Presiona `C` desde el dashboard para abrir el asistente. Un **HUD sensible al contexto** en la parte inferior siempre muestra qué teclas están activas en cada paso — sin adivinar.

### Paso 0 — Imagen

Escribe para filtrar entre **20 perfiles offline curados** (postgres, redis, nginx, node, mysql, mongo, python, golang y más). Los resultados aparecen al instante.

Presiona **`Tab`** en cualquier momento para buscar en Docker Hub en vivo. Un indicador `[searching Docker Hub...]` confirma que la búsqueda está en curso. Usa `↑` / `↓` para navegar las sugerencias y `Enter` para seleccionar.

**Tags inteligentes por defecto:** al seleccionar un perfil de imagen se aplica automáticamente un tag conocido y funcional — `postgres:17-alpine`, `redis:7-alpine`, `nginx:1.27-alpine`, etc. Sin más contenedores que fallan en silencio por un `:latest` desactualizado.

### Paso 1 — Nombre del contenedor

Texto libre. Dale a tu contenedor un nombre memorable.

### Paso 2 — Mapeo de puertos

Ingresa un mapeo de puertos en formato `HOST:CONTENEDOR`, por ejemplo `8080:80`, `5432:5432`. Deja en blanco para omitir.

### Paso 3 — Variables de entorno

Ingresa pares `CLAVE=VALOR` de a uno. Las **sugerencias contextuales** muestran variables recomendadas para la imagen seleccionada:

| Imagen               | Variables sugeridas                                        |
| -------------------- | ---------------------------------------------------------- |
| postgres             | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`        |
| mysql                | `MYSQL_ROOT_PASSWORD`, `MYSQL_DATABASE`                    |
| redis                | _(sin variables requeridas)_                               |
| mongo                | `MONGO_INITDB_ROOT_USERNAME`, `MONGO_INITDB_ROOT_PASSWORD` |
| node / nginx / otros | Variables de runtime comunes según corresponda             |

**Las variables secretas** (`PASSWORD`, `SECRET`, `TOKEN`, `API_KEY`, etc.) se enmascaran automáticamente mientras escribes. Usa `Ctrl+R` para revelarlas temporalmente, o `Ctrl+G` para generar una contraseña fuerte con una sola tecla.

Presiona `Enter` en una línea vacía para terminar y crear el contenedor.

---


## Shell Interactivo

Presiona `S` desde el dashboard con un contenedor en ejecución seleccionado. CDD hará lo siguiente:

1. Detectará el shell disponible dentro del contenedor (`bash` o `sh`)
2. Abrirá una sesión de terminal interactiva completa
3. Te dejará en el shell del contenedor

Desde ahí puedes ejecutar cualquier comando — `psql` para PostgreSQL, `python3` para Python, `node` para Node.js, `redis-cli` para Redis, etc.

Escribe `exit` o presiona `Ctrl+D` para salir del shell y volver al dashboard de CDD.

---

## Requisitos

- Node.js >= 18
- Docker instalado y ejecutándose (CDD se conecta al socket local de Docker)

---

## Desarrollo

```bash
pnpm install
pnpm run build        # compila src/ → dist/
node dist/index.js   # ejecuta desde la salida compilada
```

Vuelve a ejecutar `pnpm run build` después de cualquier cambio en el código fuente. Usa `pnpm link --global` para probar el comando global `cdd` localmente.

---

## Tests

```bash
pnpm test
```

Los tests están en `test/` y cubren helpers, servicios y hooks.

---

## Logging

Por defecto CDD muestra mensajes `info`, `warn` y `error`. Para diagnósticos más detallados:

```bash
CDD_LOG_LEVEL=debug cdd
```

Presiona `D` dentro del dashboard para activar el panel de debug en vivo. Presiona `D` nuevamente para ocultarlo.

Para capturar los logs en un archivo:

```bash
CDD_LOG_LEVEL=debug cdd > cdd-debug.log 2>&1
```

---

## Solución de problemas

- **¿No ves contenedores?** Si Docker está ejecutándose pero no hay contenedores, puede que no tengas ninguno ejecutándose o creado. Presiona `C` para crear uno. Si Docker no es accesible, CDD ahora muestra una pantalla de error clara con instrucciones para solucionarlo.
- **¿Error de conexión con Docker?** CDD mostrará "Can't reach Docker" con pasos específicos para resolverlo. Presiona `R` para reintentar después de solucionar el problema, espera la cuenta atrás en vivo o presiona `Q` para salir.
- **¿El panel dice "No lo reconozco"?** CDD solo explica lo que su catálogo de reglas reconoce, y prefiere admitirlo antes que adivinar. Las últimas líneas están ahí mismo — presiona `L` para el log completo.
- **¿No aparece `F`?** La tecla solo aparece cuando el diagnóstico trae un arreglo. La mayoría de las causas se explican pero no se pueden reparar (una imagen sin comando, un volumen denegado), y una tecla que abre un asistente sin nada que cambiar sería ruido.
- **`F` dice que no pudo leer la configuración del contenedor?** CDD se niega a recrear un contenedor cuya configuración no pudo leer, en vez de construir uno sin variables — que moriría igual. Presiona `C` para crear uno desde cero.
- **¿Un arreglo dejó un campo de contraseña vacío a propósito?** CDD no inventa contraseñas. Rellénalo en la pantalla de revisión antes de crear, o el contenedor fallará otra vez igual.
- **¿Errores de permisos en Linux/macOS?** Prueba con `sudo cdd` o agrega tu usuario al grupo `docker`.
- **¿Windows?** Ejecuta la terminal como Administrador.
- **¿Falta el directorio `dist/`?** Ejecuta `pnpm run build` — está en `.gitignore` y no se incluye en el repositorio.
- **¿La búsqueda del asistente no funciona?** Verifica tu conexión a internet. Los perfiles offline siempre funcionan sin acceso a la red.

---

## Contribuciones

Consulta [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Licencia

MIT/ISC — ver [`LICENSE`](LICENSE).

---

🇬🇧 [Read in English](README.md)
