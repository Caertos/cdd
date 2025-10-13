/**
 * React hook to manage Docker containers state.
 * Hook de React para gestionar el estado de contenedores Docker.
 *
 * @returns {[Array, Function]} [containers, refresh] / [contenedores, refrescar]
 * @example
 * // EN: Use in a component
 * // ES: Usar en un componente
 * const [containers, refresh] = useContainers();
 */
import React, { useState, useEffect } from "react";
import { getContainers } from "../helpers/dockerService";

export function useContainers() {
  const [containers, setContainers] = useState([]);

  useEffect(() => {
    const fetch = async () => setContainers(await getContainers());
    fetch();
    const timer = setInterval(fetch, 3000);
    return () => clearInterval(timer);
  }, []);

  return { containers };
}
