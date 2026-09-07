import { useEffect, useState } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function App() {
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
        <p className="subtitle">Doctor Frontend</p>

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
      </div>
    </div>
  )
}

export default App
