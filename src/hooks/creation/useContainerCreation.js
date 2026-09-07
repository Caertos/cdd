import { useReducer, useState, useRef, useEffect } from 'react';
import {
  validatePorts,
  validateEnvVars,
} from '../../helpers/validationHelpers.js';
import {
  IMAGE_PROFILES,
  resolveImageTag,
  WIZARD_STEP_COUNT,
} from '../../helpers/constants.js';
import { safeCall } from '../../helpers/safeCall.js';
import {
  searchDockerHub,
  formatHubResult,
} from '../../helpers/dockerHubService.js';
import { applyKeyToText } from '../../helpers/textEditing.js';

const MAX_VISIBLE = 6;

/** Number of steps in the wizard. Passes to 5 in TASK-4. */
export const STEP_COUNT = WIZARD_STEP_COUNT;

const INITIAL_FORM = {
  step: 0,
  imageName: '',
  containerName: '',
  portInput: '',
  envInput: '',
  cursors: { imageName: 0, containerName: 0, portInput: 0, envInput: 0 },
  message: '',
  messageColor: 'yellow',
  suggestions: [],
  selectedSuggestionIndex: -1,
  visibleOffset: 0,
};

function formReducer(state, action) {
  switch (action.type) {
    case 'RESET':
      return { ...INITIAL_FORM };
    case 'RESET_WIZARD':
      return {
        ...INITIAL_FORM,
        message: 'Insert the name of the image to create: ',
        messageColor: 'yellow',
      };
    case 'SET':
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

/**
 * Validates the content of a step without changing step.
 * Extracted from the logic that was inside nextStep().
 *
 * @param {number} step
 * @param {Object} values - { imageName, containerName, portInput, envInput }
 * @param {Object} ctx    - { imageProfiles, dbImages }
 * @returns {{ ok: boolean, error?: string }}
 */
export function validateStep(step, values, ctx) {
  const { imageName, portInput, envInput } = values;
  const { imageProfiles, dbImages } = ctx;

  if (step === 0) {
    if (!imageName.trim()) {
      return { ok: false, error: 'Image name cannot be empty.' };
    }
    return { ok: true };
  }

  if (step === 2) {
    if (portInput.trim() && !validatePorts(portInput)) {
      return {
        ok: false,
        error:
          'Port format must be host:container and both must be numbers (e.g. 8080:80)',
      };
    }
    return { ok: true };
  }

  if (step === 3) {
    const result = validateEnvVars(envInput, imageName, imageProfiles);
    if (!result.valid) {
      return { ok: false, error: result.errors.join(' | ') };
    }
    return { ok: true };
  }

  // Steps without validation (1, future steps) always pass
  return { ok: true };
}

/**
 * Returns the help message that corresponds to a step.
 * Extracted from the setStepMessage() calls scattered in nextStep().
 *
 * @param {number} step
 * @param {Object} values - { imageName, containerName, portInput, envInput }
 * @param {Object} ctx    - { imageProfiles, dbImages }
 * @returns {{ text: string, color: string }}
 */
export function stepMessageFor(step, values, ctx) {
  const { imageName } = values;
  const { imageProfiles, dbImages } = ctx;

  if (step === 0) {
    return {
      text: 'Insert the name of the image to create: ',
      color: 'yellow',
    };
  }
  if (step === 1) {
    return {
      text: 'Optional: Enter container name or leave empty and press Enter',
      color: 'yellow',
    };
  }
  if (step === 2) {
    return {
      text: 'Optional: Enter ports (format 8080:80,443:443) or leave empty and press Enter',
      color: 'yellow',
    };
  }
  if (step === 3) {
    const isDb = dbImages.some((db) =>
      imageName.trim().toLowerCase().includes(db)
    );
    const baseName = imageName
      .trim()
      .toLowerCase()
      .split(':')[0]
      .split('/')
      .pop();
    const profile = imageProfiles[baseName];

    if (profile?.requiredEnv?.length) {
      const suggestedPart =
        profile.suggestedEnv?.length
          ? ` | Suggested: ${profile.suggestedEnv.join(', ')}`
          : '';
      return {
        text: `Required env vars for ${baseName}: ${profile.requiredEnv.join(', ')}. Enter as VAR=val,VAR2=val2${suggestedPart}`,
        color: 'yellow',
      };
    }
    if (profile?.suggestedEnv?.length) {
      return {
        text: `Suggested env vars for ${baseName}: ${profile.suggestedEnv.join(', ')}. Enter as VAR=val,VAR2=val2 or leave empty.`,
        color: 'yellow',
      };
    }
    if (isDb) {
      return {
        text: 'Warning: This image usually requires environment variables (e.g. MYSQL_ROOT_PASSWORD=my-secret-pw for MySQL, POSTGRES_PASSWORD=yourpassword for Postgres). Enter them as VAR=val,VAR2=val2 or leave empty and press Enter.',
        color: 'yellow',
      };
    }
    return {
      text: 'Optional: Enter environment variables (format VAR1=val1,VAR2=val2) or leave empty and press Enter',
      color: 'yellow',
    };
  }

  return { text: '', color: 'yellow' };
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
    cursors,
    message,
    messageColor,
    suggestions,
    selectedSuggestionIndex,
    visibleOffset,
  } = form;

  // Ref always holds the latest form state for use inside callbacks
  // that capture stale closure values.
  const formRef = useRef(form);
  formRef.current = form;

  // Convenience setters that mirror the old useState API
  const setStep = (v) => dispatch({ type: 'SET', payload: { step: v } });
  const setImageName = (v) =>
    dispatch({ type: 'SET', payload: { imageName: v } });
  const setContainerName = (v) =>
    dispatch({ type: 'SET', payload: { containerName: v } });
  const setPortInput = (v) =>
    dispatch({ type: 'SET', payload: { portInput: v } });
  const setEnvInput = (v) =>
    dispatch({
      type: 'SET',
      payload: { envInput: typeof v === 'function' ? v(form.envInput) : v },
    });
  const setMessage = (v) => dispatch({ type: 'SET', payload: { message: v } });
  const setMessageColor = (v) =>
    dispatch({ type: 'SET', payload: { messageColor: v } });
  const setSuggestions = (v) =>
    dispatch({ type: 'SET', payload: { suggestions: v } });
  const setSelectedSuggestionIndex = (fn) => {
    // Support both direct value and updater function
    if (typeof fn === 'function') {
      dispatch({
        type: 'SET',
        payload: { selectedSuggestionIndex: fn(form.selectedSuggestionIndex) },
      });
    } else {
      dispatch({ type: 'SET', payload: { selectedSuggestionIndex: fn } });
    }
  };
  const setVisibleOffset = (fn) => {
    if (typeof fn === 'function') {
      dispatch({
        type: 'SET',
        payload: { visibleOffset: fn(form.visibleOffset) },
      });
    } else {
      dispatch({ type: 'SET', payload: { visibleOffset: fn } });
    }
  };

  /**
   * Sets a field's text value and cursor position together.
   * @param {'imageName'|'containerName'|'portInput'|'envInput'} fieldName
   * @param {string} value
   * @param {number} cursor
   */
  function setFieldText(fieldName, value, cursor) {
    dispatch({
      type: 'SET',
      payload: {
        [fieldName]: value,
        cursors: { ...form.cursors, [fieldName]: cursor },
      },
    });
  }

  /**
   * Returns the field name associated with a wizard step.
   * @param {number} step
   * @returns {'imageName'|'containerName'|'portInput'|'envInput'|null}
   */
  function fieldForStep(step) {
    return (
      ['imageName', 'containerName', 'portInput', 'envInput'][step] ?? null
    );
  }

  /**
   * Applies a keypress to the field associated with the current step.
   * When the edited field is imageName, recalculates suggestions.
   * @param {string} input - Raw Ink input
   * @param {import('ink').Key} key - Ink key object
   * @returns {boolean} true if the key was consumed
   */
  function handleFieldKey(input, key) {
    const fieldName = fieldForStep(step);
    if (!fieldName) return false;

    const currentState = { value: form[fieldName], cursor: cursors[fieldName] };
    const { state: newState, handled } = applyKeyToText(
      currentState,
      input,
      key
    );

    if (!handled) return false;

    if (fieldName === 'imageName') {
      // Recalculate suggestions when image name changes
      activeHubRequestRef.current.controller?.abort();
      activeHubRequestRef.current.requestId += 1;
      setIsSearchingHub(false);
      setHubResults(null);

      const lower = newState.value.toLowerCase();
      const matches = newState.value.trim()
        ? Object.keys(imageProfiles).filter((key) => key.includes(lower))
        : [];

      dispatch({
        type: 'SET',
        payload: {
          imageName: newState.value,
          cursors: { ...form.cursors, imageName: newState.cursor },
          selectedSuggestionIndex: -1,
          visibleOffset: 0,
          suggestions: matches,
        },
      });
    } else {
      setFieldText(fieldName, newState.value, newState.cursor);
    }

    return true;
  }

  // Docker Hub search state (kept as useState because they are independent of form)
  const [isSearchingHub, setIsSearchingHub] = useState(false);
  const [hubResults, setHubResults] = useState(null);
  // Tracks active request: { controller: AbortController|null, requestId: number }
  const activeHubRequestRef = useRef({ controller: null, requestId: 0 });

  // Timer for auto-clearing messages
  const messageTimerRef = useRef(null);

  /**
   * Sets a permanent message (e.g. step instructions). No auto-clear.
   */
  function setStepMessage(msg, color = 'yellow') {
    clearTimeout(messageTimerRef.current);
    dispatch({ type: 'SET', payload: { message: msg, messageColor: color } });
  }

  /**
   * Sets a transient feedback message (e.g. validation errors). Auto-clears after `ms`.
   */
  function setTimedMessage(msg, color = 'yellow', ms = 4000) {
    clearTimeout(messageTimerRef.current);
    dispatch({ type: 'SET', payload: { message: msg, messageColor: color } });
    if (msg) {
      messageTimerRef.current = setTimeout(
        () => dispatch({ type: 'SET', payload: { message: '' } }),
        ms
      );
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
    dispatch({
      type: 'SET',
      payload: { selectedSuggestionIndex: -1, visibleOffset: 0 },
    });

    try {
      const results = await searchDockerHub(query, {
        signal: controller.signal,
      });
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
   * Closes the suggestion list without changing step.
   */
  function closeSuggestions() {
    dispatch({
      type: 'SET',
      payload: {
        suggestions: [],
        selectedSuggestionIndex: -1,
        visibleOffset: 0,
      },
    });
  }

  /**
   * Cancels any in-flight Hub search and clears results.
   */
  function cancelHubSearch() {
    activeHubRequestRef.current.controller?.abort();
    activeHubRequestRef.current.requestId += 1;
    setIsSearchingHub(false);
    setHubResults(null);
  }

  /**
   * Moves the suggestion selection up (-1) or down (+1).
   * Clamps index to [-1, suggestions.length - 1].
   * Adjusts visibleOffset to keep selected item in the visible window.
   *
   * @param {number} direction - -1 (up) or 1 (down)
   */
  function moveSuggestionSelection(direction) {
    const next = Math.max(
      -1,
      Math.min(suggestions.length - 1, selectedSuggestionIndex + direction)
    );
    let newOffset = visibleOffset;
    if (next < visibleOffset) newOffset = Math.max(0, next);
    else if (next >= visibleOffset + MAX_VISIBLE)
      newOffset = next - MAX_VISIBLE + 1;
    dispatch({
      type: 'SET',
      payload: { selectedSuggestionIndex: next, visibleOffset: newOffset },
    });
  }

  /**
   * Applies the currently focused suggestion to imageName.
   * Does NOT advance the step. Clears suggestions after applying.
   */
  function applyFocusedSuggestion() {
    if (
      selectedSuggestionIndex < 0 ||
      selectedSuggestionIndex >= suggestions.length
    )
      return;
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

  /** Build context object for pure helper functions */
  const stepCtx = { imageProfiles, dbImages };

  /**
   * Advances to the next step, with validation and feedback.
   */
  function nextStep() {
    // Read current values from ref (closure values may be stale in batched updates)
    const f = formRef.current;
    const currentValues = {
      imageName: f.imageName,
      containerName: f.containerName,
      portInput: f.portInput,
      envInput: f.envInput,
    };
    const validation = validateStep(f.step, currentValues, stepCtx);
    if (!validation.ok) {
      setTimedMessage(validation.error, 'red');
      return;
    }

    // Step 3 is the final step — call onCreate before advancing
    if (f.step === 3) {
      safeCall(onCreate, currentValues);
      return;
    }

    // Step 0: resolve image tag before advancing
    if (f.step === 0) {
      const resolved = resolveImageTag(f.imageName, imageProfiles);
      dispatch({ type: 'SET', payload: { imageName: resolved, step: 1 } });
    } else {
      dispatch({ type: 'SET', payload: { step: f.step + 1 } });
    }

    const msg = stepMessageFor(f.step + 1, currentValues, stepCtx);
    setStepMessage(msg.text, msg.color);
  }

  /**
   * Goes back one step. Does not validate and does not erase anything.
   * No-op at step 0.
   */
  function prevStep() {
    const f = formRef.current;
    if (f.step <= 0) return;
    dispatch({ type: 'SET', payload: { step: f.step - 1 } });
    const currentValues = {
      imageName: f.imageName,
      containerName: f.containerName,
      portInput: f.portInput,
      envInput: f.envInput,
    };
    const msg = stepMessageFor(f.step - 1, currentValues, stepCtx);
    setStepMessage(msg.text, msg.color);
  }

  /**
   * Jumps to a specific step, preserving all data.
   * Used by TASK-4 for direct navigation from the summary screen.
   * @param {number} targetStep
   */
  function goToStep(targetStep) {
    if (targetStep < 0 || targetStep >= STEP_COUNT) return;
    dispatch({ type: 'SET', payload: { step: targetStep } });
    const f = formRef.current;
    const currentValues = {
      imageName: f.imageName,
      containerName: f.containerName,
      portInput: f.portInput,
      envInput: f.envInput,
    };
    const msg = stepMessageFor(targetStep, currentValues, stepCtx);
    setStepMessage(msg.text, msg.color);
  }

  /**
   * True if any field has content (decides whether Esc asks or exits).
   */
  function hasAnyInput() {
    return !!(
      imageName.trim() ||
      containerName.trim() ||
      portInput.trim() ||
      envInput.trim()
    );
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
    const baseName = imageName
      .trim()
      .toLowerCase()
      .split(':')[0]
      .split('/')
      .pop();
    const profile = imageProfiles[baseName];
    const suggested = profile?.suggestedEnv ?? [];
    if (!suggested.length) return;
    const addedKeys = envInput
      .split(',')
      .map((s) => s.split('=')[0].trim())
      .filter(Boolean);
    const next = suggested.find((s) => !addedKeys.includes(s.split('=')[0]));
    if (!next) {
      setTimedMessage('All suggested env vars added', 'yellow');
      return;
    }
    const newEnvInput = envInput ? `${envInput},${next}` : next;
    dispatch({ type: 'SET', payload: { envInput: newEnvInput } });
  }

  /**
   * True when the current image profile has at least one suggestedEnv entry.
   */
  const baseName = imageName
    .trim()
    .toLowerCase()
    .split(':')[0]
    .split('/')
    .pop();
  const hasSuggestedEnv =
    (imageProfiles[baseName]?.suggestedEnv?.length ?? 0) > 0;

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
    cursors,
    message,
    setMessage,
    messageColor,
    setMessageColor,
    suggestions,
    activeItems: hubResults ?? suggestions,
    selectedSuggestionIndex,
    visibleOffset,
    isSearchingHub,
    hubResults,
    updateImageInput,
    triggerHubSearch,
    closeSuggestions,
    cancelHubSearch,
    moveSuggestionSelection,
    applyFocusedSuggestion,
    nextStep,
    prevStep,
    goToStep,
    hasAnyInput,
    cancelCreation,
    resetCreation,
    insertNextSuggestedEnv,
    hasSuggestedEnv,
    fieldForStep,
    handleFieldKey,
  };
}
