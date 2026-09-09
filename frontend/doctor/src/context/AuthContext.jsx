import { createContext, useContext, useEffect, useState } from 'react'
import { getMe } from '../services/api'

const AuthContext = createContext(null)

const TOKEN_KEY = 'doctor_auth_token'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [loading, setLoading] = useState(true)

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
          localStorage.removeItem(TOKEN_KEY)
          setToken(null)
        }
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY)
        setToken(null)
      })
      .finally(() => setLoading(false))
  }, [token])

  function login(authResponse) {
    localStorage.setItem(TOKEN_KEY, authResponse.access_token)
    setToken(authResponse.access_token)
    setUser({
      user_id: authResponse.user_id,
      name: authResponse.name,
      role: authResponse.role,
      needs_abha_linking: authResponse.needs_abha_linking,
    })
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
