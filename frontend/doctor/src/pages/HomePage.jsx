import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fetchTodayQueue, updateAppointmentStatus } from '../services/api'
import '../App.css'

const STATUS_STYLES = {
  booked: { bg: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', label: 'Booked' },
  checked_in: { bg: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24', label: 'Checked In' },
  in_progress: { bg: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', label: 'In Progress' },
  completed: { bg: 'rgba(52, 211, 153, 0.1)', color: '#34d399', label: 'Completed' },
  cancelled: { bg: 'rgba(100, 116, 139, 0.1)', color: '#64748b', label: 'Cancelled' },
  no_show: { bg: 'rgba(239, 68, 68, 0.1)', color: '#f87171', label: 'No Show' },
}

// What the next action is for each status
const NEXT_ACTION = {
  booked: { label: 'Check In', nextStatus: 'checked_in', color: '#fbbf24' },
  checked_in: { label: 'Start', nextStatus: 'in_progress', color: '#a855f7' },
  in_progress: { label: 'Complete', nextStatus: 'completed', color: '#34d399' },
}

const REFRESH_INTERVAL = 30000 // 30 seconds

export default function HomePage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [queue, setQueue] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [updating, setUpdating] = useState(null) // appointment ID currently being updated

  const loadQueue = useCallback(async () => {
    if (!user?.user_id) return
    try {
      const data = await fetchTodayQueue(user.user_id)
      setQueue(data)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user?.user_id])

  // Initial load + auto-refresh
  useEffect(() => {
    loadQueue()
    const interval = setInterval(loadQueue, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [loadQueue])

  const handleStatusChange = async (appointmentId, newStatus) => {
    setUpdating(appointmentId)
    try {
      await updateAppointmentStatus(appointmentId, newStatus)
      await loadQueue() // Refresh the list
    } catch (err) {
      setError(err.message)
    } finally {
      setUpdating(null)
    }
  }

  const handleNoShow = async (appointmentId) => {
    setUpdating(appointmentId)
    try {
      await updateAppointmentStatus(appointmentId, 'no_show')
      await loadQueue()
    } catch (err) {
      setError(err.message)
    } finally {
      setUpdating(null)
    }
  }

  const activeQueue = queue.filter(
    (a) => !['completed', 'cancelled', 'no_show'].includes(a.status)
  )
  const completedToday = queue.filter(
    (a) => ['completed', 'no_show', 'cancelled'].includes(a.status)
  )

  return (
    <div className="app" style={{ alignItems: 'flex-start' }}>
      <div style={{ maxWidth: 700, width: '100%', padding: '1.5rem' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '1.5rem',
        }}>
          <div>
            <div style={{
              display: 'inline-block',
              background: 'rgba(52, 211, 153, 0.1)',
              color: '#34d399',
              padding: '3px 10px',
              borderRadius: 4,
              fontSize: '0.7rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '0.5rem',
            }}>
              Doctor Portal
            </div>
            <h1 style={{ fontSize: '1.4rem', margin: 0 }}>Today's Queue</h1>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
              Dr. {user?.name} — {new Date().toLocaleDateString('en-IN', {
                weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
              })}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={loadQueue}
              style={{
                background: '#1e293b',
                border: '1px solid #334155',
                color: '#94a3b8',
                padding: '0.5rem 0.75rem',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: '0.8rem',
              }}
            >
              ↻ Refresh
            </button>
            <button
              onClick={logout}
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: '#f87171',
                padding: '0.5rem 0.75rem',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: '0.8rem',
              }}
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '1.25rem',
        }}>
          {[
            { label: 'In Queue', count: activeQueue.length, color: '#38bdf8' },
            { label: 'Completed', count: completedToday.filter((a) => a.status === 'completed').length, color: '#34d399' },
            { label: 'No Show', count: completedToday.filter((a) => a.status === 'no_show').length, color: '#f87171' },
            { label: 'Total', count: queue.length, color: '#94a3b8' },
          ].map((stat) => (
            <div key={stat.label} style={{
              flex: 1,
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 8,
              padding: '0.75rem',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: stat.color }}>
                {stat.count}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.15rem' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <div
            onClick={() => navigate('/refer')}
            style={{
              flex: 1,
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 8,
              padding: '0.75rem',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = '#34d399'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = '#334155'}
          >
            <div style={{ fontSize: '1.3rem', marginBottom: '0.25rem' }}>↗️</div>
            <div style={{ fontSize: '0.8rem', color: '#f1f5f9', fontWeight: 500 }}>Refer Patient</div>
          </div>
          <div
            onClick={() => navigate('/referrals')}
            style={{
              flex: 1,
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 8,
              padding: '0.75rem',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = '#34d399'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = '#334155'}
          >
            <div style={{ fontSize: '1.3rem', marginBottom: '0.25rem' }}>📥</div>
            <div style={{ fontSize: '0.8rem', color: '#f1f5f9', fontWeight: 500 }}>Incoming Referrals</div>
          </div>
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

        {loading && <p style={{ color: '#94a3b8', textAlign: 'center' }}>Loading queue…</p>}

        {/* Active queue */}
        {!loading && activeQueue.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '3rem 1rem',
            color: '#64748b',
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🎉</div>
            <p style={{ fontSize: '0.95rem' }}>No patients in queue</p>
            <p style={{ fontSize: '0.8rem', color: '#475569' }}>
              Queue auto-refreshes every 30 seconds
            </p>
          </div>
        )}

        {!loading && activeQueue.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.5rem' }}>
            {activeQueue.map((appt, idx) => {
              const statusStyle = STATUS_STYLES[appt.status] || STATUS_STYLES.booked
              const nextAction = NEXT_ACTION[appt.status]
              const isUpdating = updating === appt.id

              return (
                <div
                  key={appt.id}
                  style={{
                    background: '#1e293b',
                    border: `1px solid ${appt.status === 'in_progress' ? '#a855f7' : '#334155'}`,
                    borderRadius: 10,
                    padding: '1rem 1.25rem',
                    transition: 'border-color 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      {/* Queue number */}
                      <div style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: 'rgba(56, 189, 248, 0.1)',
                        color: '#38bdf8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        flexShrink: 0,
                      }}>
                        #{idx + 1}
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#f1f5f9' }}>
                          {appt.patient_name}
                        </h3>
                        <div style={{
                          display: 'flex',
                          gap: '0.5rem',
                          alignItems: 'center',
                          marginTop: '0.2rem',
                        }}>
                          <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>
                            {new Date(appt.scheduled_at).toLocaleTimeString('en-IN', {
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                          {appt.queue_position && (
                            <span style={{
                              background: 'rgba(251, 191, 36, 0.1)',
                              color: '#fbbf24',
                              padding: '1px 6px',
                              borderRadius: 3,
                              fontSize: '0.7rem',
                            }}>
                              Walk-in
                            </span>
                          )}
                          <span style={{
                            background: statusStyle.bg,
                            color: statusStyle.color,
                            padding: '1px 6px',
                            borderRadius: 3,
                            fontSize: '0.7rem',
                            fontWeight: 600,
                          }}>
                            {statusStyle.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{
                    display: 'flex',
                    gap: '0.4rem',
                    marginTop: '0.75rem',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid #334155',
                  }}>
                    {nextAction && (
                      <button
                        onClick={() => handleStatusChange(appt.id, nextAction.nextStatus)}
                        disabled={isUpdating}
                        style={{
                          flex: 1,
                          padding: '0.55rem',
                          background: `${nextAction.color}22`,
                          border: `1px solid ${nextAction.color}44`,
                          color: nextAction.color,
                          borderRadius: 6,
                          cursor: isUpdating ? 'wait' : 'pointer',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          opacity: isUpdating ? 0.6 : 1,
                        }}
                      >
                        {isUpdating ? '…' : `${nextAction.label} →`}
                      </button>
                    )}
                    {appt.status !== 'in_progress' && (
                      <button
                        onClick={() => handleNoShow(appt.id)}
                        disabled={isUpdating}
                        style={{
                          padding: '0.55rem 0.75rem',
                          background: 'rgba(239, 68, 68, 0.08)',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                          color: '#f87171',
                          borderRadius: 6,
                          cursor: isUpdating ? 'wait' : 'pointer',
                          fontSize: '0.8rem',
                          opacity: isUpdating ? 0.6 : 1,
                        }}
                      >
                        No Show
                      </button>
                    )}
                    <button
                      onClick={() => navigate(`/refer?patient_id=${appt.patient_id}&patient_name=${encodeURIComponent(appt.patient_name)}`)}
                      style={{
                        padding: '0.55rem 0.75rem',
                        background: 'rgba(52, 211, 153, 0.08)',
                        border: '1px solid rgba(52, 211, 153, 0.2)',
                        color: '#34d399',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                      }}
                    >
                      Refer
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Completed section */}
        {!loading && completedToday.length > 0 && (
          <div>
            <h2 style={{
              fontSize: '1rem',
              color: '#64748b',
              marginBottom: '0.75rem',
              paddingTop: '0.5rem',
              borderTop: '1px solid #1e293b',
            }}>
              Completed Today ({completedToday.length})
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {completedToday.map((appt) => {
                const statusStyle = STATUS_STYLES[appt.status] || STATUS_STYLES.completed
                return (
                  <div
                    key={appt.id}
                    style={{
                      background: '#1e293b',
                      border: '1px solid #1e293b',
                      borderRadius: 8,
                      padding: '0.7rem 1rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      opacity: 0.6,
                    }}
                  >
                    <div>
                      <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                        {appt.patient_name}
                      </span>
                      <span style={{ color: '#475569', fontSize: '0.78rem', marginLeft: '0.5rem' }}>
                        {new Date(appt.scheduled_at).toLocaleTimeString('en-IN', {
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <span style={{
                      background: statusStyle.bg,
                      color: statusStyle.color,
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: '0.7rem',
                      fontWeight: 600,
                    }}>
                      {statusStyle.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
