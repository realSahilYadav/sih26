import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { fetchNearbyFacilities, createReferral } from '../services/api'
import { useAuth } from '../context/AuthContext'

export default function ReferPatientPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  
  const patientId = searchParams.get('patient_id') || ''
  const patientName = searchParams.get('patient_name') || 'Unknown Patient'

  const [facilities, setFacilities] = useState([])
  const [loadingLoc, setLoadingLoc] = useState(false)
  const [locError, setLocError] = useState(null)
  
  const [selectedFacility, setSelectedFacility] = useState(null)
  const [reason, setReason] = useState('')
  
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocError('Geolocation is not supported by your browser')
      return
    }

    setLoadingLoc(true)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords
          const data = await fetchNearbyFacilities(latitude, longitude, 50)
          setFacilities(data)
          setLocError(null)
        } catch (err) {
          setLocError(err.message || 'Failed to fetch facilities')
        } finally {
          setLoadingLoc(false)
        }
      },
      (error) => {
        setLocError('Location access denied or unavailable.')
        setLoadingLoc(false)
      }
    )
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedFacility) {
      setSubmitError('Please select a destination facility.')
      return
    }
    if (!reason.trim()) {
      setSubmitError('Please provide a reason for referral.')
      return
    }

    setSubmitting(true)
    setSubmitError(null)
    try {
      const data = await createReferral({
        patient_id: patientId,
        to_facility_id: selectedFacility.id,
        reason: reason.trim(),
      })
      setSuccess(data)
    } catch (err) {
      setSubmitError(err.message || 'Failed to create referral')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="app" style={{ alignItems: 'flex-start' }}>
        <div style={{ maxWidth: 700, width: '100%', padding: '1.5rem', marginTop: '2rem' }}>
          <div style={{
            background: '#1e293b',
            border: '1px solid #34d399',
            borderRadius: 12,
            padding: '2rem',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
            <h2 style={{ color: '#f1f5f9', margin: '0 0 1rem 0' }}>Referral Created Successfully</h2>
            <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
              Patient <strong>{patientName}</strong> has been referred to <strong>{selectedFacility?.name}</strong>.
            </p>
            <button
              onClick={() => navigate('/')}
              style={{
                background: '#334155',
                color: '#f1f5f9',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: 8,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Back to Queue
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app" style={{ alignItems: 'flex-start' }}>
      <div style={{ maxWidth: 700, width: '100%', padding: '1.5rem' }}>
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
          <h1 style={{ fontSize: '1.4rem', margin: 0, color: '#f1f5f9' }}>Refer Patient</h1>
        </div>

        <div style={{
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: 8,
          padding: '1rem',
          marginBottom: '1.5rem',
        }}>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Patient</div>
          <div style={{ fontSize: '1.1rem', color: '#f1f5f9', fontWeight: 600 }}>{patientName}</div>
          {patientId && <div style={{ fontSize: '0.7rem', color: '#64748b' }}>ID: {patientId}</div>}
        </div>

        <form onSubmit={handleSubmit}>
          <h3 style={{ fontSize: '1rem', color: '#e2e8f0', marginBottom: '0.75rem' }}>Select Destination Facility</h3>
          
          {locError && (
            <div style={{ color: '#f87171', background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: 8, marginBottom: '1rem', fontSize: '0.85rem' }}>
              {locError}
            </div>
          )}
          
          {loadingLoc ? (
            <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Finding nearby facilities...</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
              {facilities.length === 0 && !locError ? (
                <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No facilities found nearby.</p>
              ) : (
                facilities.map(fac => (
                  <div
                    key={fac.id}
                    onClick={() => setSelectedFacility(fac)}
                    style={{
                      background: '#1e293b',
                      border: `2px solid ${selectedFacility?.id === fac.id ? '#34d399' : '#334155'}`,
                      borderRadius: 8,
                      padding: '1rem',
                      cursor: 'pointer',
                      transition: 'border-color 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ color: '#f1f5f9', fontWeight: 600, marginBottom: '0.25rem' }}>{fac.name}</div>
                        <span style={{
                          display: 'inline-block',
                          background: 'rgba(56, 189, 248, 0.1)',
                          color: '#38bdf8',
                          padding: '2px 8px',
                          borderRadius: 12,
                          fontSize: '0.7rem',
                          textTransform: 'uppercase',
                        }}>
                          {fac.type || 'Facility'}
                        </span>
                      </div>
                      {fac.distance_km != null && (
                        <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                          {Number(fac.distance_km).toFixed(1)} km
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', color: '#e2e8f0', marginBottom: '0.75rem' }}>Reason for Referral</h3>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 2000))}
              required
              rows={4}
              placeholder="Describe the reason for referring this patient..."
              style={{
                width: '100%',
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: 8,
                padding: '0.75rem',
                color: '#f1f5f9',
                fontSize: '0.9rem',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
              {reason.length} / 2000
            </div>
          </div>

          {submitError && (
            <div style={{ color: '#f87171', background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: 8, marginBottom: '1rem', fontSize: '0.85rem' }}>
              {submitError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !selectedFacility || !reason.trim()}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, #059669, #34d399)',
              color: '#ffffff',
              border: 'none',
              padding: '0.85rem',
              borderRadius: 8,
              fontSize: '1rem',
              fontWeight: 600,
              cursor: submitting || !selectedFacility || !reason.trim() ? 'not-allowed' : 'pointer',
              opacity: submitting || !selectedFacility || !reason.trim() ? 0.6 : 1,
            }}
          >
            {submitting ? 'Creating...' : 'Create Referral'}
          </button>
        </form>
      </div>
    </div>
  )
}
