import React from "react";
import { Box, Text } from "ink";
import { PromptField, PromptMessage } from "./PromptField";

export default function ContainerCreationPrompt(props) {
  const { step, imageName, containerName, portInput, envInput, message, messageColor } = props;
  const prompts = [
    {
      label: "Nombre de la imagen Docker:",
      value: imageName,
      required: true,
    },
    {
      label: "Nombre del contenedor (opcional):",
      value: containerName,
      required: false,
    },
    {
      label: "Puertos (opcional, formato 8080:80,443:443):",
      value: portInput,
      required: false,
    },
    {
      label: "Variables de entorno (opcional, formato VAR1=val1,VAR2=val2):",
      value: envInput,
      required: false,
    },
  ];
  const { label, value, required } = prompts[step] || {};
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" padding={1}>
      <PromptField label={label} value={value} required={required} />
      <PromptMessage message={message} color={messageColor} />
      <Text dimColor>Presiona Enter para continuar, Escape para cancelar</Text>
    </Box>
  );
}
