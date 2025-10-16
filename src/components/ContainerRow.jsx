import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { getStats } from "../helpers/dockerService/serviceComponents/containerStats";
import StatsBar from "./StatsBar.jsx";

const stateText = (state) => {
  if (state === "running") return { text: "🟢 RUNNING", color: "green" };
  if (state === "exited") return { text: "🔴 EXITED", color: "red" };
  if (state === "paused") return { text: "🟠 PAUSED", color: "yellow" };
  return { text: state.toUpperCase(), color: "gray" };
};

export default function ContainerRow({ container }) {
  const { id, name, image, state } = container;
  const [stats, setStats] = useState({
    cpuPercent: 0,
    memPercent: 0,
    netIO: { rx: 0, tx: 0 },
  });

  // Format ports for display
  const formatPorts = (ports) => {
    if (!ports || ports.length === 0) return "";
    if (Array.isArray(ports)) {
      return ports.map((p, i) => ` 🔗 ${p}`).join("  ");
    }
    return ` 🔗 ${ports}`;
  };

  const [statsError, setStatsError] = useState("");
  useEffect(() => {
    if (state !== "running") return;
    const fetchStats = async () => {
      try {
        const s = await getStats(id);
        setStats(s);
        setStatsError("");
      } catch (err) {
        setStats({ cpuPercent: 0, memPercent: 0, netIO: { rx: 0, tx: 0 } });
        setStatsError("Error fetching stats");
      }
    };
    fetchStats();
    const timer = setInterval(fetchStats, 1500);
    return () => clearInterval(timer);
  }, [id, state]);

  const stateInfo = stateText(state);
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text color="cyan">{name.padEnd(20)}</Text>
        <Text color="gray">{image.padEnd(20)}</Text>
        <Text color={stateInfo.color}>{stateInfo.text}</Text>
        <Text color="yellow">{formatPorts(container.ports)}</Text>
        {state === "running" && <Text> </Text>}
        {state === "running" && (
          <StatsBar
            cpu={parseFloat(stats.cpuPercent)}
            mem={parseFloat(stats.memPercent)}
          />
        )}
        {state === "running" && statsError && (
          <Text color="red">{statsError}</Text>
        )}
      </Box>
    </Box>
  );
}
