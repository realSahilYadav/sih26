import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchMedicines } from '../services/api'

const FACILITY_TYPE_LABELS = {
  sub_centre: 'Sub Centre',
  phc: 'PHC',
  rural_hospital: 'Rural Hospital',
  district_hospital: 'District Hospital',
}

const FACILITY_TYPE_COLORS = {
  sub_centre: '#22c55e',
  phc: '#0ea5e9',
  rural_hospital: '#8b5cf6',
  district_hospital: '#f59e0b',
}

export default function MedicineSearch() {
  const navigate = useNavigate()
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])

  const [medicineName, setMedicineName] = useState('')
  const [radiusKm, setRadiusKm] = useState(25)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [coords, setCoords] = useState(null)
  const [geoStatus, setGeoStatus] = useState('idle')
  const [searched, setSearched] = useState(false)

  // ── Initialise Leaflet map ────────────────────────────────────────────
  useEffect(() => {
    if (mapInstanceRef.current || !mapRef.current) return
    const L = window.L
    if (!L) return

    const map = L.map(mapRef.current, {
      center: [20.5937, 78.9629], // India centre
      zoom: 5,
      zoomControl: true,
      attributionControl: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    mapInstanceRef.current = map

    return () => {
      map.remove()
      mapInstanceRef.current = null
    }
  }, [])

  // ── Update map markers when results change ────────────────────────────
  useEffect(() => {
    const L = window.L
    const map = mapInstanceRef.current
    if (!L || !map) return

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    if (results.length === 0) return

    const bounds = []

    results.forEach((r) => {
      const color = FACILITY_TYPE_COLORS[r.facility_type] || '#38bdf8'
      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width: 32px; height: 32px; border-radius: 50%;
          background: ${color}; border: 3px solid #fff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; color: #fff; font-weight: 700;
        ">${r.quantity_available}</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18],
      })

      const marker = L.marker([r.lat, r.lng], { icon }).addTo(map)
      marker.bindPopup(`
        <div style="font-family: system-ui, sans-serif; min-width: 180px;">
          <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px; color: #1e293b;">${r.facility_name}</div>
          <div style="font-size: 11px; text-transform: uppercase; color: ${color}; font-weight: 600; margin-bottom: 6px;">
            ${FACILITY_TYPE_LABELS[r.facility_type] || r.facility_type}
          </div>
          <div style="font-size: 13px; color: #334155; margin-bottom: 2px;">
            💊 <strong>${r.medicine_name}</strong> — <strong>${r.quantity_available}</strong> in stock
          </div>
          <div style="font-size: 12px; color: #64748b; margin-bottom: 2px;">
            📍 ${r.distance_km} km away
          </div>
          <div style="font-size: 12px; color: #64748b;">
            ${r.address}
          </div>
          ${r.contact_phone ? `<div style="font-size: 12px; color: #64748b; margin-top: 2px;">📞 ${r.contact_phone}</div>` : ''}
        </div>
      `)

      markersRef.current.push(marker)
      bounds.push([r.lat, r.lng])
    })

    // Include user's location in bounds
    if (coords) {
      bounds.push([coords.lat, coords.lng])
    }

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 })
    }
  }, [results, coords])

  // ── Geolocation ───────────────────────────────────────────────────────
  const requestLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported by your browser')
      setGeoStatus('denied')
      return
    }
    setGeoStatus('loading')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setCoords(c)
        setGeoStatus('granted')

        // Centre map on user
        const map = mapInstanceRef.current
        if (map) map.setView([c.lat, c.lng], 10)
      },
      () => {
        setGeoStatus('denied')
        setError('Location permission denied. Enter coordinates manually.')
      },
      { timeout: 10000 }
    )
  }

  // ── Search ────────────────────────────────────────────────────────────
  const doSearch = async (e) => {
    if (e) e.preventDefault()
    if (!medicineName.trim()) return
    if (!coords) {
      setError('Please share your location or enter coordinates first')
      return
    }
    setLoading(true)
    setError(null)
    setSearched(true)
    try {
      const data = await searchMedicines(medicineName.trim(), coords.lat, coords.lng, radiusKm)
      setResults(data)
      if (data.length === 0) {
        setError(`No facilities found with "${medicineName}" within ${radiusKm} km`)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Styles ────────────────────────────────────────────────────────────
  const inputStyle = {
    flex: 1,
    padding: '0.7rem 0.9rem',
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 8,
    color: '#e2e8f0',
    fontSize: '0.9rem',
    outline: 'none',
    transition: 'border-color 0.2s',
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: 800, margin: '0 auto' }}>
      {/* Back navigation */}
      <button
        onClick={() => navigate('/')}
        style={{
          background: 'none', border: 'none', color: '#38bdf8',
          cursor: 'pointer', fontSize: '0.9rem', padding: 0, marginBottom: '1rem',
        }}
      >
        ← Back to Dashboard
      </button>

      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem', color: '#f1f5f9' }}>
          💊 Find Medicine
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>
          Search for medicine availability at nearby health facilities
        </p>
      </div>

      {/* Location button */}
      <button
        onClick={requestLocation}
        disabled={geoStatus === 'loading'}
        style={{
          width: '100%', padding: '0.75rem',
          background: coords
            ? 'rgba(34, 197, 94, 0.15)'
            : 'linear-gradient(135deg, #0ea5e9, #6366f1)',
          color: coords ? '#4ade80' : '#fff',
          border: coords ? '1px solid rgba(34, 197, 94, 0.3)' : 'none',
          borderRadius: 8, fontSize: '0.9rem', cursor: 'pointer',
          marginBottom: '0.75rem', fontWeight: 500,
          transition: 'all 0.2s',
        }}
      >
        {geoStatus === 'loading'
          ? '📡 Detecting location…'
          : coords
            ? `✓ Location set (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`
            : '📍 Use My Location'}
      </button>

      {/* Manual coords (collapsed by default, expandable if denied) */}
      {geoStatus === 'denied' && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <input
            type="number" step="any" placeholder="Latitude"
            onChange={(e) => setCoords((c) => ({ ...c, lat: parseFloat(e.target.value) || 0 }))}
            style={inputStyle}
          />
          <input
            type="number" step="any" placeholder="Longitude"
            onChange={(e) => setCoords((c) => ({ ...c, lng: parseFloat(e.target.value) || 0 }))}
            style={inputStyle}
          />
        </div>
      )}

      {/* Search form */}
      <form onSubmit={doSearch} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <input
          type="text"
          placeholder="🔍 Medicine name (e.g. Paracetamol, Amoxicillin…)"
          value={medicineName}
          onChange={(e) => setMedicineName(e.target.value)}
          style={{ ...inputStyle, flex: 3 }}
          onFocus={(e) => (e.target.style.borderColor = '#38bdf8')}
          onBlur={(e) => (e.target.style.borderColor = '#334155')}
        />
        <select
          value={radiusKm}
          onChange={(e) => setRadiusKm(Number(e.target.value))}
          style={{
            ...inputStyle, flex: 0, width: 110, minWidth: 110,
            cursor: 'pointer', appearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
            backgroundPosition: 'right 0.5rem center',
            backgroundRepeat: 'no-repeat',
            backgroundSize: '1.25em 1.25em',
            paddingRight: '2rem',
          }}
        >
          <option value={5}>5 km</option>
          <option value={10}>10 km</option>
          <option value={25}>25 km</option>
          <option value={50}>50 km</option>
          <option value={100}>100 km</option>
        </select>
        <button
          type="submit"
          disabled={loading || !medicineName.trim()}
          style={{
            padding: '0.7rem 1.25rem',
            background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
            color: '#fff', border: 'none', borderRadius: 8,
            cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600,
            opacity: loading || !medicineName.trim() ? 0.5 : 1,
            whiteSpace: 'nowrap',
          }}
        >
          {loading ? '…' : 'Search'}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div style={{
          background: results.length > 0 ? 'rgba(251, 191, 36, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${results.length > 0 ? 'rgba(251, 191, 36, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
          color: results.length > 0 ? '#fbbf24' : '#f87171',
          padding: '0.6rem 1rem', borderRadius: 8,
          fontSize: '0.85rem', marginBottom: '1rem',
        }}>
          {error}
        </div>
      )}

      {/* Map */}
      <div style={{
        borderRadius: 12, overflow: 'hidden',
        border: '1px solid #334155',
        marginBottom: '1rem',
        background: '#1e293b',
      }}>
        <div
          ref={mapRef}
          style={{ width: '100%', height: 360 }}
        />
      </div>

      {/* Results count */}
      {searched && !loading && results.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          marginBottom: '0.75rem',
        }}>
          <span style={{
            background: 'rgba(56, 189, 248, 0.15)',
            color: '#38bdf8', padding: '2px 10px', borderRadius: 999,
            fontSize: '0.75rem', fontWeight: 700,
          }}>
            {results.length}
          </span>
          <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
            {results.length === 1 ? 'facility' : 'facilities'} with stock
          </span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '2rem 0' }}>
          <div style={{
            width: 36, height: 36,
            border: '3px solid rgba(56, 189, 248, 0.2)',
            borderTopColor: '#38bdf8',
            borderRadius: '50%',
            animation: 'spin 0.7s linear infinite',
            margin: '0 auto 0.75rem',
          }} />
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Searching nearby facilities…</p>
        </div>
      )}

      {/* Result cards */}
      {!loading && results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {results.map((r, idx) => {
            const color = FACILITY_TYPE_COLORS[r.facility_type] || '#38bdf8'
            return (
              <div
                key={`${r.facility_id}-${r.medicine_name}-${idx}`}
                style={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: 12,
                  padding: '1rem 1.25rem',
                  transition: 'border-color 0.2s, transform 0.15s',
                  cursor: 'default',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = color
                  e.currentTarget.style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#334155'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', color: '#f1f5f9' }}>{r.facility_name}</h3>
                    <span style={{
                      display: 'inline-block',
                      background: `${color}20`, color,
                      padding: '2px 8px', borderRadius: 4,
                      fontSize: '0.7rem', marginTop: '0.3rem',
                      textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600,
                    }}>
                      {FACILITY_TYPE_LABELS[r.facility_type] || r.facility_type}
                    </span>
                  </div>
                  <span style={{
                    color: '#0ea5e9', fontSize: '0.85rem', fontWeight: 600,
                    whiteSpace: 'nowrap', marginLeft: '1rem',
                  }}>
                    {r.distance_km} km
                  </span>
                </div>

                {/* Medicine info */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  marginTop: '0.75rem',
                  padding: '0.6rem 0.75rem',
                  background: 'rgba(56, 189, 248, 0.06)',
                  borderRadius: 8,
                  border: '1px solid rgba(56, 189, 248, 0.1)',
                }}>
                  <span style={{ fontSize: '1.3rem' }}>💊</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.9rem', color: '#e2e8f0', fontWeight: 500 }}>
                      {r.medicine_name}
                    </div>
                  </div>
                  <div style={{
                    background: r.quantity_available > 10
                      ? 'rgba(34, 197, 94, 0.15)'
                      : r.quantity_available > 3
                        ? 'rgba(251, 191, 36, 0.15)'
                        : 'rgba(239, 68, 68, 0.15)',
                    color: r.quantity_available > 10
                      ? '#4ade80'
                      : r.quantity_available > 3
                        ? '#fbbf24'
                        : '#f87171',
                    padding: '3px 10px', borderRadius: 6,
                    fontSize: '0.8rem', fontWeight: 700,
                  }}>
                    {r.quantity_available} in stock
                  </div>
                </div>

                <p style={{ margin: '0.5rem 0 0', color: '#94a3b8', fontSize: '0.8rem' }}>
                  {r.address}
                </p>
                {r.contact_phone && (
                  <p style={{ margin: '0.2rem 0 0', color: '#64748b', fontSize: '0.75rem' }}>
                    📞 {r.contact_phone}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Spinner keyframe (injected once) */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
