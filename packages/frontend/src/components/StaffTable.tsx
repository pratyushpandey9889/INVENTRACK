/**
 * StaffTable — Staff management table for shop owners.
 *
 * - Lists all staff members (GET /api/users)
 * - "Invite Staff" button opens an inline modal to create a new staff account (POST /api/users)
 * - Edit button opens an inline modal to update name/email (PATCH /api/users/:id)
 * - Deactivate button calls DELETE /api/users/:id with a confirmation prompt
 *
 * Requirements: 7.7, 7.8, 7.9, 7.10, 7.11, 7.12
 */

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../lib/api'

// ── Types ────────────────────────────────────────────────────────────────────

export interface StaffUser {
  id: string
  shopId: string
  name: string
  email: string
  role: 'staff'
  createdAt: string
}

// ── API helpers ───────────────────────────────────────────────────────────────

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

function extractApiErrors(err: unknown): Record<string, string> {
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
        return errors as Record<string, string>
      }
    }
  }
  return {}
}

// ── Shared field + input utilities ────────────────────────────────────────────

function inputClass(error?: string): string {
  const base =
    'w-full rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
  return error
    ? `${base} border-red-400 bg-red-50 focus:ring-red-400`
    : `${base} border-gray-300 bg-white`
}

interface FieldProps {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}

