/**
 * StockAdjustmentModal — Record a stock change for a product.
 *
 * Movement types:
 *  - restock   → positive changeAmount
 *  - sale      → negative changeAmount
 *  - damage    → negative changeAmount (note required)
 *  - adjustment → negative changeAmount (note required)
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 9.3
 */

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../lib/api'

// ── Types ────────────────────────────────────────────────────────────────────

export interface Product {
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

type MovementType = 'restock' | 'sale' | 'damage' | 'adjustment'

interface StockAdjustmentModalProps {
  product: Product
  onClose: () => void
  onSuccess: (updatedProduct: Product) => void
}

interface MovementResponse {
  movement: {
    id: string
    productId: string
    changeAmount: number
    type: string
    note?: string
    createdAt: string
  }
  updatedProduct: Product
}

// Movement types where a note is required
const NOTE_REQUIRED_TYPES: MovementType[] = ['damage', 'adjustment']

// ── Component ─────────────────────────────────────────────────────────────────

export function StockAdjustmentModal({ product, onClose, onSuccess }: StockAdjustmentModalProps) {
  const queryClient = useQueryClient()

  const [movementType, setMovementType] = useState<MovementType>('restock')
  const [quantityStr, setQuantityStr] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  // ── Derived values ───────────────────────────────────────────────────────

  const quantity = parseFloat(quantityStr)
  const validQuantity = !isNaN(quantity) && quantity > 0

  // Live preview: restock adds, everything else subtracts
  const newStock = validQuantity
    ? movementType === 'restock'
      ? product.currentStock + quantity
      : product.currentStock - quantity
    : null

  const wouldGoNegative = newStock !== null && newStock < 0
  const noteRequired = NOTE_REQUIRED_TYPES.includes(movementType)
  const noteMissing = noteRequired && note.trim() === ''

  const submitDisabled =
    submitting ||
    !validQuantity ||
    wouldGoNegative ||
    noteMissing

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleTypeChange(type: MovementType) {
    setMovementType(type)
    setApiError(null)
  }

  function handleQuantityChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuantityStr(e.target.value)
    setApiError(null)
  }

  function handleNoteChange(e: React.ChangeEvent<HTMLInputElement>) {
    setNote(e.target.value)
    setApiError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitDisabled) return

    // changeAmount: positive for restock, negative for everything else
    const changeAmount = movementType === 'restock' ? quantity : -quantity

    const payload = {
      productId: product.id,
      changeAmount,
      type: movementType,
      ...(note.trim() ? { note: note.trim() } : {}),
    }

    setSubmitting(true)
    setApiError(null)

    try {
      const response = await api.post<MovementResponse>('/api/movements', payload)
      const { updatedProduct } = response.data

      // Invalidate cached product and dashboard data
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['products'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ])

      toast.success('Stock updated successfully.')
      onSuccess(updatedProduct)
      onClose()
    } catch (err: unknown) {
      const message = extractApiMessage(err) ?? 'Something went wrong. Please try again.'
      setApiError(message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stock-adjustment-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* White card */}
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 id="stock-adjustment-modal-title" className="text-lg font-semibold text-gray-900">
              Adjust Stock
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {product.name}
              <span className="ml-2 text-gray-400">
                (Current: {product.currentStock} {product.unit})
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="px-6 py-5 space-y-5">
            {/* API error banner */}
            {apiError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm-.75-4.75a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-1.5 0v4.5Zm.75-8a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" clipRule="evenodd" />
                </svg>
                <span>{apiError}</span>
              </div>
            )}

            {/* Movement type */}
            <fieldset>
              <legend className="text-sm font-medium text-gray-700 mb-2">
                Movement Type <span className="text-red-500" aria-hidden="true">*</span>
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {(['restock', 'sale', 'damage', 'adjustment'] as MovementType[]).map((type) => (
                  <label
                    key={type}
                    className={`flex items-center gap-2.5 cursor-pointer rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                      movementType === type
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="movementType"
                      value={type}
                      checked={movementType === type}
                      onChange={() => handleTypeChange(type)}
                      className="sr-only"
                    />
                    <span
                      className={`h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        movementType === type
                          ? 'border-indigo-500 bg-indigo-500'
                          : 'border-gray-300 bg-white'
                      }`}
                      aria-hidden="true"
                    >
                      {movementType === type && (
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      )}
                    </span>
                    <span className="capitalize">{type}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Quantity */}
            <div className="flex flex-col gap-1">
              <label htmlFor="adj-quantity" className="text-sm font-medium text-gray-700">
                Quantity <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <input
                id="adj-quantity"
                type="number"
                min="0.001"
                step="any"
                value={quantityStr}
                onChange={handleQuantityChange}
                placeholder="Enter a positive number"
                className={`w-full rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  wouldGoNegative
                    ? 'border-red-400 bg-red-50 focus:ring-red-400'
                    : 'border-gray-300 bg-white'
                }`}
                autoFocus
              />
              {wouldGoNegative && (
                <p className="text-xs text-red-600" role="alert">
                  This quantity would reduce stock below zero.
                </p>
              )}
            </div>

            {/* Note */}
            <div className="flex flex-col gap-1">
              <label htmlFor="adj-note" className="text-sm font-medium text-gray-700">
                Note
                {noteRequired && (
                  <span className="text-red-500 ml-1" aria-hidden="true">*</span>
                )}
                {!noteRequired && (
                  <span className="ml-1 font-normal text-gray-400">(Optional)</span>
                )}
              </label>
              <input
                id="adj-note"
                type="text"
                value={note}
                onChange={handleNoteChange}
                placeholder={
                  noteRequired
                    ? `Note is required for ${movementType} movements`
                    : 'Add a note…'
                }
                className={`w-full rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  noteMissing && note !== ''
                    ? 'border-red-400 bg-red-50 focus:ring-red-400'
                    : 'border-gray-300 bg-white'
                }`}
              />
              {noteRequired && note.trim() === '' && quantityStr !== '' && (
                <p className="text-xs text-red-600" role="alert">
                  A note is required for {movementType} movements.
                </p>
              )}
            </div>

            {/* Live preview */}
            <div
              className={`rounded-lg px-4 py-3 text-sm font-medium border ${
                newStock === null
                  ? 'bg-gray-50 border-gray-200 text-gray-400'
                  : wouldGoNegative
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-indigo-50 border-indigo-200 text-indigo-700'
              }`}
              aria-live="polite"
              aria-atomic="true"
            >
              {newStock === null ? (
                'New stock will be: — units'
              ) : wouldGoNegative ? (
                <>
                  New stock would be:{' '}
                  <strong>{newStock.toLocaleString()} {product.unit}</strong>
                  {' '}— cannot go below zero
                </>
              ) : (
                <>
                  New stock will be:{' '}
                  <strong>
                    {newStock.toLocaleString(undefined, { maximumFractionDigits: 4 })} {product.unit}
                  </strong>
                </>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitDisabled}
              title={
                wouldGoNegative
                  ? 'Resulting stock would be negative'
                  : noteMissing
                  ? `A note is required for ${movementType} movements`
                  : undefined
              }
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Saving…' : 'Save Adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default StockAdjustmentModal

// ── Utility helpers ───────────────────────────────────────────────────────────

/**
 * Extracts the top-level `message` string from an API error response.
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
