/**
 * AlertCard component — displays alert information with action buttons.
 * Requirements: 3.5, 3.8, 4.4, 4.5, 5.4, 5.5, 5.6
 */

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../lib/api'
import StockBadge from './StockBadge'

// ── Types ────────────────────────────────────────────────────────────────────

export interface Alert {
  id: string
  shopId: string
  productId: string
  triggeredAt: string
  resolvedAt: string | null
  status: 'open' | 'ordered' | 'dismissed' | 'resolved'
}

export interface AlertWithProduct extends Alert {
  product: {
    id: string
    name: string
    sku: string | null
    currentStock: number
    lowStockThreshold: number
    unit: string
  }
  suggestedReorderQty: number
  avgDailyUsage: number | null
  daysSinceLastRestock: number | null
}

interface AlertCardProps {
  alert: AlertWithProduct
  onUpdate?: (alert: Alert) => void
  onRemove?: (alertId: string) => void
}

type StockStatus = 'zero' | 'critical' | 'warning' | 'healthy'

// ── Helper functions ─────────────────────────────────────────────────────────

/**
 * Classify stock status based on current stock and threshold.
 * Requirements: 3.9, 3.10, 3.11, 3.12, 3.13, 3.14
 */
function classifyStockStatus(currentStock: number, threshold: number): StockStatus {
  if (currentStock === 0) {
    return 'zero'
  }
  if (currentStock <= threshold) {
    return 'critical'
  }
  if (currentStock <= threshold * 1.2) {
    return 'warning'
  }
  return 'healthy'
}

/**
 * Format reorder suggestion text based on whether it's velocity-based or fallback.
 * Requirements: 4.4, 4.5
 */
function formatReorderSuggestion(alert: AlertWithProduct): string {
  if (alert.avgDailyUsage !== null) {
    // Velocity-based suggestion (fallback = false)
    // Format: "Sold ~{avgDailyUsage} units/day over last 30 days. Suggest reordering {suggestedQty} units."
    return `Sold ~${alert.avgDailyUsage} units/day over last 30 days. Suggest reordering ${alert.suggestedReorderQty} units.`
  } else {
    // Fallback suggestion (fallback = true)
    // Format: "Not enough sales data. Suggest reordering {suggestedQty} units (2× your threshold)."
    return `Not enough sales data. Suggest reordering ${alert.suggestedReorderQty} units (2× your threshold).`
  }
}

/**
 * Extract error message from API response.
 */
function extractApiMessage(err: unknown): string | undefined {
  if (
    err &&
    typeof err === 'object' &&
    'response' in err &&
    err.response &&
    typeof err.response === 'object' &&
    'data' in err.response
  ) {
    const data = (err.response as { data?: unknown }).data
    if (data && typeof data === 'object' && 'message' in data) {
      const msg = (data as { message: unknown }).message
      if (typeof msg === 'string') return msg
    }
  }
  return undefined
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AlertCard({ alert, onUpdate, onRemove }: AlertCardProps) {
  const [localStatus, setLocalStatus] = useState(alert.status)
  const [isRemoving, setIsRemoving] = useState(false)

  // Calculate stock status for badge display
  const stockStatus = classifyStockStatus(alert.product.currentStock, alert.product.lowStockThreshold)

  // Format reorder suggestion text
  const suggestionText = formatReorderSuggestion(alert)

  // Mutation for updating alert status
  const updateStatusMutation = useMutation({
    mutationFn: async (status: 'ordered' | 'dismissed') => {
      const response = await api.patch<Alert>(`/api/alerts/${alert.id}`, { status })
      return response.data
    },
    onMutate: async (status) => {
      // Optimistic update
      if (status === 'dismissed') {
        setIsRemoving(true)
      } else {
        setLocalStatus(status)
      }
    },
    onSuccess: (updatedAlert, status) => {
      if (status === 'dismissed') {
        // Remove the card from the list
        onRemove?.(alert.id)
      } else {
        // Update the card status
        onUpdate?.(updatedAlert)
      }
    },
    onError: (err, status) => {
      // Revert optimistic update on error
      if (status === 'dismissed') {
        setIsRemoving(false)
      } else {
        setLocalStatus(alert.status)
      }
      
      // Show error message
      const message = extractApiMessage(err) ?? 'Failed to update alert. Please try again.'
      toast.error(message)
    },
  })

  const handleMarkOrdered = () => {
    updateStatusMutation.mutate('ordered')
  }

  const handleDismiss = () => {
    updateStatusMutation.mutate('dismissed')
  }

  // Show loading state when removing
  if (isRemoving) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm opacity-50 animate-pulse">
        <div className="text-center text-gray-500 text-sm">Dismissing...</div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Product name and stock info */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate">{alert.product.name}</h3>
          {alert.product.sku && (
            <p className="text-sm text-gray-500 mt-0.5">
              SKU: <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">{alert.product.sku}</code>
            </p>
          )}
        </div>
        <StockBadge status={stockStatus} />
      </div>

      {/* Stock levels */}
      <div className="flex items-center justify-between mb-3 text-sm">
        <div className="text-gray-600">
          <span className="font-medium text-gray-900">{alert.product.currentStock}</span>
          <span className="mx-1 text-gray-400">/</span>
          <span>{alert.product.lowStockThreshold}</span>
          <span className="ml-1 text-gray-400">{alert.product.unit}</span>
        </div>
        {alert.daysSinceLastRestock !== null && (
          <div className="text-gray-500 text-xs">
            {alert.daysSinceLastRestock} days since restock
          </div>
        )}
      </div>

      {/* Reorder suggestion */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
        <p className="text-sm text-blue-800">{suggestionText}</p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        {localStatus === 'open' ? (
          <>
            <button
              onClick={handleMarkOrdered}
              disabled={updateStatusMutation.isPending}
              className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updateStatusMutation.isPending && updateStatusMutation.variables === 'ordered' 
                ? 'Marking...' 
                : 'Mark as Ordered'
              }
            </button>
            <button
              onClick={handleDismiss}
              disabled={updateStatusMutation.isPending}
              className="flex-1 px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updateStatusMutation.isPending && updateStatusMutation.variables === 'dismissed' 
                ? 'Dismissing...' 
                : 'Dismiss'
              }
            </button>
          </>
        ) : (
          <div className="w-full px-3 py-2 text-center text-sm text-gray-500 bg-gray-50 rounded-md border">
            Status: {localStatus === 'ordered' ? 'Ordered' : 'Dismissed'}
          </div>
        )}
      </div>
    </div>
  )
}

export default AlertCard