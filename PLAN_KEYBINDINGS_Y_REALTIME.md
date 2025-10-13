# Plan de Implementación: Keybindings y Funcionalidades Avanzadas para CDD

Este documento te guiará paso a paso para agregar keybindings y la integración de logs y estadísticas en tiempo real a tu proyecto CLI/CDD. Además, incluye recomendaciones de investigación para que puedas aprender y experimentar por ti mismo.

---

## 1. Keybindings (Atajos de Teclado)

### Objetivo
Permitir la navegación y control de contenedores Docker usando el teclado.

### Acciones y Sugerencias
- **↑ / ↓**: Navegar entre contenedores
- **Enter**: Seleccionar contenedor
- **L**: Mostrar logs en vivo
- **S**: Mostrar estadísticas
- **R**: Reiniciar contenedor
- **I**: Iniciar contenedor
- **P**: Pausar/Detener contenedor
- **Q**: Salir

### ¿Cómo hacerlo?

### Usando Ink para Keybindings y UI CLI React

Si ya tienes Ink instalado, es la mejor opción para construir tu CLI interactiva con React. Ink te permite crear componentes reutilizables, manejar el estado y capturar eventos de teclado de forma reactiva, todo en la terminal.

#### Funciones y hooks clave de Ink:

- **`<Text>` y `<Box>`**: Componentes básicos para mostrar texto y organizar la UI en la terminal.
  - **Por qué:** Permiten estructurar y dar formato a la salida, igual que en React web.

- **`useInput`**: Hook para capturar cualquier tecla presionada por el usuario.
  - **Cómo:**
    ```js
    import { useInput } from 'ink';
    useInput((input, key) => {
      if (key.upArrow) { /* lógica para ↑ */ }
      if (key.downArrow) { /* lógica para ↓ */ }
      if (input === 'q') { /* salir */ }
      // ...otros keybindings

    ### ¿Cómo hacerlo?

    #### Usando Ink para Keybindings y UI CLI React

    Si ya tienes Ink instalado, es la mejor opción para construir tu CLI interactiva con React. Ink te permite crear componentes reutilizables, manejar el estado y capturar eventos de teclado de forma reactiva, todo en la terminal.

    ##### Funciones y hooks clave de Ink:

    - **`<Text>` y `<Box>`**: Componentes básicos para mostrar texto y organizar la UI en la terminal.
      - **Por qué:** Permiten estructurar y dar formato a la salida, igual que en React web.

    - **`useInput`**: Hook para capturar cualquier tecla presionada por el usuario.
      - **Cómo:**
        ```js
        import { useInput } from 'ink';
        useInput((input, key) => {
          if (key.upArrow) { /* lógica para ↑ */ }
          if (key.downArrow) { /* lógica para ↓ */ }
          if (input === 'q') { /* salir */ }
          // ...otros keybindings
        });
        ```
      - **Por qué:** Es la forma más sencilla y reactiva de manejar atajos de teclado en la terminal con Ink.

    - **Estado React**: Usa `useState` y `useEffect` igual que en React web para manejar selección, logs, stats, etc.
      - **Por qué:** Permite que la UI se actualice automáticamente cuando cambian los datos o el estado.

    ##### Ejemplo básico de navegación con Ink:

    ```js
    import React, { useState } from 'react';
    import { render, Box, Text, useInput } from 'ink';

    const containers = ['web', 'db', 'cache'];

    const App = () => {
      const [selected, setSelected] = useState(0);

      useInput((input, key) => {
        if (key.upArrow) setSelected(i => (i === 0 ? containers.length - 1 : i - 1));
        if (key.downArrow) setSelected(i => (i === containers.length - 1 ? 0 : i + 1));
        if (input === 'q') process.exit();
        // ...otros keybindings
      });

      return (
        <Box flexDirection="column">
          {containers.map((name, i) => (
            <Text key={name} color={i === selected ? 'green' : undefined}>
              {i === selected ? '>' : ' '} {name}
            </Text>
          ))}
          <Text>Usa ↑/↓ para navegar, Q para salir</Text>
        </Box>
      );
    };

    render(<App />);
    ```

    ##### ¿Por qué Ink?
    - Permite una experiencia de desarrollo y mantenimiento muy similar a React web.
    - Facilita la captura de teclas y el renderizado dinámico sin dependencias extra.
    - Es ideal para CLIs interactivas, menús, dashboards y visualización en tiempo real.

    Consulta la [documentación oficial de Ink](https://github.com/vadimdemedes/ink) para más ejemplos y detalles.
#### Ejemplo básico de navegación con Ink:

```js
import React, { useState } from 'react';
import { render, Box, Text, useInput } from 'ink';

const containers = ['web', 'db', 'cache'];

const App = () => {
  const [selected, setSelected] = useState(0);

  useInput((input, key) => {
    if (key.upArrow) setSelected(i => (i === 0 ? containers.length - 1 : i - 1));
    if (key.downArrow) setSelected(i => (i === containers.length - 1 ? 0 : i + 1));
    if (input === 'q') process.exit();
    // ...otros keybindings
  });

  return (
    <Box flexDirection="column">
      {containers.map((name, i) => (
        <Text key={name} color={i === selected ? 'green' : undefined}>
          {i === selected ? '>' : ' '} {name}
        </Text>
      ))}
      <Text>Usa ↑/↓ para navegar, Q para salir</Text>
    </Box>
  );
};

