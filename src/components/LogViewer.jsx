import React from "react";
import { Text, useInput } from "ink";

export default function LogViewer({ logs, onExit, container }) {
  useInput((input, key) => {
    if (key.escape) {
      onExit();
    }
  });

  const visibleLogs = logs.slice(-15);

  return (
    <>
      <Text color="green">{container?.name || "Container"} logs, press ESC to exit</Text>
      {visibleLogs.length === 0 ? (
        <Text dimColor>No logs...</Text>
      ) : (
        visibleLogs.map((line, idx) => <Text key={idx}>{line}</Text>)
      )}
    </>
  );
}
