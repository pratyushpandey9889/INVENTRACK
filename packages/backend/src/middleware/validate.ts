import { Request, Response, NextFunction } from 'express'
import { ZodTypeAny } from 'zod'
import { AppError } from '../utils/errors'

/**
 * Express middleware factory that validates req.body against a Zod schema.
 * On failure, throws AppError(400) with all issue messages joined.
 * Requirements: 9.1, 9.2
 */
export function validate(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      const errorMessage = result.error.issues.map((i: { message: string }) => i.message).join(', ')
      return next(new AppError(400, errorMessage))
    }
    next()
  }
}
