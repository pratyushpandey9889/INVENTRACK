/**
 * DashboardPage — Home screen with summary cards and overview
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */

import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import SummaryCards from '../components/SummaryCards'
import AlertCard, { AlertWithProduct } from '../components/AlertCard'

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

interface Movement {
  id: string
  productId: string
  userId: string
  changeAmount: number
  type: 'restock' | 'sale' | 'damage' | 'adjustment'
  note: string | null
  createdAt: string
  productName: string
  userName: string
}

interface DashboardData {
  totalProducts: number
  lowStockCount: number
  zeroStockCount: number
  totalInventoryValue: number
  urgentAlerts: AlertWithProduct[]
  recentMovements: Movement[]
}

// ────────────────────────────────────────────────────────────────
// Helper functions
// ────────────────────────────────────────────────────────────────

/**
 * Format movement type for display
 */
function formatMovementType(type: Movement['type']): string {
  switch (type) {
    case 'restock':
      return 'Restock'
    case 'sale':
      return 'Sale'
    case 'damage':
      return 'Damage'
    case 'adjustment':
      return 'Adjustment'
    default:
      return type
  }
}

/**
 * Format change amount with proper +/- prefix
 */
function formatChangeAmount(changeAmount: number): string {
  return changeAmount > 0 ? `+${changeAmount}` : String(changeAmount)
}

/**
 * Format timestamp for recent activity
 */
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMinutes < 1) {
    return 'Just now'
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`
  } else if (diffHours < 24) {
    return `${diffHours}h ago`
  } else if (diffDays < 7) {
    return `${diffDays}d ago`
  } else {
    return date.toLocaleDateString()
  }
}

// ────────────────────────────────────────────────────────────────
// Loading skeletons
// ────────────────────────────────────────────────────────────────

function AlertsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="animate-pulse bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="flex justify-between items-start mb-3">
            <div className="h-5 bg-gray-200 rounded w-2/3" />
            <div className="h-6 bg-gray-200 rounded-full w-16" />
          </div>
          <div className="space-y-2 mb-3">
            <div className="h-4 bg-gray-200 rounded w-1/2" />
            <div className="h-4 bg-gray-200 rounded w-1/3" />
          </div>
          <div className="h-12 bg-gray-100 rounded mb-4" />
          <div className="flex gap-2">
            <div className="h-8 bg-gray-200 rounded flex-1" />
            <div className="h-8 bg-gray-200 rounded flex-1" />
          </div>
        </div>
      ))}
    </div>
  )
}

function MovementsSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="animate-pulse flex items-center gap-3 py-3">
          <div className="h-4 bg-gray-200 rounded w-1/4" />
          <div className="h-4 bg-gray-200 rounded w-16" />
          <div className="h-4 bg-gray-200 rounded w-20" />
          <div className="h-4 bg-gray-200 rounded w-20" />
          <div className="h-4 bg-gray-200 rounded w-16" />
        </div>
      ))}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  // Fetch dashboard data (includes all sections)
  const { data, isLoading, isError, error, refetch } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const response = await api.get<DashboardData>('/api/dashboard')
      return response.data
    },
  })

  // Handle alert updates (when "Mark as Ordered" or "Dismiss" succeeds)
  const handleAlertUpdate = () => {
    refetch()
  }

  const handleAlertRemove = () => {
    refetch()
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Overview of your inventory health and recent activity
        </p>
      </div>

      {/* Summary Cards */}
      <SummaryCards />

      {/* Error state for dashboard-specific data */}
      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12A9 9 0 1 1 3 12a9 9 0 0 1 18 0z" />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-red-800">Failed to load dashboard sections</h3>
              <p className="text-sm text-red-600 mt-1">
                {error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.'}
              </p>
              <button
                onClick={() => refetch()}
                className="mt-3 inline-flex items-center px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 text-xs font-medium rounded-md transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Urgent Alerts Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Urgent Alerts</h2>
          {data?.urgentAlerts && data.urgentAlerts.length > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
              {data.urgentAlerts.length} alert{data.urgentAlerts.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {isLoading ? (
          <AlertsSkeleton />
        ) : !data?.urgentAlerts.length ? (
          <div className="text-center py-8">
            <svg className="w-12 h-12 mx-auto mb-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No urgent alerts</h3>
            <p className="text-gray-500 text-sm">All your products are well-stocked! Great job managing your inventory.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.urgentAlerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onUpdate={handleAlertUpdate}
                onRemove={handleAlertRemove}
              />
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
          {data?.recentMovements && data.recentMovements.length > 0 && (
            <span className="text-xs text-gray-500">
              Last {data.recentMovements.length} movement{data.recentMovements.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {isLoading ? (
          <MovementsSkeleton />
        ) : !data?.recentMovements.length ? (
          <div className="text-center py-8">
            <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No recent activity</h3>
            <p className="text-gray-500 text-sm">Stock movements will appear here as they occur.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-0 font-medium text-gray-900">Product</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-900">Change</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-900">Type</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-900">User</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-900">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.recentMovements.map((movement) => (
                  <tr key={movement.id} className="hover:bg-gray-25">
                    <td className="py-3 px-0 font-medium text-gray-900 max-w-[200px] truncate">
                      {movement.productName}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          movement.changeAmount > 0
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {formatChangeAmount(movement.changeAmount)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-gray-600">
                      {formatMovementType(movement.type)}
                    </td>
                    <td className="py-3 px-3 text-gray-600">
                      {movement.userName}
                    </td>
                    <td className="py-3 px-3 text-gray-500 text-xs">
                      {formatTimestamp(movement.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
