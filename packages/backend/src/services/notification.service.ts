import { db } from '../db/database'

// Requirements: 6.5, 6.6, 6.7

export interface Notification {
  id: string
  shopId: string
  alertId: string | null
  message: string
  isRead: boolean
  createdAt: string
}

interface NotificationRow {
  id: string
  shop_id: string
  alert_id: string | null
  message: string
  is_read: number
  created_at: string
}

function rowToNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    shopId: row.shop_id,
    alertId: row.alert_id,
    message: row.message,
    isRead: row.is_read === 1,
    createdAt: row.created_at,
  }
}

/**
 * List notifications for a shop, ordered by created_at descending.
 * Requirements: 6.5
 * @param shopId - The shop ID
 * @param limit - Maximum number of notifications to return (default: 20)
 * @returns Array of notifications
 */
export function listNotifications(shopId: string, limit: number = 20): Notification[] {
  const rows = db
    .prepare(`
      SELECT id, shop_id, alert_id, message, is_read, created_at
      FROM notifications
      WHERE shop_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `)
    .all(shopId, limit) as NotificationRow[]

  return rows.map(rowToNotification)
}

/**
 * Get the count of unread notifications for a shop.
 * Requirements: 6.6, 6.7
 * @param shopId - The shop ID
 * @returns Object containing the count
 */
export function getUnreadCount(shopId: string): { count: number } {
  const result = db
    .prepare(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE shop_id = ? AND is_read = 0
    `)
    .get(shopId) as { count: number }

  return { count: result.count }
}

/**
 * Mark notifications as read.
 * Requirements: 6.5, 6.6
 * @param shopId - The shop ID
 * @param ids - Array of notification IDs or the string 'all'
 * @returns Object containing the number of updated notifications
 */
export function markRead(shopId: string, ids: string[] | 'all'): { updated: number } {
  let result: { changes: number }

  if (ids === 'all') {
    // Mark all notifications for the shop as read
    result = db
      .prepare(`
        UPDATE notifications
        SET is_read = 1
        WHERE shop_id = ? AND is_read = 0
      `)
      .run(shopId)
  } else {
    // Mark specific notifications as read
    if (ids.length === 0) {
      return { updated: 0 }
    }

    const placeholders = ids.map(() => '?').join(',')
    result = db
      .prepare(`
        UPDATE notifications
        SET is_read = 1
        WHERE shop_id = ? AND id IN (${placeholders}) AND is_read = 0
      `)
      .run([shopId, ...ids])
  }

  return { updated: result.changes }
}
