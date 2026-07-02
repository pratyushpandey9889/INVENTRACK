/**
 * StockHistoryChart component — displays a 30-day stock level history as a line chart.
 * Requirements: 2.11
 */

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import api from '../lib/api'

// ── Types ────────────────────────────────────────────────────────────────────

interface StockMovement {
  id: string
  productId: string
  userId: string
  changeAmount: number
  type: 'restock' | 'sale' | 'damage' | 'adjustment'
  note: string | null
  createdAt: string
}

interface StockHistoryChartProps {
  productId: string
  currentStock: number
}

interface StockDataPoint {
  date: string
  stock: number
  displayDate: string
}

// ── Helper functions ─────────────────────────────────────────────────────────

/**
 * Get date string for 30 days ago in ISO format
 */
function get30DaysAgo(): string {
  const date = new Date()
  date.setDate(date.getDate() - 30)
  return date.toISOString()
}

/**
 * Format date for display in tooltip
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Transform movements into stock level time series
 * Working backwards from current stock using movements
 */
function transformMovementsToStockHistory(
  movements: StockMovement[], 
  currentStock: number
): StockDataPoint[] {
  if (movements.length === 0) {
    // No movements in 30 days, return current stock as flat line
    const now = new Date().toISOString()
    const thirtyDaysAgo = get30DaysAgo()
    
    return [
      {
        date: thirtyDaysAgo,
        stock: currentStock,
        displayDate: formatDate(thirtyDaysAgo)
      },
      {
        date: now,
        stock: currentStock,
        displayDate: formatDate(now)
      }
    ]
  }

  // Sort movements by date (oldest first)
  const sortedMovements = [...movements].sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  // Calculate stock level at each movement point, working forwards
  const dataPoints: StockDataPoint[] = []
  let runningStock = currentStock

  // First, work backwards to find the starting stock 30 days ago
  for (let i = sortedMovements.length - 1; i >= 0; i--) {
    const movement = sortedMovements[i]
    runningStock -= movement.changeAmount
  }

  // Add starting point (30 days ago)
  const startDate = get30DaysAgo()
  dataPoints.push({
    date: startDate,
    stock: Math.max(0, runningStock), // Ensure non-negative
    displayDate: formatDate(startDate)
  })

  // Now work forward through movements
  let currentStockLevel = runningStock
  for (const movement of sortedMovements) {
    currentStockLevel += movement.changeAmount
    dataPoints.push({
      date: movement.createdAt,
      stock: Math.max(0, currentStockLevel), // Ensure non-negative
      displayDate: formatDate(movement.createdAt)
    })
  }

  // Add current point (now)
  const now = new Date().toISOString()
  dataPoints.push({
    date: now,
    stock: currentStock,
    displayDate: formatDate(now)
  })

  return dataPoints
}

/**
 * Loading skeleton for the chart
 */
function ChartSkeleton() {
  return (
    <div className="w-full h-64 bg-gray-50 rounded-lg border flex items-center justify-center animate-pulse">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-2"></div>
        <div className="text-sm text-gray-500">Loading stock history...</div>
      </div>
    </div>
  )
}

/**
 * Error display for failed fetch
 */
function ChartError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="w-full h-64 bg-red-50 rounded-lg border border-red-200 flex items-center justify-center">
      <div className="text-center">
        <div className="text-red-600 mb-2">
          <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="text-sm text-red-700 mb-3">Failed to load stock history</div>
        <button
          onClick={onRetry}
          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StockHistoryChart({ productId, currentStock }: StockHistoryChartProps) {
  const from30DaysAgo = useMemo(() => get30DaysAgo(), [])

  const { 
    data: movements, 
    isLoading, 
    error, 
    refetch 
  } = useQuery({
    queryKey: ['movements', productId, from30DaysAgo],
    queryFn: async () => {
      const response = await api.get<StockMovement[]>('/api/movements', {
        params: {
          productId,
          from: from30DaysAgo
        }
      })
      return response.data
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const stockData = useMemo(() => {
    if (!movements) return []
    return transformMovementsToStockHistory(movements, currentStock)
  }, [movements, currentStock])

  if (isLoading) {
    return <ChartSkeleton />
  }

  if (error) {
    return <ChartError onRetry={() => refetch()} />
  }

  const maxStock = Math.max(...stockData.map(d => d.stock), 1)
  const yAxisMax = Math.ceil(maxStock * 1.1) // Add 10% padding

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-900">Stock History (30 Days)</h3>
        <p className="text-sm text-gray-500">Stock levels over the past 30 days</p>
      </div>
      
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={stockData}
            margin={{
              top: 5,
              right: 30,
              left: 20,
              bottom: 60,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="date"
              type="category"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => {
                const date = new Date(value)
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              }}
              interval="preserveStartEnd"
            />
            <YAxis 
              domain={[0, yAxisMax]}
              tick={{ fontSize: 12 }}
              label={{ value: 'Stock Quantity', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip 
              labelFormatter={(value) => `Date: ${formatDate(value as string)}`}
              formatter={(value: number) => [value, 'Stock']}
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '12px'
              }}
            />
            <Legend />
            <Line 
              type="stepAfter"
              dataKey="stock" 
              stroke="#2563eb" 
              strokeWidth={2}
              dot={{ fill: '#2563eb', strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6, stroke: '#2563eb', strokeWidth: 2, fill: 'white' }}
              name="Stock Level"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      {stockData.length === 2 && stockData[0].stock === stockData[1].stock && (
        <div className="mt-3 p-2 bg-gray-50 rounded text-sm text-gray-600 text-center">
          No stock movements in the past 30 days
        </div>
      )}
    </div>
  )
}

export default StockHistoryChart