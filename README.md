# CDD - CLI Docker Dashboard

CDD es una herramienta de línea de comandos (CLI) construida con React e Ink para monitorear contenedores Docker de forma interactiva y visual en la terminal.

## Características
- Visualización en tiempo real de los contenedores Docker activos y detenidos.
- Actualización automática del estado de los contenedores cada 2 segundos.
- Interfaz amigable y colorida usando Ink y React.
- Información mostrada: nombre, imagen, estado, puertos y estado textual de cada contenedor.
- Mensaje de ayuda para salir fácilmente (`Press Ctrl+C to exit`).

## Instalación
1. Clona el repositorio y entra en la carpeta del proyecto.
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Transpila el código fuente y corrige los imports:
   ```bash
   npm run build
   ```
4. Ejecuta el CLI:
   ```bash
   node dist/index.js
   ```

## Estructura del proyecto
- `src/` - Código fuente en JSX/ESM.
  - `App.jsx` - Componente principal.
  - `dockerService.js` - Lógica para obtener los contenedores Docker.
  - `components/` - Componentes visuales (`Header.jsx`, `ContainerRow.jsx`).
- `dist/` - Código transpilado listo para Node.js.
- `.babelrc` - Configuración de Babel para JSX y módulos ES.
- `fix-imports.cjs` - Script post-build para corregir imports en dist/.
- `package.json` - Scripts y dependencias.
- `ERRORS.md` - Documentación de errores y soluciones.

## Scripts útiles
- `npm run build` - Transpila el código fuente y corrige los imports automáticamente.

## Requisitos
- Node.js 18+
- Docker instalado y corriendo (el CLI se conecta al socket local de Docker)

## Notas de desarrollo
- Puedes escribir imports sin extensión en el código fuente (`import X from './X'`).
- El flujo de build se encarga de que los imports sean válidos en Node.js.
- Consulta `ERRORS.md` para ver el historial de problemas y soluciones.

---

CDD es ideal para desarrolladores que desean monitorear sus contenedores Docker de forma rápida y visual desde la terminal, aprovechando la potencia de React en el CLI.
