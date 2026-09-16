import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fetchTriageSymptoms, assistedTriage, textToSpeech } from '../services/api'
import { getActivePatient } from './AssistedHome'
import SpeakerButton from '../components/SpeakerButton'
import MicButton from '../components/MicButton'
import '../App.css'

/**
 * Auto-play TTS helper — fire-and-forget.
 */
function autoSpeak(text, lang) {
  textToSpeech(text, lang)
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
}

export default function AssistedTriage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const patient = getActivePatient()
  const lang = user?.preferred_language || 'hi'

  const [step, setStep] = useState(0)
  const [categories, setCategories] = useState([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState(new Set())
  const [selectedSymptoms, setSelectedSymptoms] = useState(new Set())
  const [temperature, setTemperature] = useState('')
  const [freeText, setFreeText] = useState('')
  const [result, setResult] = useState(null)
  const [loadingSymptoms, setLoadingSymptoms] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const spokenSteps = useRef(new Set())

  // Redirect if no patient
  useEffect(() => {
    if (!patient) {
      navigate('/assisted/register', { replace: true })
    }
  }, [patient, navigate])

  // Load symptoms
  useEffect(() => {
    fetchTriageSymptoms()
      .then(setCategories)
      .catch((err) => setError(err.message))
      .finally(() => setLoadingSymptoms(false))
  }, [])

  // Auto-TTS on step change
  useEffect(() => {
    if (spokenSteps.current.has(step)) return
    spokenSteps.current.add(step)

    const messages = [
      'What is bothering the patient? Select the areas.',
      'Select the specific symptoms.',
      'Enter temperature if available.',
      'Any other details to share with the doctor?',
      'Evaluating symptoms, please wait.',
    ]
    if (messages[step]) {
      autoSpeak(messages[step], lang)
    }
  }, [step, lang])

  if (!patient) return null

  const handleNext = async () => {
    if (step === 3) {
      // Submit
      setSubmitting(true)
      setError(null)
      setStep(4)
      try {
        const payload = {
          symptoms: Array.from(selectedSymptoms),
          free_text: freeText || null,
          vitals: temperature ? { temperature: parseFloat(temperature) } : null,
        }
        const res = await assistedTriage(patient.patient_id, payload.symptoms, payload.free_text, payload.vitals)
        setResult(res)
      } catch (err) {
        setError(err.message)
        setStep(3)
      } finally {
        setSubmitting(false)
      }
    } else {
      setStep((s) => Math.min(s + 1, 4))
    }
  }

  const handleBack = () => setStep((s) => Math.max(s - 1, 0))

  const toggleCategory = (catId) => {
    const s = new Set(selectedCategoryIds)
    s.has(catId) ? s.delete(catId) : s.add(catId)
    setSelectedCategoryIds(s)
  }

  const toggleSymptom = (sympId) => {
    const s = new Set(selectedSymptoms)
    s.has(sympId) ? s.delete(sympId) : s.add(sympId)
    setSelectedSymptoms(s)
  }

  const resetTriage = () => {
    setStep(0)
    setSelectedCategoryIds(new Set())
    setSelectedSymptoms(new Set())
    setTemperature('')
    setFreeText('')
    setResult(null)
    setError(null)
    spokenSteps.current = new Set()
  }

  // ── Progress dots ───────────────────────────────────────────────────────
  const renderProgress = () => (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: '1.5rem' }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: i === step ? '#38bdf8' : i < step ? '#0ea5e9' : '#334155',
            transition: 'background 0.3s',
          }}
        />
      ))}
    </div>
  )

  // ── Step 0: Category selection ──────────────────────────────────────────
  const renderStep0 = () => {
    if (loadingSymptoms) return <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem 0' }}>Loading…</div>
    if (error) return <div style={{ color: '#f87171', textAlign: 'center' }}>{error}</div>

    return (
      <div className="assisted-animate-in">
        <h2 style={{ color: '#f1f5f9', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          What's bothering the patient?
          <SpeakerButton text="What is bothering the patient? Select the areas where they feel unwell." />
        </h2>
        <p style={{ color: '#94a3b8', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
          Select the areas where they feel unwell.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {categories.filter((c) => c.category !== 'other').map((cat) => (
            <div
              key={cat.category}
              onClick={() => toggleCategory(cat.category)}
              style={{
                background: selectedCategoryIds.has(cat.category) ? 'rgba(56, 189, 248, 0.08)' : '#1e293b',
                border: `2px solid ${selectedCategoryIds.has(cat.category) ? '#38bdf8' : '#334155'}`,
                borderRadius: 14,
                padding: '1.1rem 0.75rem',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s',
                minHeight: 90,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{ fontSize: '2.2rem', marginBottom: '0.4rem' }}>{cat.icon}</div>
              <div style={{ color: '#f1f5f9', fontSize: '0.9rem', fontWeight: 600 }}>{cat.description}</div>
            </div>
          ))}
        </div>

        <button
          className="assisted-btn assisted-btn-primary"
          disabled={selectedCategoryIds.size === 0}
          onClick={handleNext}
        >
          Next →
        </button>
      </div>
    )
  }

  // ── Step 1: Symptom selection ───────────────────────────────────────────
  const renderStep1 = () => {
    const selectedCats = categories.filter((c) => selectedCategoryIds.has(c.category))
    const otherCat = categories.find((c) => c.category === 'other')
    const displayCats = [...selectedCats]
    if (otherCat && !selectedCategoryIds.has('other')) displayCats.push(otherCat)

    return (
      <div className="assisted-animate-in">
        <h2 style={{ color: '#f1f5f9', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          Select symptoms
          <SpeakerButton text="Select the symptoms the patient is experiencing." />
        </h2>
        <p style={{ color: '#94a3b8', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
          Check all that apply.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.5rem', maxHeight: '50vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
          {displayCats.map((cat) => (
            <div key={cat.category}>
              <h3 style={{ color: '#38bdf8', fontSize: '0.95rem', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>{cat.icon}</span> {cat.description}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {cat.symptoms.map((symp) => (
                  <label
                    key={symp.id}
                    className={`assisted-checkbox-row ${selectedSymptoms.has(symp.id) ? 'selected' : ''}`}
                    onClick={() => toggleSymptom(symp.id)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSymptoms.has(symp.id)}
                      onChange={() => {}}
                    />
                    <span>{symp.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="assisted-btn assisted-btn-secondary" onClick={handleBack} style={{ flex: '0 0 auto', width: 'auto', minWidth: 100 }}>
            ← Back
          </button>
          <button
            className="assisted-btn assisted-btn-primary"
            disabled={selectedSymptoms.size === 0}
            onClick={handleNext}
            style={{ flex: 1 }}
          >
            Next →
          </button>
        </div>
      </div>
    )
  }

  // ── Step 2: Vitals ──────────────────────────────────────────────────────
  const renderStep2 = () => (
    <div className="assisted-animate-in">
      <h2 style={{ color: '#f1f5f9', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        Temperature (Optional)
        <SpeakerButton text="If you have a thermometer, enter the patient's body temperature." />
      </h2>
      <p style={{ color: '#94a3b8', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
        Enter body temperature in °C if available.
      </p>

      <div style={{ marginBottom: '1.5rem' }}>
        <input
          type="number"
          step="0.1"
          placeholder="e.g. 38.5"
          className="assisted-input"
          value={temperature}
          onChange={(e) => setTemperature(e.target.value)}
          inputMode="decimal"
          style={{ fontSize: '1.2rem', textAlign: 'center', padding: '1rem' }}
        />
      </div>

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button className="assisted-btn assisted-btn-secondary" onClick={handleBack} style={{ flex: '0 0 auto', width: 'auto', minWidth: 100 }}>
          ← Back
        </button>
        <button
          className="assisted-btn assisted-btn-secondary"
          onClick={() => { setTemperature(''); handleNext() }}
          style={{ flex: 1, background: 'transparent', border: '1px solid #334155' }}
        >
          Skip
        </button>
        <button className="assisted-btn assisted-btn-primary" onClick={handleNext} style={{ flex: 1 }}>
          Next →
        </button>
      </div>
    </div>
  )

  // ── Step 3: Free text ───────────────────────────────────────────────────
  const renderStep3 = () => (
    <div className="assisted-animate-in">
      <h2 style={{ color: '#f1f5f9', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        Additional Details
        <SpeakerButton text="Describe any extra symptoms or details. You can also speak using the microphone." />
      </h2>
      <p style={{ color: '#94a3b8', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
        Anything else the doctor should know? (Optional)
      </p>

      <div style={{ marginBottom: '1.5rem' }}>
        <textarea
          placeholder="Describe symptoms, duration, medications…"
          className="assisted-input"
          value={freeText}
          onChange={(e) => setFreeText(e.target.value.slice(0, 2000))}
          style={{ minHeight: 120, resize: 'vertical', fontFamily: 'inherit' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem' }}>
          <MicButton onResult={(text) => setFreeText((prev) => (prev ? prev + ' ' : '') + text)} />
          <span style={{ color: '#64748b', fontSize: '0.75rem' }}>{freeText.length}/2000</span>
        </div>
      </div>

      {error && (
        <div style={{ color: '#f87171', marginBottom: '1rem', fontSize: '0.9rem', background: 'rgba(239,68,68,0.1)', padding: '0.65rem 1rem', borderRadius: 8 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button className="assisted-btn assisted-btn-secondary" onClick={handleBack} style={{ flex: '0 0 auto', width: 'auto', minWidth: 100 }}>
          ← Back
        </button>
        <button className="assisted-btn assisted-btn-success" onClick={handleNext} style={{ flex: 1 }}>
          ✓ Submit Triage
        </button>
      </div>
    </div>
  )

  // ── Step 4: Result ──────────────────────────────────────────────────────
  const renderStep4 = () => {
    if (submitting || !result) {
      return (
        <div style={{ textAlign: 'center', padding: '3rem 0' }}>
          <div style={{
            width: 48, height: 48,
            border: '3px solid rgba(56, 189, 248, 0.2)',
            borderTopColor: '#38bdf8',
            borderRadius: '50%',
            animation: 'spin 0.7s linear infinite',
            margin: '0 auto 1.5rem',
          }} />
          <p style={{ color: '#94a3b8', fontSize: '1.05rem' }}>Evaluating symptoms…</p>
        </div>
      )
    }

    const { urgency_level, recommended_action, explanation, triage_record_id } = result

    let badge = {}
    if (urgency_level === 'red') {
      badge = { bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', text: '#f87171', label: '🔴 Emergency' }
    } else if (urgency_level === 'yellow') {
      badge = { bg: 'rgba(251, 191, 36, 0.15)', border: '#f59e0b', text: '#fbbf24', label: '🟡 Urgent' }
    } else {
      badge = { bg: 'rgba(34, 197, 94, 0.15)', border: '#22c55e', text: '#4ade80', label: '🟢 Non-Urgent' }
    }

    return (
      <div className="assisted-animate-in" style={{ textAlign: 'center' }}>
        <h2 style={{ color: '#f1f5f9', marginBottom: '1.25rem' }}>Triage Result — {patient.name}</h2>

        <div style={{
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: 14,
          padding: '2rem 1.5rem',
          marginBottom: '1.5rem',
        }}>
          <div style={{
            display: 'inline-block',
            background: badge.bg,
            border: `1px solid ${badge.border}`,
            color: badge.text,
            padding: '0.6rem 1.25rem',
            borderRadius: 9999,
            fontSize: '1.15rem',
            fontWeight: 'bold',
            marginBottom: '1rem',
          }}>
            {badge.label}
          </div>

          <h3 style={{
            color: '#f1f5f9',
            fontSize: '1.15rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
          }}>
            {recommended_action}
            <SpeakerButton text={recommended_action} />
          </h3>

          {explanation && explanation.length > 0 && (
            <div style={{ textAlign: 'left', borderTop: '1px solid #334155', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
              <h4 style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
                Why this result?
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {explanation.map((rule, idx) => {
                  const color = rule.urgency === 'red' ? '#f87171' : rule.urgency === 'yellow' ? '#fbbf24' : '#4ade80'
                  return (
                    <div key={idx} style={{ display: 'flex', gap: '0.75rem' }}>
                      <div style={{ color, marginTop: 2, fontSize: '1.2rem' }}>•</div>
                      <div>
                        <div style={{ color: '#f1f5f9', fontWeight: 500, fontSize: '0.95rem' }}>{rule.rule_name}</div>
                        <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: 2 }}>{rule.detail}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button
            className="assisted-btn assisted-btn-primary"
            onClick={() => navigate('/assisted/book', { state: { triage_id: triage_record_id } })}
          >
            📋 Book Appointment for {patient.name}
          </button>
          <button className="assisted-btn assisted-btn-secondary" onClick={resetTriage}>
            🔄 Check Again
          </button>
          <button
            className="assisted-btn assisted-btn-secondary"
            onClick={() => navigate('/assisted')}
            style={{ background: 'transparent', border: '1px solid #334155' }}
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="app assisted-mode" style={{ minHeight: '100vh', background: '#0f172a', padding: '1.5rem 1rem' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div
            onClick={() => step > 0 && step < 4 ? handleBack() : navigate('/assisted')}
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
            Symptom Check
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

        {/* Main card */}
        <div style={{
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: 14,
          padding: '1.5rem',
        }}>
          {renderProgress()}
          {step === 0 && renderStep0()}
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
        </div>
      </div>
    </div>
  )
}
