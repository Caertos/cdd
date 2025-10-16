import React from "react";
import { Text } from "ink";

export function PromptField({ label, value, required }) {
  // If the field is required and empty, show in red
  const isEmpty = required && !value.trim();
  return (
    <>
      <Text>{label}</Text>
      <Text color={isEmpty ? "red" : "cyan"}>{value}_</Text>
    </>
  );
}

export function PromptMessage({ message, color }) {
  if (!message) return null;
  return <Text color={color || "yellow"}>{message}</Text>;
}
