import { v4 as uuid } from 'uuid'
import { Database as DatabaseType } from 'better-sqlite3'

/**
 * Algorithm 1: Check and fire/resolve alerts after a stock movement.
 * Must be called inside an existing db.transaction() with the updated stock already written.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */
export function checkAndFireAlert(productId: string, shopId: string, db: DatabaseType): void {
  // Load current state
  const product = db
    .prepare('SELECT current_stock, low_stock_threshold, name, unit FROM products WHERE id = ?')
    .get(productId) as { current_stock: number; low_stock_threshold: number; name: string; unit: string } | undefined

  if (!product) return

  // Check for existing open alert
  const openAlert = db
    .prepare("SELECT id FROM alerts WHERE product_id = ? AND status = 'open' LIMIT 1")
    .get(productId) as { id: string } | undefined

  if (product.current_stock <= product.low_stock_threshold) {
    // Stock is at or below threshold — alert needed
    if (!openAlert) {
      // No open alert exists: create one + a notification (Requirement 3.1)
      // Deduplication: skip if open alert already exists (Requirement 3.2)
      const newAlertId = uuid()
      db.prepare(
        "INSERT INTO alerts (id, shop_id, product_id, status) VALUES (?, ?, ?, 'open')"
      ).run(newAlertId, shopId, productId)

      const message = `${product.name} is low on stock: ${product.current_stock} ${product.unit} remaining`
      db.prepare(
        'INSERT INTO notifications (id, shop_id, alert_id, message, is_read) VALUES (?, ?, ?, ?, 0)'
      ).run(uuid(), shopId, newAlertId, message)
    }
    // ELSE: open alert already exists — do nothing (deduplication per Requirement 3.2)
  } else {
    // Stock is above threshold — resolve any open alert (Requirement 3.3)
    if (openAlert) {
      db.prepare(
        "UPDATE alerts SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).run(openAlert.id)
      // Mark associated notification as read (Requirement 3.3)
      db.prepare(
        'UPDATE notifications SET is_read = 1 WHERE alert_id = ?'
      ).run(openAlert.id)
    }
  }
}
