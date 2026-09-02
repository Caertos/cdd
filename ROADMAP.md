# 🗺️ CDD — CLI Docker Dashboard: Roadmap de Desarrollo

> **Versión actual:** v4.0.0
> **Fecha:** 2026-04-28
> **Proyecto:** CDD es un dashboard TUI (Terminal UI) para gestionar contenedores Docker desde la línea de comandos. Construido con React/Ink, permite inspeccionar, iniciar, detener, crear y monitorear contenedores sin salir de la terminal.

---

## 📋 Resumen del Roadmap

| Fase | Versión | Foco Principal | Features incluidas |
|------|---------|---------------|-------------------|
| **Fase 0** | —       | Deuda Técnica (Tests) | 8A, 8B, 8C, 8D |
| **Fase 1** | v4.1.0  | Navegación y UX crítica | 3A, 3B, 3D |
| **Fase 2** | v4.2.0  | Observabilidad y salud | 2B, 2C, 2D, 3C |
| **Fase 3** | v4.3.0  | Wizard de Creación mejorado | 1A, 1B, 1C |
| **Fase 4** | v5.0.0  | Gestión de Imágenes + Conectividad | 4A, 4B, 4C, 5B |
| **Backlog** | —      | Ideas de baja prioridad | 2A, 5A, 6.x, 1D, 4D |

---

## 🚨 Fase 0 — Deuda Técnica (Prerrequisito bloqueante)

> **Objetivo:** Cubrir con tests los módulos críticos antes de agregar cualquier feature nueva. Sin esta base, cada iteración rompe cosas silenciosamente.

Esta fase no tiene versión de release asociada — es trabajo de infraestructura de calidad que debe completarse antes de la v4.1.0.

---

### 🔴 8A — Tests: `containerStats.js`

**Prioridad:** 🟠 Muy Alta

**Por qué es crítico:** Este módulo consume la API de stats de Docker en tiempo real (streaming). Sin tests, cualquier cambio en el formato de datos del daemon o en la lógica de parsing puede romper silenciosamente las métricas mostradas al usuario.

**Sub-tareas técnicas:**
- [ ] Identificar todas las funciones exportadas por `containerStats.js`
- [ ] Mockear el cliente Docker (`dockerode` o equivalente) para respuestas de stream
- [ ] Escribir test: parseo correcto de CPU % desde datos crudos del daemon
- [ ] Escribir test: parseo correcto de memoria usada / límite
- [ ] Escribir test: manejo de contenedor detenido (stats vacíos o null)
- [ ] Escribir test: manejo de error en stream (container no encontrado, daemon caído)
- [ ] Verificar cobertura >= 80% del módulo

**Criterio de aceptación:**
- Todos los tests pasan en CI
- Los casos de error (container inexistente, stream interrumpido) están cubiertos
- No hay lógica de transformación de datos sin test

---

### 🔴 8B — Tests: `containerLogs.js`

**Prioridad:** 🟠 Muy Alta

**Por qué es crítico:** Los logs son uno de los flujos más usados del TUI. Este módulo maneja streaming de logs, buffering y posiblemente filtrado. Un bug aquí afecta directamente la experiencia de depuración del usuario.

**Sub-tareas técnicas:**
- [ ] Identificar funciones exportadas: fetch de logs, streaming, parsing de timestamps
- [ ] Mockear stream de logs de Docker con datos sintéticos (stdout/stderr multiplex)
- [ ] Escribir test: lectura de logs con formato TTY
- [ ] Escribir test: lectura de logs sin TTY (stream multiplexado con header)
- [ ] Escribir test: logs vacíos (contenedor nuevo sin salida)
- [ ] Escribir test: truncado/límite de líneas si existe lógica de límite
- [ ] Escribir test: error al acceder a logs de contenedor inexistente

**Criterio de aceptación:**
- Los dos modos de stream (TTY y multiplexado) están testeados
- El módulo se puede importar e invocar sin un daemon real corriendo
- Cobertura >= 80%

---

### 🔴 8C — Tests: `imageUtils.js`

**Prioridad:** 🟠 Muy Alta

**Por qué es crítico:** Las utilidades de imagen son reutilizadas en múltiples vistas (lista de contenedores, wizard de creación, gestión de imágenes). Un bug en formateo o filtrado afecta múltiples partes de la UI.

