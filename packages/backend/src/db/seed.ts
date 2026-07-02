import { v4 as uuidv4 } from 'uuid'
import bcrypt from 'bcrypt'
import { db } from './database'
import { migrate } from './migrate'

const BCRYPT_COST = 12

async function seed(): Promise<void> {
  // Run migrations first so it's safe to run seed standalone
  migrate()
  console.log('✅ Migrations applied')

  // ── Seed shop ──────────────────────────────────────────────────────────────
  const shopId = 'shop-test-1'
  const existingShop = db.prepare('SELECT id FROM shops WHERE id = ?').get(shopId)

  if (!existingShop) {
    db.prepare(`
      INSERT INTO shops (id, name, owner_id)
      VALUES (?, ?, ?)
    `).run(shopId, 'Demo Shop', 'user-owner-1')
    console.log('✅ Inserted demo shop')
  } else {
    console.log('⏭️  Demo shop already exists, skipping')
  }

  // ── Seed owner user ────────────────────────────────────────────────────────
  const ownerId = 'user-owner-1'
  const existingOwner = db.prepare('SELECT id FROM users WHERE id = ?').get(ownerId)

  if (!existingOwner) {
    const ownerHash = await bcrypt.hash('password123', BCRYPT_COST)
    db.prepare(`
      INSERT INTO users (id, shop_id, name, email, password_hash, role)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(ownerId, shopId, 'Alice Owner', 'alice@demo.com', ownerHash, 'owner')
    console.log('✅ Inserted owner user (Alice)')
  } else {
    console.log('⏭️  Owner user already exists, skipping')
  }

  // ── Seed staff user ────────────────────────────────────────────────────────
  const staffId = 'user-staff-1'
  const existingStaff = db.prepare('SELECT id FROM users WHERE id = ?').get(staffId)

  if (!existingStaff) {
    const staffHash = await bcrypt.hash('password123', BCRYPT_COST)
    db.prepare(`
      INSERT INTO users (id, shop_id, name, email, password_hash, role)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(staffId, shopId, 'Bob Staff', 'bob@demo.com', staffHash, 'staff')
    console.log('✅ Inserted staff user (Bob)')
  } else {
    console.log('⏭️  Staff user already exists, skipping')
  }

  // ── Seed products ──────────────────────────────────────────────────────────
  // Stock levels are chosen to exercise the alert engine:
  //   Rice:        current=5,  threshold=20  → critical (5 <= 20)
  //   Cooking Oil: current=100,threshold=30  → healthy  (100 > 30*1.2=36)
  //   Sugar:       current=0,  threshold=10  → zero
  //   Salt:        current=12, threshold=10  → warning  (10 < 12 <= 10*1.2=12)
  //   Flour:       current=50, threshold=15  → healthy  (50 > 15*1.2=18)

  const products = [
    {
      id: uuidv4(),
      name: 'Rice',
      unit: 'kg',
      category: 'Grains',
      current_stock: 5,
      low_stock_threshold: 20,
      cost_price: 1.5,
      selling_price: 2.0,
    },
    {
      id: uuidv4(),
      name: 'Cooking Oil',
      unit: 'litre',
      category: 'Oils',
      current_stock: 100,
      low_stock_threshold: 30,
      cost_price: 2.0,
      selling_price: 3.0,
    },
    {
      id: uuidv4(),
      name: 'Sugar',
      unit: 'kg',
      category: 'Baking',
      current_stock: 0,
      low_stock_threshold: 10,
      cost_price: 0.8,
      selling_price: 1.2,
    },
    {
      id: uuidv4(),
      name: 'Salt',
      unit: 'kg',
      category: 'Condiments',
      current_stock: 12,
      low_stock_threshold: 10,
      cost_price: 0.5,
      selling_price: 0.9,
    },
    {
      id: uuidv4(),
      name: 'Flour',
      unit: 'kg',
      category: 'Baking',
      current_stock: 50,
      low_stock_threshold: 15,
      cost_price: 1.0,
      selling_price: 1.5,
    },
  ]

  const checkProduct = db.prepare('SELECT id FROM products WHERE shop_id = ? AND name = ?')
  const insertProduct = db.prepare(`
    INSERT INTO products
      (id, shop_id, name, unit, category, current_stock, low_stock_threshold, cost_price, selling_price)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  for (const p of products) {
    const existing = checkProduct.get(shopId, p.name)
    if (!existing) {
      insertProduct.run(
        p.id,
        shopId,
        p.name,
        p.unit,
        p.category,
        p.current_stock,
        p.low_stock_threshold,
        p.cost_price,
        p.selling_price,
      )
      console.log(`✅ Inserted product: ${p.name}`)
    } else {
      console.log(`⏭️  Product "${p.name}" already exists, skipping`)
    }
  }

  console.log('\n🎉 Seed complete!')
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
