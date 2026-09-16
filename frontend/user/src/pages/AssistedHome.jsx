import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { textToSpeech } from '../services/api'
import '../App.css'

/**
 * Helper to get/set the active patient from sessionStorage.
 */
export function getActivePatient() {
  try {
    const raw = sessionStorage.getItem('assisted_patient')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setActivePatient(patient) {
  if (patient) {
    sessionStorage.setItem('assisted_patient', JSON.stringify(patient))
  } else {
    sessionStorage.removeItem('assisted_patient')
  }
}

export default function AssistedHome() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [patient, setPatient] = useState(getActivePatient)
  const ttsPlayed = useRef(false)

  // Auto-play voice guidance on first mount
  useEffect(() => {
    if (ttsPlayed.current) return
    ttsPlayed.current = true

    const lang = user?.preferred_language || 'hi'
    const text = patient
      ? `Welcome. You are working with patient ${patient.name}. Choose an action below.`
      : 'Welcome. Please register a patient first, or choose an action below.'

    textToSpeech(text, lang).then((data) => {
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
    }).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const clearPatient = () => {
    setActivePatient(null)
    setPatient(null)
  }

  const cards = [
    {
      title: 'Register Patient',
      description: 'New patient without a smartphone',
      icon: '👤',
      path: '/assisted/register',
      gradient: 'linear-gradient(135deg, #22c55e, #0ea5e9)',
      always: true,
    },
    {
      title: 'Check Symptoms',
      description: patient ? `For ${patient.name}` : 'Register patient first',
      icon: '🩺',
      path: '/assisted/triage',
      gradient: 'linear-gradient(135deg, #f59e0b, #ef4444)',
      always: false,
    },
    {
      title: 'Book Appointment',
      description: patient ? `For ${patient.name}` : 'Register patient first',
      icon: '📋',
      path: '/assisted/book',
      gradient: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
      always: false,
    },
  ]

  return (
    <div className="app assisted-mode" style={{ minHeight: '100vh', background: '#0f172a', padding: '1.5rem' }}>
      <div style={{ maxWidth: 560, width: '100%', margin: '0 auto' }} className="assisted-animate-in">

        <div className="assisted-badge">🏥 Health Worker Mode</div>
        <h1 style={{ marginBottom: '0.25rem', color: '#f1f5f9' }}>Assisted Mode</h1>
        <p style={{ color: '#94a3b8', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
          Welcome, <strong>{user?.name}</strong>
        </p>

        {/* Active patient banner */}
        {patient && (
          <div className="patient-banner" style={{ margin: '0 0 1.25rem', borderRadius: 12 }}>
            <div className="patient-banner-avatar">
              {patient.name.charAt(0).toUpperCase()}
            </div>
            <div className="patient-banner-info">
              <div className="patient-banner-name">{patient.name}</div>
              <div className="patient-banner-phone">{patient.phone}</div>
            </div>
            <button className="patient-banner-change" onClick={clearPatient}>
              Clear
            </button>
          </div>
        )}

        {/* Action cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.5rem' }}>
          {cards.map((card) => {
            const disabled = !card.always && !patient
            return (
              <div
                key={card.path}
                className="assisted-card"
                onClick={() => !disabled && navigate(card.path)}
                style={{
                  opacity: disabled ? 0.45 : 1,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  pointerEvents: disabled ? 'none' : 'auto',
                }}
              >
                <div
                  className="assisted-card-icon"
                  style={{ background: card.gradient }}
                >
                  {card.icon}
                </div>
                <div className="assisted-card-text">
                  <h3>{card.title}</h3>
                  <p>{card.description}</p>
                </div>
                <span style={{ marginLeft: 'auto', color: '#475569', fontSize: '1.4rem' }}>→</span>
              </div>
            )
          })}
        </div>

        {/* Sign out */}
        <button
          className="assisted-btn assisted-btn-danger"
          onClick={logout}
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}