**Sub-tareas técnicas:**
- [ ] Mapear todas las funciones utilitarias del módulo
- [ ] Escribir test: formateo de nombres de imagen (tag, digest, sin tag → "latest")
- [ ] Escribir test: cálculo/formateo de tamaño de imagen (bytes → MB/GB)
- [ ] Escribir test: filtrado o búsqueda de imágenes por nombre
- [ ] Escribir test: manejo de imágenes sin nombre (`<none>:<none>`)
- [ ] Escribir test: parseo de fecha de creación

**Criterio de aceptación:**
- Todas las funciones exportadas tienen al menos un test positivo y uno negativo
- Los edge cases (`<none>` tags, tamaños cero, fechas inválidas) están cubiertos

---

### 🔴 8D — Tests: `ContainerRow.jsx`

**Prioridad:** 🟠 Muy Alta

**Por qué es crítico:** `ContainerRow` es el componente más renderizado del TUI — aparece por cada contenedor en la lista. Cualquier regresión visual o de estado en este componente es inmediatamente visible para el usuario.

**Sub-tareas técnicas:**
- [ ] Configurar testing de componentes Ink/React (ink-testing-library o equivalente)
- [ ] Escribir test: render de contenedor en estado `running`
- [ ] Escribir test: render de contenedor en estado `exited` / `stopped`
- [ ] Escribir test: render de contenedor seleccionado (highlight / foco activo)
- [ ] Escribir test: truncado de nombre largo de contenedor
- [ ] Escribir test: muestra correcta de imagen y puerto(s)
- [ ] Escribir snapshot test para detectar regresiones de layout

**Criterio de aceptación:**
- El componente puede renderizarse en tests sin un terminal real
- Los tres estados principales (running, exited, selected) tienen cobertura
- Snapshot actualizado y en control de versiones

---

## 🧭 Fase 1 — v4.1.0: Navegación y UX crítica

> **Objetivo:** Hacer que encontrar y manejar contenedores sea rápido y fluido, independientemente de cuántos haya corriendo.

---

### 🔴 3A — Filtro de contenedores

**Prioridad:** 🔴 Suprema

**Descripción:** El usuario debe poder filtrar la lista de contenedores en tiempo real escribiendo texto. El filtro debe aplicarse sobre nombre del contenedor, imagen y estado. Es la feature de mayor impacto en usabilidad para usuarios con muchos contenedores.

**Sub-tareas técnicas:**
- [ ] Agregar estado `filterQuery` en el componente de lista de contenedores
- [ ] Implementar keybinding para activar el modo filtro (ej. `/` o `f`)
- [ ] Renderizar un input de texto en el footer/header cuando el modo filtro está activo
- [ ] Filtrar la lista derivada en tiempo real mientras el usuario escribe (case-insensitive)
- [ ] Aplicar filtro sobre: nombre del contenedor, nombre de imagen, estado
- [ ] Permitir salir del modo filtro con `Esc` y limpiar el query
- [ ] Mantener la selección actual si el contenedor seleccionado sigue visible tras filtrar
- [ ] Mostrar contador de resultados (ej. `3 / 12 contenedores`)

**Criterio de aceptación:**
- Escribir `/web` en la lista muestra solo contenedores cuyo nombre o imagen contiene "web"
- `Esc` limpia el filtro y restaura la lista completa
- El contador de resultados es preciso
- Con lista vacía tras filtrar, se muestra mensaje "Sin resultados para '{query}'"

**Testing:**
- Test: filtrar por nombre exacto devuelve solo ese contenedor
- Test: filtrar por imagen devuelve contenedores que usan esa imagen
- Test: filtro vacío devuelve todos los contenedores
- Test: `Esc` limpia el estado de filtro

---

### 🟡 3B — Scroll real en logs (todos los logs disponibles)

**Prioridad:** 🟡 Alta

**Descripción:** El panel de logs debe mostrar TODOS los logs disponibles del contenedor (no solo los últimos N), con scroll real que permita navegar hacia arriba y abajo. El usuario quiere poder ir al inicio del log de un contenedor y leer la historia completa, como hace `docker logs` sin `--tail`.

**Sub-tareas técnicas:**
- [ ] Cambiar la petición de logs para usar `tail: 'all'` en lugar de un límite fijo
- [ ] Implementar buffer de líneas en el estado del componente de logs
- [ ] Agregar índice de scroll (línea superior visible) en el estado
- [ ] Implementar scroll con teclas `↑` / `↓` (de línea en línea)
- [ ] Implementar scroll con `PgUp` / `PgDn` (saltos de página)
- [ ] Implementar `Home` / `End` para ir al inicio/fin del buffer
- [ ] Calcular dinámicamente cuántas líneas caben en el viewport actual
- [ ] Agregar indicador visual de posición (ej. `línea 120 / 3042` en el footer)
- [ ] Para logs en streaming (follow): auto-scroll al final a menos que el usuario haya scrolleado hacia arriba

