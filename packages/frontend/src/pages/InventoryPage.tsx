/**
 * InventoryPage — sortable, filterable product table.
 * Requirements: 1.3, 1.4, 1.5, 1.6, 1.10, 3.9
 */

import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'
import StockBadge from '../components/StockBadge'
import StockAdjustmentModal from '../components/StockAdjustmentModal'
import ProductModal from '../components/ProductModal'

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

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

interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

type SortField =
  | 'name'
  | 'current_stock'
  | 'low_stock_threshold'
  | 'cost_price'
  | 'selling_price'
  | 'created_at'
type SortOrder = 'asc' | 'desc'

interface ProductListQuery {
  search?: string
  category?: string
  sortBy?: SortField
  order?: SortOrder
  page?: number
  limit?: number
}

// ────────────────────────────────────────────────────────────────
// Debounce hook
// ────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}

// ────────────────────────────────────────────────────────────────
// Loading skeleton
// ────────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="animate-pulse">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex gap-4 px-6 py-4 border-b border-gray-100">
          <div className="h-4 bg-gray-200 rounded w-1/4" />
          <div className="h-4 bg-gray-200 rounded w-1/6" />
          <div className="h-4 bg-gray-200 rounded w-1/6" />
          <div className="h-4 bg-gray-200 rounded w-1/8" />
          <div className="h-4 bg-gray-200 rounded w-1/8" />
          <div className="h-4 bg-gray-200 rounded w-1/8" />
        </div>
      ))}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Sort icon helper
// ────────────────────────────────────────────────────────────────

