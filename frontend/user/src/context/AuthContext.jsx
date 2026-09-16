import { createContext, useContext, useEffect, useState } from 'react'
import { getMe } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('auth_token'))
  const [loading, setLoading] = useState(true)

  // Validate existing token on mount
  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    getMe()
      .then((data) => {
        if (data) {
          setUser(data)
        } else {
          // Token invalid — clear it
          localStorage.removeItem('auth_token')
          setToken(null)
        }
      })
      .catch(() => {
        localStorage.removeItem('auth_token')
        setToken(null)
      })
      .finally(() => setLoading(false))
  }, [token])

  function login(authResponse) {
    localStorage.setItem('auth_token', authResponse.access_token)
    setToken(authResponse.access_token)
    setUser({
      user_id: authResponse.user_id,
      name: authResponse.name,
      role: authResponse.role,
      needs_abha_linking: authResponse.needs_abha_linking,
      abha_id: authResponse.abha_id || null,
      preferred_language: authResponse.preferred_language || 'en',
    })
  }

  function logout() {
    localStorage.removeItem('auth_token')
    setToken(null)
    setUser(null)
  }

  /**
   * Partially update the user object in context (e.g. after ABHA linking).
   */
  function updateUser(patch) {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