**Criterio de aceptación:**
- `docker logs` de un contenedor con 5000 líneas muestra todas las 5000 líneas navegables
- El usuario puede llegar al inicio con `Home` y al final con `End`
- Al activar "follow" desde el inicio, el scroll sigue bajando automáticamente
- Si el usuario scrollea hacia arriba en modo follow, el auto-scroll se pausa

**Testing:**
- Test: buffer contiene todas las líneas recibidas del stream
- Test: scroll respeta los límites (no pasa de 0 ni del máximo)
- Test: auto-scroll se desactiva cuando el usuario scrollea manualmente

---

### 🟠 3D — Ordenamiento de la lista de contenedores

**Prioridad:** 🟠 Muy Alta

**Descripción:** El usuario debe poder ordenar la lista de contenedores por diferentes criterios: nombre, estado, imagen, y tiempo de creación/uptime. El orden debe ser configurable con atajos de teclado y debe persistir durante la sesión.

**Sub-tareas técnicas:**
- [ ] Definir los criterios de ordenamiento soportados: `name`, `status`, `image`, `created`
- [ ] Agregar estado `sortBy` y `sortDirection` (asc/desc) en el componente de lista
- [ ] Implementar función de comparación para cada criterio
- [ ] Agregar keybindings para ciclar entre criterios (ej. `s` para ciclar sort)
- [ ] Mostrar el criterio activo y la dirección en el header de la lista (ej. `↑ nombre`)
- [ ] Toggle de dirección al presionar el mismo criterio dos veces
- [ ] El sort debe ser compatible con el filtro activo (3A): ordenar el resultado filtrado

**Criterio de aceptación:**
- Presionar el keybinding ordena la lista visualmente de forma inmediata
- Presionar el mismo criterio invierte el orden (asc → desc)
- El indicador de sort activo es visible en la UI
- Filtro y sort funcionan juntos sin conflicto

**Testing:**
- Test: ordenar por nombre produce lista en orden alfabético
- Test: ordenar por estado agrupa running antes de exited
- Test: toggle de dirección invierte el orden correctamente
- Test: sort se aplica sobre la lista ya filtrada

---

### 📐 Testing — Fase 1

Todos los features de esta fase tocan lógica de estado y transformación de datos. Priorizar:
- Tests de la función de filtrado (pura, sin UI)
- Tests de la función de sort (pura, sin UI)
- Tests del buffer de scroll de logs
- Actualizar snapshots de `ContainerRow` si el indicador de sort afecta el header

---

## 🔬 Fase 2 — v4.2.0: Observabilidad y Salud de Contenedores

> **Objetivo:** Dar al usuario visibilidad real del estado interno de sus contenedores: métricas expandidas, health checks y alertas de cambio de estado.

---

### 🟡 2B — Stats expandidos (Disk I/O, memoria en MB, tasa de red)

**Prioridad:** 🟡 Alta

**Descripción:** El panel de estadísticas actual muestra métricas básicas. Debe expandirse para mostrar Disk I/O (read/write en bytes/s), uso de memoria en MB y GB (no solo porcentaje), y tasa de red (inbound/outbound en KB/s o MB/s). Los datos provienen de la misma API de stats de Docker.

**Sub-tareas técnicas:**
- [ ] Revisar el payload completo de `/containers/{id}/stats` y mapear campos disponibles
- [ ] Extraer `blkio_stats` para Disk I/O (read/write acumulados → calcular delta entre muestras)
- [ ] Extraer `memory_stats.usage` y `memory_stats.limit` y formatear en MB/GB
- [ ] Extraer `networks` para calcular rx_bytes/tx_bytes delta entre muestras
- [ ] Implementar función de cálculo de tasa (delta / intervalo de muestreo)
- [ ] Diseñar layout del panel de stats con las nuevas métricas
- [ ] Formatear automáticamente (KB, MB, GB según magnitud)

**Criterio de aceptación:**
- El panel muestra: CPU%, Memoria (usado/límite en MB), Disk Read, Disk Write, Net In, Net Out
- Los valores de tasa (Disk/Net) son calculados correctamente como deltas entre dos muestras
- El formateo cambia dinámicamente (ej. "1.2 MB/s" no "1234567 B/s")

