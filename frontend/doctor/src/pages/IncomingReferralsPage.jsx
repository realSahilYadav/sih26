import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchTodayQueue, fetchIncomingReferrals, updateReferralStatus } from '../services/api'
import { useAuth } from '../context/AuthContext'

const STATUS_BADGE = {
  referred: { bg: 'rgba(56,189,248,0.1)', color: '#38bdf8', label: 'Referred' },
  accepted: { bg: 'rgba(251,191,36,0.1)', color: '#fbbf24', label: 'Accepted' },
  in_transit: { bg: 'rgba(168,85,247,0.1)', color: '#a855f7', label: 'In Transit' },
  completed: { bg: 'rgba(52,211,153,0.1)', color: '#34d399', label: 'Completed' },
  follow_up_needed: { bg: 'rgba(239,68,68,0.1)', color: '#f87171', label: 'Follow-up Needed' },
}

const FILTERS = [
  { id: '', label: 'All' },
  { id: 'referred', label: 'Referred' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'in_transit', label: 'In Transit' },
  { id: 'completed', label: 'Completed' },
  { id: 'follow_up_needed', label: 'Follow-up' },
]

export default function IncomingReferralsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  
  const [facilityId, setFacilityId] = useState(null)
  const [loadingFacility, setLoadingFacility] = useState(true)
  const [facilityError, setFacilityError] = useState(null)
  
  const [referrals, setReferrals] = useState([])
  const [loadingRefs, setLoadingRefs] = useState(false)
  const [refError, setRefError] = useState(null)
  
  const [filter, setFilter] = useState('')
  const [updatingId, setUpdatingId] = useState(null)

  // 1. Fetch facility ID from today's queue
  useEffect(() => {
    async function loadFacility() {
      if (!user?.user_id) return
      try {
        const queue = await fetchTodayQueue(user.user_id)
        if (queue && queue.length > 0 && queue[0].facility_id) {
          setFacilityId(queue[0].facility_id)
        } else {
          setFacilityError('Could not determine your facility. You need at least one appointment scheduled today to use this feature.')
        }
      } catch (err) {
        setFacilityError(err.message || 'Failed to determine facility ID')
      } finally {
        setLoadingFacility(false)
      }
    }
    loadFacility()
  }, [user?.user_id])

  // 2. Fetch referrals
  const loadReferrals = useCallback(async () => {
    if (!facilityId) return
    setLoadingRefs(true)
    try {
      const data = await fetchIncomingReferrals(facilityId, filter || undefined)
      setReferrals(data)
      setRefError(null)
    } catch (err) {
      setRefError(err.message || 'Failed to fetch referrals')
    } finally {
      setLoadingRefs(false)
    }
  }, [facilityId, filter])

  useEffect(() => {
    loadReferrals()
    const interval = setInterval(loadReferrals, 30000)
    return () => clearInterval(interval)
  }, [loadReferrals])

  const handleUpdateStatus = async (refId, newStatus) => {
    setUpdatingId(refId)
    try {
      await updateReferralStatus(refId, newStatus)
      await loadReferrals()
    } catch (err) {
      setRefError(err.message || 'Failed to update status')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="app" style={{ alignItems: 'flex-start' }}>
      <div style={{ maxWidth: 800, width: '100%', padding: '1.5rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '1.2rem',
              padding: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
            }}
          >
            ←
          </button>
          <h1 style={{ fontSize: '1.4rem', margin: 0, color: '#f1f5f9' }}>Incoming Referrals</h1>
        </div>

        {loadingFacility && <p style={{ color: '#94a3b8' }}>Determining facility...</p>}
        
        {facilityError && (
          <div style={{ color: '#f87171', background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: 8 }}>
            {facilityError}
          </div>
        )}

        {facilityId && (
          <>
            {/* Filters */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
              {FILTERS.map(f => {
                const isActive = filter === f.id
                return (
                  <button
                    key={f.id}
                    onClick={() => setFilter(f.id)}
                    style={{
                      background: isActive ? 'rgba(52,211,153,0.15)' : 'transparent',
                      border: `1px solid ${isActive ? '#34d399' : '#334155'}`,
                      color: isActive ? '#34d399' : '#94a3b8',
                      padding: '0.4rem 1rem',
                      borderRadius: 20,
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: isActive ? 600 : 400,
                      transition: 'all 0.2s',
                    }}
                  >
                    {f.label}
                  </button>
                )
              })}
            </div>

            {refError && (
              <div style={{ color: '#f87171', background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: 8, marginBottom: '1rem', fontSize: '0.85rem' }}>
                {refError}
              </div>
            )}

            {/* Referrals List */}
            {loadingRefs && referrals.length === 0 ? (
              <p style={{ color: '#94a3b8' }}>Loading referrals...</p>
            ) : referrals.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📭</div>
                <p>No incoming referrals found.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {referrals.map(ref => {
                  const badge = STATUS_BADGE[ref.status] || STATUS_BADGE.referred
                  const isUpdating = updatingId === ref.id

                  return (
                    <div key={ref.id} style={{
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: 12,
                      padding: '1.25rem',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                        <div>
                          <h3 style={{ fontSize: '1.2rem', color: '#f1f5f9', margin: '0 0 0.25rem 0' }}>
                            {ref.patient_name || `Patient #${ref.patient_id}`}
                          </h3>
                          <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                            From: {ref.from_facility_name || 'Unknown Facility'}
                          </div>
                          <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                            Referring Doctor: {ref.referring_doctor_name || 'Unknown Doctor'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{
                            display: 'inline-block',
                            background: badge.bg,
                            color: badge.color,
                            padding: '4px 10px',
                            borderRadius: 12,
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            marginBottom: '0.25rem',
                          }}>
                            {badge.label}
                          </span>
                          <div style={{ color: '#64748b', fontSize: '0.75rem' }}>
                            {new Date(ref.created_at).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>

                      <div style={{ background: '#0f172a', padding: '0.75rem', borderRadius: 8, color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1rem' }}>
                        {ref.reason}
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        {ref.status === 'referred' && (
                          <button
                            onClick={() => handleUpdateStatus(ref.id, 'accepted')}
                            disabled={isUpdating}
                            style={{
                              background: 'rgba(52, 211, 153, 0.1)',
                              border: '1px solid rgba(52, 211, 153, 0.3)',
                              color: '#34d399',
                              padding: '0.5rem 1rem',
                              borderRadius: 6,
                              cursor: isUpdating ? 'wait' : 'pointer',
                              fontWeight: 600,
                              fontSize: '0.85rem',
                              opacity: isUpdating ? 0.6 : 1,
                            }}
                          >
                            Accept
                          </button>
                        )}
                        
                        {ref.status === 'accepted' && (
                          <button
                            onClick={() => handleUpdateStatus(ref.id, 'in_transit')}
                            disabled={isUpdating}
                            style={{
                              background: 'rgba(168, 85, 247, 0.1)',
                              border: '1px solid rgba(168, 85, 247, 0.3)',
                              color: '#a855f7',
                              padding: '0.5rem 1rem',
                              borderRadius: 6,
                              cursor: isUpdating ? 'wait' : 'pointer',
                              fontWeight: 600,
                              fontSize: '0.85rem',
                              opacity: isUpdating ? 0.6 : 1,
                            }}
                          >
                            Mark In Transit
                          </button>
                        )}

                        {ref.status === 'in_transit' && (
                          <>
                            <button
                              onClick={() => handleUpdateStatus(ref.id, 'follow_up_needed')}
                              disabled={isUpdating}
                              style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                color: '#f87171',
                                padding: '0.5rem 1rem',
                                borderRadius: 6,
                                cursor: isUpdating ? 'wait' : 'pointer',
                                fontWeight: 600,
                                fontSize: '0.8rem',
                                opacity: isUpdating ? 0.6 : 1,
                              }}
                            >
                              Needs Follow-up
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(ref.id, 'completed')}
                              disabled={isUpdating}
                              style={{
                                background: 'rgba(52, 211, 153, 0.1)',
                                border: '1px solid rgba(52, 211, 153, 0.3)',
                                color: '#34d399',
                                padding: '0.5rem 1rem',
                                borderRadius: 6,
                                cursor: isUpdating ? 'wait' : 'pointer',
                                fontWeight: 600,
                                fontSize: '0.85rem',
                                opacity: isUpdating ? 0.6 : 1,
                              }}
                            >
                              Complete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
