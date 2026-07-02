import { v4 as uuidv4 } from 'uuid'
import { db } from '../db/database'
import { AppError } from '../utils/errors'
import { classifyStockStatus } from '../utils/classifyStockStatus'
import type { StockStatus } from '../utils/classifyStockStatus'
import type { CreateProductInput, UpdateProductInput, ProductListQuery } from '../schemas/product.schema'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Product {
  id: string
  shopId: string
  name: string
  sku: string | null
  category: string | null
  unit: string
  currentStock: number
  costPrice: number
  sellingPrice: number
  lowStockThreshold: number
  isArchived: boolean
  createdAt: string
  updatedAt: string
  stockStatus: StockStatus // computed, not stored
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

// ─── Internal DB row type ────────────────────────────────────────────────────

interface ProductRow {
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

// ─── Helper: map DB row → Product ───────────────────────────────────────────

/**
 * Converts a snake_case database row to a camelCase Product object,
 * adding the computed stockStatus field.
 */
function mapProductRow(row: ProductRow): Product {
  return {
    id: row.id,
    shopId: row.shop_id,
    name: row.name,
    sku: row.sku,
    category: row.category,
    unit: row.unit,
    currentStock: row.current_stock,
    costPrice: row.cost_price,
    sellingPrice: row.selling_price,
    lowStockThreshold: row.low_stock_threshold,
    isArchived: row.is_archived === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    stockStatus: classifyStockStatus(row.current_stock, row.low_stock_threshold),
  }
}

// ─── Whitelist for sortBy to prevent SQL injection ───────────────────────────

const VALID_SORT_FIELDS = new Set([
  'name',
  'current_stock',
  'low_stock_threshold',
  'cost_price',
  'selling_price',
  'created_at',
])

// ─── Service Functions ───────────────────────────────────────────────────────

/**
 * Create a new product in the given shop.
 * Requirements: 1.1
 */
export function createProduct(shopId: string, data: CreateProductInput): Product {
  const id = uuidv4()

  db.prepare(
    `INSERT INTO products
       (id, shop_id, name, sku, category, unit, current_stock, cost_price, selling_price, low_stock_threshold)
     VALUES
       (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    shopId,
    data.name,
    data.sku ?? null,
    data.category ?? null,
    data.unit,
    data.currentStock,
    data.costPrice,
    data.sellingPrice,
    data.lowStockThreshold
  )

  const row = db
    .prepare('SELECT * FROM products WHERE id = ?')
    .get(id) as ProductRow

  return mapProductRow(row)
}

/**
 * List products for a shop with filtering, sorting, and pagination.
 * Requirements: 1.3–1.7
 */
export function listProducts(shopId: string, query: ProductListQuery): PaginatedResponse<Product> {
  const {
    search,
    category,
    sortBy = 'created_at',
    order = 'desc',
    page = 1,
    limit = 50,
  } = query

  // Validate sortBy against the whitelist to prevent SQL injection (Requirement 11.4)
  const safeSortBy = VALID_SORT_FIELDS.has(sortBy) ? sortBy : 'created_at'
  const safeOrder = order === 'asc' ? 'ASC' : 'DESC'

  // Build WHERE clause with parameterized values
  const conditions: string[] = ['shop_id = ?', 'is_archived = 0']
  const params: unknown[] = [shopId]

  if (search) {
    conditions.push('(name LIKE ? OR sku LIKE ?)')
    const wildcard = `%${search}%`
    params.push(wildcard, wildcard)
  }

  if (category) {
    conditions.push('LOWER(category) = LOWER(?)')
    params.push(category)
  }

  const whereClause = conditions.join(' AND ')

  // COUNT query for total (same WHERE, no LIMIT/OFFSET)
  const countRow = db
    .prepare(`SELECT COUNT(*) as count FROM products WHERE ${whereClause}`)
    .get(params) as { count: number }

  const total = countRow.count

  // Data query with ORDER BY and pagination
  const offset = (page - 1) * limit

  // Safe interpolation: safeSortBy and safeOrder are whitelisted/enum-restricted above
  const rows = db
    .prepare(
      `SELECT * FROM products
       WHERE ${whereClause}
       ORDER BY ${safeSortBy} ${safeOrder}
       LIMIT ? OFFSET ?`
    )
    .all([...params, limit, offset]) as ProductRow[]

  return {
    data: rows.map(mapProductRow),
    total,
    page,
    limit,
  }
}

/**
 * Get a single product by ID, scoped to the shop.
 * Requirements: 1.12, 1.13
 */
export function getProduct(shopId: string, id: string): Product {
  const row = db
    .prepare('SELECT * FROM products WHERE id = ? AND shop_id = ? AND is_archived = 0')
    .get(id, shopId) as ProductRow | undefined

  if (!row) {
    throw new AppError(404, 'Product not found')
  }

  return mapProductRow(row)
}

/**
 * Partially update a product. Only supplied fields are changed.
 * Requirements: 1.8, 1.9
 */
export function updateProduct(shopId: string, id: string, data: UpdateProductInput): Product {
  // Map camelCase input keys to snake_case DB columns
  const fieldMap: Record<string, string> = {
    name: 'name',
    sku: 'sku',
    category: 'category',
    unit: 'unit',
    currentStock: 'current_stock',
    costPrice: 'cost_price',
    sellingPrice: 'selling_price',
    lowStockThreshold: 'low_stock_threshold',
  }

  const setClauses: string[] = []
  const updateParams: unknown[] = []

  for (const [camelKey, snakeCol] of Object.entries(fieldMap)) {
    if (camelKey in data) {
      setClauses.push(`${snakeCol} = ?`)
      updateParams.push((data as Record<string, unknown>)[camelKey])
    }
  }

  // Always bump updated_at
  setClauses.push('updated_at = CURRENT_TIMESTAMP')

  // WHERE clause params
  updateParams.push(id, shopId)

  const result = db
    .prepare(
      `UPDATE products
       SET ${setClauses.join(', ')}
       WHERE id = ? AND shop_id = ? AND is_archived = 0`
    )
    .run(updateParams)

  if (result.changes === 0) {
    throw new AppError(404, 'Product not found')
  }

  const row = db
    .prepare('SELECT * FROM products WHERE id = ?')
    .get(id) as ProductRow

  return mapProductRow(row)
}

/**
 * Soft-delete (archive) a product.
 * Requirements: 1.10, 1.11
 */
export function archiveProduct(shopId: string, id: string): { success: true } {
  const result = db
    .prepare(
      `UPDATE products
       SET is_archived = 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND shop_id = ?`
    )
    .run(id, shopId)

  if (result.changes === 0) {
    throw new AppError(404, 'Product not found')
  }

  return { success: true }
}