function SortIcon({ field, current, order }: { field: SortField; current?: SortField; order: SortOrder }) {
  if (field !== current) {
    return (
      <svg className="w-3.5 h-3.5 text-gray-400 inline ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 8v-4m0 4l-4-4m4 4l4-4" />
      </svg>
    )
  }
  return order === 'asc' ? (
    <svg className="w-3.5 h-3.5 text-indigo-600 inline ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    </svg>
  ) : (
    <svg className="w-3.5 h-3.5 text-indigo-600 inline ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

// ────────────────────────────────────────────────────────────────
// Main page component
// ────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const isOwner = user?.role === 'owner'

  // ── Filter / sort state ──────────────────────────────────────
  const [searchInput, setSearchInput] = useState('')
  const [category, setCategory] = useState('')
  const [sortBy, setSortBy] = useState<SortField>('name')
  const [order, setOrder] = useState<SortOrder>('asc')
  const [page, setPage] = useState(1)
  const limit = 20

  // Debounce search: 400 ms (Requirement 1.4)
  const debouncedSearch = useDebounce(searchInput, 400)

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, category, sortBy, order])

  // ── Modal/action state ───────────────────────────────────────
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null)
  const [editProduct, setEditProduct] = useState<Product | null | 'new'>(null)

  const onAdjustStock = useCallback((product: Product) => {
    setAdjustProduct(product)
  }, [])

  const onEdit = useCallback((product: Product) => {
    setEditProduct(product)
  }, [])

  const handleAdjustSuccess = useCallback((updatedProduct: Product) => {
    setAdjustProduct(null)
    console.log('Product stock adjusted:', updatedProduct.currentStock)
  }, [])

  // ── Build query params ───────────────────────────────────────
  const queryParams: ProductListQuery = {
    ...(debouncedSearch && { search: debouncedSearch }),
    ...(category && { category }),
    sortBy,
    order,
    page,
    limit,
  }

  // ── Fetch products ───────────────────────────────────────────
  const { data, isLoading, isError, error } = useQuery<PaginatedResponse<Product>>({
    queryKey: ['products', queryParams],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (queryParams.search) params.set('search', queryParams.search)
      if (queryParams.category) params.set('category', queryParams.category)
      if (queryParams.sortBy) params.set('sortBy', queryParams.sortBy)
      if (queryParams.order) params.set('order', queryParams.order)
      params.set('page', String(queryParams.page ?? 1))
      params.set('limit', String(queryParams.limit ?? 20))

      const res = await api.get<PaginatedResponse<Product>>(`/api/products?${params.toString()}`)
      return res.data
    },
  })

  // ── Derive unique categories from fetched data ───────────────
  const categories = Array.from(
    new Set((data?.data ?? []).map((p) => p.category).filter(Boolean) as string[])
  ).sort()

  // ── Archive mutation ─────────────────────────────────────────
  const archiveMutation = useMutation({
    mutationFn: (productId: string) => api.delete(`/api/products/${productId}`),
    onSuccess: () => {
      toast.success('Product archived.')
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to archive product. Please try again.'
      toast.error(msg)
    },
  })

  const handleArchive = (product: Product) => {
    if (!window.confirm(`Archive "${product.name}"? It will be hidden from the product list.`)) {
      return
    }
    archiveMutation.mutate(product.id)
  }

  // ── Sort handler ─────────────────────────────────────────────
  const handleSort = (field: SortField) => {
    if (field === sortBy) {
      setOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setOrder('asc')
    }
  }

  // ── Pagination ───────────────────────────────────────────────
  const totalPages = data ? Math.ceil(data.total / limit) : 1

  // ────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────
  return (
    <>
      {/* Stock Adjustment Modal */}
      {adjustProduct && (
        <StockAdjustmentModal
          product={adjustProduct}
          onClose={() => setAdjustProduct(null)}
          onSuccess={handleAdjustSuccess}
        />
      )}

      {/* Add / Edit Product Modal */}
      {editProduct !== null && (
        <ProductModal
          product={editProduct === 'new' ? undefined : editProduct}
          onClose={() => setEditProduct(null)}
          onSuccess={(_savedProduct) => {
            setEditProduct(null)
            queryClient.invalidateQueries({ queryKey: ['products'] })
          }}
        />
      )}

      <div className="space-y-4">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          {data && (
            <p className="text-sm text-gray-500 mt-0.5">
              {data.total} product{data.total !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Add Product button — owners only (Requirement 1.10) */}
        {isOwner && (
          <button
            onClick={() => setEditProduct('new')}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md shadow-sm transition-colors duration-150"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Product
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Search input (debounced 400 ms — Requirement 1.4) */}
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19A8 8 0 1 1 11 3a8 8 0 0 1 0 16z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name or SKU…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* Category dropdown (Requirement 1.5) */}
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
        >
          <option value="">All categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Table card */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
        {isLoading ? (
          <TableSkeleton />
        ) : isError ? (
          <div className="px-6 py-10 text-center text-red-600">
            <svg className="w-8 h-8 mx-auto mb-2 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12A9 9 0 1 1 3 12a9 9 0 0 1 18 0z" />
            </svg>
            <p className="font-medium">Failed to load products</p>
            <p className="text-sm text-red-400 mt-1">
              {error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.'}
            </p>
          </div>
        ) : (
          <>
            {/* Scrollable table wrapper */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {/* Sortable: Name (Requirement 1.6) */}
                    <th
                      scope="col"
                      onClick={() => handleSort('name')}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700"
                    >
                      Name
                      <SortIcon field="name" current={sortBy} order={order} />
                    </th>

                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      SKU
                    </th>

                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>

                    {/* Sortable: Stock (Requirement 1.6) */}
                    <th
                      scope="col"
                      onClick={() => handleSort('current_stock')}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700"
                    >
                      Stock
                      <SortIcon field="current_stock" current={sortBy} order={order} />
                    </th>

                    {/* Sortable: Threshold (Requirement 1.6) */}
                    <th
                      scope="col"
                      onClick={() => handleSort('low_stock_threshold')}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700"
                    >
                      Threshold
                      <SortIcon field="low_stock_threshold" current={sortBy} order={order} />
                    </th>

                    {/* Sortable: Unit Value = currentStock × costPrice (Requirement 1.6) */}
                    <th
                      scope="col"
                      onClick={() => handleSort('cost_price')}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700"
                    >
                      Unit Value
                      <SortIcon field="cost_price" current={sortBy} order={order} />
                    </th>

                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="bg-white divide-y divide-gray-100">
                  {data?.data.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-10 text-center text-gray-400">
                        <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6m16 0v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6m16 0H4" />
                        </svg>
                        No products found
                        {(debouncedSearch || category) && (
                          <span className="block text-xs mt-1">Try adjusting your search or filter.</span>
                        )}
                      </td>
                    </tr>
                  ) : (
                    data?.data.map((product) => (
                      <ProductRow
                        key={product.id}
                        product={product}
                        isOwner={isOwner}
                        onAdjustStock={onAdjustStock}
                        onEdit={onEdit}
                        onArchive={handleArchive}
                        isArchiving={archiveMutation.isPending && archiveMutation.variables === product.id}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 bg-gray-50">
                <p className="text-xs text-gray-500">
                  Page {page} of {totalPages} &mdash; {data?.total} total
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-2.5 py-1.5 text-xs font-medium rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
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

// ────────────────────────────────────────────────────────────────
// Product row sub-component (keeps the main component clean)
// ────────────────────────────────────────────────────────────────

interface ProductRowProps {
  product: Product
  isOwner: boolean
  onAdjustStock: (product: Product) => void
  onEdit: (product: Product) => void
  onArchive: (product: Product) => void
  isArchiving: boolean
}

function ProductRow({ product, isOwner, onAdjustStock, onEdit, onArchive, isArchiving }: ProductRowProps) {
  const unitValue = product.currentStock * product.costPrice

  return (
    <tr className="hover:bg-gray-50 transition-colors duration-75">
      {/* Name */}
      <td className="px-6 py-3 font-medium text-gray-900 max-w-[200px] truncate">
        {product.name}
      </td>

      {/* SKU */}
      <td className="px-6 py-3 text-gray-500">
        {product.sku ? (
          <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">{product.sku}</code>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </td>

      {/* Category */}
      <td className="px-6 py-3 text-gray-500">
        {product.category ?? <span className="text-gray-300">—</span>}
      </td>

      {/* Stock with StockBadge (Requirement 3.9) */}
      <td className="px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-800">
            {product.currentStock} <span className="text-xs text-gray-400 font-normal">{product.unit}</span>
          </span>
          <StockBadge status={product.stockStatus} />
        </div>
      </td>

      {/* Threshold */}
      <td className="px-6 py-3 text-gray-600">
        {product.lowStockThreshold} <span className="text-xs text-gray-400">{product.unit}</span>
      </td>

      {/* Unit Value = currentStock × costPrice */}
      <td className="px-6 py-3 text-gray-700 font-medium">
        ${unitValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </td>

      {/* Actions */}
      <td className="px-6 py-3 text-right">
        <div className="flex items-center justify-end gap-1.5">
          {/* Adjust Stock — all authenticated users */}
          <button
            onClick={() => onAdjustStock(product)}
            className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded transition-colors duration-100"
            title="Adjust stock"
          >
            Adjust
          </button>

          {/* Edit — all authenticated users (owner-only create; edit is allowed per task spec) */}
          <button
            onClick={() => onEdit(product)}
            className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded transition-colors duration-100"
            title="Edit product"
          >
            Edit
          </button>

          {/* Archive — owners only (Requirement 1.10, 1.11) */}
          {isOwner && (
            <button
              onClick={() => onArchive(product)}
              disabled={isArchiving}
              className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded transition-colors duration-100 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Archive product"
            >
              {isArchiving ? 'Archiving…' : 'Archive'}
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}