render(<App />);
```

#### ¿Por qué Ink?
- Permite una experiencia de desarrollo y mantenimiento muy similar a React web.
- Facilita la captura de teclas y el renderizado dinámico sin dependencias extra.
- Es ideal para CLIs interactivas, menús, dashboards y visualización en tiempo real.

Consulta la [documentación oficial de Ink](https://github.com/vadimdemedes/ink) para más ejemplos y detalles.

---

## 2. Integración de Logs y Stats en Tiempo Real

### Logs en Vivo
- Utiliza el comando `docker logs -f <container>` para obtener logs en streaming.
- Investiga cómo manejar streams en Node.js con `child_process.spawn`.
- Si quieres mostrar los logs en la UI, revisa cómo actualizar el estado en tiempo real.

### Estadísticas en Tiempo Real
- Usa el comando `docker stats <container> --no-stream` para obtener stats puntuales, o sin `--no-stream` para flujo continuo.
- Investiga cómo parsear la salida de estos comandos y mostrarla en la UI.
- Considera usar la librería [dockerode](https://github.com/apocas/dockerode) para interactuar con Docker desde Node.js de forma programática.

---

## 3. Recomendaciones de Investigación

- **Node.js y Streams**: Aprende sobre el módulo `stream` y cómo manejar datos en tiempo real.
- **Captura de Teclas en Terminal**: Explora cómo funcionan los eventos de teclado en aplicaciones CLI.
- **Dockerode**: Investiga esta librería para controlar Docker desde Node.js.
- **React y Eventos Globales**: Si tu UI es React, revisa cómo manejar eventos globales de teclado.
- **Websockets**: Si decides separar backend y frontend, aprende sobre websockets para comunicación en tiempo real.
- **UX en CLI**: Investiga buenas prácticas para interfaces de usuario en la terminal (ejemplo: [blessed](https://github.com/chjj/blessed)).


## 4. Siguiente Paso Sugerido


## 5. Recursos Útiles


---

## 6. Planificación Detallada Paso a Paso

### Paso 1: Definir el tipo de interfaz
- Si tu aplicación es CLI y ya tienes Ink, úsalo como framework principal para toda la UI y keybindings.
- Ink te permite crear componentes, manejar el estado y capturar teclas de forma reactiva, todo en la terminal.
- Si necesitas algo que Ink no cubre, evalúa otras librerías, pero prioriza Ink para evitar dependencias innecesarias.

### Paso 2: Investigar y elegir librerías para keybindings
- Para CLI con Ink, usa el hook `useInput` para capturar teclas y manejar la navegación y acciones.
- Haz pruebas simples con `useInput` para capturar teclas y mostrar la tecla presionada o cambiar el estado.

### Paso 3: Implementar navegación entre contenedores (↑/↓)
- Usa `useState` para el índice seleccionado.
- Renderiza la lista de contenedores con `<Text>` y `<Box>`, resaltando el seleccionado.
- Usa `useInput` para capturar las flechas y actualizar el índice.
- Haz que la navegación sea cíclica para mejor UX.

### Paso 4: Implementar selección de contenedor (Enter)
- Al presionar Enter, guarda el contenedor seleccionado en el estado.
- Muestra un menú de acciones o detalles usando componentes condicionales de Ink.

### Paso 5: Implementar acciones sobre el contenedor
- L: Mostrar logs en vivo
- S: Mostrar estadísticas en tiempo real
- R: Reiniciar contenedor
- I: Iniciar contenedor
- P: Pausar/Detener contenedor
- Q: Salir
- Para cada acción:
  - Usa `useInput` para detectar la tecla y cambiar el estado de la vista.
  - Crea una función que ejecute el comando Docker correspondiente usando `child_process` o `dockerode`.
  - Muestra el resultado en la UI usando componentes Ink.

### Paso 6: Integrar logs en tiempo real
- Usa `docker logs -f <container>` con `child_process.spawn` para obtener logs en streaming.
- Lee los datos del stream y actualiza el estado con los logs recibidos.
- Renderiza los logs en tiempo real usando `<Text>` y el estado de React.
- Permite salir de la vista de logs con una tecla usando `useInput`.

### Paso 7: Integrar estadísticas en tiempo real
- Usa `docker stats <container>` o la API de `dockerode` para obtener stats.
- Actualiza el estado periódicamente (con `setInterval` o un efecto) y renderiza los stats en la UI.
- Permite salir de la vista de stats con una tecla usando `useInput`.

### Paso 8: Mejorar la experiencia de usuario
- Agrega mensajes de ayuda o leyenda de teclas usando `<Text>`.
- Maneja errores de Docker y muestra mensajes claros en la UI.
- Permite refrescar la lista de contenedores con una tecla usando `useInput`.

### Paso 9: Refactorizar y documentar
- Organiza el código en componentes Ink y hooks reutilizables.
- Documenta cada función y componente.
- Escribe un README con ejemplos de uso y keybindings.

### Paso 10: Pruebas y mejoras
- Prueba todos los keybindings y flujos en la terminal.
- Pide feedback a otros usuarios.
- Agrega nuevas funcionalidades según necesidades.

---

## 7. Consejos para Aprender y Disfrutar el Proceso
- Investiga cada librería antes de usarla.
- Haz pruebas pequeñas y ve integrando poco a poco.
- Lee la documentación oficial de Docker y Node.js.
- No dudes en romper cosas: ¡así se aprende!
- Si te atoras, busca ejemplos en GitHub o StackOverflow.

---
- [Node.js Child Process](https://nodejs.org/api/child_process.html)
- [Docker CLI Reference](https://docs.docker.com/engine/reference/commandline/cli/)
- [Inquirer.js](https://www.npmjs.com/package/inquirer)
- [dockerode](https://github.com/apocas/dockerode)
- [blessed](https://github.com/chjj/blessed)

---

¡Diviértete programando y aprendiendo! Si tienes dudas sobre algún punto, investiga primero y luego pregunta para profundizar.
