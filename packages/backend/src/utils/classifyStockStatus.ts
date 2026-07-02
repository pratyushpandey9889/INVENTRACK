export type StockStatus = 'zero' | 'critical' | 'warning' | 'healthy'

/**
 * Classifies a product's stock level into a status badge.
 * Algorithm 3 from the design document.
 * Requirements: 3.9–3.14
 *
 * @param currentStock - current stock quantity (>= 0)
 * @param threshold    - low stock threshold (> 0, or 0 as edge case)
 * @returns StockStatus
 */
export function classifyStockStatus(currentStock: number, threshold: number): StockStatus {
  // zero: stock is 0 regardless of threshold
  if (currentStock === 0) return 'zero'

  // critical: 0 < stock <= threshold
  if (currentStock <= threshold) return 'critical'

  // warning: threshold < stock <= threshold * 1.2
  if (currentStock <= threshold * 1.2) return 'warning'

  // healthy: stock > threshold * 1.2
  return 'healthy'
}
