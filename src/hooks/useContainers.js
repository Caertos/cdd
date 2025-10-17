/**
 * React hook to manage Docker containers state.
 *
 * @returns {[Array, Function]} [containers, refresh] / [contenedores, refrescar]
 * @example
 * // Use in a component
 * const [containers, refresh] = useContainers();
 */
import React, { useState, useEffect } from "react";
import { getContainers } from "../helpers/dockerService/serviceComponents/containerList";
import { REFRESH_INTERVALS } from "../helpers/constants";

export function useContainers() {
  const [containers, setContainers] = useState([]);

  useEffect(() => {
    const fetch = async () => setContainers(await getContainers());
    fetch();
  const timer = setInterval(fetch, REFRESH_INTERVALS.CONTAINER_LIST);
    return () => clearInterval(timer);
  }, []);

  return { containers };
}
