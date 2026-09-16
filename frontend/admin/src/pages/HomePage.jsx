import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function HomePage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', color: '#f1f5f9' }}>
      <header style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <span style={{ 
            display: 'inline-block', padding: '4px 14px', borderRadius: '999px', 
            fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', 
            background: 'rgba(251, 146, 60, 0.12)', color: '#fb923c', marginBottom: '1rem' 
          }}>
            Admin Portal
          </span>
          <h1 style={{ fontSize: '2rem', margin: '0 0 0.5rem 0' }}>Facility Dashboard</h1>
          <p style={{ color: '#94a3b8', margin: 0 }}>Welcome back, {user?.name || 'Admin'}</p>
        </div>
        
        <button 
          onClick={logout}
          style={{
            background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.2)',
            padding: '0.6rem 1.2rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem'
          }}
        >
          Sign Out
        </button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {/* Dashboard Card */}
        <div 
          onClick={() => navigate('/dashboard')}
          style={{
            background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '1.5rem',
            cursor: 'pointer', transition: 'transform 0.2s, borderColor 0.2s',
            display: 'flex', flexDirection: 'column', gap: '1rem'
          }}
          onMouseOver={(e) => e.currentTarget.style.borderColor = '#22c55e'}
          onMouseOut={(e) => e.currentTarget.style.borderColor = '#334155'}
        >
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #22c55e, #0ea5e9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem'
          }}>
            📊
          </div>
          <div>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem' }}>Facility Dashboard</h3>
            <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.9rem', lineHeight: 1.5 }}>
              Appointments, referrals, stock alerts, and triage trends — all in one view.
            </p>
          </div>
        </div>

        {/* Referral Tracking Card */}
        <div 
          onClick={() => navigate('/referrals')}
          style={{
            background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '1.5rem',
            cursor: 'pointer', transition: 'transform 0.2s, borderColor 0.2s',
            display: 'flex', flexDirection: 'column', gap: '1rem'
          }}
          onMouseOver={(e) => e.currentTarget.style.borderColor = '#fb923c'}
          onMouseOut={(e) => e.currentTarget.style.borderColor = '#334155'}
        >
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #fb923c, #f59e0b)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem'
          }}>
            🔄
          </div>
          <div>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem' }}>Referral Tracking</h3>
            <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.9rem', lineHeight: 1.5 }}>
              Monitor incoming and outgoing patient referrals, update statuses, and manage transfers.
            </p>
          </div>
        </div>

        {/* Medicine Stock Card */}
        <div 
          onClick={() => navigate('/stock')}
          style={{
            background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '1.5rem',
            cursor: 'pointer', transition: 'transform 0.2s, borderColor 0.2s',
            display: 'flex', flexDirection: 'column', gap: '1rem'
          }}
          onMouseOver={(e) => e.currentTarget.style.borderColor = '#f59e0b'}
          onMouseOut={(e) => e.currentTarget.style.borderColor = '#334155'}
        >
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem'
          }}>
            💊
          </div>
          <div>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem' }}>Medicine Stock</h3>
            <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.9rem', lineHeight: 1.5 }}>
              Track and update medicine inventory for your facility. Add, edit, and monitor stock levels.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
