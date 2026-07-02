/**
 * AlertsPage — tabbed alerts dashboard with status filtering.
 * Requirements: 3.5, 3.6, 3.7, 3.8
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import AlertCard, { AlertWithProduct } from '../components/AlertCard'

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

type AlertTab = 'open' | 'ordered' | 'dismissed' | 'all'

// ────────────────────────────────────────────────────────────────
// Loading skeleton
// ────────────────────────────────────────────────────────────────

function AlertsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => (
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

// ────────────────────────────────────────────────────────────────
// Empty state component
// ────────────────────────────────────────────────────────────────

function EmptyState({ activeTab }: { activeTab: AlertTab }) {
  const messages = {
    open: {
      title: 'No open alerts',
      description: 'All your products are well-stocked! Check back later or adjust stock thresholds if needed.',
      icon: (
        <svg className="w-12 h-12 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    ordered: {
      title: 'No ordered alerts',
      description: 'Items you mark as ordered will appear here.',
      icon: (
        <svg className="w-12 h-12 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    dismissed: {
      title: 'No dismissed alerts',
      description: 'Items you dismiss will appear here.',
      icon: (
        <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    all: {
      title: 'No alerts',
      description: 'No alerts have been generated yet. Alerts are created when product stock falls to or below the threshold.',
      icon: (
        <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-5 5v-5zM4.707 9.293a1 1 0 000 1.414l6 6a1 1 0 001.414 0l6-6a1 1 0 00-1.414-1.414L11 14.586 5.293 8.879a1 1 0 00-1.414 0z" />
        </svg>
      ),
    },
  }

  const { title, description, icon } = messages[activeTab]

  return (
    <div className="text-center py-12">
      <div className="mx-auto mb-4">{icon}</div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 max-w-md mx-auto text-sm">{description}</p>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Main page component
// ────────────────────────────────────────────────────────────────

export default function AlertsPage() {
  const [activeTab, setActiveTab] = useState<AlertTab>('open')

  // ── Fetch alerts based on active tab ────────────────────────────
  const { data, isLoading, isError, error, refetch } = useQuery<PaginatedResponse<AlertWithProduct>>({
    queryKey: ['alerts', activeTab],
    queryFn: async () => {
      const params = new URLSearchParams()
      
      // Only add status filter for specific tabs (not 'all')
      if (activeTab !== 'all') {
        params.set('status', activeTab)
      }
      
      const url = `/api/alerts${params.toString() ? '?' + params.toString() : ''}`
      const res = await api.get<PaginatedResponse<AlertWithProduct>>(url)
      return res.data
    },
  })

  // ── Alert update handlers ───────────────────────────────────────
  const handleAlertUpdate = () => {
    // Refetch the current tab's data when an alert is updated
    refetch()
  }

  const handleAlertRemove = () => {
    // Refetch the current tab's data when an alert is dismissed/removed
    refetch()
  }

  // ── Tab configuration ───────────────────────────────────────────
  const tabs = [
    { id: 'open' as AlertTab, label: 'Open', count: activeTab === 'open' ? data?.total : undefined },
    { id: 'ordered' as AlertTab, label: 'Ordered', count: activeTab === 'ordered' ? data?.total : undefined },
    { id: 'dismissed' as AlertTab, label: 'Dismissed', count: activeTab === 'dismissed' ? data?.total : undefined },
    { id: 'all' as AlertTab, label: 'All', count: activeTab === 'all' ? data?.total : undefined },
  ]

  // ────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Alerts</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Monitor and manage low-stock alerts across your inventory
        </p>
      </div>

      {/* Tab navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-150
                  ${isActive
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                {tab.label}
                {typeof tab.count === 'number' && (
                  <span
                    className={`
                      ml-2 py-0.5 px-2 rounded-full text-xs font-medium
                      ${isActive
                        ? 'bg-indigo-100 text-indigo-600'
                        : 'bg-gray-100 text-gray-600'
                      }
                    `}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Content area */}
      <div className="min-h-[400px]">
        {isLoading ? (
          <AlertsSkeleton />
        ) : isError ? (
          <div className="text-center py-12">
            <svg className="w-12 h-12 mx-auto mb-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12A9 9 0 1 1 3 12a9 9 0 0 1 18 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load alerts</h3>
            <p className="text-sm text-gray-500 mb-4">
              {error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.'}
            </p>
            <button
              onClick={() => refetch()}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md transition-colors duration-150"
            >
              Try Again
            </button>
          </div>
        ) : !data?.data.length ? (
          <EmptyState activeTab={activeTab} />
        ) : (
          <>
            {/* Alert cards grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data.data.map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onUpdate={handleAlertUpdate}
                  onRemove={handleAlertRemove}
                />
              ))}
            </div>

            {/* Result summary */}
            {data.total > 0 && (
              <div className="mt-6 text-center text-sm text-gray-500">
                Showing {data.data.length} of {data.total} alert{data.total !== 1 ? 's' : ''}
                {activeTab !== 'all' && ` with status "${activeTab}"`}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
