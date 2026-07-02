import { Router, Request, Response, NextFunction } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import { getDashboardSummary } from '../services/dashboard.service'

const router = Router()

// GET /api/dashboard — Requirements: 5.1, 5.2, 5.3
router.get(
  '/',
  authenticate,
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const summary = getDashboardSummary(req.user!.shopId)
      res.status(200).json(summary)
    } catch (err) {
      next(err)
    }
  }
)

export default router
