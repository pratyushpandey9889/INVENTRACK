/**
 * ProductModal — Add/Edit Product modal.
 *
 * - When `product` prop is provided → Edit mode (PATCH /api/products/:id)
 * - When `product` prop is absent → Add mode (POST /api/products)
 *
 * Requirements: 1.1, 1.2, 1.9
 */

import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../lib/api'

// ── Types ────────────────────────────────────────────────────────────────────

export interface Product {
  id: string
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

interface ProductModalProps {
  /** If provided, the modal opens in edit mode pre-populated with this product. */
  product?: Product
  onClose: () => void
  onSuccess: (product: Product) => void
}

// ── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  name: string
  sku: string
  category: string
  unit: string
  currentStock: string
  costPrice: string
  sellingPrice: string
  lowStockThreshold: string
}

interface FieldErrors {
  [field: string]: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toFormState(product?: Product): FormState {
  if (!product) {
    return {
      name: '',
      sku: '',
      category: '',
      unit: 'unit',
      currentStock: '0',
      costPrice: '0',
      sellingPrice: '0',
      lowStockThreshold: '10',
    }
  }
  return {
    name: product.name,
    sku: product.sku ?? '',
    category: product.category ?? '',
    unit: product.unit,
    currentStock: String(product.currentStock),
    costPrice: String(product.costPrice),
    sellingPrice: String(product.sellingPrice),
    lowStockThreshold: String(product.lowStockThreshold),
  }
}

/**
 * Client-side validation. Returns an error map (empty if valid).
 * This mirrors the server-side rules so users get instant feedback.
 */
function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {}

  if (!form.name.trim()) {
    errors.name = 'Name is required.'
  } else if (form.name.trim().length > 200) {
    errors.name = 'Name must be 200 characters or fewer.'
  }

  if (!form.unit.trim()) {
    errors.unit = 'Unit is required.'
  }

  const stock = Number(form.currentStock)
  if (form.currentStock === '' || isNaN(stock)) {
    errors.currentStock = 'Current stock must be a number.'
  } else if (stock < 0) {
    errors.currentStock = 'Stock cannot be negative.'
  }

  const costPrice = Number(form.costPrice)
  if (form.costPrice === '' || isNaN(costPrice)) {
    errors.costPrice = 'Cost price must be a number.'
  } else if (costPrice < 0) {
    errors.costPrice = 'Cost price cannot be negative.'
  }

  const sellingPrice = Number(form.sellingPrice)
  if (form.sellingPrice === '' || isNaN(sellingPrice)) {
    errors.sellingPrice = 'Selling price must be a number.'
  } else if (sellingPrice < 0) {
    errors.sellingPrice = 'Selling price cannot be negative.'
  }

  const threshold = Number(form.lowStockThreshold)
  if (form.lowStockThreshold === '' || isNaN(threshold)) {
    errors.lowStockThreshold = 'Low-stock threshold must be a number.'
  } else if (threshold <= 0) {
    errors.lowStockThreshold = 'Low-stock threshold must be greater than 0.'
  }

  return errors
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ProductModal({ product, onClose, onSuccess }: ProductModalProps) {
  const queryClient = useQueryClient()
  const isEditMode = Boolean(product)

  const [form, setForm] = useState<FormState>(() => toFormState(product))
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)

  // Re-populate the form when the product prop changes (e.g. user picks a
  // different product to edit without unmounting the modal).
  useEffect(() => {
    setForm(toFormState(product))
    setFieldErrors({})
  }, [product])

