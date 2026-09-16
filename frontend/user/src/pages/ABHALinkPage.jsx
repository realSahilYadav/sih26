import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { requestABHAOTP, verifyABHAOTP } from '../services/api'

export default function ABHALinkPage() {
  const navigate = useNavigate()
  const { user, updateUser } = useAuth()

  const [step, setStep] = useState('abha') // 'abha' | 'otp' | 'success'
  const [abhaNumber, setAbhaNumber] = useState('')
  const [txnId, setTxnId] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [linkedAbha, setLinkedAbha] = useState(null)

  const otpRefs = useRef([])

  // Already linked — show status
  if (user && !user.needs_abha_linking && step !== 'success') {
    return (
      <div style={{ padding: '1.5rem', maxWidth: 520, margin: '0 auto' }}>
        <button
          onClick={() => navigate('/')}
          style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', fontSize: '0.9rem', padding: 0, marginBottom: '1.5rem' }}
        >
          ← Back to Dashboard
        </button>
        <div style={{
          background: '#1e293b', border: '1px solid #334155', borderRadius: 16,
          padding: '2.5rem', textAlign: 'center',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
          <h2 style={{ margin: '0 0 0.5rem', color: '#f1f5f9', fontSize: '1.3rem' }}>ABHA ID Already Linked</h2>
          <div style={{
            background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)',
            borderRadius: 8, padding: '0.75rem', marginTop: '1rem',
            color: '#4ade80', fontSize: '0.95rem', fontWeight: 600,
            fontFamily: 'ui-monospace, monospace', letterSpacing: '0.05em',
          }}>
            {user.abha_id}
          </div>
        </div>
      </div>
    )
  }

  // ── Step 1: Enter ABHA number ─────────────────────────────────────────

  const handleAbhaSubmit = async (e) => {
    e.preventDefault()
    const cleaned = abhaNumber.replace(/[\s\-]/g, '')
    if (cleaned.length !== 14) {
      setError('ABHA number must be 14 digits')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await requestABHAOTP(abhaNumber)
      setTxnId(data.txn_id)
      setStep('otp')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2: OTP verification ──────────────────────────────────────────

  const handleOtpChange = (idx, value) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...otp]
    next[idx] = digit
    setOtp(next)
    if (digit && idx < 5) otpRefs.current[idx + 1]?.focus()
  }

  const handleOtpKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus()
    }
  }

  const handleOtpPaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      setOtp(pasted.split(''))
      otpRefs.current[5]?.focus()
    }
  }

  const handleOtpSubmit = async (e) => {
    e.preventDefault()
    const code = otp.join('')
    if (code.length !== 6) return
    setLoading(true)
    setError(null)
    try {
      const data = await verifyABHAOTP(txnId, code)
      setLinkedAbha(data)
      updateUser({
        needs_abha_linking: false,
        abha_id: data.abha_id,
      })
      setStep('success')
    } catch (err) {
      setError(err.message)
      setOtp(['', '', '', '', '', ''])
      otpRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  // ── Styles ────────────────────────────────────────────────────────────

  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    padding: '0.75rem 1rem',
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: 8, color: '#e2e8f0',
    fontSize: '1rem', outline: 'none',
    transition: 'border-color 0.2s',
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: 520, margin: '0 auto' }}>
      <button
        onClick={() => navigate('/')}
        style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', fontSize: '0.9rem', padding: 0, marginBottom: '1.5rem' }}
      >
        ← Back to Dashboard
      </button>

      <div style={{
        background: '#1e293b', border: '1px solid #334155', borderRadius: 16,
        padding: '2rem', textAlign: 'center',
      }}>
        {/* Header */}
        <div style={{
          width: 56, height: 56, borderRadius: 14, margin: '0 auto 1rem',
          background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.5rem',
        }}>
          🆔
        </div>
        <h1 style={{ fontSize: '1.4rem', margin: '0 0 0.25rem', color: '#f1f5f9' }}>
          Link ABHA ID
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0 0 1.5rem' }}>
          Connect your Ayushman Bharat Health Account
        </p>

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#f87171', padding: '0.6rem 1rem', borderRadius: 8,
            fontSize: '0.85rem', marginBottom: '1rem', textAlign: 'left',
          }}>
            {error}
          </div>
        )}

        {/* Step 1: ABHA number */}
        {step === 'abha' && (
          <form onSubmit={handleAbhaSubmit}>
            <div style={{ textAlign: 'left', marginBottom: '1rem' }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
                ABHA Number
              </label>
              <input
                type="text"
                placeholder="XX-XXXX-XXXX-XXXX"
                value={abhaNumber}
                onChange={(e) => setAbhaNumber(e.target.value)}
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = '#38bdf8')}
                onBlur={(e) => (e.target.style.borderColor = '#334155')}
                autoFocus
              />
              <p style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.4rem' }}>
                Your 14-digit ABHA number (with or without hyphens)
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || abhaNumber.replace(/[\s\-]/g, '').length < 14}
              style={{
                width: '100%', padding: '0.75rem',
                background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
                color: '#fff', border: 'none', borderRadius: 8,
                fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer',
                opacity: loading || abhaNumber.replace(/[\s\-]/g, '').length < 14 ? 0.5 : 1,
                marginBottom: '0.75rem',
              }}
            >
              {loading ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff', borderRadius: '50%',
                    animation: 'spin 0.7s linear infinite', display: 'inline-block',
                  }} />
                  Sending OTP…
                </span>
              ) : 'Send Verification OTP'}
            </button>

            <button
              type="button"
              onClick={() => navigate('/')}
              style={{
                width: '100%', padding: '0.6rem',
                background: 'transparent', color: '#94a3b8',
                border: '1px solid #334155', borderRadius: 8,
                fontSize: '0.85rem', cursor: 'pointer',
              }}
            >
              Skip for now
            </button>
          </form>
        )}

        {/* Step 2: OTP */}
        {step === 'otp' && (
          <form onSubmit={handleOtpSubmit}>
            <div style={{
              background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.15)',
              borderRadius: 8, padding: '0.6rem', marginBottom: '1rem',
              fontSize: '0.82rem', color: '#38bdf8',
            }}>
              OTP sent to mobile linked with your ABHA
            </div>

            <button
              type="button"
              onClick={() => { setStep('abha'); setOtp(['', '', '', '', '', '']); setError(null) }}
              style={{
                background: 'none', border: 'none', color: '#38bdf8',
                cursor: 'pointer', fontSize: '0.82rem', padding: 0, marginBottom: '1rem',
              }}
            >
              ← Change ABHA number
            </button>

            <div style={{
              display: 'inline-block',
              background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)',
              borderRadius: 6, padding: '0.35rem 0.75rem', marginBottom: '1.25rem',
              color: '#a5b4fc', fontSize: '0.85rem', fontFamily: 'ui-monospace, monospace',
            }}>
              {abhaNumber}
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                Enter 6-digit OTP
              </label>
              <div
                style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}
                onPaste={handleOtpPaste}
              >
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => (otpRefs.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                    autoFocus={idx === 0}
                    style={{
                      width: 44, height: 52, textAlign: 'center',
                      background: '#0f172a',
                      border: `2px solid ${digit ? '#6366f1' : '#334155'}`,
                      borderRadius: 8, color: '#e2e8f0',
                      fontSize: '1.2rem', fontWeight: 700, outline: 'none',
                      transition: 'border-color 0.2s',
                    }}
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || otp.join('').length !== 6}
              style={{
                width: '100%', padding: '0.75rem',
                background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
                color: '#fff', border: 'none', borderRadius: 8,
                fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer',
                opacity: loading || otp.join('').length !== 6 ? 0.5 : 1,
                marginBottom: '0.75rem',
              }}
            >
              {loading ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff', borderRadius: '50%',
                    animation: 'spin 0.7s linear infinite', display: 'inline-block',
                  }} />
                  Verifying…
                </span>
              ) : 'Verify & Link ABHA'}
            </button>

            <button
              type="button"
              onClick={() => navigate('/')}
              style={{
                width: '100%', padding: '0.6rem',
                background: 'transparent', color: '#94a3b8',
                border: '1px solid #334155', borderRadius: 8,
                fontSize: '0.85rem', cursor: 'pointer',
              }}
            >
              Skip for now
            </button>
          </form>
        )}

        {/* Step 3: Success */}
        {step === 'success' && (
          <div>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', margin: '0 auto 1rem',
              background: 'rgba(34, 197, 94, 0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2rem',
            }}>
              ✓
            </div>
            <h2 style={{ color: '#4ade80', fontSize: '1.2rem', margin: '0 0 0.5rem' }}>
              ABHA ID Linked Successfully!
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0 0 1rem' }}>
              Your health records are now connected via ABDM
            </p>
            <div style={{
              background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)',
              borderRadius: 8, padding: '0.75rem', marginBottom: '1.5rem',
              color: '#4ade80', fontSize: '1rem', fontWeight: 600,
              fontFamily: 'ui-monospace, monospace', letterSpacing: '0.05em',
            }}>
              {linkedAbha?.abha_id}
            </div>
            {linkedAbha?.abha_address && (
              <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '1rem' }}>
                ABHA Address: <strong style={{ color: '#e2e8f0' }}>{linkedAbha.abha_address}</strong>
              </p>
            )}
            <button
              onClick={() => navigate('/')}
              style={{
                width: '100%', padding: '0.75rem',
                background: 'linear-gradient(135deg, #22c55e, #0ea5e9)',
                color: '#fff', border: 'none', borderRadius: 8,
                fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
