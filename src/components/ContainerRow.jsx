import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { getStats } from "../helpers/dockerService/serviceComponents/containerStats";
import { REFRESH_INTERVALS } from "../helpers/constants";
import StatsBar from "./StatsBar.jsx";
import PropTypes from 'prop-types';

const stateText = (state) => {
  if (state === "running") return { text: "🟢 RUNNING", color: "green" };
  if (state === "exited") return { text: "🔴 EXITED", color: "red" };
  if (state === "paused") return { text: "🟠 PAUSED", color: "yellow" };
  return { text: state.toUpperCase(), color: "gray" };
};

/**
 * Row component that renders information and live stats for a container.
 *
 * @param {Object} props
 * @param {Object} props.container - Container object with id, name, image, state and ports
 * @returns {JSX.Element}
 */
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
      return ports.map((p, _i) => ` 🔗 ${p}`).join("  ");
    }
    return ` 🔗 ${ports}`;
  };

  const [statsError, setStatsError] = useState("");
  useEffect(() => {
    if (state !== "running") return;
    
    let isMounted = true;
    
    const fetchStats = async () => {
      try {
        const s = await getStats(id);
        if (isMounted) {
          setStats(s);
          setStatsError("");
        }
      } catch (err) {
        if (isMounted) {
          setStats({ cpuPercent: 0, memPercent: 0, netIO: { rx: 0, tx: 0 } });
          setStatsError("Error fetching stats");
        }
      }
    };
    
    fetchStats();
  const timer = setInterval(fetchStats, REFRESH_INTERVALS.CONTAINER_STATS);
    
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
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

ContainerRow.propTypes = {
  container: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    image: PropTypes.string,
    state: PropTypes.string,
    ports: PropTypes.oneOfType([PropTypes.array, PropTypes.string])
  }).isRequired,
};
