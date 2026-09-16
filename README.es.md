# CDD — CLI Docker Dashboard

<p align="center">
  <img src="https://img.shields.io/npm/v/cdd-cli?color=blue&label=npm%20package" alt="npm version"/>
  <img src="https://img.shields.io/npm/dt/cdd-cli?color=green&label=downloads" alt="npm downloads"/>
  <a href="https://deepwiki.com/Caertos/cdd"><img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki"></a>
</p>

> **Un dashboard de Docker para la terminal — monitorea, gestiona y crea contenedores sin salir del teclado.**

---

## 🎉 Novedades en v4.6

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
- 🎨 Estados de contenedor codificados por color y retroalimentación visual
- ✨ **Asistente de creación interactivo** — configuración paso a paso con perfiles curados y búsqueda en Hub
- 🪵 Streaming de logs en tiempo real para el contenedor seleccionado
- 🐛 Panel de debug en vivo activable con la tecla `D`

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
npm install
npm run build
node dist/index.js
```

Para usar como comando global durante el desarrollo:

```bash
npm link
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
| `L`       | Ver logs del contenedor seleccionado en tiempo real         |
| `S`       | Abrir shell interactivo dentro del contenedor seleccionado  |
| `E`       | Eliminar el contenedor seleccionado — requiere confirmación |
| `D`       | Activar/desactivar panel de debug en vivo                   |
| `Q`       | Salir                                                       |
| `?`       | Mostrar panel de ayuda                                      |

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
npm install
npm run build        # compila src/ → dist/
node dist/index.js   # ejecuta desde la salida compilada
```

Vuelve a ejecutar `npm run build` después de cualquier cambio en el código fuente. Usa `npm link` para probar el comando global `cdd` localmente.

---

## Tests

```bash
npm test
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

- **¿No ves contenedores?** Asegúrate de que Docker esté ejecutándose y de que tu usuario tenga acceso al socket de Docker.
- **¿Errores de permisos en Linux/macOS?** Prueba con `sudo cdd` o agrega tu usuario al grupo `docker`.
- **¿Windows?** Ejecuta la terminal como Administrador.
- **¿Falta el directorio `dist/`?** Ejecuta `npm run build` — está en `.gitignore` y no se incluye en el repositorio.
- **¿La búsqueda del asistente no funciona?** Verifica tu conexión a internet. Los perfiles offline siempre funcionan sin acceso a la red.

---

## Contribuciones

Consulta [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Licencia

MIT/ISC — ver [`LICENSE`](LICENSE).

---

🇬🇧 [Read in English](README.md)
