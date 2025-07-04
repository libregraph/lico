/**
 * Converts an Error object to a serializable object for Redux state
 * @param {Error} error - The error object to serialize
 * @returns {Object} - Serializable error object
 */
export function serializeError(error) {
  if (!error) {
    return null;
  }

  // If it's already serialized, return as-is
  if (typeof error === 'object' && !(error instanceof Error)) {
    return error;
  }

  // Convert Error object to serializable object
  return {
    message: error.message,
    id: error.id || error.message,
    values: error.values || undefined,
    stack: error.stack || undefined
  };
}

/**
 * Creates a serializable error object
 * @param {string} message - Error message/id
 * @param {Object} values - Optional values for error interpolation
 * @returns {Object} - Serializable error object
 */
export function createSerializableError(message, values = undefined) {
  return {
    message,
    id: message,
    values
  };
}