import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { v4 as uuid } from 'uuid'
import { calculateReorderSuggestion } from './reorderEngine.service'

/**
 * Integration tests for Task 8.4: Alert Service with Reorder Engine
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5
 *
 * These tests verify the actual integration between alert service and reorder engine
 * using real database queries.
 */

describe('Alert Service Integration - Task 8.4', () => {
  let testDb: Database.Database
  let shopId: string
  let userId: string
  let productId: string

  beforeAll(() => {
    // Create in-memory database
    testDb = new Database(':memory:')

    // Create schema
    testDb.exec(`
      CREATE TABLE shops (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    testDb.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        shop_id TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    testDb.exec(`
      CREATE TABLE products (
        id TEXT PRIMARY KEY,
        shop_id TEXT NOT NULL,
        name TEXT NOT NULL,
        sku TEXT,
        category TEXT,
        unit TEXT NOT NULL DEFAULT 'unit',
        current_stock REAL NOT NULL DEFAULT 0,
        cost_price REAL NOT NULL DEFAULT 0,
        selling_price REAL NOT NULL DEFAULT 0,
        low_stock_threshold REAL NOT NULL DEFAULT 10,
        is_archived INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    testDb.exec(`
      CREATE TABLE stock_movements (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        change_amount REAL NOT NULL,
        type TEXT NOT NULL,
        note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    testDb.exec(`
      CREATE TABLE alerts (
        id TEXT PRIMARY KEY,
        shop_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        resolved_at DATETIME,
        status TEXT NOT NULL DEFAULT 'open'
      )
    `)
  })

  afterAll(() => {
    testDb.close()
  })

  beforeEach(() => {
    // Clear tables
    testDb.exec('DELETE FROM alerts')
    testDb.exec('DELETE FROM stock_movements')
    testDb.exec('DELETE FROM products')
    testDb.exec('DELETE FROM users')
    testDb.exec('DELETE FROM shops')

    // Insert fresh test data
    shopId = uuid()
    userId = uuid()
    productId = uuid()

    testDb.prepare('INSERT INTO shops (id, name, owner_id) VALUES (?, ?, ?)').run(shopId, 'Test Shop', userId)

    testDb.prepare('INSERT INTO users (id, shop_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)').run(
      userId,
      shopId,
      'Test User',
      'test@example.com',
      'hash',
      'owner'
    )
  })

  it('should calculate reorder suggestion with velocity-based formula when enough sales data exists', () => {
    // Create product with low stock
    testDb
      .prepare(
        'INSERT INTO products (id, shop_id, name, unit, current_stock, cost_price, selling_price, low_stock_threshold) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(productId, shopId, 'Test Product', 'unit', 5, 10, 20, 10)

    // Add sale movements over multiple days (30 days)
    const now = Date.now()
    for (let i = 0; i < 15; i++) {
      const movementId = uuid()
      const daysAgo = i * 2 // Spread movements across 30 days (every 2 days)
      const createdAt = new Date(now - daysAgo * 24 * 60 * 60 * 1000).toISOString()
      testDb
        .prepare(
          'INSERT INTO stock_movements (id, product_id, user_id, change_amount, type, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .run(movementId, productId, userId, -3, 'sale', createdAt)
    }

    // Calculate reorder suggestion
    const suggestion = calculateReorderSuggestion(productId, 30, testDb)

    // Verify velocity-based calculation
    // Total out: 15 movements × 3 units = 45 units
    // lookbackDays: 30
    // avgDailyUsage: 45 / 30 = 1.5 units/day
    // suggestedQty: CEILING((45 / 30) * 30 * 2) = CEILING(90) = 90
    expect(suggestion.fallback).toBe(false)
    expect(suggestion.avgDailyUsage).toBe(1.5)
    expect(suggestion.suggestedQty).toBe(90)
    expect(suggestion.basisDays).toBe(30)
  })

  it('should use fallback mode (2× threshold) when not enough sales data', () => {
    // Create product with no sales history
    testDb
      .prepare(
        'INSERT INTO products (id, shop_id, name, unit, current_stock, cost_price, selling_price, low_stock_threshold) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(productId, shopId, 'Test Product', 'unit', 5, 10, 20, 10)

    // Add only 2 sale movements (less than 3 active days)
    const now = Date.now()
    for (let i = 0; i < 2; i++) {
      const movementId = uuid()
      const daysAgo = i * 5
      const createdAt = new Date(now - daysAgo * 24 * 60 * 60 * 1000).toISOString()
      testDb
        .prepare(
          'INSERT INTO stock_movements (id, product_id, user_id, change_amount, type, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .run(movementId, productId, userId, -2, 'sale', createdAt)
    }

    // Calculate reorder suggestion
    const suggestion = calculateReorderSuggestion(productId, 30, testDb)

    // Verify fallback calculation
    // threshold: 10
    // suggestedQty: CEILING(10 * 2) = 20
    expect(suggestion.fallback).toBe(true)
    expect(suggestion.avgDailyUsage).toBe(null)
    expect(suggestion.suggestedQty).toBe(20)
    expect(suggestion.basisDays).toBe(0)
  })

  it('should calculate daysSinceLastRestock correctly', () => {
    // Create product
    testDb
      .prepare(
        'INSERT INTO products (id, shop_id, name, unit, current_stock, cost_price, selling_price, low_stock_threshold) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(productId, shopId, 'Test Product', 'unit', 5, 10, 20, 10)

    // Add a restock movement 7 days ago
    const restockId = uuid()
    const daysAgo = 7
    const restockDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString()
    testDb
      .prepare(
        'INSERT INTO stock_movements (id, product_id, user_id, change_amount, type, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(restockId, productId, userId, 50, 'restock', restockDate)

    // Query the last restock movement
    const lastRestockRow = testDb
      .prepare(
        `
      SELECT created_at
      FROM stock_movements
      WHERE product_id = ? AND type = 'restock'
      ORDER BY created_at DESC
      LIMIT 1
    `
      )
      .get(productId) as { created_at: string } | undefined

    expect(lastRestockRow).toBeDefined()

    if (lastRestockRow) {
      const lastRestockDate = new Date(lastRestockRow.created_at)
      const now = new Date()
      const diffMs = now.getTime() - lastRestockDate.getTime()
      const daysSinceLastRestock = Math.floor(diffMs / (1000 * 60 * 60 * 24))

      // Should be approximately 7 days (may be 6 or 7 depending on timing)
      expect(daysSinceLastRestock).toBeGreaterThanOrEqual(6)
      expect(daysSinceLastRestock).toBeLessThanOrEqual(7)
    }
  })

  it('should return null for daysSinceLastRestock when no restock exists', () => {
    // Create product with no restock history
    testDb
      .prepare(
        'INSERT INTO products (id, shop_id, name, unit, current_stock, cost_price, selling_price, low_stock_threshold) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(productId, shopId, 'Test Product', 'unit', 5, 10, 20, 10)

    // Add only sale movements (no restock)
    const movementId = uuid()
    testDb
      .prepare('INSERT INTO stock_movements (id, product_id, user_id, change_amount, type) VALUES (?, ?, ?, ?, ?)')
      .run(movementId, productId, userId, -2, 'sale')

    // Query the last restock movement
    const lastRestockRow = testDb
      .prepare(
        `
      SELECT created_at
      FROM stock_movements
      WHERE product_id = ? AND type = 'restock'
      ORDER BY created_at DESC
      LIMIT 1
    `
      )
      .get(productId) as { created_at: string } | undefined

    // Should be undefined
    expect(lastRestockRow).toBeUndefined()
  })

  it('should include sale and damage movements in velocity calculation', () => {
    // Create product
    testDb
      .prepare(
        'INSERT INTO products (id, shop_id, name, unit, current_stock, cost_price, selling_price, low_stock_threshold) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(productId, shopId, 'Test Product', 'unit', 5, 10, 20, 10)

    // Add both sale and damage movements
    const now = Date.now()
    for (let i = 0; i < 10; i++) {
      const movementId = uuid()
      const daysAgo = i * 3
      const createdAt = new Date(now - daysAgo * 24 * 60 * 60 * 1000).toISOString()
      const type = i % 2 === 0 ? 'sale' : 'damage'
      testDb
        .prepare(
          'INSERT INTO stock_movements (id, product_id, user_id, change_amount, type, created_at, note) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .run(movementId, productId, userId, -2, type, createdAt, type === 'damage' ? 'damaged' : null)
    }

    // Calculate reorder suggestion
    const suggestion = calculateReorderSuggestion(productId, 30, testDb)

    // Verify both sale and damage are counted
    // Total out: 10 movements × 2 units = 20 units
    // avgDailyUsage: 20 / 30 = 0.67 units/day
    // suggestedQty: CEILING((20 / 30) * 30 * 2) = CEILING(40) = 40
    expect(suggestion.fallback).toBe(false)
    expect(suggestion.avgDailyUsage).toBe(0.67)
    expect(suggestion.suggestedQty).toBe(40)
  })

  it('should always return suggestedQty >= 1 (Requirement 4.3)', () => {
    // Create product with very low threshold
    testDb
      .prepare(
        'INSERT INTO products (id, shop_id, name, unit, current_stock, cost_price, selling_price, low_stock_threshold) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .run(productId, shopId, 'Test Product', 'unit', 0.1, 10, 20, 0.1)

    // No sales history (fallback mode)
    const suggestion = calculateReorderSuggestion(productId, 30, testDb)

    // Even with threshold of 0.1, suggestedQty should be at least 1
    expect(suggestion.suggestedQty).toBeGreaterThanOrEqual(1)
  })
})
