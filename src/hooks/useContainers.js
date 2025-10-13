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
