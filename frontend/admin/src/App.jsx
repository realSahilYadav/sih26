import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import ReferralTrackingPage from './pages/ReferralTrackingPage'
import './App.css'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0f172a' }}>
        <div style={{ width: 40, height: 40, border: '3px solid rgba(251, 146, 60, 0.2)', borderTopColor: '#fb923c', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      </div>
    )
  }
  return user ? children : <Navigate to="/login" replace />
}

function AppRoutes() {
  const { user, loading } = useAuth()
  if (loading) { 
    return (
      <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0f172a' }}>
        <div style={{ width: 40, height: 40, border: '3px solid rgba(251, 146, 60, 0.2)', borderTopColor: '#fb923c', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      </div>
    )
  }
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
      <Route path="/referrals" element={<ProtectedRoute><ReferralTrackingPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
