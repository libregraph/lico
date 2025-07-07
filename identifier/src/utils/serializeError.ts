interface SerializableError {
  message: string;
  id: string;
  values?: unknown;
  stack?: string;
}

interface ExtendedError extends Error {
  id?: string;
  values?: unknown;
}

/**
 * Converts an Error object to a serializable object for Redux state
 */
export function serializeError(error: Error | ExtendedError | null | undefined): SerializableError | null {
  if (!error) {
    return null;
  }

  // If it's already serialized, return as-is
  if (typeof error === 'object' && !(error instanceof Error)) {
    return error as SerializableError;
  }

  // Convert Error object to serializable object
  return {
    message: error.message,
    id: (error as ExtendedError).id || error.message,
    values: (error as ExtendedError).values || undefined,
    stack: error.stack || undefined
  };
}

/**
 * Creates a serializable error object
 */
export function createSerializableError(message: string, values?: unknown): SerializableError {
  return {
    message,
    id: message,
    values
  };
}