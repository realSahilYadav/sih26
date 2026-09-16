import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fetchNearbyFacilities, fetchDoctorAvailability, assistedBooking, textToSpeech } from '../services/api'
import { getActivePatient } from './AssistedHome'
import SpeakerButton from '../components/SpeakerButton'
import '../App.css'

function formatDate(d) {
  return d.toISOString().split('T')[0]
}

function getNextWeekdays(count = 7) {
  const days = []
  const d = new Date()
  while (days.length < count) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) days.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return days
}

export default function AssistedBook() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const patient = getActivePatient()
  const lang = user?.preferred_language || 'hi'
  const ttsPlayed = useRef(false)

  // State
  const [step, setStep] = useState(0) // 0=facility, 1=doctor+date, 2=slot, 3=confirm
  const [facilities, setFacilities] = useState([])
  const [selectedFacility, setSelectedFacility] = useState(null)
  const [availability, setAvailability] = useState([])
  const [selectedDoctor, setSelectedDoctor] = useState(null)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [isWalkin, setIsWalkin] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [geoError, setGeoError] = useState(null)

  const weekdays = getNextWeekdays(7)

  // Redirect if no patient
  useEffect(() => {
    if (!patient) {
      navigate('/assisted/register', { replace: true })
    }
  }, [patient, navigate])

  // Auto-TTS
  useEffect(() => {
    if (ttsPlayed.current) return
    ttsPlayed.current = true
    textToSpeech('Select a nearby facility to book an appointment.', lang)
      .then((data) => {
        if (!data?.audio_base64) return
        const byteChars = atob(data.audio_base64)
        const byteArray = new Uint8Array(byteChars.length)
        for (let i = 0; i < byteChars.length; i++) {
          byteArray[i] = byteChars.charCodeAt(i)
        }
        const blob = new Blob([byteArray], { type: 'audio/wav' })
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        audio.onended = () => URL.revokeObjectURL(url)
        audio.play().catch(() => {})
      })
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load facilities via geolocation
  useEffect(() => {
    setLoading(true)
    if (!navigator.geolocation) {
      setGeoError('Geolocation not available — searching default area')
      fetchNearbyFacilities(19.076, 72.877, 50) // Mumbai fallback
        .then(setFacilities)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fetchNearbyFacilities(pos.coords.latitude, pos.coords.longitude, 50)
          .then(setFacilities)
          .catch((e) => setError(e.message))
          .finally(() => setLoading(false))
      },
      () => {
        setGeoError('Location access denied — searching default area')
        fetchNearbyFacilities(19.076, 72.877, 50)
          .then(setFacilities)
          .catch((e) => setError(e.message))
          .finally(() => setLoading(false))
      },
      { timeout: 5000 }
    )
  }, [])

  // Load doctor availability when facility + date selected
  useEffect(() => {
    if (!selectedFacility || !selectedDate) return
    setLoading(true)
    setError(null)
    fetchDoctorAvailability(selectedFacility.id, formatDate(selectedDate))
      .then(setAvailability)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [selectedFacility, selectedDate])

  const doctorAvailability = availability.find((a) => a.doctor_id === selectedDoctor?.doctor_id)

  const handleBook = async () => {
    setLoading(true)
    setError(null)
    try {
      let scheduledAt = null
      if (!isWalkin && selectedSlot && selectedDate) {
        const [h, m] = selectedSlot.split(':')
        const dt = new Date(selectedDate)
        dt.setHours(parseInt(h), parseInt(m), 0, 0)
        scheduledAt = dt.toISOString()
      }
      const result = await assistedBooking(
        patient.patient_id,
        selectedFacility.id,
        selectedDoctor.doctor_id,
        scheduledAt,
        isWalkin
      )
      setSuccess(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!patient) return null

  // ── Success screen ──────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="app assisted-mode" style={{ minHeight: '100vh', background: '#0f172a', padding: '1.5rem' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }} className="assisted-animate-in">
          <div style={{ fontSize: '3.5rem', marginTop: '2rem', marginBottom: '1rem' }}>✅</div>
          <h1 style={{ color: '#34d399', marginBottom: '0.75rem' }}>Appointment Booked!</h1>

          <div style={{
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 14,
            padding: '1.5rem',
            textAlign: 'left',
            marginBottom: '1.5rem',
          }}>
            <div style={{ marginBottom: '0.75rem' }}>
              <span style={{ color: '#64748b', fontSize: '0.78rem' }}>Patient</span>
              <p style={{ color: '#f1f5f9', margin: '0.15rem 0 0', fontSize: '1rem', fontWeight: 600 }}>
                {patient.name} — {patient.phone}
              </p>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <span style={{ color: '#64748b', fontSize: '0.78rem' }}>Doctor</span>
              <p style={{ color: '#f1f5f9', margin: '0.15rem 0 0', fontSize: '1rem' }}>{success.doctor_name}</p>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <span style={{ color: '#64748b', fontSize: '0.78rem' }}>Facility</span>
              <p style={{ color: '#f1f5f9', margin: '0.15rem 0 0', fontSize: '1rem' }}>{success.facility_name}</p>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '0.78rem' }}>When</span>
              <p style={{ color: '#f1f5f9', margin: '0.15rem 0 0', fontSize: '1rem' }}>
                {new Date(success.scheduled_at).toLocaleString('en-IN')}
                {success.queue_position && ` • Queue #${success.queue_position}`}
              </p>
            </div>
          </div>

          <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            📱 An SMS confirmation will be sent to {patient.phone}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button className="assisted-btn assisted-btn-primary" onClick={() => navigate('/assisted')}>
              ← Back to Dashboard
            </button>
            <button
              className="assisted-btn assisted-btn-secondary"
              onClick={() => {
                setSuccess(null)
                setStep(0)
                setSelectedFacility(null)
                setSelectedDoctor(null)
                setSelectedDate(null)
                setSelectedSlot(null)
              }}
            >
              Book Another
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Booking flow ────────────────────────────────────────────────────────
  return (
    <div className="app assisted-mode" style={{ minHeight: '100vh', background: '#0f172a', padding: '1.5rem 1rem' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div
            onClick={() => {
              if (step > 0) setStep((s) => s - 1)
              else navigate('/assisted')
            }}
            style={{
              cursor: 'pointer',
              color: '#94a3b8',
              padding: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: '#1e293b',
              fontSize: '1.1rem',
            }}
          >
            ←
          </div>
          <div style={{ flex: 1, textAlign: 'center', marginRight: 44, fontWeight: 700, color: '#f1f5f9', fontSize: '1.1rem' }}>
            Book Appointment
          </div>
        </div>

        {/* Patient banner */}
        <div className="patient-banner" style={{ margin: '0 0 1.25rem', borderRadius: 12 }}>
          <div className="patient-banner-avatar">
            {patient.name.charAt(0).toUpperCase()}
          </div>
          <div className="patient-banner-info">
            <div className="patient-banner-name">For: {patient.name}</div>
            <div className="patient-banner-phone">{patient.phone}</div>
          </div>
        </div>

        {/* Step bar */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {['Facility', 'Doctor', 'Slot', 'Confirm'].map((s, i) => (
            <div key={s} style={{
              flex: 1,
              height: 5,
              borderRadius: 3,
              background: i <= step ? '#38bdf8' : '#334155',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#f87171',
            padding: '0.65rem 1rem',
            borderRadius: 8,
            fontSize: '0.88rem',
            marginBottom: '1rem',
          }}>
            {error}
          </div>
        )}

        {geoError && (
          <div style={{
            background: 'rgba(251, 191, 36, 0.08)',
            border: '1px solid rgba(251, 191, 36, 0.15)',
            color: '#fbbf24',
            padding: '0.5rem 0.75rem',
            borderRadius: 8,
            fontSize: '0.78rem',
            marginBottom: '1rem',
          }}>
            {geoError}
          </div>
        )}

        {/* Step 0: Facility */}
        {step === 0 && (
          <div className="assisted-animate-in">
            <h2 style={{ color: '#f1f5f9', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Select Facility
              <SpeakerButton text="Select a nearby health facility." />
            </h2>

            {loading && <p style={{ color: '#94a3b8', textAlign: 'center' }}>Finding nearby facilities…</p>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {facilities.map((f) => (
                <div
                  key={f.id}
                  className="assisted-card"
                  onClick={() => { setSelectedFacility(f); setStep(1) }}
                >
                  <div className="assisted-card-icon" style={{ background: 'linear-gradient(135deg, #0ea5e9, #6366f1)' }}>
                    🏥
                  </div>
                  <div className="assisted-card-text" style={{ flex: 1 }}>
                    <h3>{f.name}</h3>
                    <p>{f.address}</p>
                    {f.distance_km != null && (
                      <p style={{ color: '#38bdf8', fontSize: '0.8rem', marginTop: '0.15rem' }}>
                        {f.distance_km.toFixed(1)} km away
                      </p>
                    )}
                  </div>
                  <span style={{ color: '#475569', fontSize: '1.4rem' }}>→</span>
                </div>
              ))}
            </div>

            {!loading && facilities.length === 0 && (
              <p style={{ color: '#94a3b8', textAlign: 'center', marginTop: '2rem' }}>
                No facilities found nearby.
              </p>
            )}
          </div>
        )}

        {/* Step 1: Doctor + Date */}
        {step === 1 && (
          <div className="assisted-animate-in">
            <h2 style={{ color: '#f1f5f9', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Select Date & Doctor
              <SpeakerButton text="Choose a date, then select a doctor." />
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1rem' }}>
              At {selectedFacility?.name}
            </p>

            {/* Date picker */}
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
              {weekdays.map((d) => (
                <button
                  key={formatDate(d)}
                  onClick={() => setSelectedDate(d)}
                  style={{
                    padding: '0.6rem 0.85rem',
                    background: selectedDate && formatDate(selectedDate) === formatDate(d) ? '#0ea5e9' : '#1e293b',
                    color: selectedDate && formatDate(selectedDate) === formatDate(d) ? '#fff' : '#94a3b8',
                    border: '1px solid #334155',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    minHeight: 44,
                  }}
                >
                  {d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })}
                </button>
              ))}
            </div>

            {loading && <p style={{ color: '#94a3b8' }}>Loading doctors…</p>}

            {!loading && availability.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {availability.map((doc) => {
                  const freeCount = doc.slots.filter((s) => s.available).length
                  return (
                    <div
                      key={doc.doctor_id}
                      className="assisted-card"
                      onClick={() => { setSelectedDoctor(doc); setStep(2) }}
                    >
                      <div className="assisted-card-icon" style={{ background: 'linear-gradient(135deg, #22c55e, #0ea5e9)' }}>
                        👨‍⚕️
                      </div>
                      <div className="assisted-card-text" style={{ flex: 1 }}>
                        <h3>{doc.doctor_name}</h3>
                        <p>{freeCount} slot{freeCount !== 1 ? 's' : ''} available</p>
                      </div>
                      <span style={{ color: '#475569', fontSize: '1.4rem' }}>→</span>
                    </div>
                  )
                })}
              </div>
            )}

            {!loading && selectedDate && availability.length === 0 && (
              <p style={{ color: '#94a3b8', textAlign: 'center' }}>No doctors available on this date.</p>
            )}
          </div>
        )}

        {/* Step 2: Slot or Walk-in */}
        {step === 2 && (
          <div className="assisted-animate-in">
            <h2 style={{ color: '#f1f5f9', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Select Time
              <SpeakerButton text="Choose walk-in or pick a time slot." />
            </h2>

            {/* Walk-in card */}
            <div
              className="assisted-card"
              onClick={() => { setIsWalkin(true); setSelectedSlot(null); setStep(3) }}
              style={{
                borderColor: '#f59e0b',
                marginBottom: '1rem',
              }}
            >
              <div className="assisted-card-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>
                🚶
              </div>
              <div className="assisted-card-text" style={{ flex: 1 }}>
                <h3 style={{ color: '#fbbf24' }}>Walk-in (No fixed time)</h3>
                <p>Queue position will be assigned</p>
              </div>
              <span style={{ color: '#fbbf24', fontSize: '1.4rem' }}>→</span>
            </div>

            <p style={{ color: '#64748b', fontSize: '0.8rem', textAlign: 'center', margin: '0.75rem 0' }}>
              — or pick a specific slot —
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
              {doctorAvailability?.slots?.map((slot) => (
                <button
                  key={slot.time}
                  disabled={!slot.available}
                  onClick={() => { setIsWalkin(false); setSelectedSlot(slot.time); setStep(3) }}
                  style={{
                    padding: '0.75rem 0.25rem',
                    minHeight: 52,
                    background: !slot.available ? '#1e293b' : '#1e293b',
                    color: !slot.available ? '#475569' : '#e2e8f0',
                    border: `1.5px solid ${!slot.available ? '#1e293b' : '#334155'}`,
                    borderRadius: 10,
                    cursor: slot.available ? 'pointer' : 'not-allowed',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    opacity: slot.available ? 1 : 0.35,
                  }}
                >
                  {slot.time}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && (
          <div className="assisted-animate-in">
            <h2 style={{ color: '#f1f5f9', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Confirm Booking
              <SpeakerButton text="Please confirm the appointment details and tap the book button." />
            </h2>

            <div style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 14,
              padding: '1.25rem',
              marginBottom: '1.5rem',
            }}>
              <div style={{ marginBottom: '0.75rem' }}>
                <span style={{ color: '#64748b', fontSize: '0.78rem' }}>Patient</span>
                <p style={{ color: '#f1f5f9', margin: '0.15rem 0 0', fontSize: '1rem', fontWeight: 600 }}>
                  {patient.name}
                </p>
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <span style={{ color: '#64748b', fontSize: '0.78rem' }}>Facility</span>
                <p style={{ color: '#f1f5f9', margin: '0.15rem 0 0', fontSize: '1rem' }}>
                  {selectedFacility?.name}
                </p>
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <span style={{ color: '#64748b', fontSize: '0.78rem' }}>Doctor</span>
                <p style={{ color: '#f1f5f9', margin: '0.15rem 0 0', fontSize: '1rem' }}>
                  {selectedDoctor?.doctor_name}
                </p>
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <span style={{ color: '#64748b', fontSize: '0.78rem' }}>Date</span>
                <p style={{ color: '#f1f5f9', margin: '0.15rem 0 0', fontSize: '1rem' }}>
                  {selectedDate?.toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.78rem' }}>Time</span>
                <p style={{ color: '#f1f5f9', margin: '0.15rem 0 0', fontSize: '1rem' }}>
                  {isWalkin ? (
                    <span style={{ color: '#fbbf24' }}>Walk-in (queue assigned)</span>
                  ) : selectedSlot}
                </p>
              </div>
            </div>

            <button
              className="assisted-btn assisted-btn-success"
              onClick={handleBook}
              disabled={loading}
              style={{ minHeight: 60, fontSize: '1.1rem' }}
            >
              {loading ? (
                <>
                  <span style={{
                    width: 20, height: 20,
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    animation: 'spin 0.7s linear infinite',
                    display: 'inline-block',
                  }} />
                  Booking…
                </>
              ) : (
                '✓ Confirm Appointment'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
