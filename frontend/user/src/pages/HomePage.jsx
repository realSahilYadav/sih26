import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import '../App.css'

export default function HomePage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const cards = [
    {
      title: 'Check Symptoms',
      description: 'Quick health check — get urgency guidance',
      icon: '🩺',
      path: '/triage',
      gradient: 'linear-gradient(135deg, #22c55e, #0ea5e9)',
    },
    {
      title: 'Find Facilities',
      description: 'Search nearby health centres, PHCs, and hospitals',
      icon: '🏥',
      path: '/facilities',
      gradient: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
    },
    {
      title: 'Find Medicine',
      description: 'Check medicine availability at nearby facilities',
      icon: '💊',
      path: '/medicines',
      gradient: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    },
    {
      title: 'My Appointments',
      description: 'View upcoming and past appointments',
      icon: '📋',
      path: '/appointments',
      gradient: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
    },
    {
      title: 'Profile & Settings',
      description: 'View your profile, ABHA status, and preferences',
      icon: '⚙️',
      path: '/profile',
      gradient: 'linear-gradient(135deg, #64748b, #475569)',
    },
  ]

  return (
    <div className="app">
      <div style={{ maxWidth: 600, width: '100%', padding: '1.5rem' }}>
        <div className="badge">Patient Portal</div>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Rural Healthcare Platform</h1>
        <p className="subtitle" style={{ marginBottom: '1.5rem' }}>
          Welcome back, <strong>{user?.name}</strong>
        </p>

        {user?.needs_abha_linking && (
          <div
            onClick={() => navigate('/abha/link')}
            style={{
              background: 'rgba(251, 191, 36, 0.1)',
              border: '1px solid rgba(251, 191, 36, 0.2)',
              color: '#fbbf24',
              padding: '0.7rem 1rem',
              borderRadius: '8px',
              fontSize: '0.82rem',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              lineHeight: '1.4',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(251, 191, 36, 0.15)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(251, 191, 36, 0.1)')}
          >
            <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>⚠️</span>
            <span style={{ flex: 1 }}>ABHA ID not linked — tap to connect your Ayushman Bharat Health Account</span>
            <span style={{ color: '#fbbf24', fontSize: '1rem', flexShrink: 0 }}>→</span>
          </div>
        )}

        {/* Quick action cards */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          marginBottom: '1.5rem',
        }}>
          {cards.map((card) => (
            <div
              key={card.path}
              onClick={() => navigate(card.path)}
              style={{
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 12,
                padding: '1.25rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                transition: 'border-color 0.2s, transform 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#38bdf8'
                e.currentTarget.style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#334155'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 10,
                background: card.gradient,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.4rem',
                flexShrink: 0,
              }}>
                {card.icon}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#f1f5f9' }}>
                  {card.title}
                </h3>
                <p style={{ margin: '0.2rem 0 0', color: '#94a3b8', fontSize: '0.8rem' }}>
                  {card.description}
                </p>
              </div>
              <span style={{ marginLeft: 'auto', color: '#475569', fontSize: '1.2rem' }}>→</span>
            </div>
          ))}
        </div>

        <button
          onClick={logout}
          style={{
            width: '100%',
            marginTop: '0.5rem',
            background: 'rgba(239, 68, 68, 0.1)',
            borderColor: 'rgba(239, 68, 68, 0.2)',
            color: '#f87171',
            padding: '0.7rem',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: '0.85rem',
          }}
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}
