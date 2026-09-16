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

// ── Triage ───────────────────────────────────────────────────────────────────

export async function fetchTriageSymptoms() {
  const res = await apiFetch('/api/triage/symptoms')
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to fetch symptoms' }))
    throw new Error(err.detail || 'Failed to fetch symptoms')
  }
  return res.json()
}

export async function submitTriage(data) {
  const res = await apiFetch('/api/triage', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Triage evaluation failed' }))
    throw new Error(err.detail || 'Triage evaluation failed')
  }
  return res.json()
}

export async function fetchTriageHistory() {
  const res = await apiFetch('/api/triage/history')
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to fetch triage history' }))
    throw new Error(err.detail || 'Failed to fetch triage history')
  }
  return res.json()
}

export async function linkTriageAppointment(triageId, appointmentId) {
  const res = await apiFetch(`/api/triage/${triageId}/link-appointment`, {
    method: 'PATCH',
    body: JSON.stringify({ appointment_id: appointmentId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to link appointment' }))
    throw new Error(err.detail || 'Failed to link appointment')
  }
  return res.json()
}

// ── Medicine Search ─────────────────────────────────────────────────────────

/**
 * Search for medicines available at nearby facilities.
 */
export async function searchMedicines(name, lat, lng, radiusKm = 25) {
  const params = new URLSearchParams({ name, lat, lng, radius_km: radiusKm })
  const res = await apiFetch(`/api/medicines/search?${params}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to search medicines' }))
    throw new Error(err.detail || 'Failed to search medicines')
  }
  return res.json()
}

// ── ABHA Linking ────────────────────────────────────────────────────────────

/**
 * Request OTP for ABHA number verification.
 */
export async function requestABHAOTP(abhaNumber) {
  const res = await apiFetch('/api/abha/link/request-otp', {
    method: 'POST',
    body: JSON.stringify({ abha_number: abhaNumber }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'ABDM service unavailable' }))
    throw new Error(err.detail || 'Failed to request ABHA OTP')
  }
  return res.json()
}

/**
 * Verify OTP and link ABHA ID to the current user.
 */
export async function verifyABHAOTP(txnId, otp) {
  const res = await apiFetch('/api/abha/link/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ txn_id: txnId, otp }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'ABHA verification failed' }))
    throw new Error(err.detail || 'ABHA verification failed')
  }
  return res.json()
}

/**
 * Get current ABHA linking status.
 */
export async function getABHAStatus() {
  const res = await apiFetch('/api/abha/status')
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to fetch ABHA status' }))
    throw new Error(err.detail || 'Failed to fetch ABHA status')
  }
  return res.json()
}

// ── Voice (TTS / STT) ───────────────────────────────────────────────────────

/**
 * Convert text to speech via Bhashini TTS.
 * Returns { audio_base64, language, cached }.
 */
export async function textToSpeech(text, language) {
  const res = await apiFetch('/api/voice/tts', {
    method: 'POST',
    body: JSON.stringify({ text, language }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'TTS unavailable' }))
    throw new Error(err.detail || 'Text-to-speech failed')
  }
  return res.json()
}

/**
 * Convert speech audio to text via Bhashini ASR.
 * Returns { text, language }.
 */
export async function speechToText(audioBase64, language) {
  const res = await apiFetch('/api/voice/stt', {
    method: 'POST',
    body: JSON.stringify({ audio_base64: audioBase64, language }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'STT unavailable' }))
    throw new Error(err.detail || 'Speech-to-text failed')
  }
  return res.json()
}

/**
 * Update the user's preferred language.
 */
export async function updateLanguage(language) {
  const res = await apiFetch('/api/auth/language', {
    method: 'PUT',
    body: JSON.stringify({ language }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to update language' }))
    throw new Error(err.detail || 'Failed to update language')
  }
  return res.json()
}
