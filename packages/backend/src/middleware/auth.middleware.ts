import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

// Extend Express Request to carry the authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string
        shopId: string
        role: 'owner' | 'staff'
      }
    }
  }
}

/**
 * JWT authentication middleware.
 * Extracts and verifies the Bearer token from the Authorization header.
 * Attaches { userId, shopId, role } to req.user on success.
 * Requirements: 8.1, 8.2, 7.6
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization

  // Requirement 8.1: return 401 if no Authorization header or wrong format
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Authentication required' })
    return
  }

  const token = authHeader.slice(7) // strip "Bearer "

  try {
    // Requirement 8.2: verify JWT and extract claims
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string
      shopId: string
      role: 'owner' | 'staff'
    }

    req.user = {
      userId: payload.userId,
      shopId: payload.shopId,
      role: payload.role,
    }

    next()
  } catch (err) {
    // Requirement 7.6: specific message for expired tokens
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ message: 'Session expired. Please log in again.' })
      return
    }

    // All other JWT errors
    res.status(401).json({ message: 'Invalid token' })
  }
}
