import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { getStats } from "../helpers/dockerService/serviceComponents/containerStats";
import { REFRESH_INTERVALS } from "../helpers/constants.js";
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

  // Format ports for display (no leading space to avoid layout shifts)
  const formatPorts = (ports) => {
    if (!ports || ports.length === 0) return "";
    if (Array.isArray(ports)) {
      return ports.map((p, _i) => `🔗 ${p}`).join("  ");
    }
    return `🔗 ${ports}`;
  };

  // Helper to truncate long strings to a max length without adding trailing spaces
  const truncate = (s, max = 20) => {
    if (!s) return "";
    return s.length > max ? s.slice(0, max - 1) + "…" : s;
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
      <Box flexDirection="row" alignItems="center">
        <Box width={20} flexShrink={1} paddingRight={1}>
          <Text color="cyan">{truncate(name, 20)}</Text>
        </Box>
        <Box width={20} flexShrink={1} paddingRight={1}>
          <Text color="gray">{truncate(image, 20)}</Text>
        </Box>
        <Box width={16} minWidth={10} paddingRight={1}>
          <Text color={stateInfo.color}>{stateInfo.text}</Text>
        </Box>
        <Box flexGrow={1} flexShrink={1} paddingLeft={0} paddingRight={1}>
          <Text color="yellow">{formatPorts(container.ports)}</Text>
        </Box>
        <Box width={30} flexShrink={0} paddingLeft={1}>
          {state === "running" ? (
            <StatsBar cpu={parseFloat(stats.cpuPercent)} mem={parseFloat(stats.memPercent)} />
          ) : null}
        </Box>
      </Box>
      {statsError && <Text color="red">{statsError}</Text>}
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
