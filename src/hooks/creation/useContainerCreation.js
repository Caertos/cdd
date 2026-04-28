import { useReducer, useState, useRef, useEffect } from 'react';
import {
  validatePorts,
  validateEnvVars,
} from '../../helpers/validationHelpers.js';
import { IMAGE_PROFILES, resolveImageTag } from '../../helpers/constants.js';
import { safeCall } from '../../helpers/safeCall.js';
import { searchDockerHub, formatHubResult } from '../../helpers/dockerHubService.js';

const MAX_VISIBLE = 6;

const INITIAL_FORM = {
  step: 0,
  imageName: '',
  containerName: '',
  portInput: '',
  envInput: '',
  message: '',
  messageColor: 'yellow',
  suggestions: [],
  selectedSuggestionIndex: -1,
  visibleOffset: 0,
};

function formReducer(state, action) {
  switch (action.type) {
    case 'RESET': return { ...INITIAL_FORM };
    case 'RESET_WIZARD': return { ...INITIAL_FORM, message: 'Insert the name of the image to create: ', messageColor: 'yellow' };
    case 'SET': return { ...state, ...action.payload };
    default: return state;
  }
}

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
  const [form, dispatch] = useReducer(formReducer, INITIAL_FORM);
  const {
    step,
    imageName,
    containerName,
    portInput,
    envInput,
    message,
    messageColor,
    suggestions,
    selectedSuggestionIndex,
    visibleOffset,
  } = form;

  // Convenience setters that mirror the old useState API
  const setStep = (v) => dispatch({ type: 'SET', payload: { step: v } });
  const setImageName = (v) => dispatch({ type: 'SET', payload: { imageName: v } });
  const setContainerName = (v) => dispatch({ type: 'SET', payload: { containerName: v } });
  const setPortInput = (v) => dispatch({ type: 'SET', payload: { portInput: v } });
  const setEnvInput = (v) =>
    dispatch({ type: 'SET', payload: { envInput: typeof v === 'function' ? v(form.envInput) : v } });
  const setMessage = (v) => dispatch({ type: 'SET', payload: { message: v } });
  const setMessageColor = (v) => dispatch({ type: 'SET', payload: { messageColor: v } });
  const setSuggestions = (v) => dispatch({ type: 'SET', payload: { suggestions: v } });
  const setSelectedSuggestionIndex = (fn) => {
    // Support both direct value and updater function
    if (typeof fn === 'function') {
      dispatch({ type: 'SET', payload: { selectedSuggestionIndex: fn(form.selectedSuggestionIndex) } });
    } else {
      dispatch({ type: 'SET', payload: { selectedSuggestionIndex: fn } });
    }
  };
  const setVisibleOffset = (fn) => {
    if (typeof fn === 'function') {
      dispatch({ type: 'SET', payload: { visibleOffset: fn(form.visibleOffset) } });
    } else {
      dispatch({ type: 'SET', payload: { visibleOffset: fn } });
    }
  };

  // Docker Hub search state (kept as useState because they are independent of form)
  const [isSearchingHub, setIsSearchingHub] = useState(false);
  const [hubResults, setHubResults] = useState(null);
  // Tracks active request: { controller: AbortController|null, requestId: number }
  const activeHubRequestRef = useRef({ controller: null, requestId: 0 });

  // Timer for auto-clearing messages
  const messageTimerRef = useRef(null);

  function setTimedMessage(msg, color = 'yellow', ms = 4000) {
    clearTimeout(messageTimerRef.current);
    dispatch({ type: 'SET', payload: { message: msg, messageColor: color } });
    if (msg) {
      messageTimerRef.current = setTimeout(() => dispatch({ type: 'SET', payload: { message: '' } }), ms);
    }
  }

  useEffect(() => () => clearTimeout(messageTimerRef.current), []);

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

    const lower = value.toLowerCase();
    const matches = value.trim()
      ? Object.keys(imageProfiles).filter((key) => key.includes(lower))
      : [];

    dispatch({
      type: 'SET',
      payload: {
        imageName: value,
        selectedSuggestionIndex: -1,
        visibleOffset: 0,
        suggestions: matches,
      },
    });
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
    dispatch({ type: 'SET', payload: { selectedSuggestionIndex: -1, visibleOffset: 0 } });

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
    const next = Math.max(-1, Math.min(suggestions.length - 1, selectedSuggestionIndex + direction));
    let newOffset = visibleOffset;
    if (next < visibleOffset) newOffset = Math.max(0, next);
    else if (next >= visibleOffset + MAX_VISIBLE) newOffset = next - MAX_VISIBLE + 1;
    dispatch({ type: 'SET', payload: { selectedSuggestionIndex: next, visibleOffset: newOffset } });
  }

  /**
   * Applies the currently focused suggestion to imageName.
   * Does NOT advance the step. Clears suggestions after applying.
   */
  function applyFocusedSuggestion() {
    if (selectedSuggestionIndex < 0 || selectedSuggestionIndex >= suggestions.length) return;
    const chosen = suggestions[selectedSuggestionIndex];
    dispatch({
      type: 'SET',
      payload: {
        imageName: resolveImageTag(chosen, imageProfiles),
        suggestions: [],
        selectedSuggestionIndex: -1,
        visibleOffset: 0,
      },
    });
  }

  /**
   * Advances to the next step, with validation and feedback.
   */
  function nextStep() {
    if (step === 0) {
      if (!imageName.trim()) {
        setTimedMessage('Image name cannot be empty.', 'red');
        return;
      }
      const resolved = resolveImageTag(imageName, imageProfiles);
      dispatch({ type: 'SET', payload: { imageName: resolved, step: 1 } });
      setTimedMessage(
        'Optional: Enter container name or leave empty and press Enter',
        'yellow'
      );
      return;
    }
    if (step === 1) {
      dispatch({ type: 'SET', payload: { step: 2 } });
      setTimedMessage(
        'Optional: Enter ports (format 8080:80,443:443) or leave empty and press Enter',
        'yellow'
      );
      return;
    }
    if (step === 2) {
      // Ports are now optional - only validate if provided
      if (portInput.trim() && !validatePorts(portInput)) {
        setTimedMessage(
          'Port format must be host:container and both must be numbers (e.g. 8080:80)',
          'red'
        );
        return;
      }
      dispatch({ type: 'SET', payload: { step: 3 } });
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
        setTimedMessage(
          `Required env vars for ${baseName}: ${profile.requiredEnv.join(', ')}. Enter as VAR=val,VAR2=val2${suggestedPart}`,
          'yellow'
        );
      } else if (profile && profile.suggestedEnv && profile.suggestedEnv.length) {
        setTimedMessage(
          `Suggested env vars for ${baseName}: ${profile.suggestedEnv.join(', ')}. Enter as VAR=val,VAR2=val2 or leave empty.`,
          'yellow'
        );
      } else if (isDb) {
        setTimedMessage(
          'Warning: This image usually requires environment variables (e.g. MYSQL_ROOT_PASSWORD=my-secret-pw for MySQL, POSTGRES_PASSWORD=yourpassword for Postgres). Enter them as VAR=val,VAR2=val2 or leave empty and press Enter.',
          'yellow'
        );
      } else {
        setTimedMessage(
          'Optional: Enter environment variables (format VAR1=val1,VAR2=val2) or leave empty and press Enter',
          'yellow'
        );
      }
      return;
    }
    if (step === 3) {
      // Contextual env validation using image profiles
      const result = validateEnvVars(envInput, imageName, imageProfiles);
      if (!result.valid) {
        setTimedMessage(result.errors.join(' | '), 'red');
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
    dispatch({ type: 'RESET' });
    safeCall(onCancel);
  }

  /**
   * Resets all creation state to initial values without triggering onCancel.
   * Used by the command router when the user presses 'c' to open the creation wizard.
   */
  function resetCreation() {
    dispatch({ type: 'RESET_WIZARD' });
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
    if (!next) { setTimedMessage('All suggested env vars added', 'yellow'); return; }
    const newEnvInput = envInput ? `${envInput},${next}` : next;
    dispatch({ type: 'SET', payload: { envInput: newEnvInput } });
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