**Testing:**
- Test: cálculo de delta de bytes entre dos muestras consecutivas
- Test: formateo de bytes a unidad legible
- Test: manejo de primera muestra (no hay delta previo → mostrar 0 o "—")

---

### 🟡 2C — Health Check visible

**Prioridad:** 🟡 Alta

**Descripción:** Si un contenedor tiene un health check configurado, el TUI debe mostrar su estado (`healthy`, `unhealthy`, `starting`) de forma destacada. También debe mostrar el resultado del último chequeo (exit code y output). Muchos usuarios no saben que sus contenedores están `unhealthy` hasta que algo falla.

**Sub-tareas técnicas:**
- [ ] Leer `State.Health` del endpoint `GET /containers/{id}/json`
- [ ] Mostrar badge de estado de health en `ContainerRow` cuando existe health check
- [ ] En el panel de detalle, mostrar: estado, último chequeo (timestamp), output del último test
- [ ] Diferenciar visualmente: sin health check / healthy / starting / unhealthy
- [ ] Para `unhealthy`, mostrar el output del log del health check para diagnóstico

**Criterio de aceptación:**
- Un contenedor `unhealthy` muestra un indicador visual distinto en la lista
- El panel de detalle muestra el output del último health check fallido
- Un contenedor sin health check configurado no muestra el badge

**Testing:**
- Test: componente recibe `Health: null` → no renderiza badge
- Test: componente recibe `Health.Status: "unhealthy"` → renderiza badge de error
- Test: output del último log se muestra correctamente truncado

---

### 🟡 2D — Notificaciones de estado

**Prioridad:** 🟡 Alta

**Descripción:** Cuando un contenedor cambia de estado (ej. pasa de `running` a `exited`, o un health check pasa a `unhealthy`), el TUI debe mostrar una notificación temporal no bloqueante (tipo toast) en la esquina de la pantalla. Esto permite al usuario seguir trabajando y ser alertado de cambios sin que el UI quede bloqueado.

**Sub-tareas técnicas:**
- [ ] Implementar sistema de polling de estados de contenedores (o usar Docker events API `GET /events`)
- [ ] Preferir Docker events API para reactividad real vs polling
- [ ] Crear componente `Notification` / `Toast` con texto, tipo (info/warn/error) y auto-dismiss
- [ ] Implementar cola de notificaciones con tiempo de vida configurable (ej. 5 segundos)
- [ ] Disparar notificación cuando: `running → exited`, `healthy → unhealthy`, contenedor creado/eliminado externamente
- [ ] Posicionar el toast en esquina inferior derecha sin bloquear la lista

**Criterio de aceptación:**
- Un contenedor que se detiene externamente (`docker stop` en otra terminal) genera un toast en el TUI en menos de 2 segundos
- El toast desaparece automáticamente tras 5 segundos
- Múltiples notificaciones simultáneas se apilan sin solaparse
- Las notificaciones no interrumpen el flujo de teclado del usuario

**Testing:**
- Test: la cola de notificaciones agrega y remueve correctamente
- Test: el componente Toast se renderiza con los tipos correctos (info/warn/error)
- Test: dos notificaciones se apilan sin reemplazarse

---

### 🟢 3C — Filtro de texto en logs

**Prioridad:** 🟢 Media

**Descripción:** Dentro del panel de logs (implementado en 3B), el usuario puede activar un filtro de texto para mostrar solo las líneas que contienen el patrón buscado. Compatible con el scroll completo de 3B — filtra el buffer completo, no solo las líneas visibles.

**Sub-tareas técnicas:**
- [ ] Agregar keybinding para activar filtro de logs (ej. `f` dentro del panel de logs)
- [ ] Renderizar input de texto para el patrón de búsqueda
- [ ] Filtrar el buffer completo de líneas contra el patrón (case-insensitive por defecto)
- [ ] Resaltar en cada línea visible el texto que coincide con el patrón
- [ ] Mostrar contador de líneas coincidentes (ej. `47 / 3042 líneas`)
- [ ] `Esc` limpia el filtro y restaura el buffer completo
- [ ] Si el filtro está activo, el scroll opera sobre el buffer filtrado

**Criterio de aceptación:**
- Escribir "ERROR" muestra solo líneas con "ERROR", resaltadas
- El contador refleja las líneas coincidentes sobre el total
- `Esc` restaura todas las líneas y el scroll vuelve a la posición anterior
- El filtro opera sobre el buffer completo, no solo las líneas visibles

