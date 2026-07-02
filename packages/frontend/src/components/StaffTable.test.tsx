/**
 * StaffTable component tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '../context/AuthContext'
import StaffTable from './StaffTable'
import api from '../lib/api'

// Mock the API
vi.mock('../lib/api')
const mockedApi = vi.mocked(api)

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const mockOwnerUser = {
  id: 'owner-1',
  name: 'John Owner',
  email: 'owner@test.com',
  role: 'owner' as const,
  shopId: 'shop-1',
  createdAt: '2024-01-01T00:00:00Z',
}

const mockStaffUser = {
  id: 'staff-1',
  name: 'Jane Staff',
  email: 'staff@test.com',
  role: 'staff' as const,
  shopId: 'shop-1',
  createdAt: '2024-01-15T00:00:00Z',
}

const mockStaffMembers = [
  mockStaffUser,
  {
    id: 'staff-2',
    name: 'Bob Staff',
    email: 'bob@test.com',
    role: 'staff' as const,
    shopId: 'shop-1',
    createdAt: '2024-01-20T00:00:00Z',
  },
]

function renderWithProviders(ui: React.ReactElement, { user = mockOwnerUser } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  // Mock the auth context
  const MockAuthProvider = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  )

  // Mock useAuth hook to return our test user
  const originalUseAuth = require('../context/AuthContext').useAuth
  vi.spyOn(require('../context/AuthContext'), 'useAuth').mockReturnValue({
    user,
    token: 'test-token',
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
  })

  const result = render(ui, { wrapper: MockAuthProvider })

  return {
    ...result,
    queryClient,
  }
}

describe('StaffTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Role-based access', () => {
    it('should show permission denied message for non-owner users', () => {
      const staffUser = { ...mockOwnerUser, role: 'staff' as const }
      renderWithProviders(<StaffTable />, { user: staffUser })

      expect(screen.getByText("You don't have permission to view staff management.")).toBeInTheDocument()
    })

    it('should render staff table for owner users', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: mockStaffMembers })

      renderWithProviders(<StaffTable />)

      expect(screen.getByText('Staff Management')).toBeInTheDocument()
      expect(screen.getByText('Invite Staff')).toBeInTheDocument()

      await waitFor(() => {
        expect(screen.getByText('Jane Staff')).toBeInTheDocument()
        expect(screen.getByText('Bob Staff')).toBeInTheDocument()
      })
    })
  })

  describe('Staff list display', () => {
    it('should display staff members in a table', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: mockStaffMembers })

      renderWithProviders(<StaffTable />)

      await waitFor(() => {
        expect(screen.getByText('Jane Staff')).toBeInTheDocument()
        expect(screen.getByText('staff@test.com')).toBeInTheDocument()
        expect(screen.getByText('Bob Staff')).toBeInTheDocument()
        expect(screen.getByText('bob@test.com')).toBeInTheDocument()
      })

      // Check table headers
      expect(screen.getByText('Name')).toBeInTheDocument()
      expect(screen.getByText('Email')).toBeInTheDocument()
      expect(screen.getByText('Date Joined')).toBeInTheDocument()
      expect(screen.getByText('Actions')).toBeInTheDocument()
    })

    it('should show empty state when no staff members exist', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: [] })

      renderWithProviders(<StaffTable />)

      await waitFor(() => {
        expect(screen.getByText('No staff members yet')).toBeInTheDocument()
        expect(screen.getByText('Use "Invite Staff" to add team members.')).toBeInTheDocument()
      })
    })

    it('should show error state when API request fails', async () => {
      mockedApi.get.mockRejectedValueOnce(new Error('Network error'))

      renderWithProviders(<StaffTable />)

      await waitFor(() => {
        expect(screen.getByText('Failed to load staff members')).toBeInTheDocument()
      })
    })
  })

  describe('Invite staff modal', () => {
    it('should open invite modal when invite button is clicked', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: mockStaffMembers })

      renderWithProviders(<StaffTable />)

      const inviteButton = screen.getByText('Invite Staff')
      fireEvent.click(inviteButton)

      expect(screen.getByText('Invite Staff Member')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Enter full name')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Enter email address')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('At least 8 characters')).toBeInTheDocument()
    })

    it('should validate required fields in invite modal', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: [] })

      renderWithProviders(<StaffTable />)

      // Open modal
      fireEvent.click(screen.getByText('Invite Staff'))

      // Try to submit empty form
      fireEvent.click(screen.getByText('Invite Staff'))

      await waitFor(() => {
        expect(screen.getByText('Name is required')).toBeInTheDocument()
        expect(screen.getByText('Email is required')).toBeInTheDocument()
        expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument()
      })
    })

    it('should successfully invite a staff member', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: [] })
      mockedApi.post.mockResolvedValueOnce({ data: mockStaffUser })
      mockedApi.get.mockResolvedValueOnce({ data: [mockStaffUser] })

      renderWithProviders(<StaffTable />)

      // Open modal
      fireEvent.click(screen.getByText('Invite Staff'))

      // Fill form
      fireEvent.change(screen.getByPlaceholderText('Enter full name'), {
        target: { value: 'Jane Staff' },
      })
      fireEvent.change(screen.getByPlaceholderText('Enter email address'), {
        target: { value: 'staff@test.com' },
      })
      fireEvent.change(screen.getByPlaceholderText('At least 8 characters'), {
        target: { value: 'password123' },
      })

      // Submit form
      fireEvent.click(screen.getByText('Invite Staff'))

      await waitFor(() => {
        expect(mockedApi.post).toHaveBeenCalledWith('/api/users', {
          name: 'Jane Staff',
          email: 'staff@test.com',
          password: 'password123',
        })
      })
    })
  })

  describe('Edit staff modal', () => {
    it('should open edit modal when edit button is clicked', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: mockStaffMembers })

      renderWithProviders(<StaffTable />)

      await waitFor(() => {
        expect(screen.getByText('Jane Staff')).toBeInTheDocument()
      })

      // Click edit button for first staff member
      const editButtons = screen.getAllByText('Edit')
      fireEvent.click(editButtons[0])

      expect(screen.getByText('Edit Staff Member')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Jane Staff')).toBeInTheDocument()
      expect(screen.getByDisplayValue('staff@test.com')).toBeInTheDocument()
    })

    it('should successfully update staff member', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: mockStaffMembers })
      mockedApi.patch.mockResolvedValueOnce({ data: { ...mockStaffUser, name: 'Jane Updated' } })
      mockedApi.get.mockResolvedValueOnce({ data: [{ ...mockStaffUser, name: 'Jane Updated' }] })

      renderWithProviders(<StaffTable />)

      await waitFor(() => {
        expect(screen.getByText('Jane Staff')).toBeInTheDocument()
      })

      // Click edit button
      const editButtons = screen.getAllByText('Edit')
      fireEvent.click(editButtons[0])

      // Update name
      const nameInput = screen.getByDisplayValue('Jane Staff')
      fireEvent.change(nameInput, { target: { value: 'Jane Updated' } })

      // Submit
      fireEvent.click(screen.getByText('Save Changes'))

      await waitFor(() => {
        expect(mockedApi.patch).toHaveBeenCalledWith('/api/users/staff-1', {
          name: 'Jane Updated',
          email: 'staff@test.com',
        })
      })
    })
  })

  describe('Deactivate staff', () => {
    it('should show confirmation dialog when deactivate button is clicked', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: mockStaffMembers })

      // Mock window.confirm
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

      renderWithProviders(<StaffTable />)

      await waitFor(() => {
        expect(screen.getByText('Jane Staff')).toBeInTheDocument()
      })

      // Click deactivate button
      const deactivateButtons = screen.getAllByText('Deactivate')
      fireEvent.click(deactivateButtons[0])

      expect(confirmSpy).toHaveBeenCalledWith(
        'Deactivate "Jane Staff"? They will no longer be able to log in.'
      )

      confirmSpy.mockRestore()
    })

    it('should deactivate staff member when confirmed', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: mockStaffMembers })
      mockedApi.delete.mockResolvedValueOnce({ data: { success: true } })
      mockedApi.get.mockResolvedValueOnce({ data: [mockStaffMembers[1]] }) // Remove first staff member

      // Mock window.confirm to return true
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

      renderWithProviders(<StaffTable />)

      await waitFor(() => {
        expect(screen.getByText('Jane Staff')).toBeInTheDocument()
      })

      // Click deactivate button
      const deactivateButtons = screen.getAllByText('Deactivate')
      fireEvent.click(deactivateButtons[0])

      await waitFor(() => {
        expect(mockedApi.delete).toHaveBeenCalledWith('/api/users/staff-1')
      })

      confirmSpy.mockRestore()
    })
  })

  describe('API error handling', () => {
    it('should show error message when invite fails', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: [] })
      mockedApi.post.mockRejectedValueOnce({
        response: {
          data: { errors: { email: 'Email already in use' } },
        },
      })

      renderWithProviders(<StaffTable />)

      // Open modal and submit with valid data
      fireEvent.click(screen.getByText('Invite Staff'))
      
      fireEvent.change(screen.getByPlaceholderText('Enter full name'), {
        target: { value: 'Jane Staff' },
      })
      fireEvent.change(screen.getByPlaceholderText('Enter email address'), {
        target: { value: 'existing@test.com' },
      })
      fireEvent.change(screen.getByPlaceholderText('At least 8 characters'), {
        target: { value: 'password123' },
      })

      fireEvent.click(screen.getByText('Invite Staff'))

      await waitFor(() => {
        expect(screen.getByText('Email already in use')).toBeInTheDocument()
      })
    })
  })
})