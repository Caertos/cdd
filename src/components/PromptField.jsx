import React from "react";
import { Text } from "ink";

export function PromptField({ label, value, required }) {
  // Si es requerido y está vacío, mostrar en rojo
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
