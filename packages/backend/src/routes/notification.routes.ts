import { Router, Request, Response, NextFunction } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import { listNotifications, getUnreadCount, markRead } from '../services/notification.service'
import { AppError } from '../utils/errors'

const router = Router()

// GET /api/notifications — Requirements: 6.3, 6.5
router.get(
  '/',
  authenticate,
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const limitParam = req.query.limit
      let limit = 20
      if (limitParam !== undefined) {
        const parsed = Number(limitParam)
        if (!Number.isInteger(parsed) || parsed < 1) {
          return next(new AppError(400, 'limit must be a positive integer'))
        }
        limit = parsed
      }
      const notifications = listNotifications(req.user!.shopId, limit)
      res.status(200).json(notifications)
    } catch (err) {
      next(err)
    }
  }
)

// GET /api/notifications/unread-count — Requirements: 6.4, 6.6, 6.7
router.get(
  '/unread-count',
  authenticate,
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const result = getUnreadCount(req.user!.shopId)
      res.status(200).json(result)
    } catch (err) {
      next(err)
    }
  }
)

// POST /api/notifications/mark-read — Requirements: 6.5, 6.6
router.post(
  '/mark-read',
  authenticate,
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const { ids } = req.body
      if (ids !== 'all' && !Array.isArray(ids)) {
        return next(new AppError(400, 'ids must be an array of strings or the value "all"'))
      }
      if (Array.isArray(ids) && ids.some(id => typeof id !== 'string')) {
        return next(new AppError(400, 'each id must be a string'))
      }
      const result = markRead(req.user!.shopId, ids)
      res.status(200).json(result)
    } catch (err) {
      next(err)
    }
  }
)

export default router
