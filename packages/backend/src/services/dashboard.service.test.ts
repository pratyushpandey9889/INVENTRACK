import { describe, it, expect, beforeEach } from 'vitest'
import { v4 as uuid } from 'uuid'
import { db } from '../db/database'
import { getDashboardSummary } from './dashboard.service'
import bcrypt from 'bcrypt'

describe('Dashboard Service', () => {
  let shopId: string
  let userId: string
  let productId1: string
  let productId2: string
  let productId3: string

  beforeEach(() => {
    // Clean up test data
    db.exec('DELETE FROM notifications')
    db.exec('DELETE FROM alerts')
    db.exec('DELETE FROM stock_movements')
    db.exec('DELETE FROM products')
    db.exec('DELETE FROM users')
    db.exec('DELETE FROM shops')

    // Create test shop and owner
    shopId = uuid()
    userId = uuid()

    db.prepare(
      'INSERT INTO shops (id, name, owner_id) VALUES (?, ?, ?)'
    ).run(shopId, 'Test Shop', userId)

    const passwordHash = bcrypt.hashSync('password123', 12)
    db.prepare(
      'INSERT INTO users (id, shop_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(userId, shopId, 'Test Owner', 'owner@test.com', passwordHash, 'owner')

    // Create test products with different stock states
    productId1 = uuid()
    productId2 = uuid()
    productId3 = uuid()

    // Product 1: zero stock (most urgent)
    db.prepare(
      `INSERT INTO products (id, shop_id, name, unit, current_stock, cost_price, selling_price, low_stock_threshold)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(productId1, shopId, 'Product Zero', 'unit', 0, 10, 20, 5)

    // Product 2: low stock (critical)
    db.prepare(
      `INSERT INTO products (id, shop_id, name, unit, current_stock, cost_price, selling_price, low_stock_threshold)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(productId2, shopId, 'Product Low', 'unit', 3, 15, 30, 10)

    // Product 3: healthy stock
    db.prepare(
      `INSERT INTO products (id, shop_id, name, unit, current_stock, cost_price, selling_price, low_stock_threshold)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(productId3, shopId, 'Product Healthy', 'unit', 50, 5, 10, 10)

    // Create open alerts for low/zero stock products
    const alert1Id = uuid()
    const alert2Id = uuid()

    db.prepare(
      `INSERT INTO alerts (id, shop_id, product_id, status, triggered_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(alert1Id, shopId, productId1, 'open', new Date().toISOString())

    db.prepare(
      `INSERT INTO alerts (id, shop_id, product_id, status, triggered_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(alert2Id, shopId, productId2, 'open', new Date().toISOString())

    // Create some stock movements
    const movement1Id = uuid()
    const movement2Id = uuid()

    db.prepare(
      `INSERT INTO stock_movements (id, product_id, user_id, change_amount, type, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(movement1Id, productId1, userId, -5, 'sale', new Date(Date.now() - 1000).toISOString())

    db.prepare(
      `INSERT INTO stock_movements (id, product_id, user_id, change_amount, type, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(movement2Id, productId2, userId, 10, 'restock', new Date().toISOString())
  })

  it('should calculate correct aggregate statistics', () => {
    const summary = getDashboardSummary(shopId)

    expect(summary.totalProducts).toBe(3)
    expect(summary.lowStockCount).toBe(2) // Products 1 and 2
    expect(summary.zeroStockCount).toBe(1) // Product 1
    
    // totalInventoryValue = (0 * 10) + (3 * 15) + (50 * 5) = 0 + 45 + 250 = 295
    expect(summary.totalInventoryValue).toBe(295)
  })

  it('should return urgent alerts ordered by severity', () => {
    const summary = getDashboardSummary(shopId)

    expect(summary.urgentAlerts).toHaveLength(2)
    
    // First alert should be the zero-stock product (most urgent)
    expect(summary.urgentAlerts[0].product.name).toBe('Product Zero')
    expect(summary.urgentAlerts[0].product.currentStock).toBe(0)
    
    // Second alert should be the low-stock product
    expect(summary.urgentAlerts[1].product.name).toBe('Product Low')
    expect(summary.urgentAlerts[1].product.currentStock).toBe(3)
  })

  it('should enrich alerts with reorder suggestions', () => {
    const summary = getDashboardSummary(shopId)

    expect(summary.urgentAlerts[0].suggestedReorderQty).toBeGreaterThan(0)
    expect(summary.urgentAlerts[0]).toHaveProperty('avgDailyUsage')
    expect(summary.urgentAlerts[0]).toHaveProperty('daysSinceLastRestock')
  })

  it('should return recent movements enriched with product and user names', () => {
    const summary = getDashboardSummary(shopId)

    expect(summary.recentMovements).toHaveLength(2)
    
    // Most recent movement should be the restock
    expect(summary.recentMovements[0].productName).toBe('Product Low')
    expect(summary.recentMovements[0].userName).toBe('Test Owner')
    expect(summary.recentMovements[0].type).toBe('restock')
    expect(summary.recentMovements[0].changeAmount).toBe(10)
    
    // Second movement should be the sale
    expect(summary.recentMovements[1].productName).toBe('Product Zero')
    expect(summary.recentMovements[1].type).toBe('sale')
  })

  it('should return empty arrays when no alerts or movements exist', () => {
    // Clean up alerts and movements
    db.exec('DELETE FROM alerts')
    db.exec('DELETE FROM stock_movements')

    const summary = getDashboardSummary(shopId)

    expect(summary.totalProducts).toBe(3)
    expect(summary.urgentAlerts).toHaveLength(0)
    expect(summary.recentMovements).toHaveLength(0)
  })

  it('should handle archived products correctly', () => {
    // Archive product 3
    db.prepare('UPDATE products SET is_archived = 1 WHERE id = ?').run(productId3)

    const summary = getDashboardSummary(shopId)

    // Should only count non-archived products
    expect(summary.totalProducts).toBe(2)
    expect(summary.lowStockCount).toBe(2)
    expect(summary.zeroStockCount).toBe(1)
    
    // totalInventoryValue = (0 * 10) + (3 * 15) = 45 (product 3 excluded)
    expect(summary.totalInventoryValue).toBe(45)
  })

  it('should limit urgent alerts to 5', () => {
    // Create 6 more products with low stock
    for (let i = 0; i < 6; i++) {
      const prodId = uuid()
      db.prepare(
        `INSERT INTO products (id, shop_id, name, unit, current_stock, cost_price, selling_price, low_stock_threshold)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(prodId, shopId, `Extra Product ${i}`, 'unit', 2, 10, 20, 5)

      const alertId = uuid()
      db.prepare(
        `INSERT INTO alerts (id, shop_id, product_id, status, triggered_at)
         VALUES (?, ?, ?, ?, ?)`
      ).run(alertId, shopId, prodId, 'open', new Date().toISOString())
    }

    const summary = getDashboardSummary(shopId)

    // Should return max 5 alerts
    expect(summary.urgentAlerts).toHaveLength(5)
  })

  it('should limit recent movements to 10', () => {
    // Create 12 more movements
    for (let i = 0; i < 12; i++) {
      const movementId = uuid()
      db.prepare(
        `INSERT INTO stock_movements (id, product_id, user_id, change_amount, type, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(movementId, productId3, userId, 1, 'adjustment', new Date(Date.now() - i * 1000).toISOString())
    }

    const summary = getDashboardSummary(shopId)

    // Should return max 10 movements
    expect(summary.recentMovements).toHaveLength(10)
  })
})
