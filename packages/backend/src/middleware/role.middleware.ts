import { Request, Response, NextFunction } from 'express'

/**
 * Role guard middleware — owner only.
 * Must be used after the `authenticate` middleware so req.user is populated.
 * Returns 403 if the authenticated user is not an owner.
 * Requirements: 8.3, 8.4, 1.10
 */
export function requireOwner(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'owner') {
    res.status(403).json({ message: "You don't have permission to do this." })
    return
  }

  next()
}
