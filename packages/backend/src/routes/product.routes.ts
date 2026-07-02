import { Router, Request, Response, NextFunction } from 'express'
import { ZodTypeAny } from 'zod'
import { authenticate } from '../middleware/auth.middleware'
import { requireOwner } from '../middleware/role.middleware'
import { validate } from '../middleware/validate'
import { AppError } from '../utils/errors'
import {
  createProductSchema,
  updateProductSchema,
  productListQuerySchema,
} from '../schemas/product.schema'
import {
  createProduct,
  listProducts,
  getProduct,
  updateProduct,
  archiveProduct,
} from '../services/product.service'

const router = Router()

/**
 * Middleware factory that validates req.query against a Zod schema.
 * On failure, calls next(AppError(400)) with joined issue messages.
 * Requirements: 1.6, 1.7, 1.8
 */
function validateQuery(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query)
    if (!result.success) {
      const message = result.error.issues
        .map((i: { message: string }) => i.message)
        .join(', ')
      return next(new AppError(400, message))
    }
    // Attach parsed query onto req for use in the handler
    ;(req as Request & { parsedQuery?: unknown }).parsedQuery = result.data
    next()
  }
}

// ─── GET /api/products ───────────────────────────────────────────────────────
// Requirements: 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.12
router.get(
  '/',
  authenticate,
  validateQuery(productListQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = listProducts(req.user!.shopId, (req as Request & { parsedQuery?: unknown }).parsedQuery as Parameters<typeof listProducts>[1])
      res.status(200).json(result)
    } catch (err) {
      next(err)
    }
  }
)

// ─── POST /api/products ──────────────────────────────────────────────────────
// Requirements: 1.1, 1.2, 8.3, 8.4
router.post(
  '/',
  authenticate,
  requireOwner,
  validate(createProductSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const product = createProduct(req.user!.shopId, req.body)
      res.status(201).json(product)
    } catch (err) {
      next(err)
    }
  }
)

// ─── GET /api/products/:id ───────────────────────────────────────────────────
// Requirements: 1.12, 1.13
router.get(
  '/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const product = getProduct(req.user!.shopId, String(req.params.id))
      res.status(200).json(product)
    } catch (err) {
      next(err)
    }
  }
)

// ─── PATCH /api/products/:id ─────────────────────────────────────────────────
// Requirements: 1.9, 8.4
router.patch(
  '/:id',
  authenticate,
  requireOwner,
  validate(updateProductSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const product = updateProduct(req.user!.shopId, String(req.params.id), req.body)
      res.status(200).json(product)
    } catch (err) {
      next(err)
    }
  }
)

// ─── DELETE /api/products/:id ────────────────────────────────────────────────
// Requirements: 1.11, 8.3, 8.5
router.delete(
  '/:id',
  authenticate,
  requireOwner,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = archiveProduct(req.user!.shopId, String(req.params.id))
      res.status(200).json(result)
    } catch (err) {
      next(err)
    }
  }
)

export default router