**Testing:**
- Test: filtro vacío devuelve el buffer completo
- Test: filtro "ERROR" sobre buffer con 3 líneas ERROR devuelve exactamente 3
- Test: el resaltado de texto funciona correctamente con el patrón

---

### 📐 Testing — Fase 2

- Tests para la lógica de cálculo de deltas de stats (2B) — puramente funcional
- Tests del parser de health check status (2C)
- Tests de la cola de notificaciones (2D) — insert, auto-dismiss, límite de cola
- Tests del filtro de logs sobre buffer (3C)

---

## 🧙 Fase 3 — v4.3.0: Wizard de Creación Mejorado

> **Objetivo:** Hacer que crear contenedores desde el TUI sea tan completo y claro como usar `docker run` con sus flags más importantes.

---

### 🟡 1A — Volúmenes en el Wizard

**Prioridad:** 🟡 Alta

**Descripción:** El wizard de creación de contenedores debe ofrecer al usuario elegir explícitamente la estrategia de persistencia de datos: volumen nombrado (datos persisten entre reinicios), bind mount (carpeta local), `tmpfs` (en memoria, datos volátiles) o ninguno. Esto evita el error común de crear contenedores sin entender qué pasa con sus datos al detenerlos.

**Sub-tareas técnicas:**
- [ ] Agregar paso "Almacenamiento" al wizard con selector de tipo: `none`, `named volume`, `bind mount`, `tmpfs`
- [ ] Para `named volume`: input para nombre del volumen (o auto-generar basado en el nombre del contenedor) y ruta del mountpoint dentro del contenedor
- [ ] Para `bind mount`: input para ruta local (host) y ruta destino en el contenedor; validar que la ruta local existe
- [ ] Para `tmpfs`: input para ruta del mountpoint en el contenedor; input opcional para tamaño máximo
- [ ] Traducir la selección a los flags correctos en el payload de creación (`Volumes`, `HostConfig.Binds`, `HostConfig.Mounts`)
- [ ] Mostrar resumen de la configuración elegida en el paso final del wizard

**Criterio de aceptación:**
- Crear un contenedor con volumen nombrado genera un volumen persistente verificable con `docker volume ls`
- Crear con `tmpfs` no genera volumen persistente
- El resumen final del wizard muestra la configuración de almacenamiento seleccionada
- Un bind mount a ruta inexistente muestra error de validación antes de continuar

**Testing:**
- Test: traducción de selección `named volume` al payload de API correcto
- Test: traducción de `tmpfs` al payload correcto
- Test: validación de ruta local en bind mount (path no existe → error)
- Test: `none` no incluye campos de volumen en el payload

---

### 🟡 1B — Redes en el Wizard

**Prioridad:** 🟡 Alta

**Descripción:** El wizard debe permitir al usuario elegir a qué red(es) conectar el contenedor al crearlo. Debe listar las redes disponibles en el daemon, permitir seleccionar una o crear una nueva red, y permitir configurar aliases dentro de la red. Esto es clave para que los contenedores se comuniquen entre sí.

**Sub-tareas técnicas:**
- [ ] Agregar paso "Red" al wizard
- [ ] Listar redes existentes con `GET /networks` y presentarlas en un selector
- [ ] Mostrar tipo de red junto al nombre (bridge, host, none, overlay)
- [ ] Opción para no conectar a ninguna red (`--network none`)
- [ ] Opción para crear una nueva red bridge con nombre personalizado (invocar `POST /networks/create` antes de crear el contenedor)
- [ ] Input opcional para alias dentro de la red
- [ ] Traducir selección al campo `NetworkingConfig` del payload de creación

**Criterio de aceptación:**
- El contenedor creado aparece en la red seleccionada (verificable con `docker network inspect`)
- Si se crea una red nueva, esta existe antes de que el contenedor sea creado
- Seleccionar `none` crea el contenedor sin interfaces de red

**Testing:**
- Test: el listado de redes consume correctamente el endpoint de Docker
- Test: traducción de selección al campo `NetworkingConfig`
- Test: flujo de creación de red nueva → asociación al contenedor

---

### 🟢 1C — Restart Policy en el Wizard

**Prioridad:** 🟢 Media

**Descripción:** El wizard debe incluir un selector de política de reinicio del contenedor: `no` (nunca reiniciar), `always` (siempre), `on-failure` (solo si sale con error, con límite de reintentos opcional), `unless-stopped`. Este campo es simple pero evita confusión a usuarios que esperan que sus contenedores sobrevivan a reinicios del daemon.

