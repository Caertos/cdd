import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import chalk from "chalk";
import { getStats } from "../dockerService.js";
import StatsBar from "./StatsBar";

const colorByState = (state) => {
  if (state === "running") return chalk.greenBright("🟢 RUNNING");
  if (state === "exited") return chalk.redBright("🔴 EXITED");
  if (state === "paused") return chalk.yellowBright("🟠 PAUSED");
  return chalk.gray(state.toUpperCase());
};

export default function ContainerRow({ container }) {
  const { id, name, image, state } = container;
  const [stats, setStats] = useState({
    cpuPercent: 0,
    memPercent: 0,
    netIO: { rx: 0, tx: 0 },
  });

  useEffect(() => {
    if (state !== "running") return;
    const fetchStats = async () => {
      const s = await getStats(id);
      setStats(s);
    };
    fetchStats();
    const timer = setInterval(fetchStats, 1500);
    return () => clearInterval(timer);
  }, [id, state]);

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text>
        {chalk.cyan(name.padEnd(20))} {chalk.gray(image.padEnd(20))}{" "}
        {state === "running"
          ? chalk.greenBright("🟢 RUNNING")
          : chalk.redBright(`🔴 ${state.toUpperCase()}`)}
        {"  "}
        {chalk.yellow(container.ports)}
        {"  "}
        {state === "running" && (
          <StatsBar
            cpu={parseFloat(stats.cpuPercent)}
            mem={parseFloat(stats.memPercent)}
          />
        )}
      </Text>
    </Box>
  );
}
