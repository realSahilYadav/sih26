import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fetchTriageSymptoms, submitTriage } from '../services/api'

export default function TriagePage() {
  const navigate = useNavigate()
  
  // Step management
  const [step, setStep] = useState(0)
  const totalSteps = 5
  
  // Data state
  const [categories, setCategories] = useState([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState(new Set())
  const [selectedSymptoms, setSelectedSymptoms] = useState(new Set())
  const [temperature, setTemperature] = useState('')
  const [freeText, setFreeText] = useState('')
  
  // Result state
  const [result, setResult] = useState(null)
  
  // Loading & error states
  const [loadingSymptoms, setLoadingSymptoms] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadSymptoms() {
      try {
        setLoadingSymptoms(true)
        const data = await fetchTriageSymptoms()
        setCategories(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoadingSymptoms(false)
      }
    }
    loadSymptoms()
  }, [])

  const handleNext = async () => {
    if (step === 3) {
      // Submit triage
      try {
        setSubmitting(true)
        setError(null)
        setStep(4) // Move to result view (shows loading spinner initially)
        
        const payload = {
          symptoms: Array.from(selectedSymptoms),
          free_text: freeText,
          vitals: temperature ? { temperature: parseFloat(temperature) } : null
        }
        
        const res = await submitTriage(payload)
        setResult(res)
      } catch (err) {
        setError(err.message)
        setStep(3) // Go back on error
      } finally {
        setSubmitting(false)
      }
    } else {
      setStep(s => Math.min(s + 1, 4))
    }
  }

  const handleBack = () => {
    setStep(s => Math.max(s - 1, 0))
  }

  const toggleCategory = (catId) => {
    const newSet = new Set(selectedCategoryIds)
    if (newSet.has(catId)) {
      newSet.delete(catId)
    } else {
      newSet.add(catId)
    }
    setSelectedCategoryIds(newSet)
  }

  const toggleSymptom = (sympId) => {
    const newSet = new Set(selectedSymptoms)
    if (newSet.has(sympId)) {
      newSet.delete(sympId)
    } else {
      newSet.add(sympId)
    }
    setSelectedSymptoms(newSet)
  }
  
  const resetTriage = () => {
    setStep(0)
    setSelectedCategoryIds(new Set())
    setSelectedSymptoms(new Set())
    setTemperature('')
    setFreeText('')
    setResult(null)
    setError(null)
  }

  // Common button styles
  const btnPrimaryStyle = {
    background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
    color: 'white',
    padding: '0.75rem 1.5rem',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 'bold',
    transition: 'opacity 0.2s',
  }
  
  const btnSecondaryStyle = {
    background: '#334155',
    color: '#f1f5f9',
    padding: '0.75rem 1.5rem',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.85rem',
    transition: 'background 0.2s',
  }

  const btnDisabledStyle = {
    ...btnPrimaryStyle,
    opacity: 0.5,
    cursor: 'not-allowed',
  }

  const renderProgress = () => {
    return (
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '2rem' }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: i === step ? '#38bdf8' : '#334155',
              transition: 'background 0.3s'
            }}
          />
        ))}
      </div>
    )
  }

  const renderStep0 = () => {
    if (loadingSymptoms) {
      return <div style={{ textAlign: 'center', color: '#94a3b8' }}>Loading categories...</div>
    }
    if (error) {
      return <div style={{ color: '#f87171' }}>{error}</div>
    }
    
    return (
      <>
        <h2 style={{ marginBottom: '0.5rem', color: '#f1f5f9' }}>What's bothering you?</h2>
        <p style={{ color: '#94a3b8', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Select the areas or categories where you are experiencing symptoms.
        </p>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {categories.filter(c => c.category !== 'other').map(cat => (
            <div
              key={cat.category}
              onClick={() => toggleCategory(cat.category)}
              style={{
                background: '#1e293b',
                border: `2px solid ${selectedCategoryIds.has(cat.category) ? '#38bdf8' : '#334155'}`,
                borderRadius: '12px',
                padding: '1rem',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{cat.icon}</div>
              <div style={{ color: '#f1f5f9', fontSize: '0.9rem', fontWeight: '500' }}>{cat.description}</div>
            </div>
          ))}
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            style={selectedCategoryIds.size > 0 ? btnPrimaryStyle : btnDisabledStyle}
            disabled={selectedCategoryIds.size === 0}
            onClick={handleNext}
          >
            Next
          </button>
        </div>
      </>
    )
  }

  const renderStep1 = () => {
    const selectedCats = categories.filter(c => selectedCategoryIds.has(c.category))
    const otherCat = categories.find(c => c.category === 'other')
    
    const displayCats = [...selectedCats]
    if (otherCat && !selectedCategoryIds.has('other')) displayCats.push(otherCat)

    return (
      <>
        <h2 style={{ marginBottom: '0.5rem', color: '#f1f5f9' }}>Select your symptoms</h2>
        <p style={{ color: '#94a3b8', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Check all that apply.
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem', maxHeight: '50vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
          {displayCats.map(cat => (
            <div key={cat.category}>
              <h3 style={{ color: '#38bdf8', fontSize: '1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>{cat.icon}</span> {cat.description}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {cat.symptoms.map(symp => (
                  <label key={symp.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '0.5rem', background: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }}>
                    <input 
                      type="checkbox"
                      checked={selectedSymptoms.has(symp.id)}
                      onChange={() => toggleSymptom(symp.id)}
                      style={{ width: '18px', height: '18px', accentColor: '#38bdf8' }}
                    />
                    <span style={{ color: '#f1f5f9', fontSize: '0.9rem' }}>{symp.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button style={btnSecondaryStyle} onClick={handleBack}>Back</button>
          <button 
            style={selectedSymptoms.size > 0 ? btnPrimaryStyle : btnDisabledStyle}
            disabled={selectedSymptoms.size === 0}
            onClick={handleNext}
          >
            Next
          </button>
        </div>
      </>
    )
  }

  const renderStep2 = () => {
    return (
      <>
        <h2 style={{ marginBottom: '0.5rem', color: '#f1f5f9' }}>Vitals (Optional)</h2>
        <p style={{ color: '#94a3b8', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          If you have a thermometer, please enter your temperature.
        </p>
        
        <div style={{ marginBottom: '2rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#f1f5f9', fontSize: '0.9rem' }}>
            Body temperature (°C)
          </label>
          <input 
            type="number"
            step="0.1"
            placeholder="e.g. 38.5"
            value={temperature}
            onChange={e => setTemperature(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '8px',
              color: '#f1f5f9',
              fontSize: '1rem',
            }}
          />
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button style={btnSecondaryStyle} onClick={handleBack}>Back</button>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button style={{...btnSecondaryStyle, background: 'transparent', border: '1px solid #334155'}} onClick={() => { setTemperature(''); handleNext(); }}>
              I don't have a thermometer
            </button>
            <button style={btnPrimaryStyle} onClick={handleNext}>Next</button>
          </div>
        </div>
      </>
    )
  }

  const renderStep3 = () => {
    return (
      <>
        <h2 style={{ marginBottom: '0.5rem', color: '#f1f5f9' }}>Additional Details</h2>
        <p style={{ color: '#94a3b8', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Is there anything else you'd like to tell the doctor? (Optional)
        </p>
        
        <div style={{ marginBottom: '2rem' }}>
          <textarea 
            placeholder="Describe any other symptoms, how long you've been feeling unwell, etc."
            value={freeText}
            onChange={e => setFreeText(e.target.value.slice(0, 2000))}
            style={{
              width: '100%',
              minHeight: '120px',
              padding: '0.75rem',
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '8px',
              color: '#f1f5f9',
              fontSize: '0.9rem',
              resize: 'vertical',
            }}
          />
          <div style={{ textAlign: 'right', color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem' }}>
            {freeText.length} / 2000
          </div>
        </div>
        
        {error && <div style={{ color: '#f87171', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</div>}
        
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button style={btnSecondaryStyle} onClick={handleBack}>Back</button>
          <button style={btnPrimaryStyle} onClick={handleNext}>
            Submit
          </button>
        </div>
      </>
    )
  }

  const renderStep4 = () => {
    if (submitting || !result) {
      return (
        <div style={{ textAlign: 'center', padding: '3rem 0' }}>
          <div style={{
            width: 40,
            height: 40,
            border: '3px solid rgba(56, 189, 248, 0.2)',
            borderTopColor: '#38bdf8',
            borderRadius: '50%',
            animation: 'spin 0.7s linear infinite',
            margin: '0 auto 1rem'
          }} />
          <p style={{ color: '#94a3b8' }}>Evaluating symptoms...</p>
        </div>
      )
    }

    const { urgency_level, recommended_action, explanation, triage_record_id } = result

    let badgeProps = {}
    if (urgency_level === 'red') {
      badgeProps = { bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', text: '#f87171', label: '🔴 Emergency' }
    } else if (urgency_level === 'yellow') {
      badgeProps = { bg: 'rgba(251, 191, 36, 0.15)', border: '#f59e0b', text: '#fbbf24', label: '🟡 Urgent' }
    } else {
      badgeProps = { bg: 'rgba(34, 197, 94, 0.15)', border: '#22c55e', text: '#4ade80', label: '🟢 Non-Urgent' }
    }

    return (
      <div style={{ textAlign: 'center' }}>
        <h2 style={{ marginBottom: '1.5rem', color: '#f1f5f9' }}>Triage Result</h2>
        
        <div style={{
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '12px',
          padding: '2rem',
          marginBottom: '2rem'
        }}>
          <div style={{
            display: 'inline-block',
            background: badgeProps.bg,
            border: `1px solid ${badgeProps.border}`,
            color: badgeProps.text,
            padding: '0.5rem 1rem',
            borderRadius: '9999px',
            fontSize: '1.1rem',
            fontWeight: 'bold',
            marginBottom: '1rem'
          }}>
            {badgeProps.label}
          </div>
          
          <h3 style={{ color: '#f1f5f9', fontSize: '1.2rem', marginBottom: '1.5rem' }}>
            {recommended_action}
          </h3>

          {explanation && explanation.length > 0 && (
            <div style={{ textAlign: 'left', marginTop: '2rem', borderTop: '1px solid #334155', paddingTop: '1.5rem' }}>
              <h4 style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1rem', textTransform: 'uppercase' }}>Why this result?</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {explanation.map((rule, idx) => {
                  const ruleColor = rule.urgency === 'red' ? '#f87171' : rule.urgency === 'yellow' ? '#fbbf24' : '#4ade80'
                  return (
                    <div key={idx} style={{ display: 'flex', gap: '0.75rem' }}>
                      <div style={{ color: ruleColor, marginTop: '2px', fontSize: '1.2rem' }}>•</div>
                      <div>
                        <div style={{ color: '#f1f5f9', fontWeight: '500', fontSize: '0.95rem' }}>{rule.rule_name}</div>
                        <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '2px' }}>{rule.detail}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {(urgency_level === 'red' || urgency_level === 'yellow') ? (
            <button 
              onClick={() => navigate(`/facilities?triage_id=${triage_record_id}`)}
              style={{ ...btnPrimaryStyle, padding: '1rem', fontSize: '1rem' }}
            >
              Find Nearest Facility
            </button>
          ) : (
            <button 
              onClick={() => navigate(`/facilities?triage_id=${triage_record_id}`)}
              style={{ ...btnPrimaryStyle, background: 'transparent', border: '1px solid #38bdf8', color: '#38bdf8' }}
            >
              Book Appointment
            </button>
          )}
          
          <button style={{ ...btnSecondaryStyle, background: 'transparent' }} onClick={resetTriage}>
            Check Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="app" style={{ minHeight: '100vh', background: '#0f172a', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem' }}>
          <div 
            onClick={() => step > 0 && step < 4 ? handleBack() : navigate('/')}
            style={{ 
              cursor: 'pointer', 
              color: '#94a3b8', 
              padding: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: '#1e293b'
            }}
          >
            ←
          </div>
          <div style={{ flex: 1, textAlign: 'center', marginRight: '40px', fontWeight: 'bold', color: '#f1f5f9' }}>
            Symptom Checker
          </div>
        </div>

        <div style={{
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '12px',
          padding: '1.5rem'
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
