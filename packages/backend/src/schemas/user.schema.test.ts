import { describe, it, expect } from 'vitest'
import { createStaffSchema, updateStaffSchema } from './user.schema'

describe('user.schema - createStaffSchema', () => {
  it('should validate a valid staff creation payload', () => {
    const validData = {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'securePassword123',
    }

    const result = createStaffSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it('should reject when name is missing', () => {
    const invalidData = {
      email: 'john@example.com',
      password: 'securePassword123',
    }

    const result = createStaffSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('name')
    }
  })

  it('should reject when name is empty string', () => {
    const invalidData = {
      name: '',
      email: 'john@example.com',
      password: 'securePassword123',
    }

    const result = createStaffSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Name is required')
    }
  })

  it('should reject when email is invalid', () => {
    const invalidData = {
      name: 'John Doe',
      email: 'not-an-email',
      password: 'securePassword123',
    }

    const result = createStaffSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Invalid email format')
    }
  })

  it('should reject when password is less than 8 characters', () => {
    const invalidData = {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'short',
    }

    const result = createStaffSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        'Password must be at least 8 characters'
      )
    }
  })

  it('should reject when password exceeds 72 characters', () => {
    const invalidData = {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'a'.repeat(73),
    }

    const result = createStaffSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        'Password must not exceed 72 characters'
      )
    }
  })

  it('should accept password of exactly 8 characters', () => {
    const validData = {
      name: 'John Doe',
      email: 'john@example.com',
      password: '12345678',
    }

    const result = createStaffSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it('should accept password of exactly 72 characters', () => {
    const validData = {
      name: 'John Doe',
      email: 'john@example.com',
      password: 'a'.repeat(72),
    }

    const result = createStaffSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })
})

describe('user.schema - updateStaffSchema', () => {
  it('should validate when both name and email are provided', () => {
    const validData = {
      name: 'Jane Doe',
      email: 'jane@example.com',
    }

    const result = updateStaffSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it('should validate when only name is provided', () => {
    const validData = {
      name: 'Jane Doe',
    }

    const result = updateStaffSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it('should validate when only email is provided', () => {
    const validData = {
      email: 'jane@example.com',
    }

    const result = updateStaffSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it('should validate when neither field is provided (empty update)', () => {
    const validData = {}

    const result = updateStaffSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it('should reject when name is empty string', () => {
    const invalidData = {
      name: '',
    }

    const result = updateStaffSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Name is required')
    }
  })

  it('should reject when email format is invalid', () => {
    const invalidData = {
      email: 'invalid-email',
    }

    const result = updateStaffSchema.safeParse(invalidData)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Invalid email format')
    }
  })
})
