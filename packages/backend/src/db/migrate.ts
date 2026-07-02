import { db } from './database'

export function migrate(): void {
  // Shops (one per business)
  db.exec(`
    CREATE TABLE IF NOT EXISTS shops (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      owner_id    TEXT NOT NULL,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Users (owner + staff, scoped to a shop)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      shop_id       TEXT NOT NULL REFERENCES shops(id),
      name          TEXT NOT NULL,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL CHECK(role IN ('owner', 'staff')),
      is_active     INTEGER NOT NULL DEFAULT 1,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Products
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id                  TEXT PRIMARY KEY,
      shop_id             TEXT NOT NULL REFERENCES shops(id),
      name                TEXT NOT NULL,
      sku                 TEXT,
      category            TEXT,
      unit                TEXT NOT NULL DEFAULT 'unit',
      current_stock       REAL NOT NULL DEFAULT 0 CHECK(current_stock >= 0),
      cost_price          REAL NOT NULL DEFAULT 0,
      selling_price       REAL NOT NULL DEFAULT 0,
      low_stock_threshold REAL NOT NULL DEFAULT 10,
      is_archived         INTEGER NOT NULL DEFAULT 0,
      created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Stock Movements (audit log — never deleted)
  db.exec(`
    CREATE TABLE IF NOT EXISTS stock_movements (
      id            TEXT PRIMARY KEY,
      product_id    TEXT NOT NULL REFERENCES products(id),
      user_id       TEXT NOT NULL REFERENCES users(id),
      change_amount REAL NOT NULL,
      type          TEXT NOT NULL CHECK(type IN ('restock','sale','damage','adjustment')),
      note          TEXT,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Alerts
  db.exec(`
    CREATE TABLE IF NOT EXISTS alerts (
      id           TEXT PRIMARY KEY,
      shop_id      TEXT NOT NULL REFERENCES shops(id),
      product_id   TEXT NOT NULL REFERENCES products(id),
      triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at  DATETIME,
      status       TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','ordered','dismissed','resolved'))
    )
  `)

  // Notifications (powers the bell icon)
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id         TEXT PRIMARY KEY,
      shop_id    TEXT NOT NULL REFERENCES shops(id),
      alert_id   TEXT REFERENCES alerts(id),
      message    TEXT NOT NULL,
      is_read    INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Partial unique index for alert deduplication (Requirements 3.4, 10.5)
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS unique_open_alert
    ON alerts(product_id) WHERE status = 'open'
  `)

  // Performance indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_products_shop_id ON products(shop_id)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_movements_product_created ON stock_movements(product_id, created_at)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_alerts_product_status ON alerts(product_id, status)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_notifications_shop_read ON notifications(shop_id, is_read)`)
}
