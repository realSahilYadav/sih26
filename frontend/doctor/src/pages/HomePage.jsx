import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import '../App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function HomePage() {
  const { user, logout } = useAuth()
  const [health, setHealth] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const checkHealth = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/api/health`)
      const data = await res.json()
      setHealth(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkHealth()
  }, [])

  return (
    <div className="app">
      <div className="card">
        <div className="badge badge-doctor">Doctor Portal</div>
        <h1>Rural Healthcare Platform</h1>
        <p className="subtitle">
          Welcome back, <strong>Dr. {user?.name}</strong>
        </p>

        {user?.needs_abha_linking && (
          <div style={{
            background: 'rgba(251, 191, 36, 0.1)',
            border: '1px solid rgba(251, 191, 36, 0.2)',
            color: '#fbbf24',
            padding: '0.7rem 1rem',
            borderRadius: '8px',
            fontSize: '0.82rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            lineHeight: '1.4',
          }}>
            <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>⚠️</span>
            ABHA ID not linked — link your Ayushman Bharat Health Account for full access.
          </div>
        )}

        <div className="health-status">
          <h2>API Health Check</h2>
          {loading && <div className="status loading">Connecting…</div>}
          {error && (
            <div className="status error">
              <span className="dot dot-error"></span>
              Offline — {error}
            </div>
          )}
          {health && (
            <div className="status success">
              <span className="dot dot-success"></span>
              {health.status} — {new Date(health.timestamp).toLocaleString()}
            </div>
          )}
          <button onClick={checkHealth} disabled={loading}>
            Refresh
          </button>
        </div>

        <button
          onClick={logout}
          style={{
            marginTop: '1.5rem',
            background: 'rgba(239, 68, 68, 0.1)',
            borderColor: 'rgba(239, 68, 68, 0.2)',
            color: '#f87171',
          }}
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}
