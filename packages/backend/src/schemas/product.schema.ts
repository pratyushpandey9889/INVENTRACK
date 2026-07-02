import { z } from 'zod'

// Valid sort fields for the product list query
// Requirements: 1.6
const SORT_FIELDS = ['name', 'current_stock', 'low_stock_threshold', 'cost_price', 'selling_price', 'created_at'] as const

// Requirements: 1.1, 1.2, 9.1, 9.6, 9.7
export const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  sku: z.string().optional(),
  category: z.string().optional(),
  unit: z.string().min(1),
  currentStock: z.number().min(0),
  costPrice: z.number().min(0),
  sellingPrice: z.number().min(0),
  lowStockThreshold: z.number().gt(0, 'Low stock threshold must be greater than zero'),
})

// Requirements: 1.9
export const updateProductSchema = createProductSchema.partial()

// Requirements: 1.6, 1.7, 1.8
export const productListQuerySchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  sortBy: z.enum(SORT_FIELDS).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
})

export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
export type ProductListQuery = z.infer<typeof productListQuerySchema>