**Sub-tareas técnicas:**
- [ ] Agregar campo "Restart Policy" al wizard (selector entre las 4 opciones)
- [ ] Para `on-failure`: mostrar input adicional para `MaximumRetryCount` (0 = sin límite)
- [ ] Mostrar descripción breve de cada opción junto al nombre
- [ ] Traducir a `HostConfig.RestartPolicy` en el payload

**Criterio de aceptación:**
- Seleccionar `always` crea el contenedor con `RestartPolicy.Name: "always"`
- Seleccionar `on-failure` con 3 reintentos crea el contenedor con `MaximumRetryCount: 3`
- La descripción de cada opción es visible en el UI durante la selección

**Testing:**
- Test: traducción de cada opción al campo del payload correcto
- Test: `on-failure` incluye `MaximumRetryCount` en el payload
- Test: valor por defecto es `no`

---

### 📐 Testing — Fase 3

- Tests de cada paso del wizard por separado (sin necesidad de correr el wizard completo)
- Tests de la función que construye el payload final de creación con todas las opciones nuevas
- Test de integración del wizard end-to-end con un mock del cliente Docker

---

## 🖼️ Fase 4 — v5.0.0: Gestión de Imágenes y Conectividad

> **Objetivo:** Dar al usuario control sobre imágenes locales y abrir el TUI a entornos Docker remotos.

---

### 🟢 4A — Vista de imágenes locales

**Prioridad:** 🟢 Media

**Descripción:** Agregar una vista dedicada que liste todas las imágenes Docker locales con su nombre, tag, tamaño y fecha de creación. Debe permitir eliminar imágenes no usadas y ver qué contenedores usan cada imagen.

**Sub-tareas técnicas:**
- [ ] Agregar tab / vista "Imágenes" navegable desde el menú principal (keybinding `i` o tab)
- [ ] Consumir `GET /images/json` para listar imágenes
- [ ] Renderizar tabla: nombre:tag, ID (short), tamaño, fecha
- [ ] Acción de eliminar imagen seleccionada (`DELETE /images/{id}`) con confirmación
- [ ] Manejar error de imagen en uso (Docker retorna 409 → mostrar mensaje claro)
- [ ] Mostrar imágenes sin tag (`<none>:<none>`) con label "dangling"

**Criterio de aceptación:**
- La vista lista todas las imágenes locales incluyendo las dangling
- Eliminar una imagen en uso muestra un mensaje de error explicativo, no un crash
- Eliminar una imagen no usada la remueve y refresca la lista

**Testing:**
- Test: render de imagen sin tag (dangling)
- Test: error 409 al borrar imagen en uso → mensaje claro, no excepción

---

### 🟢 4B — Pull de imagen sin crear contenedor

**Prioridad:** 🟢 Media

**Descripción:** Desde la vista de imágenes (4A), el usuario puede hacer pull de cualquier imagen de Docker Hub o registry privado sin necesidad de crear un contenedor. Debe mostrar el progreso del pull en tiempo real.

**Sub-tareas técnicas:**
- [ ] Agregar acción "Pull imagen" en la vista de imágenes
- [ ] Modal/panel con input para el nombre de la imagen (ej. `nginx:latest`)
- [ ] Consumir `POST /images/create` con stream de respuesta para mostrar progreso
- [ ] Parsear las capas del progreso del pull y mostrar barra o lista de estado por capa
- [ ] Al finalizar, agregar la imagen a la lista sin necesidad de refetch completo
- [ ] Manejar error de imagen no encontrada o autenticación fallida

**Criterio de aceptación:**
- El usuario puede escribir `postgres:16` y ver el pull en tiempo real
- Al finalizar el pull, la imagen aparece en la lista
- Si el nombre de imagen no existe, se muestra error "imagen no encontrada"

**Testing:**
- Test: parseo del stream de progreso de pull (por capas)
- Test: manejo de error 404 (imagen no encontrada en registry)

---

### 🟢 4C — Export `docker run` / compose

**Prioridad:** 🟢 Media

**Descripción:** Para cualquier contenedor existente, el usuario puede generar el comando `docker run` equivalente o un fragmento de `docker-compose.yml` que recree ese contenedor con la misma configuración. Útil para documentación y reproducibilidad.

