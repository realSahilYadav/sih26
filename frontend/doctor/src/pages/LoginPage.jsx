import { useRef, useState } from 'react'
import { requestOTP, verifyOTP } from '../services/api'
import { useAuth } from '../context/AuthContext'
import './LoginPage.css'

export default function LoginPage() {
  const { login } = useAuth()

  const [step, setStep] = useState('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [otpSent, setOtpSent] = useState(false)

  const otpRefs = useRef([])

  async function handlePhoneSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await requestOTP(phone)
      setOtpSent(true)
      setStep('otp')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleOtpChange(idx, value) {
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...otp]
    next[idx] = digit
    setOtp(next)
    if (digit && idx < 5) {
      otpRefs.current[idx + 1]?.focus()
    }
  }

  function handleOtpKeyDown(idx, e) {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus()
    }
  }

  function handleOtpPaste(e) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      setOtp(pasted.split(''))
      otpRefs.current[5]?.focus()
    }
  }

  async function handleOtpSubmit(e) {
    e.preventDefault()
    const code = otp.join('')
    if (code.length !== 6) return
    setError(null)
    setLoading(true)
    try {
      const data = await verifyOTP(phone, code)
      login(data)
    } catch (err) {
      setError(err.message)
      setOtp(['', '', '', '', '', ''])
      otpRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  function goBackToPhone() {
    setStep('phone')
    setOtp(['', '', '', '', '', ''])
    setError(null)
    setOtpSent(false)
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-badge">Doctor Portal</div>
        <h1>Welcome, Doctor</h1>
        <p className="login-subtitle">
          Sign in to manage consultations &amp; patient care
        </p>

        {error && <div className="error-msg">{error}</div>}

        {step === 'phone' && (
          <form className="form-step" onSubmit={handlePhoneSubmit}>
            <div className="input-group">
              <label htmlFor="phone-input">Phone Number</label>
              <input
                id="phone-input"
                type="tel"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                autoFocus
                autoComplete="tel"
              />
            </div>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !phone.trim()}
            >
              {loading ? <><span className="spinner" /> Sending…</> : 'Send OTP'}
            </button>

            <div className="dev-hint">
              Dev mode — any phone number works. OTP is <code>123456</code>
            </div>
          </form>
        )}

        {step === 'otp' && (
          <form className="form-step" onSubmit={handleOtpSubmit}>
            <button type="button" className="btn-back" onClick={goBackToPhone}>
              ← Change number
            </button>

            {otpSent && (
              <div className="success-msg">
                OTP sent to your phone
              </div>
            )}

            <div className="phone-chip">{phone}</div>

            <div className="input-group">
              <label>Enter 6-digit OTP</label>
              <div className="otp-inputs" onPaste={handleOtpPaste}>
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
                    className={digit ? 'filled' : ''}
                    autoFocus={idx === 0}
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={loading || otp.join('').length !== 6}
            >
              {loading ? <><span className="spinner" /> Verifying…</> : 'Verify & Sign In'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
