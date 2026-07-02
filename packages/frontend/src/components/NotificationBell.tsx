import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import api from '../lib/api'

interface Notification {
  id: string
  shopId: string
  alertId?: string
  message: string
  isRead: boolean
  createdAt: string
}

interface UnreadCountResponse {
  count: number
}

interface MarkReadResponse {
  updated: number
}

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  // Poll unread count every 30 seconds
  const { data: unreadData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async (): Promise<UnreadCountResponse> => {
      const response = await api.get('/api/notifications/unread-count')
      return response.data
    },
    refetchInterval: 30_000,
    retry: (failureCount, error) => {
      // Only retry on network errors, not server errors
      const isAxiosError = error && typeof error === 'object' && 'response' in error
      return failureCount < 3 && (!isAxiosError || (error as any).response?.status >= 500)
    },
    retryOnMount: true,
    staleTime: 0, // Always refetch on mount
  })

  // Fetch notifications when dropdown opens
  const { data: notifications, error: notificationsError } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: async (): Promise<Notification[]> => {
      const response = await api.get('/api/notifications?limit=20')
      return response.data
    },
    enabled: isOpen,
    retry: false, // Don't retry notifications list to avoid infinite loading
  })

  // Mark all as read mutation
  const markAllReadMutation = useMutation({
    mutationFn: async (): Promise<MarkReadResponse> => {
      const response = await api.post('/api/notifications/mark-read', { ids: 'all' })
      return response.data
    },
    onSuccess: () => {
      // Set unread count to 0 immediately
      queryClient.setQueryData(['notifications', 'unread-count'], { count: 0 })
      // Invalidate notifications list to refresh read status
      queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] })
    },
    onError: () => {
      toast.error('Failed to mark notifications as read')
    },
  })

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const unreadCount = unreadData?.count || 0
  const displayCount = unreadCount > 99 ? '99+' : unreadCount.toString()

  const handleBellClick = () => {
    setIsOpen(!isOpen)
  }

  const handleMarkAllRead = () => {
    markAllReadMutation.mutate()
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 1) {
      const minutes = Math.floor(diffInHours * 60)
      return `${minutes}m ago`
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`
    } else {
      const days = Math.floor(diffInHours / 24)
      return `${days}d ago`
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon Button */}
      <button
        onClick={handleBellClick}
        className="relative p-2 text-indigo-200 hover:text-white transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-75 rounded-md"
        aria-label="Notifications"
      >
        {/* Bell SVG Icon */}
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 min-w-5 flex items-center justify-center px-1">
            {displayCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={markAllReadMutation.isPending}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50"
              >
                {markAllReadMutation.isPending ? 'Marking...' : 'Mark all read'}
              </button>
            )}
          </div>

          {/* Content */}
          <div className="max-h-80 overflow-y-auto">
            {notificationsError ? (
              <div className="p-4 text-center text-red-600 text-sm">
                Failed to load notifications. Please try again later.
              </div>
            ) : !notifications ? (
              <div className="p-4 text-center text-gray-500 text-sm">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">No notifications yet</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 ${
                      !notification.isRead ? 'bg-blue-50 border-l-4 border-l-blue-400' : 'bg-white'
                    }`}
                  >
                    <p className="text-sm text-gray-900">{notification.message}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDate(notification.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications && notifications.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-200 text-center">
              <span className="text-xs text-gray-500">Showing last 20 notifications</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}