**Sub-tareas técnicas:**
- [ ] Leer la configuración completa del contenedor con `GET /containers/{id}/json`
- [ ] Implementar función `toDockerRun(containerInfo)` que genere el string del comando
- [ ] Implementar función `toComposeService(containerInfo)` que genere el YAML del servicio
- [ ] Incluir: imagen, ports, volumes, env vars, network, restart policy, nombre
- [ ] Modal con el output generado y opción de copiar al portapapeles (si el entorno lo soporta)
- [ ] Advertir si algún campo no es representable en el formato exportado

**Criterio de aceptación:**
- El `docker run` generado, al ejecutarse, crea un contenedor funcionalmente equivalente
- El fragmento de compose es YAML válido
- Variables de entorno sensibles no son ocultadas pero sí se advierte al usuario

**Testing:**
- Test: `toDockerRun` con un contenedor con ports, volumes y env genera el comando correcto
- Test: `toComposeService` genera YAML válido y parseable
- Test: contenedor sin puertos no incluye flag `-p` en el output

---

### 🟢 5B — Multi-contexto Docker

**Prioridad:** 🟢 Media

**Descripción:** El TUI debe leer los contextos de Docker (`~/.docker/contexts/`) y permitir al usuario cambiar entre ellos desde una interfaz en el header. Al cambiar de contexto, todos los datos de contenedores, imágenes y redes se recargan desde el nuevo daemon.

**Sub-tareas técnicas:**
- [ ] Leer contextos disponibles desde `~/.docker/contexts/meta/` o via `docker context ls --format json`
- [ ] Mostrar el contexto activo en el header del TUI
- [ ] Acción para cambiar de contexto (modal con selector)
- [ ] Al cambiar, reinicializar el cliente Docker con el socket/host del nuevo contexto
- [ ] Recargar todos los datos desde el nuevo daemon
- [ ] Manejar error si el contexto seleccionado no está disponible (daemon apagado)

**Criterio de aceptación:**
- El contexto activo es visible en el header
- Cambiar a un contexto con un daemon remoto muestra los contenedores de ese daemon
- Si el daemon del contexto no responde, se muestra error sin crashear el TUI

**Testing:**
- Test: parsing de los archivos de contexto de Docker
- Test: error de conexión al cambiar a contexto no disponible → mensaje claro

---

### 📐 Testing — Fase 4

- Tests de `toDockerRun` y `toComposeService` (funciones puras, fáciles de testear)
- Tests del parser de contextos de Docker
- Tests del flujo de pull con mock del stream de progreso

---

## 📦 Backlog — Features de Baja Prioridad

Estas features no tienen fase asignada. Entran en el backlog para ser consideradas en futuras iteraciones según capacidad y demanda.

| ID | Feature | Prioridad | Notas |
|----|---------|-----------|-------|
| 2A | Panel Inspect | 🔵 Baja | Vista de `docker inspect` completa formateada como JSON |
| 5A | Soporte `DOCKER_HOST` | 🔵 Baja | Leer variable de entorno `DOCKER_HOST` para conexiones remotas simples |
| 6.x | Persistencia y Configuración | 🔵 Muy Baja | Preferencias de usuario, keybindings personalizables, temas |
| 1D | Recetas guardables | 🔵 Baja | Ver sección de Ideas Exploratorias |

---

## 🔭 Ideas Exploratorias

> Estas ideas no tienen versión asignada. Requieren investigación adicional antes de comprometerse a implementarlas.

---

### 💡 4D — Build de imagen custom desde el TUI

**Idea:** El usuario puede seleccionar un directorio con un `Dockerfile` (o incluso definir uno básico en el TUI) y hacer build de una imagen directamente desde la interfaz, sin salir a la terminal.

**Viabilidad técnica:**
La API de Docker soporta `POST /build` con un tar del contexto de build. La parte técnica de enviar el build es viable. El desafío real está en la UX: el usuario necesita poder seleccionar un directorio del filesystem (requiere un file picker en TUI), y el output del build (stream de texto con cada paso del Dockerfile) necesita una vista dedicada de progreso.

**Complejidad adicional:**
- File picker en TUI es complejo de implementar con buena UX (Ink no tiene uno nativo)
- Empaquetar el contexto de build como tar en memoria para mandarlo a la API
- El stream de build output tiene formato JSON por línea que debe parsearse y mostrarse limpiamente

**Riesgos:**
- Contextos de build grandes (proyectos con `node_modules` sin `.dockerignore`) pueden ser muy lentos o consumir mucha memoria
- La UX de file picker puede quedar inferior a simplemente usar `docker build` en terminal
- Requiere que el TUI tenga permisos de lectura al filesystem del usuario

