import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchMyAppointments } from '../services/api'

const STATUS_STYLES = {
  booked: { bg: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', label: 'Booked' },
  checked_in: { bg: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24', label: 'Checked In' },
  in_progress: { bg: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', label: 'In Progress' },
  completed: { bg: 'rgba(52, 211, 153, 0.1)', color: '#34d399', label: 'Completed' },
  cancelled: { bg: 'rgba(100, 116, 139, 0.1)', color: '#64748b', label: 'Cancelled' },
  no_show: { bg: 'rgba(239, 68, 68, 0.1)', color: '#f87171', label: 'No Show' },
}

const ACTIVE_STATUSES = new Set(['booked', 'checked_in', 'in_progress'])

export default function MyAppointments() {
  const navigate = useNavigate()
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('upcoming') // upcoming | past

  useEffect(() => {
    fetchMyAppointments()
      .then(setAppointments)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const upcoming = appointments.filter((a) => ACTIVE_STATUSES.has(a.status))
  const past = appointments.filter((a) => !ACTIVE_STATUSES.has(a.status))
  const displayed = tab === 'upcoming' ? upcoming : past

  return (
    <div style={{ padding: '1.5rem', maxWidth: 700, margin: '0 auto' }}>
      <button
        onClick={() => navigate('/')}
        style={{
          background: 'none',
          border: 'none',
          color: '#38bdf8',
          cursor: 'pointer',
          fontSize: '0.9rem',
          padding: 0,
          marginBottom: '1rem',
        }}
      >
        ← Back to Dashboard
      </button>

      <h1 style={{ fontSize: '1.5rem', marginBottom: '1.25rem' }}>My Appointments</h1>

      {/* Tab switcher */}
      <div style={{
        display: 'flex',
        gap: '0.25rem',
        background: '#1e293b',
        borderRadius: 8,
        padding: '0.25rem',
        marginBottom: '1.25rem',
      }}>
        <button
          onClick={() => setTab('upcoming')}
          style={{
            flex: 1,
            padding: '0.6rem',
            background: tab === 'upcoming' ? '#0ea5e9' : 'transparent',
            color: tab === 'upcoming' ? '#fff' : '#94a3b8',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 500,
            transition: 'all 0.2s',
          }}
        >
          Upcoming ({upcoming.length})
        </button>
        <button
          onClick={() => setTab('past')}
          style={{
            flex: 1,
            padding: '0.6rem',
            background: tab === 'past' ? '#0ea5e9' : 'transparent',
            color: tab === 'past' ? '#fff' : '#94a3b8',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 500,
            transition: 'all 0.2s',
          }}
        >
          Past ({past.length})
        </button>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: '#f87171',
          padding: '0.7rem 1rem',
          borderRadius: 8,
          fontSize: '0.85rem',
          marginBottom: '1rem',
        }}>
          {error}
        </div>
      )}

      {loading && <p style={{ color: '#94a3b8', textAlign: 'center' }}>Loading appointments…</p>}

      {!loading && displayed.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            {tab === 'upcoming' ? 'No upcoming appointments' : 'No past appointments'}
          </p>
          {tab === 'upcoming' && (
            <button
              onClick={() => navigate('/facilities')}
              style={{
                marginTop: '1rem',
                padding: '0.7rem 1.5rem',
                background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              Book an Appointment
            </button>
          )}
        </div>
      )}

      {!loading && displayed.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {displayed.map((appt) => {
            const statusStyle = STATUS_STYLES[appt.status] || STATUS_STYLES.booked
            return (
              <div
                key={appt.id}
                style={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: 10,
                  padding: '1rem 1.25rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#f1f5f9' }}>
                      {appt.doctor_name}
                    </h3>
                    <p style={{ margin: '0.2rem 0 0', color: '#94a3b8', fontSize: '0.8rem' }}>
                      {appt.facility_name}
                    </p>
                  </div>
                  <span style={{
                    background: statusStyle.bg,
                    color: statusStyle.color,
                    padding: '3px 10px',
                    borderRadius: 4,
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}>
                    {statusStyle.label}
                  </span>
                </div>

                <div style={{
                  display: 'flex',
                  gap: '1rem',
                  marginTop: '0.75rem',
                  color: '#94a3b8',
                  fontSize: '0.8rem',
                }}>
                  <span>📅 {new Date(appt.scheduled_at).toLocaleDateString('en-IN', {
                    weekday: 'short', month: 'short', day: 'numeric',
                  })}</span>
                  <span>🕐 {new Date(appt.scheduled_at).toLocaleTimeString('en-IN', {
                    hour: '2-digit', minute: '2-digit',
                  })}</span>
                  {appt.queue_position && (
                    <span style={{ color: '#fbbf24' }}>🎫 Queue #{appt.queue_position}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
