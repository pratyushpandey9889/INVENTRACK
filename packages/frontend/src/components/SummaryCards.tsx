/**
 * SummaryCards component — displays dashboard summary metrics in a responsive grid.
 * Requirements: 5.1
 * 
 * Four cards: Total Products, Low-Stock Items (highlighted in red/orange), 
 * Total Inventory Value, Zero-Stock Count
 * 
 * Fetches data via GET /api/dashboard and shows loading skeletons while fetching.
 * Shows error state if the fetch fails.
 */

import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'

interface DashboardSummary {
  totalProducts: number
  lowStockCount: number
  zeroStockCount: number
  totalInventoryValue: number
  urgentAlerts: any[]
  recentMovements: any[]
}

// Card skeleton component for loading state
function CardSkeleton() {
  return (
    <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
          <div className="h-8 bg-gray-200 rounded w-16" />
        </div>
        <div className="w-8 h-8 bg-gray-200 rounded" />
      </div>
    </div>
  )
}

// Individual summary card component
interface SummaryCardProps {
  title: string
  value: number | string
  icon: React.ReactNode
  variant?: 'default' | 'warning' | 'danger'
}

function SummaryCard({ title, value, icon, variant = 'default' }: SummaryCardProps) {
  const variantStyles = {
    default: 'bg-white border-gray-200',
    warning: 'bg-amber-50 border-amber-200 ring-1 ring-amber-100',
    danger: 'bg-red-50 border-red-200 ring-1 ring-red-100'
  }

  const iconStyles = {
    default: 'text-indigo-600',
    warning: 'text-amber-600',
    danger: 'text-red-600'
  }

  const valueStyles = {
    default: 'text-gray-900',
    warning: 'text-amber-900',
    danger: 'text-red-900'
  }

  return (
    <div className={`shadow-sm rounded-lg border p-6 ${variantStyles[variant]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className={`text-2xl font-bold mt-1 ${valueStyles[variant]}`}>
            {value}
          </p>
        </div>
        <div className={`w-8 h-8 ${iconStyles[variant]}`}>
          {icon}
        </div>
      </div>
    </div>
  )
}

export default function SummaryCards() {
  const { data, isLoading, isError, error } = useQuery<DashboardSummary>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const response = await api.get<DashboardSummary>('/api/dashboard')
      return response.data
    },
  })

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    )
  }

  // Error state
  if (isError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12A9 9 0 1 1 3 12a9 9 0 0 1 18 0z" />
          </svg>
          <div>
            <h3 className="text-sm font-medium text-red-800">Failed to load dashboard data</h3>
            <p className="text-sm text-red-600 mt-1">
              {error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return null
  }

  // Format currency value
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Total Products */}
      <SummaryCard
        title="Total Products"
        value={data.totalProducts.toLocaleString()}
        variant="default"
        icon={
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        }
      />

      {/* Low-Stock Items (highlighted in red/orange) */}
      <SummaryCard
        title="Low-Stock Items"
        value={data.lowStockCount.toLocaleString()}
        variant={data.lowStockCount > 0 ? 'danger' : 'default'}
        icon={
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        }
      />

      {/* Total Inventory Value */}
      <SummaryCard
        title="Total Inventory Value"
        value={formatCurrency(data.totalInventoryValue)}
        variant="default"
        icon={
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
          </svg>
        }
      />

      {/* Zero-Stock Count */}
      <SummaryCard
        title="Zero-Stock Count"
        value={data.zeroStockCount.toLocaleString()}
        variant={data.zeroStockCount > 0 ? 'warning' : 'default'}
        icon={
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        }
      />
    </div>
  )
}