/**
 * SettingsPage — User account settings and staff management.
 *
 * Sections:
 *  1. "Account" — edit own name and email (PATCH /api/users/:id with logged-in user's id)
 *  2. "Staff Management" — renders <StaffTable> for owners; access-denied message for staff
 *
 * Requirements: 7.7, 7.9
 */

import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'
import StaffTable from '../components/StaffTable'

// ── Types ─────────────────────────────────────────────────────────────────────

interface UpdateProfilePayload {
  name?: string
  email?: string
}

interface UpdatedUser {
  id: string
  name: string
  email: string
  role: 'owner' | 'staff'
  shopId: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function inputClass(error?: string): string {
  const base =
    'w-full rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
  return error
    ? `${base} border-red-400 bg-red-50 focus:ring-red-400`
    : `${base} border-gray-300 bg-white`
}

// ── Field component ───────────────────────────────────────────────────────────

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

// ── Account Section ───────────────────────────────────────────────────────────

interface AccountSectionProps {
  userId: string
  initialName: string
  initialEmail: string
}

function AccountSection({ userId, initialName, initialEmail }: AccountSectionProps) {
  const [name, setName] = useState(initialName)
  const [email, setEmail] = useState(initialEmail)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Keep form in sync if context changes (e.g. after successful update)
  useEffect(() => {
    setName(initialName)
    setEmail(initialEmail)
  }, [initialName, initialEmail])

  function validate(): Record<string, string> {
    const errors: Record<string, string> = {}
    if (!name.trim()) errors.name = 'Name is required.'
    if (!email.trim()) {
      errors.email = 'Email is required.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Enter a valid email address.'
    }
    return errors
  }

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateProfilePayload) =>
      api.patch<UpdatedUser>(`/api/users/${userId}`, payload),
    onSuccess: () => {
      toast.success('Profile updated successfully.')
      setFieldErrors({})
    },
    onError: (err: unknown) => {
      const apiErrors = extractApiErrors(err)
      if (Object.keys(apiErrors).length > 0) {
        setFieldErrors(apiErrors)
      } else {
        const message = extractApiMessage(err) ?? 'Failed to update profile. Please try again.'
        toast.error(message)
      }
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const clientErrors = validate()
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors)
      return
    }

    const payload: UpdateProfilePayload = {}
    if (name.trim() !== initialName) payload.name = name.trim()
    if (email.trim() !== initialEmail) payload.email = email.trim()

    if (Object.keys(payload).length === 0) {
      toast('No changes to save.', { icon: 'ℹ️' })
      return
    }

    setFieldErrors({})
    updateMutation.mutate(payload)
  }

  const submitting = updateMutation.isPending

  return (
    <section aria-labelledby="account-section-title">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Section header */}
        <div className="px-6 py-4 border-b border-gray-100">
          <h2
            id="account-section-title"
            className="text-lg font-semibold text-gray-900"
          >
            Account
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Update your name and email address.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="px-6 py-5 space-y-4 max-w-md">
            <Field label="Name" required error={fieldErrors.name}>
              <input
                id="account-name"
                name="name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (fieldErrors.name) {
                    setFieldErrors((prev) => {
                      const next = { ...prev }
                      delete next.name
                      return next
                    })
                  }
                }}
                placeholder="Your full name"
                className={inputClass(fieldErrors.name)}
                disabled={submitting}
                autoComplete="name"
              />
            </Field>

            <Field label="Email" required error={fieldErrors.email}>
              <input
                id="account-email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (fieldErrors.email) {
                    setFieldErrors((prev) => {
                      const next = { ...prev }
                      delete next.email
                      return next
                    })
                  }
                }}
                placeholder="you@example.com"
                className={inputClass(fieldErrors.email)}
                disabled={submitting}
                autoComplete="email"
              />
            </Field>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
            <button
              type="button"
              onClick={() => {
                setName(initialName)
                setEmail(initialEmail)
                setFieldErrors({})
              }}
              disabled={submitting}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              Reset
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
    </section>
  )
}

// ── Staff Management Section ──────────────────────────────────────────────────

function StaffManagementSection({ isOwner }: { isOwner: boolean }) {
  return (
    <section aria-labelledby="staff-section-title">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Section header */}
        <div className="px-6 py-4 border-b border-gray-100">
          <h2
            id="staff-section-title"
            className="text-lg font-semibold text-gray-900"
          >
            Staff Management
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {isOwner
              ? 'Invite, edit, or deactivate staff members for your shop.'
              : "Manage your shop's team."}
          </p>
        </div>

        <div className="px-6 py-5">
          {isOwner ? (
            /* Owner: full StaffTable (Requirements 7.7, 7.9) */
            <StaffTable />
          ) : (
            /* Staff: access-denied message (Requirement 7.9) */
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="mb-3 flex items-center justify-center w-12 h-12 rounded-full bg-gray-100">
                <svg
                  className="w-6 h-6 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm6 2a6 6 0 0 0-12 0"
                  />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-700">
                You don't have access to this section.
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Staff management is only available to shop owners.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user } = useAuth()
  const isOwner = user?.role === 'owner'

  // While auth is loading or user is absent (should not happen under ProtectedRoute),
  // render nothing to avoid layout shifts.
  if (!user) {
    return null
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage your account and shop preferences.
        </p>
      </div>

      {/* Account section */}
      <AccountSection
        userId={user.id}
        initialName={user.name}
        initialEmail={user.email}
      />

      {/* Staff Management section */}
      <StaffManagementSection isOwner={isOwner} />
    </div>
  )
}
