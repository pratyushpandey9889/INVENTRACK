import bcrypt from 'bcrypt'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../db/database'
import type { CreateStaffInput, UpdateStaffInput } from '../schemas/user.schema'
import { AppError } from '../utils/errors'

// Requirements: 7.7, 7.10, 7.13
export interface StaffUser {
  id: string
  shopId: string
  name: string
  email: string
  role: 'staff'
  createdAt: string
}

// Internal DB row type
interface UserRow {
  id: string
  shop_id: string
  name: string
  email: string
  role: 'owner' | 'staff'
  is_active: number
  created_at: string
}

function rowToStaffUser(row: UserRow): StaffUser {
  return {
    id: row.id,
    shopId: row.shop_id,
    name: row.name,
    email: row.email,
    role: 'staff',
    createdAt: row.created_at,
  }
}

/**
 * List all staff accounts for the given shop.
 * Never returns password_hash.
 * Requirements: 7.10
 */
export function listStaff(shopId: string): StaffUser[] {
  const rows = db
    .prepare(
      `SELECT id, shop_id, name, email, role, is_active, created_at
       FROM users
       WHERE shop_id = ? AND role = 'staff'
       ORDER BY created_at ASC`
    )
    .all(shopId) as UserRow[]

  return rows.map(rowToStaffUser)
}

/**
 * Create a new staff account for the given shop.
 * Hashes password with bcrypt cost 12.
 * Throws 409 on duplicate email.
 * Requirements: 7.7, 7.8, 11.1
 */
export async function createStaff(
  shopId: string,
  data: CreateStaffInput
): Promise<StaffUser> {
  const { name, email, password } = data

  // Check for duplicate email across the whole system (Requirement 7.8)
  const existing = db
    .prepare('SELECT id FROM users WHERE email = ?')
    .get(email)
  if (existing) {
    throw new AppError(409, 'Email already in use')
  }

  const userId = uuidv4()

  // Hash password with bcrypt cost 12 (Requirement 11.1)
  const passwordHash = await bcrypt.hash(password, 12)

  db.prepare(
    `INSERT INTO users (id, shop_id, name, email, password_hash, role, is_active)
     VALUES (?, ?, ?, ?, ?, 'staff', 1)`
  ).run(userId, shopId, name, email, passwordHash)

  return {
    id: userId,
    shopId,
    name,
    email,
    role: 'staff',
    createdAt: new Date().toISOString(),
  }
}

/**
 * Update name and/or email for a staff member belonging to the shop.
 * Throws 404 if the staff member is not found in the shop.
 * Requirements: 7.7, 7.9
 */
export async function updateStaff(
  shopId: string,
  id: string,
  data: UpdateStaffInput
): Promise<StaffUser> {
  // Verify the user exists in this shop and is a staff member
  const existing = db
    .prepare(
      `SELECT id, shop_id, name, email, role, is_active, created_at
       FROM users
       WHERE id = ? AND shop_id = ? AND role = 'staff'`
    )
    .get(id, shopId) as UserRow | undefined

  if (!existing) {
    throw new AppError(404, 'Staff member not found')
  }

  // If updating email, check for duplicates (Requirement 7.8)
  if (data.email && data.email !== existing.email) {
    const emailTaken = db
      .prepare('SELECT id FROM users WHERE email = ? AND id != ?')
      .get(data.email, id)
    if (emailTaken) {
      throw new AppError(409, 'Email already in use')
    }
  }

  const newName = data.name ?? existing.name
  const newEmail = data.email ?? existing.email

  db.prepare(
    `UPDATE users SET name = ?, email = ? WHERE id = ? AND shop_id = ? AND role = 'staff'`
  ).run(newName, newEmail, id, shopId)

  return rowToStaffUser({
    ...existing,
    name: newName,
    email: newEmail,
  })
}

/**
 * Deactivate a staff account so subsequent logins return 401.
 * Sets is_active = 0 — the auth service login already checks this column.
 * Throws 404 if the staff member is not found in the shop.
 * Requirements: 7.11, 7.12
 */
export function deactivateStaff(shopId: string, id: string): { success: true } {
  // Verify the user exists in this shop and is a staff member
  const existing = db
    .prepare(
      `SELECT id FROM users WHERE id = ? AND shop_id = ? AND role = 'staff'`
    )
    .get(id, shopId)

  if (!existing) {
    throw new AppError(404, 'Staff member not found')
  }

  db.prepare(
    `UPDATE users SET is_active = 0 WHERE id = ? AND shop_id = ? AND role = 'staff'`
  ).run(id, shopId)

  return { success: true }
}
