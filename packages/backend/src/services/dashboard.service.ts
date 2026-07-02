import { db } from '../db/database'
import { calculateReorderSuggestion } from './reorderEngine.service'
import type { AlertWithProduct } from './alert.service'
import type { StockMovement } from './movement.service'

// Requirements: 5.1, 5.2, 5.3

export interface DashboardSummary {
  totalProducts: number
  lowStockCount: number
  zeroStockCount: number
  totalInventoryValue: number
  urgentAlerts: AlertWithProduct[]
  recentMovements: (StockMovement & { productName: string; userName: string })[]
}

interface SummaryRow {
  total_products: number
  low_stock_count: number
  zero_stock_count: number
  total_inventory_value: number
}

interface AlertRow {
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
}

interface MovementRow {
  id: string
  product_id: string
  user_id: string
  change_amount: number
  type: 'restock' | 'sale' | 'damage' | 'adjustment'
  note: string | null
  created_at: string
  product_name: string
  user_name: string
}

/**
 * Get dashboard summary with aggregate statistics, urgent alerts, and recent activity.
 *
 * Returns:
 * - totalProducts: count of non-archived products
 * - lowStockCount: count of non-archived products where current_stock <= low_stock_threshold
 * - zeroStockCount: count of non-archived products where current_stock = 0
 * - totalInventoryValue: SUM(current_stock * cost_price) rounded to 2 decimal places
 * - urgentAlerts: top 5 open alerts ordered by severity (zero-stock first, then by ratio, then by triggered_at)
 * - recentMovements: last 10 movements enriched with productName and userName
 *
 * Requirements: 5.1, 5.2, 5.3
 */
export function getDashboardSummary(shopId: string): DashboardSummary {
  // Step 1: Calculate aggregate statistics (Requirement 5.1)
  const summaryRow = db
    .prepare(
      `SELECT
        COUNT(*) as total_products,
        SUM(CASE WHEN current_stock <= low_stock_threshold THEN 1 ELSE 0 END) as low_stock_count,
        SUM(CASE WHEN current_stock = 0 THEN 1 ELSE 0 END) as zero_stock_count,
        ROUND(SUM(current_stock * COALESCE(cost_price, 0)), 2) as total_inventory_value
      FROM products
      WHERE shop_id = ? AND is_archived = 0`
    )
    .get(shopId) as SummaryRow

  // Step 2: Fetch top 5 urgent alerts (Requirement 5.2)
  // Order by: zero-stock first, then by ascending current_stock/low_stock_threshold ratio, then by triggered_at
  const alertRows = db
    .prepare(
      `SELECT
        a.id,
        a.shop_id,
        a.product_id,
        a.triggered_at,
        a.resolved_at,
        a.status,
        p.name as product_name,
        p.sku as product_sku,
        p.current_stock as product_current_stock,
        p.low_stock_threshold as product_low_stock_threshold,
        p.unit as product_unit
      FROM alerts a
      INNER JOIN products p ON a.product_id = p.id
      WHERE a.shop_id = ? AND a.status = 'open'
      ORDER BY
        CASE WHEN p.current_stock = 0 THEN 0 ELSE 1 END ASC,
        (p.current_stock * 1.0 / p.low_stock_threshold) ASC,
        a.triggered_at ASC
      LIMIT 5`
    )
    .all(shopId) as AlertRow[]

  // Enrich alerts with reorder suggestions and days since last restock
  const urgentAlerts: AlertWithProduct[] = alertRows.map(row => {
    const reorderSuggestion = calculateReorderSuggestion(row.product_id, 30, db)

    // Calculate days since last restock
    const lastRestockRow = db
      .prepare(
        `SELECT created_at
        FROM stock_movements
        WHERE product_id = ? AND type = 'restock'
        ORDER BY created_at DESC
        LIMIT 1`
      )
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

  // Step 3: Fetch last 10 movements enriched with productName and userName (Requirement 5.3)
  const movementRows = db
    .prepare(
      `SELECT
        sm.id,
        sm.product_id,
        sm.user_id,
        sm.change_amount,
        sm.type,
        sm.note,
        sm.created_at,
        p.name as product_name,
        u.name as user_name
      FROM stock_movements sm
      INNER JOIN products p ON sm.product_id = p.id
      INNER JOIN users u ON sm.user_id = u.id
      WHERE p.shop_id = ?
      ORDER BY sm.created_at DESC
      LIMIT 10`
    )
    .all(shopId) as MovementRow[]

  const recentMovements: (StockMovement & { productName: string; userName: string })[] =
    movementRows.map(row => ({
      id: row.id,
      productId: row.product_id,
      userId: row.user_id,
      changeAmount: row.change_amount,
      type: row.type,
      note: row.note,
      createdAt: row.created_at,
      productName: row.product_name,
      userName: row.user_name,
    }))

  return {
    totalProducts: summaryRow.total_products ?? 0,
    lowStockCount: summaryRow.low_stock_count ?? 0,
    zeroStockCount: summaryRow.zero_stock_count ?? 0,
    totalInventoryValue: summaryRow.total_inventory_value ?? 0,
    urgentAlerts,
    recentMovements,
  }
}
