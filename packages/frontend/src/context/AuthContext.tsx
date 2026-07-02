import React, { createContext, useContext, useEffect, useState } from 'react'
import api from '../lib/api'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: 'owner' | 'staff'
  shopId: string
  createdAt: string
}

interface AuthState {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  register: (name: string, shopName: string, email: string, password: string) => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // On mount, if a token exists in localStorage, fetch current user
  useEffect(() => {
    if (!token) {
      setIsLoading(false)
      return
    }

    api
      .get<AuthUser>('/api/auth/me')
      .then((res) => {
        setUser(res.data)
      })
      .catch(() => {
        // Token is invalid or expired — clear it
        localStorage.removeItem('token')
        setToken(null)
        setUser(null)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [token])

  const login = async (email: string, password: string): Promise<void> => {
    const res = await api.post<{ token: string; user: AuthUser }>('/api/auth/login', {
      email,
      password,
    })
    const { token: newToken, user: newUser } = res.data
    localStorage.setItem('token', newToken)
    setToken(newToken)
    setUser(newUser)
  }

  const logout = (): void => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }

  const register = async (
    name: string,
    shopName: string,
    email: string,
    password: string,
  ): Promise<void> => {
    const res = await api.post<{ token: string; user: AuthUser }>('/api/auth/register', {
      name,
      shopName,
      email,
      password,
    })
    const { token: newToken, user: newUser } = res.data
    localStorage.setItem('token', newToken)
    setToken(newToken)
    setUser(newUser)
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>')
  }
  return ctx
}

export default AuthContext
