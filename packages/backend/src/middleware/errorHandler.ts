import { Request, Response, NextFunction } from 'express'
import { AppError } from '../utils/errors'

/**
 * Global error handler middleware.
 * Must be registered as the LAST middleware in the Express app (after all routes).
 * - Catches AppError instances and responds with the error's status code and message.
 * - Catches all other errors and responds with 500, hiding internal details.
 * Requirements: 9.5
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ message: err.message })
    return
  }

  // Log unexpected errors server-side for debugging, but don't expose details to clients
  console.error('Unexpected error:', err)

  res.status(500).json({ message: 'Something went wrong. Please try again.' })
}
