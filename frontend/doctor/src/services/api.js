/**
 * API service — centralized fetch wrapper with JWT auth.
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

/**
 * Authenticated fetch — attaches JWT from localStorage if present.
 */
async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('doctor_auth_token')
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers })

  if (res.status === 401) {
    localStorage.removeItem('doctor_auth_token')
  }

  return res
}

/**
 * Request OTP for a phone number.
 */
export async function requestOTP(phone) {
  const res = await apiFetch('/api/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to send OTP' }))
    throw new Error(err.detail || 'Failed to send OTP')
  }
  return res.json()
}

/**
 * Verify OTP and receive JWT + user info.
 */
export async function verifyOTP(phone, otp) {
  const res = await apiFetch('/api/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phone, otp }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Invalid OTP' }))
    throw new Error(err.detail || 'Invalid OTP')
  }
  return res.json()
}

/**
 * Get current authenticated user info.
 */
export async function getMe() {
  const res = await apiFetch('/api/auth/me')
  if (!res.ok) return null
  return res.json()
}

// ── Appointments ────────────────────────────────────────────────────────────

/**
 * Get today's appointment queue for the current doctor.
 */
export async function fetchTodayQueue(doctorId) {
  const res = await apiFetch(`/api/appointments/doctor/${doctorId}/today`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to fetch queue' }))
    throw new Error(err.detail || 'Failed to fetch queue')
  }
  return res.json()
}

/**
 * Update an appointment's status.
 */
export async function updateAppointmentStatus(appointmentId, newStatus) {
  const res = await apiFetch(`/api/appointments/${appointmentId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: newStatus }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to update status' }))
    throw new Error(err.detail || 'Failed to update status')
  }
  return res.json()
}
