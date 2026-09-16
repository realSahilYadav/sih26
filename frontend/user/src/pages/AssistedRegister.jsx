import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { registerPatient, textToSpeech } from '../services/api'
import { setActivePatient } from './AssistedHome'
import MicButton from '../components/MicButton'
import '../App.css'

export default function AssistedRegister() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('+91')
  const [language, setLanguage] = useState('hi')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const ttsPlayed = useRef(false)

  // Auto-play voice guidance
  useEffect(() => {
    if (ttsPlayed.current) return
    ttsPlayed.current = true
    const lang = user?.preferred_language || 'hi'
    textToSpeech('Enter the patient\'s name and phone number.', lang)
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

  const handleSubmit = async () => {
    if (!name.trim() || phone.length < 12) return
    setSubmitting(true)
    setError(null)
    try {
      const data = await registerPatient(name.trim(), phone.trim(), language)
      setResult(data)
      // Save patient to session
      setActivePatient({
        patient_id: data.patient_id,
        name: data.name,
        phone: data.phone,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const languages = [
    { code: 'hi', label: 'हिन्दी', english: 'Hindi' },
    { code: 'mr', label: 'मराठी', english: 'Marathi' },
    { code: 'en', label: 'English', english: 'English' },
  ]

  // ── Success screen ──────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="app assisted-mode" style={{ minHeight: '100vh', background: '#0f172a', padding: '1.5rem' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }} className="assisted-animate-in">
          <div style={{ fontSize: '3.5rem', marginTop: '2rem', marginBottom: '1rem' }}>✅</div>

          <h1 style={{ color: '#f1f5f9', marginBottom: '0.5rem' }}>
            {result.message === 'Patient already registered' ? 'Patient Found' : 'Patient Registered'}
          </h1>

          {result.message === 'Patient already registered' && (
            <div style={{
              background: 'rgba(251, 191, 36, 0.1)',
              border: '1px solid rgba(251, 191, 36, 0.2)',
              color: '#fbbf24',
              padding: '0.65rem 1rem',
              borderRadius: 8,
              fontSize: '0.88rem',
              marginBottom: '1rem',
            }}>
              This phone number was already registered
            </div>
          )}

          {/* Patient card */}
          <div style={{
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 14,
            padding: '1.5rem',
            marginBottom: '1.5rem',
            textAlign: 'left',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <div className="patient-banner-avatar" style={{ width: 48, height: 48, fontSize: '1.2rem' }}>
                {result.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '1.1rem' }}>{result.name}</div>
                <div style={{ color: '#64748b', fontSize: '0.85rem' }}>{result.phone}</div>
              </div>
            </div>
            <div style={{ color: '#475569', fontSize: '0.78rem' }}>
              ID: {result.patient_id}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              className="assisted-btn assisted-btn-primary"
              onClick={() => navigate('/assisted/triage')}
            >
              🩺 Proceed to Symptom Check
            </button>
            <button
              className="assisted-btn assisted-btn-secondary"
              onClick={() => navigate('/assisted')}
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Registration form ───────────────────────────────────────────────────
  return (
    <div className="app assisted-mode" style={{ minHeight: '100vh', background: '#0f172a', padding: '1.5rem' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }} className="assisted-animate-in">

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div
            onClick={() => navigate('/assisted')}
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
            Register Patient
          </div>
        </div>

        <div style={{
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: 14,
          padding: '1.5rem',
        }}>
          {/* Name */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: 600 }}>
              Patient Name
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="text"
                className="assisted-input"
                placeholder="Enter full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
              />
              <MicButton onResult={(text) => setName((prev) => prev ? prev + ' ' + text : text)} />
            </div>
          </div>

          {/* Phone */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: 600 }}>
              Phone Number
            </label>
            <input
              type="tel"
              className="assisted-input"
              placeholder="+919876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              autoComplete="off"
            />
          </div>

          {/* Language */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.9rem', marginBottom: '0.75rem', fontWeight: 600 }}>
              Preferred Language
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  className={`assisted-lang-pill ${language === lang.code ? 'active' : ''}`}
                  onClick={() => setLanguage(lang.code)}
                  type="button"
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
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

          {/* Submit */}
          <button
            className="assisted-btn assisted-btn-success"
            disabled={!name.trim() || phone.length < 12 || submitting}
            onClick={handleSubmit}
          >
            {submitting ? (
              <>
                <span style={{
                  width: 18, height: 18,
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite',
                  display: 'inline-block',
                }} />
                Registering…
              </>
            ) : (
              '✓ Register Patient'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
