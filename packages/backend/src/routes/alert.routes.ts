import { Router, Request, Response, NextFunction } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import { listAlerts, updateAlertStatus } from '../services/alert.service'
import { alertListQuerySchema } from '../schemas/alert.schema'
import { AppError } from '../utils/errors'

const router = Router()

// GET /api/alerts — Requirements: 3.5, 3.6, 3.7
router.get(
  '/',
  authenticate,
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const result = alertListQuerySchema.safeParse(req.query)
      if (!result.success) {
        const message = result.error.issues.map(i => i.message).join(', ')
        return next(new AppError(400, message))
      }
      const alerts = listAlerts(req.user!.shopId, result.data)
      res.status(200).json(alerts)
    } catch (err) {
      next(err)
    }
  }
)

// PATCH /api/alerts/:id — Requirements: 3.8, 4.6, 4.7, 4.8
router.patch(
  '/:id',
  authenticate,
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const { status } = req.body
      const alert = updateAlertStatus(req.user!.shopId, String(req.params.id), status)
      res.status(200).json(alert)
    } catch (err) {
      next(err)
    }
  }
)

export default router
