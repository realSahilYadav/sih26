/**
 * API service — centralized fetch wrapper with JWT auth.
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

/**
 * Authenticated fetch — attaches JWT from localStorage if present.
 */
async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('auth_token')
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers })

  if (res.status === 401) {
    // Token expired or invalid — clear and let AuthContext handle redirect
    localStorage.removeItem('auth_token')
  }

  return res
}

// ── Auth ────────────────────────────────────────────────────────────────────

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

// ── Facilities ──────────────────────────────────────────────────────────────

/**
 * Search for nearby facilities by coordinates.
 */
export async function fetchNearbyFacilities(lat, lng, radiusKm = 50) {
  const params = new URLSearchParams({ lat, lng, radius_km: radiusKm })
  const res = await apiFetch(`/api/facilities/nearby?${params}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to fetch facilities' }))
    throw new Error(err.detail || 'Failed to fetch facilities')
  }
  return res.json()
}

// ── Doctor Availability ─────────────────────────────────────────────────────

/**
 * Get available slots for all doctors at a facility on a given date.
 */
export async function fetchDoctorAvailability(facilityId, date) {
  const params = new URLSearchParams({ date })
  const res = await apiFetch(`/api/doctors/${facilityId}/availability?${params}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to fetch availability' }))
    throw new Error(err.detail || 'Failed to fetch availability')
  }
  return res.json()
}

// ── Appointments ────────────────────────────────────────────────────────────

/**
 * Book a new appointment.
 */
export async function bookAppointment(data) {
  const res = await apiFetch('/api/appointments', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Booking failed' }))
    throw new Error(err.detail || 'Booking failed')
  }
  return res.json()
}

/**
 * Get all appointments for the current patient.
 */
export async function fetchMyAppointments() {
  const res = await apiFetch('/api/appointments/me')
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to fetch appointments' }))
    throw new Error(err.detail || 'Failed to fetch appointments')
  }
  return res.json()
}
