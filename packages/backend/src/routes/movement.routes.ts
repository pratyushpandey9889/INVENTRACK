import { Router, Request, Response, NextFunction } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import { validate } from '../middleware/validate'
import { createMovement, listMovements } from '../services/movement.service'
import { createMovementSchema, movementListQuerySchema } from '../schemas/movement.schema'
import { AppError } from '../utils/errors'

const router = Router()

// POST /api/movements — Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 8.6
router.post(
  '/',
  authenticate,
  validate(createMovementSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = createMovement(req.user!.shopId, req.user!.userId, req.body)
      res.status(200).json(result)
    } catch (err) {
      next(err)
    }
  }
)

// GET /api/movements — Requirements: 2.7, 2.8, 2.9
router.get(
  '/',
  authenticate,
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const result = movementListQuerySchema.safeParse(req.query)
      if (!result.success) {
        const message = result.error.issues.map(i => i.message).join(', ')
        return next(new AppError(400, message))
      }
      const movements = listMovements(req.user!.shopId, result.data)
      res.status(200).json(movements)
    } catch (err) {
      next(err)
    }
  }
)

export default router
