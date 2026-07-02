import { v4 as uuid } from 'uuid'
import { db } from '../db/database'
import type { CreateMovementInput, MovementListQuery } from '../schemas/movement.schema'
import { AppError } from '../utils/errors'
import { checkAndFireAlert } from './alertEngine.service'

// Requirements: 2.1–2.10

export interface StockMovement {
  id: string
  productId: string
  userId: string
  changeAmount: number
  type: 'restock' | 'sale' | 'damage' | 'adjustment'
  note: string | null
  createdAt: string
}

export interface ProductRow {
  id: string
  shop_id: string
  name: string
  sku: string | null
  category: string | null
  unit: string
  current_stock: number
  cost_price: number
  selling_price: number
  low_stock_threshold: number
  is_archived: number
  created_at: string
  updated_at: string
}

// Internal row shape returned by better-sqlite3 for stock_movements
interface MovementRow {
  id: string
  product_id: string
  user_id: string
  change_amount: number
  type: 'restock' | 'sale' | 'damage' | 'adjustment'
  note: string | null
  created_at: string
}

function rowToMovement(row: MovementRow): StockMovement {
  return {
    id: row.id,
    productId: row.product_id,
    userId: row.user_id,
    changeAmount: row.change_amount,
    type: row.type,
    note: row.note,
    createdAt: row.created_at,
  }
}

/**
 * Create a stock movement and atomically update product.current_stock.
 * Alert engine integration is deferred to task 6.2.
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.10, 9.3, 11.4
 */
export function createMovement(
  shopId: string,
  userId: string,
  data: CreateMovementInput
): { movement: StockMovement; updatedProduct: ProductRow } {
  const { productId, changeAmount, type, note } = data

  // --- Validation (Requirements 2.4, 2.5, 2.2) ---

  // Restock must be positive (Requirement 2.4)
  if (type === 'restock' && changeAmount <= 0) {
    throw new AppError(400, 'Restock movements require a positive change amount')
  }

  // Sale and damage must be negative (Requirement 2.5)
  if ((type === 'sale' || type === 'damage') && changeAmount >= 0) {
    throw new AppError(400, 'Sale and damage movements require a negative change amount')
  }

  // Note required for damage and adjustment (Requirement 2.2)
  if ((type === 'damage' || type === 'adjustment') && (!note || note.trim() === '')) {
    throw new AppError(400, 'A note is required for damage and adjustment movements')
  }

  // --- Transaction: fetch product, check stock, insert movement, update stock ---
  const result = db.transaction(() => {
    // 1. Fetch the product scoped to the shop (Requirement 2.6)
    const product = db
      .prepare(
        'SELECT id, shop_id, current_stock FROM products WHERE id = ? AND shop_id = ? AND is_archived = 0'
      )
      .get(productId, shopId) as Pick<ProductRow, 'id' | 'shop_id' | 'current_stock'> | undefined

    if (!product) {
      throw new AppError(404, 'Product not found')
    }

    // 2. Ensure stock won't go below zero (Requirement 2.3, 9.3)
    const newStock = product.current_stock + changeAmount
    if (newStock < 0) {
      throw new AppError(
        400,
        `Cannot reduce stock below zero. Current stock: ${product.current_stock}.`
      )
    }

    // 3. Insert the stock movement row (Requirements 2.1, 2.10)
    const movementId = uuid()
    db.prepare(
      `INSERT INTO stock_movements (id, product_id, user_id, change_amount, type, note)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(movementId, productId, userId, changeAmount, type, note ?? null)

    // 4. Update products.current_stock (Requirements 2.1, 2.10)
    db.prepare(
      'UPDATE products SET current_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(newStock, productId)

    // 5. Check and fire/resolve alerts (Requirements 3.1–3.4)
    checkAndFireAlert(productId, shopId, db)

    // 6. Return the movement and the updated product row
    const movement = db
      .prepare('SELECT * FROM stock_movements WHERE id = ?')
      .get(movementId) as MovementRow

    const updatedProduct = db
      .prepare('SELECT * FROM products WHERE id = ?')
      .get(productId) as ProductRow

    return { movement: rowToMovement(movement), updatedProduct }
  })()

  return result
}

/**
 * List stock movements for a shop, optionally filtered by product and date range.
 * Requirements: 2.7, 2.8, 2.9
 */
export function listMovements(shopId: string, query: MovementListQuery): StockMovement[] {
  const { productId, from, to, limit = 50 } = query

  // Validate date range (Requirement 2.9)
  if (from && to && from > to) {
    throw new AppError(400, 'Invalid date range: from must be before to')
  }

  // Enforce max limit of 500 (Requirement 2.7)
  const effectiveLimit = Math.min(limit, 500)

  // Build parameterised query (Requirement 11.4)
  const conditions: string[] = ['p.shop_id = ?']
  const params: (string | number)[] = [shopId]

  if (productId) {
    conditions.push('sm.product_id = ?')
    params.push(productId)
  }

  if (from) {
    conditions.push('sm.created_at >= ?')
    params.push(from)
  }

  if (to) {
    conditions.push('sm.created_at <= ?')
    params.push(to)
  }

  const sql = `
    SELECT sm.*
    FROM stock_movements sm
    JOIN products p ON sm.product_id = p.id
    WHERE ${conditions.join(' AND ')}
    ORDER BY sm.created_at DESC
    LIMIT ?
  `
  params.push(effectiveLimit)

  const rows = db.prepare(sql).all(params) as MovementRow[]
  return rows.map(rowToMovement)
}
