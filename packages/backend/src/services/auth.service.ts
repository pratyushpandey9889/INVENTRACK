import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../db/database'
import type { RegisterInput, LoginInput } from '../schemas/auth.schema'
import { AppError } from '../utils/errors'

// Requirements: 7.1, 7.13
export interface UserPublic {
  id: string
  shopId: string
  name: string
  email: string
  role: 'owner' | 'staff'
}

export interface AuthResponse {
  token: string
  user: UserPublic
}

// Internal row types for DB results
interface UserRow {
  id: string
  shop_id: string
  name: string
  email: string
  password_hash: string
  role: 'owner' | 'staff'
  is_active: number
}

/**
 * Register a new shop owner.
 * Requirements: 7.1, 7.2, 7.3, 11.1, 11.2
 */
export async function register(data: RegisterInput): Promise<AuthResponse> {
  const { name, email, password, shopName } = data

  // 1. Check for duplicate email (Requirement 7.3)
  const existing = db
    .prepare('SELECT id FROM users WHERE email = ?')
    .get(email)
  if (existing) {
    throw new AppError(409, 'Email already in use')
  }

  // 2. Generate IDs
  const shopId = uuidv4()
  const userId = uuidv4()

  // 3. Hash password with bcrypt cost 12 (Requirement 11.1)
  const passwordHash = await bcrypt.hash(password, 12)

  // 4 & 5. Insert shop and user inside a transaction (Requirement 11.4)
  const insertShopAndUser = db.transaction(() => {
    db.prepare(
      'INSERT INTO shops (id, name, owner_id) VALUES (?, ?, ?)'
    ).run(shopId, shopName, userId)

    db.prepare(
      `INSERT INTO users (id, shop_id, name, email, password_hash, role)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(userId, shopId, name, email, passwordHash, 'owner')
  })

  insertShopAndUser()

  // 6. Sign JWT (Requirement 11.2, 7.4)
  const token = jwt.sign(
    { userId, shopId, role: 'owner' },
    process.env.JWT_SECRET!,
    { expiresIn: '24h' }
  )

  // 7. Return token + public user object
  return {
    token,
    user: { id: userId, shopId, name, email, role: 'owner' },
  }
}

/**
 * Log in an existing user.
 * Requirements: 7.4, 7.5, 11.1
 */
export async function login(data: LoginInput): Promise<AuthResponse> {
  const { email, password } = data

  // 1. Find user by email
  const user = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(email) as UserRow | undefined

  // 2. Return 401 for missing user or inactive account (Requirement 7.11)
  if (!user || user.is_active === 0) {
    throw new AppError(401, 'Invalid credentials')
  }

  // 3. Compare password
  const passwordMatch = await bcrypt.compare(password, user.password_hash)

  // 4. Return 401 for wrong password — same message to prevent enumeration (Requirement 7.5)
  if (!passwordMatch) {
    throw new AppError(401, 'Invalid credentials')
  }

  // 5. Sign JWT
  const token = jwt.sign(
    { userId: user.id, shopId: user.shop_id, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: '24h' }
  )

  // 6. Return token + public user object
  return {
    token,
    user: {
      id: user.id,
      shopId: user.shop_id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  }
}

/**
 * Return the public profile of an authenticated user.
 * Requirements: 7.13
 */
export function getMe(userId: string): UserPublic {
  const user = db
    .prepare('SELECT id, shop_id, name, email, role FROM users WHERE id = ?')
    .get(userId) as { id: string; shop_id: string; name: string; email: string; role: 'owner' | 'staff' } | undefined

  if (!user) {
    throw new AppError(404, 'User not found')
  }

  return {
    id: user.id,
    shopId: user.shop_id,
    name: user.name,
    email: user.email,
    role: user.role,
  }
}
