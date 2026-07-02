import { z } from 'zod'

// Requirements: 2.1–2.9

export const MOVEMENT_TYPES = ['restock', 'sale', 'damage', 'adjustment'] as const

export const createMovementSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  changeAmount: z
    .number()
    .refine(v => v !== 0, 'Change amount cannot be zero')
    .refine(v => v >= -1_000_000 && v <= 1_000_000, 'Change amount must be between -1,000,000 and 1,000,000'),
  type: z.enum(MOVEMENT_TYPES),
  note: z.string().optional(),
})

export const movementListQuerySchema = z.object({
  productId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(50),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
})

export type CreateMovementInput = z.infer<typeof createMovementSchema>
export type MovementListQuery = z.infer<typeof movementListQuerySchema>
