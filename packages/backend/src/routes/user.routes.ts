import { Router, Request, Response, NextFunction } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import { requireOwner } from '../middleware/role.middleware'
import { validate } from '../middleware/validate'
import { createStaffSchema, updateStaffSchema } from '../schemas/user.schema'
import {
  listStaff,
  createStaff,
  updateStaff,
  deactivateStaff,
} from '../services/user.service'

const router = Router()

// ─── GET /api/users ──────────────────────────────────────────────────────────
// List all staff accounts for the authenticated owner's shop.
// Requirements: 7.10, 8.3
router.get(
  '/',
  authenticate,
  requireOwner,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const staff = listStaff(req.user!.shopId)
      res.status(200).json(staff)
    } catch (err) {
      next(err)
    }
  }
)

// ─── POST /api/users ─────────────────────────────────────────────────────────
// Create a new staff account for the authenticated owner's shop.
// Requirements: 7.7, 7.8, 7.9, 8.3
router.post(
  '/',
  authenticate,
  requireOwner,
  validate(createStaffSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const staff = await createStaff(req.user!.shopId, req.body)
      res.status(201).json(staff)
    } catch (err) {
      next(err)
    }
  }
)

// ─── PATCH /api/users/:id ─────────────────────────────────────────────────────
// Update name and/or email for a staff member in the owner's shop.
// Requirements: 7.7, 7.9, 8.3
router.patch(
  '/:id',
  authenticate,
  requireOwner,
  validate(updateStaffSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const staff = await updateStaff(req.user!.shopId, String(req.params.id), req.body)
      res.status(200).json(staff)
    } catch (err) {
      next(err)
    }
  }
)

// ─── DELETE /api/users/:id ────────────────────────────────────────────────────
// Deactivate a staff account in the owner's shop.
// Requirements: 7.11, 7.12, 8.3
router.delete(
  '/:id',
  authenticate,
  requireOwner,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = deactivateStaff(req.user!.shopId, String(req.params.id))
      res.status(200).json(result)
    } catch (err) {
      next(err)
    }
  }
)

export default router