function Field({ label, required, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
        {label}
        {required && (
          <span className="text-red-500" aria-hidden="true">
            *
          </span>
        )}
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

// ── Invite Modal ──────────────────────────────────────────────────────────────

interface InviteFormState {
  name: string
  email: string
  password: string
}

interface InviteModalProps {
  onClose: () => void
  onSuccess: () => void
}

function InviteModal({ onClose, onSuccess }: InviteModalProps) {
  const [form, setForm] = useState<InviteFormState>({ name: '', email: '', password: '' })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }

  function validate(): Record<string, string> {
    const errors: Record<string, string> = {}
    if (!form.name.trim()) errors.name = 'Name is required.'
    if (!form.email.trim()) {
      errors.email = 'Email is required.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errors.email = 'Enter a valid email address.'
    }
    if (!form.password) {
      errors.password = 'Password is required.'
    } else if (form.password.length < 8) {
      errors.password = 'Password must be at least 8 characters.'
    } else if (form.password.length > 72) {
      errors.password = 'Password must be 72 characters or fewer.'
    }
    return errors
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const clientErrors = validate()
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors)
      return
    }

    setSubmitting(true)
    setFieldErrors({})

    try {
      await api.post<StaffUser>('/api/users', {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      })
      toast.success('Staff member invited successfully.')
      onSuccess()
      onClose()
    } catch (err) {
      const apiErrors = extractApiErrors(err)
      if (Object.keys(apiErrors).length > 0) {
        setFieldErrors(apiErrors)
      } else {
        const message = extractApiMessage(err) ?? 'Failed to invite staff member. Please try again.'
        toast.error(message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 id="invite-modal-title" className="text-lg font-semibold text-gray-900">
            Invite Staff Member
          </h2>
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
          <div className="px-6 py-5 space-y-4">
            <Field label="Name" required error={fieldErrors.name}>
              <input
                id="invite-name"
                name="name"
                type="text"
                value={form.name}
                onChange={handleChange}
                placeholder="e.g. Jane Smith"
                className={inputClass(fieldErrors.name)}
                autoFocus
              />
            </Field>

            <Field label="Email" required error={fieldErrors.email}>
              <input
                id="invite-email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="e.g. jane@shop.com"
                className={inputClass(fieldErrors.email)}
              />
            </Field>

            <Field label="Password" required error={fieldErrors.password}>
              <input
                id="invite-password"
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Minimum 8 characters"
                className={inputClass(fieldErrors.password)}
              />
            </Field>
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
              {submitting ? 'Inviting…' : 'Send Invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Edit Modal ────────────────────────────────────────────────────────────────

interface EditFormState {
  name: string
  email: string
}

interface EditModalProps {
  staff: StaffUser
  onClose: () => void
  onSuccess: () => void
}

function EditModal({ staff, onClose, onSuccess }: EditModalProps) {
  const [form, setForm] = useState<EditFormState>({ name: staff.name, email: staff.email })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  // Re-populate when staff prop changes
  useEffect(() => {
    setForm({ name: staff.name, email: staff.email })
    setFieldErrors({})
  }, [staff])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }

  function validate(): Record<string, string> {
    const errors: Record<string, string> = {}
    if (!form.name.trim()) errors.name = 'Name is required.'
    if (!form.email.trim()) {
      errors.email = 'Email is required.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errors.email = 'Enter a valid email address.'
    }
    return errors
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const clientErrors = validate()
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors)
      return
    }

    const payload: Partial<EditFormState> = {}
    if (form.name.trim() !== staff.name) payload.name = form.name.trim()
    if (form.email.trim() !== staff.email) payload.email = form.email.trim()

    if (Object.keys(payload).length === 0) {
      onClose()
      return
    }

    setSubmitting(true)
    setFieldErrors({})

    try {
      await api.patch<StaffUser>(`/api/users/${staff.id}`, payload)
      toast.success('Staff member updated successfully.')
      onSuccess()
      onClose()
    } catch (err) {
      const apiErrors = extractApiErrors(err)
      if (Object.keys(apiErrors).length > 0) {
        setFieldErrors(apiErrors)
      } else {
        const message = extractApiMessage(err) ?? 'Failed to update staff member. Please try again.'
        toast.error(message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-staff-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 id="edit-staff-modal-title" className="text-lg font-semibold text-gray-900">
            Edit Staff Member
          </h2>
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
          <div className="px-6 py-5 space-y-4">
            <Field label="Name" required error={fieldErrors.name}>
              <input
                id="edit-staff-name"
                name="name"
                type="text"
                value={form.name}
                onChange={handleChange}
                placeholder="e.g. Jane Smith"
                className={inputClass(fieldErrors.name)}
                autoFocus
              />
            </Field>

            <Field label="Email" required error={fieldErrors.email}>
              <input
                id="edit-staff-email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="e.g. jane@shop.com"
                className={inputClass(fieldErrors.email)}
              />
            </Field>
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
              {submitting ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="animate-pulse">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex gap-4 px-6 py-4 border-b border-gray-100">
          <div className="h-4 bg-gray-200 rounded w-1/4" />
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-200 rounded w-1/6" />
          <div className="h-4 bg-gray-200 rounded w-1/6" />
        </div>
      ))}
    </div>
  )
}

// ── Format date helper ────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function StaffTable() {
  const queryClient = useQueryClient()

  const [showInvite, setShowInvite] = useState(false)
  const [editTarget, setEditTarget] = useState<StaffUser | null>(null)

  // ── Fetch staff list (Requirements 7.10) ─────────────────────────────────
  const { data: staffList, isLoading, isError, error } = useQuery<StaffUser[]>({
    queryKey: ['staff'],
    queryFn: async () => {
      const res = await api.get<StaffUser[]>('/api/users')
      return res.data
    },
  })

  // ── Deactivate mutation (Requirements 7.11, 7.12) ────────────────────────
  const deactivateMutation = useMutation({
    mutationFn: (staffId: string) => api.delete(`/api/users/${staffId}`),
    onSuccess: () => {
      toast.success('Staff member deactivated.')
      queryClient.invalidateQueries({ queryKey: ['staff'] })
    },
    onError: (err: unknown) => {
      const message = extractApiMessage(err) ?? 'Failed to deactivate staff member. Please try again.'
      toast.error(message)
    },
  })

  function handleDeactivate(member: StaffUser) {
    if (
      !window.confirm(
        `Deactivate "${member.name}"? They will no longer be able to log in.`
      )
    ) {
      return
    }
    deactivateMutation.mutate(member.id)
  }

  function handleInviteSuccess() {
    queryClient.invalidateQueries({ queryKey: ['staff'] })
  }

  function handleEditSuccess() {
    queryClient.invalidateQueries({ queryKey: ['staff'] })
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Invite Modal */}
      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onSuccess={handleInviteSuccess}
        />
      )}

      {/* Edit Modal */}
      {editTarget && (
        <EditModal
          staff={editTarget}
          onClose={() => setEditTarget(null)}
          onSuccess={handleEditSuccess}
        />
      )}

      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Staff Members</h2>
            {staffList && (
              <p className="text-sm text-gray-500 mt-0.5">
                {staffList.length} staff member{staffList.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Invite Staff button (Requirement 7.7) */}
          <button
            onClick={() => setShowInvite(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md shadow-sm transition-colors duration-150"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Invite Staff
          </button>
        </div>

        {/* Table card */}
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
          {isLoading ? (
            <TableSkeleton />
          ) : isError ? (
            /* Error state */
            <div className="px-6 py-10 text-center text-red-600">
              <svg
                className="w-8 h-8 mx-auto mb-2 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12A9 9 0 1 1 3 12a9 9 0 0 1 18 0z"
                />
              </svg>
              <p className="font-medium">Failed to load staff members</p>
              <p className="text-sm text-red-400 mt-1">
                {error instanceof Error
                  ? error.message
                  : 'An unexpected error occurred. Please try again.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Name
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Email
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Date Joined
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="bg-white divide-y divide-gray-100">
                  {!staffList || staffList.length === 0 ? (
                    /* Empty state */
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-gray-400">
                        <svg
                          className="w-8 h-8 mx-auto mb-2 text-gray-300"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M17 20h5v-2a4 4 0 0 0-4-4h-1M9 20H4v-2a4 4 0 0 1 4-4h1m4-4a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm6 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a3 3 0 0 1 3-3"
                          />
                        </svg>
                        <p>No staff members yet</p>
                        <p className="text-xs mt-1">
                          Click "Invite Staff" to add your first team member.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    staffList.map((member) => (
                      <StaffRow
                        key={member.id}
                        member={member}
                        onEdit={() => setEditTarget(member)}
                        onDeactivate={() => handleDeactivate(member)}
                        isDeactivating={
                          deactivateMutation.isPending &&
                          deactivateMutation.variables === member.id
                        }
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Staff row sub-component ───────────────────────────────────────────────────

interface StaffRowProps {
  member: StaffUser
  onEdit: () => void
  onDeactivate: () => void
  isDeactivating: boolean
}

function StaffRow({ member, onEdit, onDeactivate, isDeactivating }: StaffRowProps) {
  return (
    <tr className="hover:bg-gray-50 transition-colors duration-75">
      {/* Name */}
      <td className="px-6 py-3 font-medium text-gray-900">
        {member.name}
      </td>

      {/* Email */}
      <td className="px-6 py-3 text-gray-600">
        {member.email}
      </td>

      {/* Date Joined */}
      <td className="px-6 py-3 text-gray-500">
        {formatDate(member.createdAt)}
      </td>

      {/* Actions */}
      <td className="px-6 py-3 text-right">
        <div className="flex items-center justify-end gap-1.5">
          {/* Edit (Requirement 7.9) */}
          <button
            onClick={onEdit}
            disabled={isDeactivating}
            className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded transition-colors duration-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Edit staff member"
          >
            Edit
          </button>

          {/* Deactivate (Requirements 7.11, 7.12) */}
          <button
            onClick={onDeactivate}
            disabled={isDeactivating}
            className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded transition-colors duration-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Deactivate staff member"
          >
            {isDeactivating ? 'Deactivating…' : 'Deactivate'}
          </button>
        </div>
      </td>
    </tr>
  )
}
