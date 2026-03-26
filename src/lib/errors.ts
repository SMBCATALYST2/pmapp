/**
 * Application error handling utilities.
 * Provides structured error types and helpers for server actions.
 */

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, string[]>;

  constructor(
    message: string,
    code: string = "INTERNAL_ERROR",
    statusCode: number = 500,
    details?: Record<string, string[]>
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

// Pre-built error factories
export const errors = {
  unauthorized: (message = "You must be signed in to perform this action") =>
    new AppError(message, "UNAUTHORIZED", 401),

  forbidden: (message = "You do not have permission to perform this action") =>
    new AppError(message, "FORBIDDEN", 403),

  notFound: (entity: string) =>
    new AppError(`${entity} not found`, "NOT_FOUND", 404),

  conflict: (message: string) =>
    new AppError(message, "CONFLICT", 409),

  validation: (message: string, details?: Record<string, string[]>) =>
    new AppError(message, "VALIDATION_ERROR", 400, details),

  badRequest: (message: string) =>
    new AppError(message, "BAD_REQUEST", 400),

  rateLimited: (message = "Too many requests. Please try again later.") =>
    new AppError(message, "RATE_LIMITED", 429),

  internal: (message = "An unexpected error occurred") =>
    new AppError(message, "INTERNAL_ERROR", 500),
} as const;

/**
 * Type-safe action result wrapper.
 * Use success() and failure() helpers rather than constructing manually.
 */
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export function success<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

export function failure(error: string): ActionResult<never> {
  return { success: false, error };
}

/**
 * Wraps a server action body with standardized error handling.
 * Catches AppError and returns structured failure, rethrows unknown errors.
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>
): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return success(data);
  } catch (error) {
    if (error instanceof AppError) {
      return failure(error.message);
    }
    console.error("Unhandled error in server action:", error);
    return failure("An unexpected error occurred. Please try again.");
  }
}
