import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { v4 as uuid } from 'uuid'
import { db } from '../db/database'
import { migrate } from '../db/migrate'
import { listNotifications, getUnreadCount, markRead } from './notification.service'

/**
 * Unit tests for notification.service.ts Task 9.1
 * Validates: Requirements 6.5, 6.6, 6.7
 */

describe('Notification Service', () => {
  let shopId: string
  let otherShopId: string

  beforeAll(() => {
    // Ensure all tables exist (idempotent)
    migrate()
  })

  beforeEach(() => {
    // Clean up test data
    db.exec('DELETE FROM notifications')
    db.exec('DELETE FROM alerts')
    db.exec('DELETE FROM stock_movements')
    db.exec('DELETE FROM products')
    db.exec('DELETE FROM users')
    db.exec('DELETE FROM shops')

    // Insert test shops
    shopId = uuid()
    otherShopId = uuid()
    db.prepare('INSERT INTO shops (id, name, owner_id) VALUES (?, ?, ?)').run(shopId, 'Test Shop', uuid())
    db.prepare('INSERT INTO shops (id, name, owner_id) VALUES (?, ?, ?)').run(otherShopId, 'Other Shop', uuid())
  })

  describe('listNotifications', () => {
    it('should return notifications for a shop ordered by created_at DESC', () => {
      const notif1Id = uuid()
      const notif2Id = uuid()
      const notif3Id = uuid()

      const now = Date.now()
      const time1 = new Date(now - 3000).toISOString()
      const time2 = new Date(now - 2000).toISOString()
      const time3 = new Date(now - 1000).toISOString()

      db.prepare(
        'INSERT INTO notifications (id, shop_id, alert_id, message, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(notif1Id, shopId, null, 'Oldest notification', 0, time1)

      db.prepare(
        'INSERT INTO notifications (id, shop_id, alert_id, message, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(notif2Id, shopId, null, 'Middle notification', 1, time2)

      db.prepare(
        'INSERT INTO notifications (id, shop_id, alert_id, message, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(notif3Id, shopId, null, 'Newest notification', 0, time3)

      const result = listNotifications(shopId)

      expect(result).toHaveLength(3)
      expect(result[0].id).toBe(notif3Id) // Newest first
      expect(result[1].id).toBe(notif2Id)
      expect(result[2].id).toBe(notif1Id) // Oldest last
      expect(result[0].message).toBe('Newest notification')
      expect(result[0].isRead).toBe(false)
      expect(result[1].isRead).toBe(true)
    })

    it('should respect the limit parameter', () => {
      for (let i = 0; i < 5; i++) {
        const time = new Date(Date.now() - (5 - i) * 1000).toISOString()
        db.prepare(
          'INSERT INTO notifications (id, shop_id, alert_id, message, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(uuid(), shopId, null, `Notification ${i}`, 0, time)
      }

      const result = listNotifications(shopId, 3)
      expect(result).toHaveLength(3)
    })

    it('should use default limit of 20', () => {
      for (let i = 0; i < 25; i++) {
        const time = new Date(Date.now() - (25 - i) * 1000).toISOString()
        db.prepare(
          'INSERT INTO notifications (id, shop_id, alert_id, message, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(uuid(), shopId, null, `Notification ${i}`, 0, time)
      }

      const result = listNotifications(shopId)
      expect(result).toHaveLength(20)
    })

    it('should only return notifications for the specified shop', () => {
      const notif1Id = uuid()
      const notif2Id = uuid()

      db.prepare(
        'INSERT INTO notifications (id, shop_id, alert_id, message, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(notif1Id, shopId, null, 'Shop 1 notification', 0, new Date().toISOString())

      db.prepare(
        'INSERT INTO notifications (id, shop_id, alert_id, message, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(notif2Id, otherShopId, null, 'Shop 2 notification', 0, new Date().toISOString())

      const result = listNotifications(shopId)
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe(notif1Id)
      expect(result[0].shopId).toBe(shopId)
    })

    it('should return empty array when shop has no notifications', () => {
      const result = listNotifications(shopId)
      expect(result).toEqual([])
    })

    it('should map row fields to camelCase correctly', () => {
      const notifId = uuid()
      db.prepare(
        'INSERT INTO notifications (id, shop_id, alert_id, message, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(notifId, shopId, null, 'Test message', 0, new Date().toISOString())

      const result = listNotifications(shopId)
      expect(result[0]).toMatchObject({
        id: notifId,
        shopId,
        alertId: null,
        message: 'Test message',
        isRead: false,
      })
      expect(typeof result[0].createdAt).toBe('string')
    })
  })

  describe('getUnreadCount', () => {
    it('should return count of unread notifications for a shop', () => {
      // 3 unread + 2 read
      for (let i = 0; i < 3; i++) {
        db.prepare(
          'INSERT INTO notifications (id, shop_id, alert_id, message, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(uuid(), shopId, null, `Unread ${i}`, 0, new Date().toISOString())
      }
      for (let i = 0; i < 2; i++) {
        db.prepare(
          'INSERT INTO notifications (id, shop_id, alert_id, message, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(uuid(), shopId, null, `Read ${i}`, 1, new Date().toISOString())
      }

      const result = getUnreadCount(shopId)
      expect(result).toEqual({ count: 3 })
    })

    it('should only count unread notifications for the specified shop', () => {
      db.prepare(
        'INSERT INTO notifications (id, shop_id, alert_id, message, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(uuid(), shopId, null, 'Shop 1 unread', 0, new Date().toISOString())

      db.prepare(
        'INSERT INTO notifications (id, shop_id, alert_id, message, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(uuid(), otherShopId, null, 'Shop 2 unread', 0, new Date().toISOString())

      const result = getUnreadCount(shopId)
      expect(result).toEqual({ count: 1 })
    })

    it('should return 0 when shop has no unread notifications', () => {
      db.prepare(
        'INSERT INTO notifications (id, shop_id, alert_id, message, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(uuid(), shopId, null, 'Read notification', 1, new Date().toISOString())

      const result = getUnreadCount(shopId)
      expect(result).toEqual({ count: 0 })
    })

    it('should return 0 when shop has no notifications', () => {
      const result = getUnreadCount(shopId)
      expect(result).toEqual({ count: 0 })
    })
  })

  describe('markRead', () => {
    it('should mark specific notifications as read', () => {
      const notif1Id = uuid()
      const notif2Id = uuid()
      const notif3Id = uuid()

      db.prepare(
        'INSERT INTO notifications (id, shop_id, alert_id, message, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(notif1Id, shopId, null, 'Notification 1', 0, new Date().toISOString())
      db.prepare(
        'INSERT INTO notifications (id, shop_id, alert_id, message, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(notif2Id, shopId, null, 'Notification 2', 0, new Date().toISOString())
      db.prepare(
        'INSERT INTO notifications (id, shop_id, alert_id, message, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(notif3Id, shopId, null, 'Notification 3', 0, new Date().toISOString())

      const result = markRead(shopId, [notif1Id, notif2Id])
      expect(result).toEqual({ updated: 2 })

      const notif1 = db.prepare('SELECT is_read FROM notifications WHERE id = ?').get(notif1Id) as { is_read: number }
      const notif2 = db.prepare('SELECT is_read FROM notifications WHERE id = ?').get(notif2Id) as { is_read: number }
      const notif3 = db.prepare('SELECT is_read FROM notifications WHERE id = ?').get(notif3Id) as { is_read: number }

      expect(notif1.is_read).toBe(1)
      expect(notif2.is_read).toBe(1)
      expect(notif3.is_read).toBe(0) // Not touched
    })

    it('should mark all notifications as read when ids is "all"', () => {
      for (let i = 0; i < 3; i++) {
        db.prepare(
          'INSERT INTO notifications (id, shop_id, alert_id, message, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(uuid(), shopId, null, `Notification ${i}`, 0, new Date().toISOString())
      }

      const result = markRead(shopId, 'all')
      expect(result).toEqual({ updated: 3 })

      const unreadCount = db
        .prepare('SELECT COUNT(*) as count FROM notifications WHERE shop_id = ? AND is_read = 0')
        .get(shopId) as { count: number }
      expect(unreadCount.count).toBe(0)
    })

    it('should only mark notifications for the specified shop', () => {
      const notif1Id = uuid()
      const notif2Id = uuid()

      db.prepare(
        'INSERT INTO notifications (id, shop_id, alert_id, message, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(notif1Id, shopId, null, 'Shop 1 notification', 0, new Date().toISOString())

      db.prepare(
        'INSERT INTO notifications (id, shop_id, alert_id, message, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(notif2Id, otherShopId, null, 'Shop 2 notification', 0, new Date().toISOString())

      // Passing both IDs but only the shop1 one should be updated
      const result = markRead(shopId, [notif1Id, notif2Id])
      expect(result).toEqual({ updated: 1 })

      const notif1 = db.prepare('SELECT is_read FROM notifications WHERE id = ?').get(notif1Id) as { is_read: number }
      const notif2 = db.prepare('SELECT is_read FROM notifications WHERE id = ?').get(notif2Id) as { is_read: number }

      expect(notif1.is_read).toBe(1)
      expect(notif2.is_read).toBe(0) // Different shop — not touched
    })

    it('should return 0 when marking empty array', () => {
      const result = markRead(shopId, [])
      expect(result).toEqual({ updated: 0 })
    })

    it('should only count notifications that were previously unread', () => {
      const notif1Id = uuid()
      const notif2Id = uuid()

      db.prepare(
        'INSERT INTO notifications (id, shop_id, alert_id, message, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(notif1Id, shopId, null, 'Unread notification', 0, new Date().toISOString())

      db.prepare(
        'INSERT INTO notifications (id, shop_id, alert_id, message, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(notif2Id, shopId, null, 'Already read', 1, new Date().toISOString())

      const result = markRead(shopId, [notif1Id, notif2Id])
      expect(result).toEqual({ updated: 1 }) // Only the unread one counted
    })

    it('should handle non-existent notification IDs gracefully', () => {
      const nonExistentId = uuid()
      const result = markRead(shopId, [nonExistentId])
      expect(result).toEqual({ updated: 0 })
    })

    it('should not affect other shops when marking all as read', () => {
      // 2 unread for shopId, 1 unread for otherShopId
      for (let i = 0; i < 2; i++) {
        db.prepare(
          'INSERT INTO notifications (id, shop_id, alert_id, message, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(uuid(), shopId, null, `Shop1 ${i}`, 0, new Date().toISOString())
      }
      db.prepare(
        'INSERT INTO notifications (id, shop_id, alert_id, message, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(uuid(), otherShopId, null, 'Other shop', 0, new Date().toISOString())

      const result = markRead(shopId, 'all')
      expect(result).toEqual({ updated: 2 })

      // Other shop's unread count unchanged
      const otherCount = getUnreadCount(otherShopId)
      expect(otherCount).toEqual({ count: 1 })
    })
  })
})