**Recomendación:** Explorar primero si existe una librería de file picker para Ink. Si no hay una mantenida, esta feature tiene un costo de UX muy alto. Alternativa: el usuario provee la ruta como string (sin picker visual) — reduce la complejidad significativamente.

---

### 💡 1D — Recetas de contenedores guardables

**Idea:** El usuario puede guardar una configuración de contenedor como "receta" (nombre, imagen, volúmenes, redes, env vars) y reutilizarla con un nombre para recrear el mismo contenedor rápidamente.

**Viabilidad técnica:**
Las recetas serían JSON serializado en un archivo de configuración local (ej. `~/.config/cdd/recipes.json`). La lectura y escritura es trivial. El wizard de creación necesitaría un paso de "cargar receta" al inicio y un botón de "guardar como receta" al final.

**Riesgos:**
- Las recetas con variables de entorno pueden contener credenciales → necesidad de advertencias y posiblemente cifrado opcional
- La migración de recetas entre versiones del schema JSON puede romper recetas antiguas
- Los usuarios power users probablemente prefieren Docker Compose para esto — la propuesta de valor debe ser clara

**Recomendación:** Solo implementar si el wizard de creación (Fase 3) ha sido bien recibido y los usuarios piden explícitamente esta funcionalidad. No es prioritario ahora.

---

### 💡 7A — Docker exec interactivo

**Idea:** El usuario puede abrir una shell interactiva dentro de un contenedor corriendo, como `docker exec -it {container} sh`, directamente desde el TUI.

**Viabilidad técnica:**
La API de Docker soporta `POST /containers/{id}/exec` seguido de `POST /exec/{id}/start`. El problema es que esto requiere una terminal interactiva con PTY real, que debe ser manejada por el TUI. Ink/React está diseñado para UIs reactivas, no para hacer passthrough de un PTY arbitrario. Probablemente requiera spawnear un proceso hijo con `child_process.spawn` apuntando al terminal del usuario y "salir" del TUI temporalmente.

**Riesgos:**
- Integrar un PTY interactivo dentro de Ink puede ser estructuralmente incompatible con el modelo de renderizado de React/Ink
- La alternativa de suspender el TUI y lanzar el exec en el terminal nativo es viable pero requiere gestión de ciclo de vida cuidadosa (restaurar el TUI al salir)
- Posibles problemas con tamaños de terminal (SIGWINCH) cuando el usuario redimensiona la ventana dentro del exec

**Recomendación:** Investigar si `ink` tiene soporte para suspender el renderizado y restaurarlo. Si lo tiene, la implementación es viable. Si no, esta feature requeriría cambios arquitecturales significativos.

---

### 💡 7B — Soporte Docker Compose

**Idea:** Detectar archivos `docker-compose.yml` en el directorio actual y ofrecer acciones de compose (up, down, restart por servicio) desde el TUI.

**Viabilidad técnica:**
Docker Compose no tiene una API REST propia — `docker compose` es un plugin de CLI que invoca la API de Docker en secuencia. La opción más pragmática es invocar `docker compose` como proceso hijo. Alternativamente, leer el `docker-compose.yml`, parsear los servicios y orquestar las llamadas a la API de Docker manualmente — esto duplica lógica que ya tiene Compose.

**Riesgos:**
- Depender del CLI de `docker compose` como proceso hijo crea una dependencia externa que puede no estar instalada
- Parsear y ejecutar compose manualmente es una reimplementación parcial de Compose, con todos los bugs propios
- El scope de "soporte compose" puede expandirse indefinidamente (redes, profiles, overrides, etc.)

**Recomendación:** Si se implementa, usar el CLI de `docker compose` como proceso hijo para las acciones, y parsear el YAML solo para mostrar información (nombres de servicios, imágenes). No reimplementar la lógica de Compose.

---

## 📌 Notas de Versionado

- **v4.x** — Mejoras incrementales sobre la base existente. Sin cambios de arquitectura.
- **v5.0.0** — Contiene cambios que afectan múltiples capas (multi-contexto, vistas nuevas). Justifica bump de versión mayor.
- Las ideas exploratorias (4D, 7A, 7B, 1D) no tienen versión asignada intencionalmente — su complejidad real se conoce solo después de investigación dedicada.

---

*Documento generado el 2026-04-28 — Roadmap v1.0 para CDD v4.0.0*
