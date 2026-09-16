import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const infoRows = [
    { label: 'Name', value: user?.name || '—' },
    { label: 'Phone', value: user?.phone || '—' },
    { label: 'Role', value: user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : '—' },
    { label: 'Language', value: user?.preferred_language === 'en' ? 'English' : user?.preferred_language || '—' },
    { label: 'Account Created', value: user?.created_at ? new Date(user.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—' },
  ]

  const isLinked = user && !user.needs_abha_linking

  return (
    <div style={{ padding: '1.5rem', maxWidth: 560, margin: '0 auto' }}>
      {/* Back */}
      <button
        onClick={() => navigate('/')}
        style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', fontSize: '0.9rem', padding: 0, marginBottom: '1.5rem' }}
      >
        ← Back to Dashboard
      </button>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%', margin: '0 auto 1rem',
          background: 'linear-gradient(135deg, #6366f1, #ec4899)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '2rem', color: '#fff', fontWeight: 700,
        }}>
          {(user?.name || '?')[0].toUpperCase()}
        </div>
        <h1 style={{ fontSize: '1.4rem', margin: '0 0 0.25rem', color: '#f1f5f9' }}>
          {user?.name || 'Profile'}
        </h1>
        <span style={{
          display: 'inline-block', padding: '3px 12px', borderRadius: 999,
          fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase',
          background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8',
          letterSpacing: '0.05em',
        }}>
          {user?.role || 'patient'}
        </span>
      </div>

      {/* ABHA Status */}
      <div style={{
        background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
        padding: '1.25rem', marginBottom: '1rem',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          marginBottom: '0.75rem',
        }}>
          <span style={{ fontSize: '1.1rem' }}>🆔</span>
          <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#f1f5f9' }}>ABHA Health ID</h3>
        </div>

        {isLinked ? (
          <div style={{
            background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.2)',
            borderRadius: 8, padding: '0.75rem',
            display: 'flex', alignItems: 'center', gap: '0.75rem',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(34, 197, 94, 0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1rem', flexShrink: 0,
            }}>
              ✓
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: '#4ade80', fontWeight: 600, marginBottom: 2 }}>
                Linked
              </div>
              <div style={{
                color: '#e2e8f0', fontSize: '0.9rem', fontWeight: 500,
                fontFamily: 'ui-monospace, monospace', letterSpacing: '0.03em',
              }}>
                {user.abha_id}
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div style={{
              background: 'rgba(251, 191, 36, 0.08)', border: '1px solid rgba(251, 191, 36, 0.2)',
              borderRadius: 8, padding: '0.75rem', marginBottom: '0.75rem',
              display: 'flex', alignItems: 'center', gap: '0.6rem',
              color: '#fbbf24', fontSize: '0.85rem',
            }}>
              <span style={{ fontSize: '1rem', flexShrink: 0 }}>⚠️</span>
              Not linked — connect your ABHA ID for seamless health record access
            </div>
            <button
              onClick={() => navigate('/abha/link')}
              style={{
                width: '100%', padding: '0.65rem',
                background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
                color: '#fff', border: 'none', borderRadius: 8,
                fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Link ABHA ID
            </button>
          </div>
        )}
      </div>

      {/* Info card */}
      <div style={{
        background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
        overflow: 'hidden', marginBottom: '1rem',
      }}>
        {infoRows.map((row, idx) => (
          <div
            key={row.label}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '0.85rem 1.25rem',
              borderBottom: idx < infoRows.length - 1 ? '1px solid rgba(51, 65, 85, 0.5)' : 'none',
            }}
          >
            <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{row.label}</span>
            <span style={{ color: '#f1f5f9', fontSize: '0.9rem', fontWeight: 500 }}>{row.value}</span>
          </div>
        ))}
      </div>

      {/* Sign out */}
      <button
        onClick={logout}
        style={{
          width: '100%', padding: '0.7rem',
          background: 'rgba(239, 68, 68, 0.1)',
          color: '#f87171',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: 8, cursor: 'pointer',
          fontSize: '0.85rem', fontWeight: 500,
        }}
      >
        Sign Out
      </button>
    </div>
  )
}
