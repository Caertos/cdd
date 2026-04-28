# CDD — CLI Docker Dashboard

<p align="center">
  <img src="https://img.shields.io/npm/v/cdd-cli?color=blue&label=npm%20package" alt="npm version"/>
  <img src="https://img.shields.io/npm/dt/cdd-cli?color=green&label=downloads" alt="npm downloads"/>
  <a href="https://github.com/caertos/cdd/actions/workflows/ci.yml">
    <img src="https://github.com/caertos/cdd/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI status" />
  </a>
  <a href="https://caertos.github.io/cdd/">
    <img src="https://img.shields.io/badge/docs-GitHub%20Pages-blue" alt="Docs" />
  </a>
  <a href="https://deepwiki.com/Caertos/cdd"><img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki"></a>
</p>

> **Un dashboard de Docker para la terminal — monitorea, gestiona y crea contenedores sin salir del teclado.**

---

## 🎉 Novedades en v3.2

**v3.2 trae el asistente de creación interactivo — y cambia las reglas del juego.**

Olvídate de los flags de `docker run`, las variables de entorno olvidadas y los tags `:latest` que fallan en silencio. Presiona `C` y CDD te guía para crear un contenedor en segundos:

- **20 perfiles de imagen curados** disponibles sin conexión — postgres, redis, nginx, node, mysql, mongo y más
- **Tags por defecto que realmente funcionan**: `postgres:17-alpine`, `redis:7-alpine`, `nginx:1.27-alpine` — sin más fallos silenciosos por `:latest`
- **Búsqueda en vivo en Docker Hub** con un solo `Tab` — con indicador `[searching Docker Hub...]` para que siempre sepas qué está pasando
- **Sugerencias contextuales de variables de entorno** — ¿creando un contenedor de Postgres? CDD sugiere `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` automáticamente
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

Usa `↑` / `↓` para navegar por los contenedores. Atajos de teclado disponibles:

| Tecla | Acción |
|-------|--------|
| `↑` / `↓` | Navegar la lista de contenedores |
| `I` | Iniciar el contenedor seleccionado |
| `P` | Detener el contenedor seleccionado |
| `R` | Reiniciar el contenedor seleccionado |
| `C` | Abrir el asistente de creación |
| `L` | Ver logs del contenedor seleccionado en tiempo real |
| `E` | Eliminar el contenedor seleccionado — requiere confirmación |
| `D` | Activar/desactivar panel de debug en vivo |
| `Q` | Salir |

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

| Imagen | Variables sugeridas |
|--------|---------------------|
| postgres | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` |
| mysql | `MYSQL_ROOT_PASSWORD`, `MYSQL_DATABASE` |
| redis | *(sin variables requeridas)* |
| mongo | `MONGO_INITDB_ROOT_USERNAME`, `MONGO_INITDB_ROOT_PASSWORD` |
| node / nginx / otros | Variables de runtime comunes según corresponda |

Presiona `Enter` en una línea vacía para terminar y crear el contenedor.

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
