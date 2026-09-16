import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { fetchDoctorAvailability, bookAppointment } from '../services/api'
import SpeakerButton from '../components/SpeakerButton'

// Steps: doctor → date → slot → confirm
const STEPS = ['doctor', 'date', 'slot', 'confirm']

function formatDate(d) {
  return d.toISOString().split('T')[0]
}

function getNextWeekdays(count = 7) {
  const days = []
  const d = new Date()
  while (days.length < count) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) {
      days.push(new Date(d))
    }
    d.setDate(d.getDate() + 1)
  }
  return days
}

export default function BookAppointment() {
  const { facilityId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const facility = location.state?.facility

  const [step, setStep] = useState(0)
  const [availability, setAvailability] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // Selections
  const [selectedDoctor, setSelectedDoctor] = useState(null)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [isWalkin, setIsWalkin] = useState(false)

  const weekdays = getNextWeekdays(7)

  // Load availability when doctor + date are chosen
  useEffect(() => {
    if (!selectedDate) return
    setLoading(true)
    setError(null)
    fetchDoctorAvailability(facilityId, formatDate(selectedDate))
      .then((data) => setAvailability(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [facilityId, selectedDate])

  const doctorAvailability = availability.find(
    (a) => a.doctor_id === selectedDoctor?.doctor_id
  )
  const availableSlots = doctorAvailability?.slots?.filter((s) => s.available) || []

  const handleBook = async () => {
    setLoading(true)
    setError(null)
    try {
      const body = {
        facility_id: facilityId,
        doctor_id: selectedDoctor.doctor_id,
        is_walkin: isWalkin,
      }
      if (!isWalkin && selectedSlot) {
        // Build ISO datetime from date + slot time
        const [h, m] = selectedSlot.split(':')
        const dt = new Date(selectedDate)
        dt.setHours(parseInt(h), parseInt(m), 0, 0)
        body.scheduled_at = dt.toISOString()
      }
      const result = await bookAppointment(body)
      setSuccess(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const goNext = () => setStep((s) => Math.min(s + 1, STEPS.length - 1))
  const goBack = () => setStep((s) => Math.max(s - 1, 0))

  // ── Success screen ──────────────────────────────────────────────────────
  if (success) {
    return (
      <div style={{ padding: '1.5rem', maxWidth: 500, margin: '0 auto', textAlign: 'center' }}>
        <div style={{
          fontSize: '3rem',
          marginBottom: '1rem',
          marginTop: '3rem',
        }}>✅</div>
        <h2 style={{ color: '#34d399', marginBottom: '0.5rem' }}>Appointment Booked!</h2>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
          <strong>{success.doctor_name}</strong> at <strong>{success.facility_name}</strong>
        </p>
        <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
          {new Date(success.scheduled_at).toLocaleString()}
          {success.queue_position && ` • Queue #${success.queue_position}`}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '2rem' }}>
          <button
            onClick={() => navigate('/appointments')}
            style={{
              padding: '0.7rem 1.5rem',
              background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            View My Appointments
          </button>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '0.7rem 1.5rem',
              background: '#334155',
              color: '#e2e8f0',
              border: '1px solid #475569',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: 600, margin: '0 auto' }}>
      <button
        onClick={() => step === 0 ? navigate(-1) : goBack()}
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
        ← {step === 0 ? 'Back' : 'Previous Step'}
      </button>

      <h1 style={{ fontSize: '1.4rem', marginBottom: '0.25rem' }}>Book Appointment</h1>
      {facility && (
        <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          {facility.name} — {facility.address}
        </p>
      )}

      {/* Step indicator */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '1.5rem',
      }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{
            flex: 1,
            height: 4,
            borderRadius: 2,
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
          padding: '0.7rem 1rem',
          borderRadius: 8,
          fontSize: '0.85rem',
          marginBottom: '1rem',
        }}>
          {error}
        </div>
      )}

      {/* Step 0: Pick doctor */}
      {step === 0 && (
        <div>
          <h2 style={{ fontSize: '1.1rem', color: '#e2e8f0', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Select a Doctor
            <SpeakerButton text="Select a doctor. Choose a date first to see which doctors are available." />
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.82rem', marginBottom: '1rem' }}>
            Choose a date first to see which doctors are available.
          </p>
          {/* Quick date pick to load doctors */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            {weekdays.map((d) => (
              <button
                key={formatDate(d)}
                onClick={() => setSelectedDate(d)}
                style={{
                  padding: '0.5rem 0.75rem',
                  background: selectedDate && formatDate(selectedDate) === formatDate(d)
                    ? '#0ea5e9' : '#1e293b',
                  color: selectedDate && formatDate(selectedDate) === formatDate(d)
                    ? '#fff' : '#94a3b8',
                  border: '1px solid #334155',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                }}
              >
                {d.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}
              </button>
            ))}
          </div>

          {loading && <p style={{ color: '#94a3b8' }}>Loading doctors…</p>}

          {!loading && availability.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {availability.map((doc) => {
                const freeCount = doc.slots.filter((s) => s.available).length
                return (
                  <div
                    key={doc.doctor_id}
                    onClick={() => {
                      setSelectedDoctor(doc)
                      goNext()
                    }}
                    style={{
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: 8,
                      padding: '0.85rem 1rem',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'border-color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#38bdf8')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#334155')}
                  >
                    <div>
                      <strong style={{ color: '#f1f5f9' }}>{doc.doctor_name}</strong>
                      <p style={{ margin: '0.2rem 0 0', color: '#64748b', fontSize: '0.78rem' }}>
                        {freeCount} slot{freeCount !== 1 ? 's' : ''} available
                      </p>
                    </div>
                    <span style={{ color: '#38bdf8', fontSize: '1.2rem' }}>→</span>
                  </div>
                )
              })}
            </div>
          )}

          {!loading && selectedDate && availability.length === 0 && (
            <p style={{ color: '#94a3b8', textAlign: 'center' }}>
              No doctors available on this date.
            </p>
          )}
        </div>
      )}

      {/* Step 1: Pick date (already chosen, show confirmation + change option) */}
      {step === 1 && (
        <div>
          <h2 style={{ fontSize: '1.1rem', color: '#e2e8f0', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Choose Date
            <SpeakerButton text="Choose a date for your appointment." />
          </h2>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            {weekdays.map((d) => (
              <button
                key={formatDate(d)}
                onClick={() => setSelectedDate(d)}
                style={{
                  padding: '0.5rem 0.75rem',
                  background: selectedDate && formatDate(selectedDate) === formatDate(d)
                    ? '#0ea5e9' : '#1e293b',
                  color: selectedDate && formatDate(selectedDate) === formatDate(d)
                    ? '#fff' : '#94a3b8',
                  border: '1px solid #334155',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                }}
              >
                {d.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}
              </button>
            ))}
          </div>

          <div style={{
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 8,
            padding: '1rem',
            marginBottom: '1rem',
          }}>
            <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: 0 }}>
              Selected: <strong style={{ color: '#f1f5f9' }}>{selectedDoctor?.doctor_name}</strong> on{' '}
              <strong style={{ color: '#f1f5f9' }}>
                {selectedDate?.toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' })}
              </strong>
            </p>
          </div>

          <button onClick={goNext} style={{
            width: '100%',
            padding: '0.75rem',
            background: '#0ea5e9',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}>
            Continue to Slot Selection →
          </button>
        </div>
      )}

      {/* Step 2: Pick slot or walk-in */}
      {step === 2 && (
        <div>
          <h2 style={{ fontSize: '1.1rem', color: '#e2e8f0', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Select Time Slot
            <SpeakerButton text="Select a time slot for your appointment. Green slots are available." />
          </h2>

          {/* Walk-in option */}
          <div
            onClick={() => { setIsWalkin(true); setSelectedSlot(null); goNext() }}
            style={{
              background: 'rgba(251, 191, 36, 0.08)',
              border: '1px solid rgba(251, 191, 36, 0.2)',
              borderRadius: 8,
              padding: '0.85rem 1rem',
              cursor: 'pointer',
              marginBottom: '1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <strong style={{ color: '#fbbf24' }}>Walk-in (No fixed time)</strong>
              <p style={{ margin: '0.2rem 0 0', color: '#94a3b8', fontSize: '0.78rem' }}>
                You'll receive a queue position
              </p>
            </div>
            <span style={{ color: '#fbbf24', fontSize: '1.2rem' }}>→</span>
          </div>

          <p style={{ color: '#64748b', fontSize: '0.78rem', textAlign: 'center', margin: '0.75rem 0' }}>
            — or pick a specific slot —
          </p>

          {loading && <p style={{ color: '#94a3b8' }}>Loading slots…</p>}

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '0.4rem',
          }}>
            {doctorAvailability?.slots?.map((slot) => (
              <button
                key={slot.time}
                disabled={!slot.available}
                onClick={() => {
                  setIsWalkin(false)
                  setSelectedSlot(slot.time)
                  goNext()
                }}
                style={{
                  padding: '0.6rem 0.25rem',
                  background: !slot.available
                    ? '#1e293b'
                    : selectedSlot === slot.time
                    ? '#0ea5e9'
                    : '#1e293b',
                  color: !slot.available ? '#475569' : '#e2e8f0',
                  border: `1px solid ${!slot.available ? '#1e293b' : '#334155'}`,
                  borderRadius: 6,
                  cursor: slot.available ? 'pointer' : 'not-allowed',
                  fontSize: '0.8rem',
                  opacity: slot.available ? 1 : 0.4,
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
        <div>
          <h2 style={{ fontSize: '1.1rem', color: '#e2e8f0', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Confirm Booking
            <SpeakerButton text="Please confirm your appointment details and tap the book button." />
          </h2>

          <div style={{
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 10,
            padding: '1.25rem',
            marginBottom: '1.5rem',
          }}>
            <div style={{ marginBottom: '0.75rem' }}>
              <span style={{ color: '#64748b', fontSize: '0.78rem' }}>Facility</span>
              <p style={{ color: '#f1f5f9', margin: '0.15rem 0 0', fontSize: '0.95rem' }}>
                {facility?.name || facilityId}
              </p>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <span style={{ color: '#64748b', fontSize: '0.78rem' }}>Doctor</span>
              <p style={{ color: '#f1f5f9', margin: '0.15rem 0 0', fontSize: '0.95rem' }}>
                {selectedDoctor?.doctor_name}
              </p>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <span style={{ color: '#64748b', fontSize: '0.78rem' }}>Date</span>
              <p style={{ color: '#f1f5f9', margin: '0.15rem 0 0', fontSize: '0.95rem' }}>
                {selectedDate?.toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '0.78rem' }}>Time</span>
              <p style={{ color: '#f1f5f9', margin: '0.15rem 0 0', fontSize: '0.95rem' }}>
                {isWalkin ? (
                  <span style={{ color: '#fbbf24' }}>Walk-in (queue position will be assigned)</span>
                ) : (
                  selectedSlot
                )}
              </p>
            </div>
          </div>

          <button
            onClick={handleBook}
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.85rem',
              background: loading
                ? '#334155'
                : 'linear-gradient(135deg, #0ea5e9, #6366f1)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: loading ? 'wait' : 'pointer',
              fontSize: '1rem',
              fontWeight: 600,
            }}
          >
            {loading ? 'Booking…' : 'Confirm Appointment'}
          </button>
        </div>
      )}
    </div>
  )
}
