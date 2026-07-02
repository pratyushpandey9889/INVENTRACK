import { Database as DatabaseType } from 'better-sqlite3'

/**
 * Return type for reorder suggestion calculations.
 * Requirements: 4.1, 4.2, 4.3
 */
export interface ReorderSuggestion {
  suggestedQty: number
  avgDailyUsage: number | null
  basisDays: number
  fallback: boolean
}

/**
 * Algorithm 2: Calculate reorder suggestion based on recent sales velocity.
 *
 * This function implements the exact logic from the design document:
 * - Query total outbound (sale + damage) movements in the lookback window
 * - Count distinct active days with movements
 * - If fewer than 3 active days OR zero total outbound: use fallback mode (2× threshold)
 * - Otherwise: calculate velocity-based suggestion = CEILING((totalOut / lookbackDays) * lookbackDays * 2)
 *
 * Requirements: 4.1, 4.2, 4.3
 *
 * @param productId The product to calculate suggestion for
 * @param lookbackDays Number of days to look back for movement history (default 30, min 14)
 * @param db Database handle (can be a transaction or the main db instance)
 * @returns ReorderSuggestion with suggestedQty, avgDailyUsage, basisDays, and fallback flag
 */
export function calculateReorderSuggestion(
  productId: string,
  lookbackDays: number = 30,
  db: DatabaseType
): ReorderSuggestion {
  // Ensure lookbackDays is at least 14
  const safeLookbackDays = Math.max(lookbackDays, 14)

  // Step 1: Fetch total outbound movements (sale + damage) in the lookback window
  const movementResult = db
    .prepare(
      `SELECT SUM(ABS(change_amount)) as total_out
       FROM stock_movements
       WHERE product_id = ?
         AND type IN ('sale', 'damage')
         AND created_at >= datetime('now', '-' || ? || ' days')`
    )
    .get(productId, safeLookbackDays) as { total_out: number | null }

  const totalOut = movementResult.total_out ?? 0

  // Step 2: Count distinct active days with sale/damage movements
  const activeDaysResult = db
    .prepare(
      `SELECT COUNT(DISTINCT DATE(created_at)) as days
       FROM stock_movements
       WHERE product_id = ?
         AND type IN ('sale', 'damage')
         AND created_at >= datetime('now', '-' || ? || ' days')`
    )
    .get(productId, safeLookbackDays) as { days: number }

  const activeDays = activeDaysResult.days

  // Step 3: Determine if we have enough data
  // Requirement 4.2: fewer than 3 active days OR zero total outbound → fallback mode
  if (activeDays < 3 || totalOut === 0) {
    // Fallback: not enough movement history, use 2× threshold
    const product = db
      .prepare('SELECT low_stock_threshold FROM products WHERE id = ?')
      .get(productId) as { low_stock_threshold: number } | undefined

    if (!product) {
      // Product not found, return minimal suggestion
      return {
        suggestedQty: 1,
        avgDailyUsage: null,
        basisDays: 0,
        fallback: true,
      }
    }

    // Requirement 4.2: MAX(1, CEILING(threshold * 2))
    // Requirement 4.3: suggestedQty must always be >= 1
    const suggestedQty = Math.max(1, Math.ceil(product.low_stock_threshold * 2))

    return {
      suggestedQty,
      avgDailyUsage: null,
      basisDays: 0,
      fallback: true,
    }
  }

  // Step 4: Calculate average daily usage
  // Requirement 4.1: totalOut / lookbackDays
  const avgDailyUsage = totalOut / safeLookbackDays

  // Step 5: Suggest enough stock for 2× lookback period (safety buffer)
  // Requirement 4.1: CEILING((totalOut / lookbackDays) * lookbackDays * 2)
  const suggestedQty = Math.ceil((totalOut / safeLookbackDays) * safeLookbackDays * 2)

  return {
    suggestedQty: Math.max(1, suggestedQty), // Requirement 4.3: always >= 1
    avgDailyUsage: Math.round(avgDailyUsage * 100) / 100, // Round to 2 decimal places
    basisDays: safeLookbackDays,
    fallback: false,
  }
}
