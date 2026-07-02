/**
 * ProductDetailPage — Single product view with editable info, stock chart, and movement log.
 * Requirements: 2.11, 1.9
 */

import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'
import StockHistoryChart from '../components/StockHistoryChart'
import ProductModal from '../components/ProductModal'
import StockBadge from '../components/StockBadge'

// ── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: string
  shopId: string
  name: string
  sku?: string
  category?: string
  unit: string
  currentStock: number
  costPrice: number
  sellingPrice: number
  lowStockThreshold: number
  isArchived: boolean
  createdAt: string
  updatedAt: string
  stockStatus: 'healthy' | 'warning' | 'critical' | 'zero'
}

interface StockMovement {
  id: string
  productId: string
  userId: string
  changeAmount: number
  type: 'restock' | 'sale' | 'damage' | 'adjustment'
  note: string | null
  createdAt: string
  // Enriched fields from the API
  productName?: string
  userName?: string
}

interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

// ── Helper Components ────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="bg-white rounded-lg border p-6">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-6 bg-gray-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>

      {/* Chart skeleton */}
      <div className="bg-white rounded-lg border p-6">
        <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="h-64 bg-gray-100 rounded"></div>
      </div>

      {/* Table skeleton */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="p-6 border-b">
          <div className="h-6 bg-gray-200 rounded w-1/4"></div>
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-4 p-4 border-b border-gray-100">
            <div className="h-4 bg-gray-200 rounded w-1/6"></div>
            <div className="h-4 bg-gray-200 rounded w-1/8"></div>
            <div className="h-4 bg-gray-200 rounded w-1/8"></div>
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ErrorDisplay({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
      <svg className="w-12 h-12 text-red-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12A9 9 0 1 1 3 12a9 9 0 0 1 18 0z" />
      </svg>
      <h2 className="text-lg font-medium text-red-900 mb-2">Failed to Load Product</h2>
      <p className="text-red-700 mb-4">{message}</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
      >
        Try Again
      </button>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const isOwner = user?.role === 'owner'

  const [editModalOpen, setEditModalOpen] = useState(false)
  const [movementsPage, setMovementsPage] = useState(1)
  const movementsLimit = 20

  // Fetch product details
  const { 
    data: product, 
    isLoading: productLoading, 
    error: productError, 
    refetch: refetchProduct 
  } = useQuery<Product>({
    queryKey: ['product', id],
    queryFn: async () => {
      if (!id) throw new Error('Product ID is required')
      const response = await api.get<Product>(`/api/products/${id}`)
      return response.data
    },
    enabled: Boolean(id),
    retry: false,
  })

  // Fetch paginated movements for this product
  const { 
    data: movementsData, 
    isLoading: movementsLoading, 
    error: movementsError,
    refetch: refetchMovements 
  } = useQuery<PaginatedResponse<StockMovement>>({
    queryKey: ['movements', id, movementsPage, movementsLimit],
    queryFn: async () => {
      if (!id) throw new Error('Product ID is required')
      const params = new URLSearchParams({
        productId: id,
        page: movementsPage.toString(),
        limit: movementsLimit.toString(),
      })
      const response = await api.get<PaginatedResponse<StockMovement>>(`/api/movements?${params.toString()}`)
      return response.data
    },
    enabled: Boolean(id),
  })

  const handleEditSuccess = () => {
    setEditModalOpen(false)
    refetchProduct()
    toast.success('Product updated successfully')
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatMovementType = (type: string) => {
    const types = {
      restock: { label: 'Restock', color: 'text-green-600 bg-green-50' },
      sale: { label: 'Sale', color: 'text-blue-600 bg-blue-50' },
      damage: { label: 'Damage', color: 'text-red-600 bg-red-50' },
      adjustment: { label: 'Adjustment', color: 'text-yellow-600 bg-yellow-50' },
    }
    return types[type as keyof typeof types] || { label: type, color: 'text-gray-600 bg-gray-50' }
  }

  // Handle not found or error states
  if (productError) {
    const is404 = productError && typeof productError === 'object' && 
                   'response' in productError && 
                   (productError as any).response?.status === 404

    if (is404) {
      return (
        <div className="text-center py-12">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6m16 0v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6m16 0H4" />
          </svg>
          <h2 className="text-xl font-medium text-gray-900 mb-2">Product Not Found</h2>
          <p className="text-gray-500 mb-6">The product you're looking for doesn't exist or has been removed.</p>
          <Link 
            to="/inventory" 
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
          >
            Back to Inventory
          </Link>
        </div>
      )
    }

    return (
      <ErrorDisplay 
        message={productError instanceof Error ? productError.message : 'An unexpected error occurred'}
        onRetry={() => refetchProduct()}
      />
    )
  }

  if (productLoading || !product) {
    return <LoadingSkeleton />
  }

  const totalMovementPages = movementsData ? Math.ceil(movementsData.total / movementsLimit) : 1

  return (
    <>
      {/* Product Edit Modal */}
      {editModalOpen && (
        <ProductModal
          product={product}
          onClose={() => setEditModalOpen(false)}
          onSuccess={handleEditSuccess}
        />
      )}

      <div className="space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center text-sm text-gray-500">
          <Link to="/inventory" className="hover:text-gray-700">
            Inventory
          </Link>
          <svg className="w-4 h-4 mx-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-gray-900 font-medium">{product.name}</span>
        </nav>

        {/* Product Information */}
        <div className="bg-white rounded-lg border p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{product.name}</h1>
              <div className="flex items-center gap-3">
                <StockBadge status={product.stockStatus} />
                {product.sku && (
                  <code className="text-sm bg-gray-100 px-2 py-1 rounded font-mono text-gray-600">
                    {product.sku}
                  </code>
                )}
                {product.category && (
                  <span className="text-sm text-gray-500 bg-gray-50 px-2 py-1 rounded">
                    {product.category}
                  </span>
                )}
              </div>
            </div>

            {/* Edit button - only for owners as per requirement 1.9 */}
            {isOwner && (
              <button
                onClick={() => setEditModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border border-indigo-200 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5m-1.414-9.414a2 2 0 1 1 2.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Product
              </button>
            )}
          </div>

          {/* Product details grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <dt className="text-sm font-medium text-gray-500">Current Stock</dt>
              <dd className="text-lg font-semibold text-gray-900">
                {product.currentStock} <span className="text-sm font-normal text-gray-500">{product.unit}</span>
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-gray-500">Low Stock Threshold</dt>
              <dd className="text-lg font-semibold text-gray-900">
                {product.lowStockThreshold} <span className="text-sm font-normal text-gray-500">{product.unit}</span>
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-gray-500">Unit</dt>
              <dd className="text-lg font-semibold text-gray-900">{product.unit}</dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-gray-500">Cost Price</dt>
              <dd className="text-lg font-semibold text-gray-900">
                ${product.costPrice.toFixed(2)}
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-gray-500">Selling Price</dt>
              <dd className="text-lg font-semibold text-gray-900">
                ${product.sellingPrice.toFixed(2)}
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-gray-500">Total Value</dt>
              <dd className="text-lg font-semibold text-gray-900">
                ${(product.currentStock * product.costPrice).toFixed(2)}
              </dd>
            </div>
          </div>
        </div>

        {/* Stock History Chart */}
        <StockHistoryChart 
          productId={product.id} 
          currentStock={product.currentStock} 
        />

        {/* Movement Log */}
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Movement History</h3>
            <p className="text-sm text-gray-500 mt-1">
              All stock movements for this product
              {movementsData && ` (${movementsData.total} total)`}
            </p>
          </div>

          {movementsLoading ? (
            <div className="p-6">
              <div className="animate-pulse space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/8"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/8"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                  </div>
                ))}
              </div>
            </div>
          ) : movementsError ? (
            <div className="p-6 text-center text-red-600">
              <p>Failed to load movement history</p>
              <button 
                onClick={() => refetchMovements()}
                className="mt-2 text-sm text-red-700 hover:text-red-900 underline"
              >
                Try again
              </button>
            </div>
          ) : !movementsData?.data.length ? (
            <div className="p-8 text-center text-gray-500">
              <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
              </svg>
              <p>No movements recorded yet</p>
            </div>
          ) : (
            <>
              {/* Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Change
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Note
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Performed By
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {movementsData.data.map((movement) => {
                      const typeInfo = formatMovementType(movement.type)
                      return (
                        <tr key={movement.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDate(movement.createdAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${typeInfo.color}`}>
                              {typeInfo.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <span className={movement.changeAmount > 0 ? 'text-green-600' : 'text-red-600'}>
                              {movement.changeAmount > 0 ? '+' : ''}{movement.changeAmount} {product.unit}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                            {movement.note ? (
                              <span className="truncate block" title={movement.note}>
                                {movement.note}
                              </span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {movement.userName || 'Unknown User'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalMovementPages > 1 && (
                <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 bg-gray-50">
                  <p className="text-xs text-gray-500">
                    Page {movementsPage} of {totalMovementPages} — {movementsData.total} total movements
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setMovementsPage((p) => Math.max(1, p - 1))}
                      disabled={movementsPage === 1}
                      className="px-2.5 py-1.5 text-xs font-medium rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setMovementsPage((p) => Math.min(totalMovementPages, p + 1))}
                      disabled={movementsPage === totalMovementPages}
                      className="px-2.5 py-1.5 text-xs font-medium rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
