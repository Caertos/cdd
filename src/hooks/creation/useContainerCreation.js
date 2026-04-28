import { useState, useRef } from 'react';
import {
  validatePorts,
  validateEnvVars,
} from '../../helpers/validationHelpers.js';
import { IMAGE_PROFILES, resolveImageTag } from '../../helpers/constants.js';
import { safeCall } from '../../helpers/safeCall.js';
import { searchDockerHub, formatHubResult } from '../../helpers/dockerHubService.js';

const MAX_VISIBLE = 6;

/**
 * Custom hook to manage the container creation flow, step by step.
 * Handles input, validation, and feedback for each creation step.
 *
 * @param {Object} params
 * @param {Function} params.onCreate - Callback when creation is confirmed
 * @param {Function} params.onCancel - Callback when creation is cancelled
 * @param {Array<string>} params.dbImages - List of DB image names for env var warning (legacy)
 * @param {Object} [params.imageProfiles] - Image profiles map for contextual validation
 * @returns {Object} Creation state, setters, and helpers
 */
export function useContainerCreation({
  onCreate,
  onCancel,
  dbImages = [],
  imageProfiles = IMAGE_PROFILES,
}) {
  const [step, setStep] = useState(0); // 0: image, 1: name, 2: ports, 3: env
  const [imageName, setImageName] = useState('');
  const [containerName, setContainerName] = useState('');
  const [portInput, setPortInput] = useState('');
  const [envInput, setEnvInput] = useState('');
  const [message, setMessage] = useState('');
  const [messageColor, setMessageColor] = useState('yellow');

  // Autocomplete state
  const [suggestions, setSuggestions] = useState([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [visibleOffset, setVisibleOffset] = useState(0);

  // Docker Hub search state
  const [isSearchingHub, setIsSearchingHub] = useState(false);
  const [hubResults, setHubResults] = useState(null);
  // Tracks active request: { controller: AbortController|null, requestId: number }
  const activeHubRequestRef = useRef({ controller: null, requestId: 0 });

  /**
   * Updates the image name input and recalculates autocomplete suggestions.
   * Resets selectedSuggestionIndex to -1 on every keystroke.
   * Also aborts any in-flight Hub search and clears Hub results.
   *
   * @param {string} value - New raw image name typed by user
   */
  function updateImageInput(value) {
    // Abort any in-flight Hub search and clear its state
    activeHubRequestRef.current.controller?.abort();
    activeHubRequestRef.current.requestId += 1;
    setIsSearchingHub(false);
    setHubResults(null);

    setImageName(value);
    setSelectedSuggestionIndex(-1);
    setVisibleOffset(0);
    if (!value.trim()) {
      setSuggestions([]);
      return;
    }
    const lower = value.toLowerCase();
    const matches = Object.keys(imageProfiles).filter((key) =>
      key.includes(lower)
    );
    setSuggestions(matches);
  }

  /**
   * Triggers a Docker Hub search for the current imageName.
   * Guards: imageName must be non-empty; no concurrent search allowed.
   * Uses AbortController + requestId to handle race conditions.
   */
  async function triggerHubSearch() {
    const query = imageName.trim();
    if (!query) return;
    if (isSearchingHub) return;

    // Abort previous request (should already be aborted from updateImageInput,
    // but guard here too)
    activeHubRequestRef.current.controller?.abort();

    const requestId = activeHubRequestRef.current.requestId + 1;
    activeHubRequestRef.current.requestId = requestId;

    const controller = new AbortController();
    activeHubRequestRef.current.controller = controller;

    setIsSearchingHub(true);
    setSelectedSuggestionIndex(-1);
    setVisibleOffset(0);

    try {
      const results = await searchDockerHub(query, { signal: controller.signal });
      // Ignore stale responses
      if (activeHubRequestRef.current.requestId !== requestId) return;
      setHubResults(results.map(formatHubResult));
    } catch (err) {
      if (activeHubRequestRef.current.requestId !== requestId) return;
      // Silence AbortError; for all other errors fall back to static suggestions
      setHubResults(null);
    } finally {
      if (activeHubRequestRef.current.requestId === requestId) {
        setIsSearchingHub(false);
      }
    }
  }

  /**
   * Moves the suggestion selection up (-1) or down (+1).
   * Clamps index to [-1, suggestions.length - 1].
   * Adjusts visibleOffset to keep selected item in the visible window.
   *
   * @param {number} direction - -1 (up) or 1 (down)
   */
  function moveSuggestionSelection(direction) {
    setSelectedSuggestionIndex((prev) => {
      const next = Math.max(-1, Math.min(suggestions.length - 1, prev + direction));
      // Adjust visibleOffset to keep selected in view
      setVisibleOffset((offset) => {
        if (next < offset) return Math.max(0, next);
        if (next >= offset + MAX_VISIBLE) return next - MAX_VISIBLE + 1;
        return offset;
      });
      return next;
    });
  }

  /**
   * Applies the currently focused suggestion to imageName.
   * Does NOT advance the step. Clears suggestions after applying.
   */
  function applyFocusedSuggestion() {
    if (selectedSuggestionIndex < 0 || selectedSuggestionIndex >= suggestions.length) return;
    const chosen = suggestions[selectedSuggestionIndex];
    setImageName(resolveImageTag(chosen, imageProfiles));
    setSuggestions([]);
    setSelectedSuggestionIndex(-1);
    setVisibleOffset(0);
  }

  /**
   * Advances to the next step, with validation and feedback.
   */
  function nextStep() {
    if (step === 0) {
      if (!imageName.trim()) {
        setMessage('Image name cannot be empty.');
        setMessageColor('red');
        return;
      }
      const resolved = resolveImageTag(imageName, imageProfiles);
      setImageName(resolved);
      setStep(1);
      setMessage(
        'Optional: Enter container name or leave empty and press Enter'
      );
      setMessageColor('yellow');
      return;
    }
    if (step === 1) {
      setStep(2);
      setMessage(
        'Optional: Enter ports (format 8080:80,443:443) or leave empty and press Enter'
      );
      setMessageColor('yellow');
      return;
    }
    if (step === 2) {
      // Ports are now optional - only validate if provided
      if (portInput.trim() && !validatePorts(portInput)) {
        setMessage(
          'Port format must be host:container and both must be numbers (e.g. 8080:80)'
        );
        setMessageColor('red');
        return;
      }
      setStep(3);
      const isDb = dbImages.some((db) =>
        imageName.trim().toLowerCase().includes(db)
      );
      // Check if the image has a profile with required env vars
      const baseName = imageName
        .trim()
        .toLowerCase()
        .split(':')[0]
        .split('/')
        .pop();
      const profile = imageProfiles[baseName];
      if (profile && profile.requiredEnv && profile.requiredEnv.length) {
        const suggestedPart =
          profile.suggestedEnv && profile.suggestedEnv.length
            ? ` | Suggested: ${profile.suggestedEnv.join(', ')}`
            : '';
        setMessage(
          `Required env vars for ${baseName}: ${profile.requiredEnv.join(', ')}. Enter as VAR=val,VAR2=val2${suggestedPart}`
        );
        setMessageColor('yellow');
      } else if (profile && profile.suggestedEnv && profile.suggestedEnv.length) {
        setMessage(
          `Suggested env vars for ${baseName}: ${profile.suggestedEnv.join(', ')}. Enter as VAR=val,VAR2=val2 or leave empty.`
        );
        setMessageColor('yellow');
      } else if (isDb) {
        setMessage(
          'Warning: This image usually requires environment variables (e.g. MYSQL_ROOT_PASSWORD=my-secret-pw for MySQL, POSTGRES_PASSWORD=yourpassword for Postgres). Enter them as VAR=val,VAR2=val2 or leave empty and press Enter.'
        );
        setMessageColor('yellow');
      } else {
        setMessage(
          'Optional: Enter environment variables (format VAR1=val1,VAR2=val2) or leave empty and press Enter'
        );
        setMessageColor('yellow');
      }
      return;
    }
    if (step === 3) {
      // Contextual env validation using image profiles
      const result = validateEnvVars(envInput, imageName, imageProfiles);
      if (!result.valid) {
        setMessage(result.errors.join(' | '));
        setMessageColor('red');
        return;
      }
      // Final step: call onCreate with all data (safely)
      safeCall(onCreate, { imageName, containerName, portInput, envInput });
    }
  }

  /**
   * Cancels the creation process and resets state.
   */
  function cancelCreation() {
    setStep(0);
    setImageName('');
    setContainerName('');
    setPortInput('');
    setEnvInput('');
    setMessage('');
    setMessageColor('yellow');
    setSuggestions([]);
    setSelectedSuggestionIndex(-1);
    setVisibleOffset(0);
    safeCall(onCancel);
  }

  /**
   * Resets all creation state to initial values without triggering onCancel.
   * Used by the command router when the user presses 'c' to open the creation wizard.
   */
  function resetCreation() {
    setStep(0);
    setImageName('');
    setContainerName('');
    setPortInput('');
    setEnvInput('');
    setMessage('Insert the name of the image to create: ');
    setMessageColor('yellow');
    setSuggestions([]);
    setSelectedSuggestionIndex(-1);
    setVisibleOffset(0);
  }

  /**
   * Inserts the next pending suggested env var into envInput.
   * Derives "next" by comparing keys already in envInput against suggestedEnv.
   * When all suggestions are already present, sets a feedback message.
   */
  function insertNextSuggestedEnv() {
    const baseName = imageName.trim().toLowerCase().split(':')[0].split('/').pop();
    const profile = imageProfiles[baseName];
    const suggested = profile?.suggestedEnv ?? [];
    if (!suggested.length) return;
    const addedKeys = envInput.split(',').map(s => s.split('=')[0].trim()).filter(Boolean);
    const next = suggested.find(s => !addedKeys.includes(s.split('=')[0]));
    if (!next) { setMessage('All suggested env vars added'); return; }
    setEnvInput(prev => prev ? `${prev},${next}` : next);
  }

  /**
   * True when the current image profile has at least one suggestedEnv entry.
   */
  const baseName = imageName.trim().toLowerCase().split(':')[0].split('/').pop();
  const hasSuggestedEnv = (imageProfiles[baseName]?.suggestedEnv?.length ?? 0) > 0;

  return {
    step,
    setStep,
    imageName,
    setImageName,
    containerName,
    setContainerName,
    portInput,
    setPortInput,
    envInput,
    setEnvInput,
    message,
    setMessage,
    messageColor,
    setMessageColor,
    suggestions,
    selectedSuggestionIndex,
    visibleOffset,
    isSearchingHub,
    hubResults,
    updateImageInput,
    triggerHubSearch,
    moveSuggestionSelection,
    applyFocusedSuggestion,
    nextStep,
    cancelCreation,
    resetCreation,
    insertNextSuggestedEnv,
    hasSuggestedEnv,
  };
}
