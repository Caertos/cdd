/**
 * Prefix a failure message, without ever doubling the prefix.
 *
 * The service layer already wraps Docker's own words ("Error creating
 * container: (HTTP code 409)..."), and the UI wants to say what it was
 * attempting. Concatenating both produced sentences like "Error creating
 * container: Error creating container: (HTTP code 409)...".
 *
 * @param {string} prefix - e.g. 'Error creating container'
 * @param {string} message - The error's message, prefixed or not
 * @returns {string}
 */
export function withContext(prefix, message) {
  const text = message == null ? '' : String(message);
  if (text.startsWith(prefix)) return text;
  return text ? `${prefix}: ${text}` : prefix;
}