  // ── Field change handler ─────────────────────────────────────────────────

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    // Clear the field-level error as the user types
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }

  // ── Submit ───────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // 1. Client-side validation
    const clientErrors = validate(form)
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors)
      return
    }

    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim() || undefined,
      category: form.category.trim() || undefined,
      unit: form.unit.trim(),
      currentStock: Number(form.currentStock),
      costPrice: Number(form.costPrice),
      sellingPrice: Number(form.sellingPrice),
      lowStockThreshold: Number(form.lowStockThreshold),
    }

    setSubmitting(true)
    setFieldErrors({})

    try {
      let savedProduct: Product

      if (isEditMode && product) {
        const response = await api.patch<Product>(`/api/products/${product.id}`, payload)
        savedProduct = response.data
      } else {
        const response = await api.post<Product>('/api/products', payload)
        savedProduct = response.data
      }

      // Invalidate the cached product list so the table re-fetches
      await queryClient.invalidateQueries({ queryKey: ['products'] })

      toast.success(isEditMode ? 'Product updated successfully.' : 'Product added successfully.')
      onSuccess(savedProduct)
      onClose()
    } catch (err: unknown) {
      // 2. Surface field-level errors from the API (Req 1.2, 9.2)
      const apiErrors = extractApiErrors(err)
      if (Object.keys(apiErrors).length > 0) {
        setFieldErrors(apiErrors)
      } else {
        const message = extractApiMessage(err) ?? 'Something went wrong. Please try again.'
        toast.error(message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    /* Modal overlay */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-modal-title"
      onClick={(e) => {
        // Close when clicking outside the card
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* White card */}
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 id="product-modal-title" className="text-lg font-semibold text-gray-900">
            {isEditMode ? 'Edit Product' : 'Add Product'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {/* × icon */}
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        {/* Form body — scrollable if content overflows */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-4">
            {/* Name */}
            <Field
              label="Name"
              required
              error={fieldErrors.name}
            >
              <input
                id="field-name"
                name="name"
                type="text"
                value={form.name}
                onChange={handleChange}
                placeholder="e.g. Basmati Rice"
                className={inputClass(fieldErrors.name)}
                autoFocus
              />
            </Field>

            {/* SKU (optional) */}
            <Field label="SKU" hint="Optional" error={fieldErrors.sku}>
              <input
                id="field-sku"
                name="sku"
                type="text"
                value={form.sku}
                onChange={handleChange}
                placeholder="e.g. RICE-001"
                className={inputClass(fieldErrors.sku)}
              />
            </Field>

            {/* Category (optional) */}
            <Field label="Category" hint="Optional" error={fieldErrors.category}>
              <input
                id="field-category"
                name="category"
                type="text"
                value={form.category}
                onChange={handleChange}
                placeholder="e.g. Grains"
                className={inputClass(fieldErrors.category)}
              />
            </Field>

            {/* Unit */}
            <Field label="Unit" required error={fieldErrors.unit}>
              <input
                id="field-unit"
                name="unit"
                type="text"
                value={form.unit}
                onChange={handleChange}
                placeholder="e.g. kg, box, unit"
                className={inputClass(fieldErrors.unit)}
              />
            </Field>

            {/* Numeric fields — 2-column grid */}
            <div className="grid grid-cols-2 gap-4">
              {/* Current / Initial Stock */}
              <Field
                label={isEditMode ? 'Current Stock' : 'Initial Stock'}
                required
                error={fieldErrors.currentStock}
              >
                <input
                  id="field-currentStock"
                  name="currentStock"
                  type="number"
                  min={0}
                  step="any"
                  value={form.currentStock}
                  onChange={handleChange}
                  className={inputClass(fieldErrors.currentStock)}
                />
              </Field>

              {/* Low-stock Threshold */}
              <Field
                label="Low-stock Threshold"
                required
                error={fieldErrors.lowStockThreshold}
              >
                <input
                  id="field-lowStockThreshold"
                  name="lowStockThreshold"
                  type="number"
                  min={1}
                  step="any"
                  value={form.lowStockThreshold}
                  onChange={handleChange}
                  className={inputClass(fieldErrors.lowStockThreshold)}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Cost Price */}
              <Field label="Cost Price" required error={fieldErrors.costPrice}>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400 text-sm">
                    $
                  </span>
                  <input
                    id="field-costPrice"
                    name="costPrice"
                    type="number"
                    min={0}
                    step="any"
                    value={form.costPrice}
                    onChange={handleChange}
                    className={`${inputClass(fieldErrors.costPrice)} pl-7`}
                  />
                </div>
              </Field>

              {/* Selling Price */}
              <Field label="Selling Price" required error={fieldErrors.sellingPrice}>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400 text-sm">
                    $
                  </span>
                  <input
                    id="field-sellingPrice"
                    name="sellingPrice"
                    type="number"
                    min={0}
                    step="any"
                    value={form.sellingPrice}
                    onChange={handleChange}
                    className={`${inputClass(fieldErrors.sellingPrice)} pl-7`}
                  />
                </div>
              </Field>
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
              disabled={submitting}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {submitting
                ? isEditMode
                  ? 'Saving…'
                  : 'Adding…'
                : isEditMode
                  ? 'Save Changes'
                  : 'Add Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ProductModal

// ── Sub-components ────────────────────────────────────────────────────────────

interface FieldProps {
  label: string
  required?: boolean
  hint?: string
  error?: string
  children: React.ReactNode
}

function Field({ label, required, hint, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500" aria-hidden="true">*</span>}
        {hint && <span className="font-normal text-gray-400">({hint})</span>}
      </label>
      {children}
      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

// ── Utility helpers ───────────────────────────────────────────────────────────

function inputClass(error?: string): string {
  const base =
    'w-full rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
  return error
    ? `${base} border-red-400 bg-red-50 focus:ring-red-400`
    : `${base} border-gray-300 bg-white`
}

/**
 * Extracts field-level error messages from an API 400 response.
 * The backend returns them as `{ errors: { fieldName: 'message', ... } }`.
 * Falls back gracefully when the shape differs.
 */
function extractApiErrors(err: unknown): FieldErrors {
  if (
    err &&
    typeof err === 'object' &&
    'response' in err &&
    err.response &&
    typeof err.response === 'object' &&
    'data' in err.response
  ) {
    const data = (err.response as { data?: unknown }).data
    if (data && typeof data === 'object' && 'errors' in data) {
      const errors = (data as { errors: unknown }).errors
      if (errors && typeof errors === 'object' && !Array.isArray(errors)) {
        return errors as FieldErrors
      }
    }
  }
  return {}
}

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
