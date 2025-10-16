import React from "react";
import { Box, Text } from "ink";
import { PromptField, PromptMessage } from "./PromptField";

export default function ContainerCreationPrompt(props) {
  const { step, imageName, containerName, portInput, envInput, message, messageColor } = props;
  const prompts = [
    {
      label: "Name of the image to create (e.g., nginx:latest):",
      value: imageName,
      required: true,
    },
    {
      label: "Name of the container (optional):",
      value: containerName,
      required: false,
    },
    {
      label: "Ports (optional, format 8080:80,443:443):",
      value: portInput,
      required: false,
    },
    {
      label: "Environment variables (optional, format VAR1=val1,VAR2=val2):",
      value: envInput,
      required: false,
    },
  ];
  const { label, value, required } = prompts[step] || {};
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="yellow" padding={1}>
      <PromptField label={label} value={value} required={required} />
      <PromptMessage message={message} color={messageColor} />
      <Text dimColor>Press Enter to continue, Escape to cancel</Text>
    </Box>
  );
}
