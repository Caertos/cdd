/**
 * React hook to manage Docker containers state.
 *
 * @returns {{containers: Array<Object>}} An object containing the current
 * containers array. The hook starts a periodic refresh and fetches the
 * container list immediately on mount.
 * @example
 * // Use in a component
 * const { containers } = useContainers();
 */
import React, { useState, useEffect } from "react";
import { getContainers } from "../helpers/dockerService/serviceComponents/containerList";
import { REFRESH_INTERVALS } from "../helpers/constants.js";

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
