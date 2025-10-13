## Instrucciones avanzadas

### Desarrollo local
1. Clona el repositorio:
   ```bash
   git clone https://github.com/caertos/cdd.git
   cd cdd
   ```
2. Instala dependencias:
   ```bash
   npm install
   ```
3. Transpila el código fuente:
   ```bash
   npm run build
   ```
4. Ejecuta el CLI localmente:
   ```bash
   node dist/index.js
   ```
5. Prueba el comando global localmente:
   ```bash
   npm link
   cdd
   ```

### Testing y troubleshooting
- Si modificas componentes, recuerda siempre ejecutar `npm run build` antes de probar.
- Si tienes problemas con permisos de Docker, ejecuta la terminal como administrador o usa `sudo`.
- Para limpiar la instalación global:
  ```bash
  npm uninstall -g cdd-cli
  ```

### Contribución
1. Haz un fork del repositorio y crea una rama para tu feature o fix.
2. Asegúrate de que tu código pase el build y funcione correctamente.
3. Haz un Pull Request con una descripción clara de tus cambios.

---
## Advanced instructions

### Local development
1. Clone the repository:
   ```bash
   git clone https://github.com/caertos/cdd.git
   cd cdd
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Transpile the source code:
   ```bash
   npm run build
   ```
4. Run the CLI locally:
   ```bash
   node dist/index.js
   ```
5. Test the global command locally:
   ```bash
   npm link
   cdd
   ```

### Testing and troubleshooting
- If you modify components, always run `npm run build` before testing.
- If you have Docker permission issues, run your terminal as administrator or use `sudo`.
- To clean up the global install:
  ```bash
  npm uninstall -g cdd-cli
  ```

### Contributing
1. Fork the repository and create a branch for your feature or fix.
2. Make sure your code builds and works correctly.
3. Open a Pull Request with a clear description of your changes.

---


<p align="center">
   <img src="https://img.shields.io/npm/v/cdd-cli?color=blue&label=npm%20package" alt="npm version"/>
   <img src="https://img.shields.io/npm/dt/cdd-cli?color=green&label=descargas" alt="npm downloads"/>
</p>

# 🐳 CDD-CLI — Docker Dashboard en la Terminal
[English version below]

---

## Ejemplo visual

```text
╭────────────────────────────────────────────────────────────────────────────╮
│ 🐳 CDD — CLI Docker Dashboard                        2 containers found    │
│                                                                          │
│ mysql-dev      mysql:latest     🟢 RUNNING                                │
│ CPU: ░░░░░░░░░░ 0.1%   MEM: ░░░░░░░░░░ 4.9%                             │
│                                                                          │
│ redis-test     redis:alpine     🔴 EXITED                                 │
│                                                                          │
│ Press Ctrl+C to exit                                                     │
│ Crafted by Carlos Cochero • 2025                                         │
╰────────────────────────────────────────────────────────────────────────────╯
```
# 🐳 CDD-CLI — Docker Dashboard in your Terminal

## Visual example

```text
╭────────────────────────────────────────────────────────────────────────────╮
│ 🐳 CDD — CLI Docker Dashboard                        2 containers found    │
│                                                                          │
│ mysql-dev      mysql:latest     🟢 RUNNING                                │
│ CPU: ░░░░░░░░░░ 0.1%   MEM: ░░░░░░░░░░ 4.9%                             │
│                                                                          │
│ redis-test     redis:alpine     🔴 EXITED                                 │
│                                                                          │
│ Press Ctrl+C to exit                                                     │
│ Crafted by Carlos Cochero • 2025                                         │
╰────────────────────────────────────────────────────────────────────────────╯
```

[English version below]

---

## Descripción
CDD-CLI es una herramienta de línea de comandos (CLI) multiplataforma que te permite monitorear y visualizar en tiempo real el estado de tus contenedores Docker directamente desde la terminal, usando una interfaz moderna y colorida basada en React e Ink.

- Visualiza todos los contenedores activos y detenidos.
- Muestra nombre, imagen, estado, puertos y estadísticas de CPU/MEM.
- Actualización automática cada 2 segundos.
- Interfaz amigable, con colores y emojis.
- Compatible con Linux, macOS y Windows (bash, cmd, PowerShell).

## Instalación global

1. Asegúrate de tener Node.js (v18+) y Docker instalados y en ejecución.
2. Instala el CLI globalmente desde npm:
   ```bash
   npm install -g cdd-cli
   ```
3. Ejecuta el dashboard desde cualquier terminal:
   ```bash
   cdd
   ```

## Uso
- Al ejecutar `cdd`, verás una tabla interactiva con todos tus contenedores Docker.
- Los contenedores en ejecución muestran estadísticas de CPU y memoria en tiempo real.
- Puedes navegar usando las flechas ↑/↓ y controlar los contenedores con atajos de teclado.
- Usa `Ctrl+C` o la tecla `Q` para salir.

### ⌨️ Atajos de teclado

- ↑ / ↓ : Navegar entre contenedores
- I : Iniciar el contenedor seleccionado
- P : Parar el contenedor seleccionado
- L : Ver logs en tiempo real del contenedor seleccionado
- Q : Salir del dashboard o de la vista de logs

## Funcionalidades principales
- 🐳 Visualización clara y compacta de todos los contenedores.
- 🔄 Refresco automático de datos.
- 📊 Estadísticas de uso de recursos para contenedores activos.
- 🎨 Interfaz visual con colores y emojis para estados.
- 👤 Autor: Carlos Cochero (2025)

## Requisitos
- Node.js >= 18
- Docker instalado y corriendo (el CLI se conecta al socket local de Docker)

## Troubleshooting
- Si no ves contenedores, asegúrate de que Docker esté corriendo y tu usuario tenga permisos para acceder al socket Docker.
- Si tienes problemas con la instalación global, prueba con `sudo` (Linux/macOS) o ejecuta la terminal como administrador (Windows).

---

# 🐳 CDD-CLI — Docker Dashboard in your Terminal

## Description
CDD-CLI is a cross-platform command-line tool (CLI) to monitor and visualize your Docker containers in real time, right from your terminal, using a modern React+Ink interface.

- See all running and stopped containers.
- Shows name, image, state, ports, and CPU/MEM stats.
- Auto-refresh every 2 seconds.
- Friendly, colorful, emoji-rich UI.
- Works on Linux, macOS, and Windows (bash, cmd, PowerShell).

## Global installation

1. Make sure you have Node.js (v18+) and Docker installed and running.
2. Install the CLI globally from npm:
   ```bash
   npm install -g cdd-cli
   ```
3. Run the dashboard from any terminal:
   ```bash
   cdd
   ```

## Usage
- When you run `cdd`, you'll see a table with all your Docker containers.
- Running containers show live CPU and memory stats.
- Use `Ctrl+C` to exit.

## Main features
- 🐳 Clear, compact visualization of all containers.
- 🔄 Automatic data refresh (every 2 seconds).
- ⌨️ Keyboard shortcuts for fast actions (navigate, start, stop, logs, quit).
- 📊 Live resource usage stats for running containers.
- 🪵 Real-time log streaming for selected containers.
- 🎨 Visual interface with colors and emojis for states.
- 👤 Author: Carlos Cochero (2025)

## Requirements
- Node.js >= 18
- Docker installed and running (CLI connects to local Docker socket)

## Troubleshooting
- If you don't see containers, make sure Docker is running and your user has permission to access the Docker socket.
- If you have issues with global install, try with `sudo` (Linux/macOS) or run terminal as administrator (Windows).

---

¡Disfruta monitoreando tus contenedores Docker desde la terminal con estilo! / Enjoy monitoring your Docker containers from the terminal in style!
