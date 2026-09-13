const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('admin_auth_token')
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  const res = await fetch(`${API_URL}${path}`, { ...options, headers })
  if (res.status === 401) {
    localStorage.removeItem('admin_auth_token')
  }
  return res
}

// Auth
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

export async function getMe() {
  const res = await apiFetch('/api/auth/me')
  if (!res.ok) return null
  return res.json()
}

// ── Referrals ───────────────────────────────────────────────────────────────

export async function fetchFacilityReferrals(facilityId, direction, status) {
  let url = `/api/referrals/facility/${facilityId}/all`
  const params = []
  if (direction) params.push(`direction=${direction}`)
  if (status && status !== 'all') params.push(`status=${status}`)
  if (params.length) url += `?${params.join('&')}`
  const res = await apiFetch(url)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to fetch referrals' }))
    throw new Error(err.detail || 'Failed to fetch referrals')
  }
  return res.json()
}

export async function updateReferralStatus(referralId, status) {
  const res = await apiFetch(`/api/referrals/${referralId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to update referral' }))
    throw new Error(err.detail || 'Failed to update referral')
  }
  return res.json()
}

export async function fetchFacilities(lat, lng, radiusKm) {
  const res = await apiFetch(`/api/facilities/nearby?lat=${lat}&lng=${lng}&radius_km=${radiusKm}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to fetch facilities' }))
    throw new Error(err.detail || 'Failed to fetch facilities')
  }
  return res.json()
}
