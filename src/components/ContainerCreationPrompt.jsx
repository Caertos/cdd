import React from "react";
import { Box, Text } from "ink";
import { PromptField, PromptMessage } from "./PromptField.jsx";
import PropTypes from 'prop-types';

/**
 * Prompt UI shown when creating a new container.
 * Presents a step-by-step form (image, name, ports, env) and displays
 * a contextual message provided by the creation hook.
 *
 * @param {Object} props
 * @param {number} props.step - Current step index (0..3)
 * @param {string} props.imageName - Value for the image name field
 * @param {string} props.containerName - Value for the container name field
 * @param {string} props.portInput - Value for the ports input field
 * @param {string} props.envInput - Value for the environment variables field
 * @param {string} props.message - Contextual message to display (errors/hints)
 * @param {string} props.messageColor - Color for the contextual message
 * @returns {JSX.Element}
 */
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

ContainerCreationPrompt.propTypes = {
  step: PropTypes.number.isRequired,
  imageName: PropTypes.string,
  containerName: PropTypes.string,
  portInput: PropTypes.string,
  envInput: PropTypes.string,
  message: PropTypes.string,
  messageColor: PropTypes.string,
};
