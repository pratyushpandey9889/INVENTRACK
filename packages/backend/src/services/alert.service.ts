import { db } from '../db/database'
import { AppError } from '../utils/errors'
import type { AlertListQuery } from '../schemas/alert.schema'
import type { PaginatedResponse } from './product.service'
import { calculateReorderSuggestion } from './reorderEngine.service'

// Requirements: 3.5, 3.6, 3.7, 3.8, 4.6, 4.7, 4.8

export interface Alert {
  id: string
  shopId: string
  productId: string
  triggeredAt: string
  resolvedAt: string | null
  status: 'open' | 'ordered' | 'dismissed' | 'resolved'
}

export interface AlertWithProduct extends Alert {
  product: {
    id: string
    name: string
    sku: string | null
    currentStock: number
    lowStockThreshold: number
    unit: string
  }
  suggestedReorderQty: number
  avgDailyUsage: number | null
  daysSinceLastRestock: number | null
}

interface AlertRow {
  id: string
  shop_id: string
  product_id: string
  triggered_at: string
  resolved_at: string | null
  status: 'open' | 'ordered' | 'dismissed' | 'resolved'
}

function rowToAlert(row: AlertRow): Alert {
  return {
    id: row.id,
    shopId: row.shop_id,
    productId: row.product_id,
    triggeredAt: row.triggered_at,
    resolvedAt: row.resolved_at,
    status: row.status,
  }
}

/**
 * List alerts for a shop with optional status filter and pagination.
 * Enriches each alert with product info and reorder suggestions.
 * Requirements: 3.5, 3.6, 10.3, 4.1, 4.2, 4.3, 4.4, 4.5
 */
export function listAlerts(shopId: string, query: AlertListQuery): PaginatedResponse<AlertWithProduct> {
  const { status, page = 1, limit = 20 } = query

  const conditions: string[] = ['a.shop_id = ?']
  const params: (string | number)[] = [shopId]

  if (status) {
    conditions.push('a.status = ?')
    params.push(status)
  }

  const whereClause = conditions.join(' AND ')

  // Count total alerts matching the filter
  const countRow = db
    .prepare(`SELECT COUNT(*) as count FROM alerts a WHERE ${whereClause}`)
    .get(params) as { count: number }

  // Fetch alerts with product info
  const offset = (page - 1) * limit
  const rows = db
    .prepare(`
      SELECT 
        a.id,
        a.shop_id,
        a.product_id,
        a.triggered_at,
        a.resolved_at,
        a.status,
        p.id as product_id,
        p.name as product_name,
        p.sku as product_sku,
        p.current_stock as product_current_stock,
        p.low_stock_threshold as product_low_stock_threshold,
        p.unit as product_unit
      FROM alerts a
      INNER JOIN products p ON a.product_id = p.id
      WHERE ${whereClause}
      ORDER BY a.triggered_at DESC
      LIMIT ? OFFSET ?
    `)
    .all([...params, limit, offset]) as Array<{
      id: string
      shop_id: string
      product_id: string
      triggered_at: string
      resolved_at: string | null
      status: 'open' | 'ordered' | 'dismissed' | 'resolved'
      product_name: string
      product_sku: string | null
      product_current_stock: number
      product_low_stock_threshold: number
      product_unit: string
    }>

  // Enrich each alert with reorder suggestions and days since last restock
  const enrichedAlerts: AlertWithProduct[] = rows.map(row => {
    // Calculate reorder suggestion using the reorder engine
    const reorderSuggestion = calculateReorderSuggestion(row.product_id, 30, db)

    // Calculate days since last restock
    const lastRestockRow = db
      .prepare(`
        SELECT created_at
        FROM stock_movements
        WHERE product_id = ? AND type = 'restock'
        ORDER BY created_at DESC
        LIMIT 1
      `)
      .get(row.product_id) as { created_at: string } | undefined

    let daysSinceLastRestock: number | null = null
    if (lastRestockRow) {
      const lastRestockDate = new Date(lastRestockRow.created_at)
      const now = new Date()
      const diffMs = now.getTime() - lastRestockDate.getTime()
      daysSinceLastRestock = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    }

    return {
      id: row.id,
      shopId: row.shop_id,
      productId: row.product_id,
      triggeredAt: row.triggered_at,
      resolvedAt: row.resolved_at,
      status: row.status,
      product: {
        id: row.product_id,
        name: row.product_name,
        sku: row.product_sku,
        currentStock: row.product_current_stock,
        lowStockThreshold: row.product_low_stock_threshold,
        unit: row.product_unit,
      },
      suggestedReorderQty: reorderSuggestion.suggestedQty,
      avgDailyUsage: reorderSuggestion.avgDailyUsage,
      daysSinceLastRestock,
    }
  })

  return {
    data: enrichedAlerts,
    total: countRow.count,
    page,
    limit,
  }
}

/**
 * Update an alert status to 'ordered' or 'dismissed'.
 * Requirements: 4.6, 4.7, 4.8
 */
export function updateAlertStatus(
  shopId: string,
  alertId: string,
  status: 'ordered' | 'dismissed'
): Alert {
  if (status !== 'ordered' && status !== 'dismissed') {
    throw new AppError(400, "Status must be 'ordered' or 'dismissed'")
  }

  const result = db
    .prepare('UPDATE alerts SET status = ? WHERE id = ? AND shop_id = ?')
    .run(status, alertId, shopId)

  if (result.changes === 0) {
    throw new AppError(404, 'Alert not found')
  }

  const row = db
    .prepare('SELECT * FROM alerts WHERE id = ?')
    .get(alertId) as AlertRow

  return rowToAlert(row)
}
