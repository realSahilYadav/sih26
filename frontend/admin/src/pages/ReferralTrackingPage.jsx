import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchFacilityReferrals, updateReferralStatus, fetchFacilities } from '../services/api'

const STATUS_COLORS = {
  referred: '#38bdf8',
  accepted: '#fbbf24',
  in_transit: '#a855f7',
  completed: '#34d399',
  follow_up_needed: '#f87171'
}

export default function ReferralTrackingPage() {
  const navigate = useNavigate()
  
  const [facilityId, setFacilityId] = useState(() => localStorage.getItem('admin_facility_id'))
  const [facilities, setFacilities] = useState([])
  const [loadingFacilities, setLoadingFacilities] = useState(!facilityId)
  
  const [referrals, setReferrals] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  const [direction, setDirection] = useState('all') // all, incoming, outgoing
  const [status, setStatus] = useState('all') // all, referred, accepted, in_transit, completed, follow_up_needed

  useEffect(() => {
    if (!facilityId) {
      loadFacilities()
    }
  }, [facilityId])

  useEffect(() => {
    if (facilityId) {
      loadReferrals()
      const interval = setInterval(loadReferrals, 30000)
      return () => clearInterval(interval)
    }
  }, [facilityId, direction, status])

  async function loadFacilities() {
    setLoadingFacilities(true)
    try {
      // 19.076, 72.8777 (Mumbai/MH center approx), 500km radius to get most test facilities
      const data = await fetchFacilities(19.076, 72.8777, 500)
      setFacilities(data)
    } catch (err) {
      setError('Failed to load facilities. ' + err.message)
    } finally {
      setLoadingFacilities(false)
    }
  }

  async function loadReferrals() {
    if (!facilityId) return
    setLoading(true)
    try {
      const data = await fetchFacilityReferrals(facilityId, direction === 'all' ? null : direction, status === 'all' ? null : status)
      setReferrals(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleSelectFacility(id) {
    localStorage.setItem('admin_facility_id', id)
    setFacilityId(id)
  }

  async function handleUpdateStatus(id, newStatus) {
    try {
      await updateReferralStatus(id, newStatus)
      loadReferrals()
    } catch (err) {
      alert(err.message)
    }
  }

  if (!facilityId) {
    return (
      <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto', color: '#f1f5f9' }}>
        <h2 style={{ color: '#fb923c' }}>Select Your Facility</h2>
        <p style={{ color: '#94a3b8' }}>Please select the facility you are managing to view its referrals.</p>
        
        {loadingFacilities ? (
          <div style={{ marginTop: '2rem', color: '#64748b' }}>Loading facilities...</div>
        ) : (
          <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {facilities.map(f => (
              <button
                key={f.id}
                onClick={() => handleSelectFacility(f.id)}
                style={{
                  background: '#1e293b', border: '1px solid #334155', padding: '1rem',
                  borderRadius: '8px', color: '#f1f5f9', cursor: 'pointer', textAlign: 'left',
                  transition: 'borderColor 0.2s'
                }}
                onMouseOver={e => e.currentTarget.style.borderColor = '#fb923c'}
                onMouseOut={e => e.currentTarget.style.borderColor = '#334155'}
              >
                <div style={{ fontWeight: 600 }}>{f.name}</div>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.25rem' }}>{f.type} • {f.address}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  const stats = {
    all: referrals.length,
    referred: referrals.filter(r => r.status === 'referred').length,
    accepted: referrals.filter(r => r.status === 'accepted').length,
    in_transit: referrals.filter(r => r.status === 'in_transit').length,
    completed: referrals.filter(r => r.status === 'completed').length,
    follow_up_needed: referrals.filter(r => r.status === 'follow_up_needed').length,
  }

  const statuses = ['all', 'referred', 'accepted', 'in_transit', 'completed', 'follow_up_needed']

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', color: '#f1f5f9' }}>
      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <button 
          onClick={() => navigate('/')}
          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2rem', padding: '0.5rem' }}
        >
          ←
        </button>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Referral Tracking</h1>
        <button 
          onClick={() => { localStorage.removeItem('admin_facility_id'); setFacilityId(null) }}
          style={{ marginLeft: 'auto', background: 'none', border: '1px solid #334155', color: '#94a3b8', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}
        >
          Change Facility
        </button>
      </header>

      {/* Filters */}
      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          
          {/* Direction */}
          <div>
            <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 600, marginBottom: '0.5rem' }}>Direction</div>
            <div style={{ display: 'flex', background: '#0f172a', borderRadius: '8px', padding: '4px' }}>
              {['all', 'incoming', 'outgoing'].map(dir => (
                <button
                  key={dir}
                  onClick={() => setDirection(dir)}
                  style={{
                    background: direction === dir ? '#334155' : 'transparent',
                    color: direction === dir ? '#f1f5f9' : '#94a3b8',
                    border: 'none', padding: '0.5rem 1rem', borderRadius: '6px',
                    cursor: 'pointer', fontSize: '0.9rem', textTransform: 'capitalize', fontWeight: 500
                  }}
                >
                  {dir}
                </button>
              ))}
            </div>
          </div>

          {/* Status Pills */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 600, marginBottom: '0.5rem' }}>Status Filter</div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {statuses.map(s => {
                const isActive = status === s
                return (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    style={{
                      background: isActive ? 'rgba(251,146,60,0.15)' : 'transparent',
                      color: isActive ? '#fb923c' : '#94a3b8',
                      border: `1px solid ${isActive ? '#fb923c' : '#334155'}`,
                      padding: '0.4rem 0.8rem', borderRadius: '999px',
                      cursor: 'pointer', fontSize: '0.85rem', textTransform: 'capitalize',
                      display: 'flex', alignItems: 'center', gap: '0.5rem'
                    }}
                  >
                    {s.replace(/_/g, ' ')}
                    {direction === 'all' && s !== 'all' && (
                      <span style={{ background: isActive ? '#fb923c' : '#334155', color: isActive ? '#fff' : '#f1f5f9', padding: '2px 6px', borderRadius: '10px', fontSize: '0.7rem' }}>
                        {stats[s]}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* List */}
      {error && <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>{error}</div>}
      
      {loading && !referrals.length ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Loading referrals...</div>
      ) : referrals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', background: '#1e293b', border: '1px dashed #334155', borderRadius: '12px', color: '#94a3b8' }}>
          No referrals found for the selected filters.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {referrals.map(ref => {
            const isIncoming = ref.to_facility_id === facilityId
            
            return (
              <div key={ref.id} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '1.2rem' }} title={isIncoming ? 'Incoming Referral' : 'Outgoing Referral'}>
                        {isIncoming ? '↙️' : '↗️'}
                      </span>
                      <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{ref.patient_name || `Patient #${ref.patient_id.substring(0,6)}`}</h3>
                      <span style={{ 
                        background: `${STATUS_COLORS[ref.status]}20`, color: STATUS_COLORS[ref.status],
                        padding: '4px 10px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase'
                      }}>
                        {ref.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    
                    <div style={{ color: '#94a3b8', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ color: isIncoming ? '#94a3b8' : '#fb923c' }}>{ref.from_facility_name || 'Facility A'}</span>
                      <span>→</span>
                      <span style={{ color: isIncoming ? '#fb923c' : '#94a3b8' }}>{ref.to_facility_name || 'Facility B'}</span>
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'right', fontSize: '0.85rem', color: '#64748b' }}>
                    <div>{new Date(ref.created_at).toLocaleString()}</div>
                    <div style={{ marginTop: '0.25rem' }}>By: {ref.referring_doctor_name || 'Doctor'}</div>
                  </div>
                </div>

                {ref.reason && (
                  <div style={{ background: '#0f172a', padding: '1rem', borderRadius: '8px', fontSize: '0.9rem', color: '#cbd5e1' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem', fontWeight: 600 }}>Reason for Referral</div>
                    {ref.reason}
                  </div>
                )}

                {/* Actions for Incoming Referrals */}
                {isIncoming && ['referred', 'accepted', 'in_transit'].includes(ref.status) && (
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', borderTop: '1px solid #334155', paddingTop: '1rem' }}>
                    {ref.status === 'referred' && (
                      <button onClick={() => handleUpdateStatus(ref.id, 'accepted')} style={{ background: '#fbbf24', color: '#000', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
                        Accept Referral
                      </button>
                    )}
                    {ref.status === 'accepted' && (
                      <button onClick={() => handleUpdateStatus(ref.id, 'in_transit')} style={{ background: '#a855f7', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
                        Mark In Transit
                      </button>
                    )}
                    {ref.status === 'in_transit' && (
                      <>
                        <button onClick={() => handleUpdateStatus(ref.id, 'completed')} style={{ background: '#34d399', color: '#000', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
                          Complete (Arrived)
                        </button>
                        <button onClick={() => handleUpdateStatus(ref.id, 'follow_up_needed')} style={{ background: '#f87171', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
                          Needs Follow-up
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
