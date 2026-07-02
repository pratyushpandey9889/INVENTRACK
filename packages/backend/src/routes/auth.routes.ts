import { Router, Request, Response, NextFunction } from 'express'
import rateLimit from 'express-rate-limit'
import { validate } from '../middleware/validate'
import { authenticate } from '../middleware/auth.middleware'
import { register, login, getMe } from '../services/auth.service'
import { registerSchema, loginSchema } from '../schemas/auth.schema'

const router = Router()

// Requirement 11.3: max 20 requests per IP per 15-minute window on auth endpoints
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
})

router.use(authRateLimiter)

// POST /api/auth/register — Requirements: 7.1, 7.2, 7.3
router.post(
  '/register',
  validate(registerSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await register(req.body)
      res.status(201).json(result)
    } catch (err) {
      next(err)
    }
  }
)

// POST /api/auth/login — Requirements: 7.4, 7.5
router.post(
  '/login',
  validate(loginSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await login(req.body)
      res.status(200).json(result)
    } catch (err) {
      next(err)
    }
  }
)

// GET /api/auth/me — Requirement: 7.13
router.get(
  '/me',
  authenticate,
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      const user = getMe(req.user!.userId)
      res.status(200).json(user)
    } catch (err) {
      next(err)
    }
  }
)

export default router
