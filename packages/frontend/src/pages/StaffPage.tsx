/**
 * StaffPage — Owner-only page for managing staff accounts.
 * Requirements: 7.7–7.12
 */

import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import StaffTable from '../components/StaffTable'

export default function StaffPage() {
  const { user } = useAuth()

  // Only owners may access this page. Redirect staff users to home.
  if (user && user.role !== 'owner') {
    return <Navigate to="/" replace />
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
        <p className="text-sm text-gray-500 mt-1">
          Invite team members, update their details, or deactivate accounts.
        </p>
      </div>

      <StaffTable />
    </div>
  )
}
