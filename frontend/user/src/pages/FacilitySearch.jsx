import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchNearbyFacilities } from '../services/api'

const FACILITY_TYPE_LABELS = {
  sub_centre: 'Sub Centre',
  phc: 'PHC',
  rural_hospital: 'Rural Hospital',
  district_hospital: 'District Hospital',
}

export default function FacilitySearch() {
  const navigate = useNavigate()
  const [facilities, setFacilities] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [geoStatus, setGeoStatus] = useState('idle') // idle | loading | granted | denied
  const [coords, setCoords] = useState({ lat: '', lng: '' })
  const [searchName, setSearchName] = useState('')

  const doSearch = async (lat, lng) => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchNearbyFacilities(lat, lng, 100)
      setFacilities(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const useGeolocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus('denied')
      setError('Geolocation is not supported by your browser')
      return
    }
    setGeoStatus('loading')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        setCoords({ lat: latitude, lng: longitude })
        setGeoStatus('granted')
        doSearch(latitude, longitude)
      },
      () => {
        setGeoStatus('denied')
        setError('Location permission denied. Enter coordinates manually.')
      },
      { timeout: 10000 }
    )
  }

  const handleManualSearch = (e) => {
    e.preventDefault()
    if (!coords.lat || !coords.lng) return
    doSearch(parseFloat(coords.lat), parseFloat(coords.lng))
  }

  // Filter by name client-side
  const displayed = searchName
    ? facilities.filter((f) =>
        f.name.toLowerCase().includes(searchName.toLowerCase())
      )
    : facilities

  return (
    <div style={{ padding: '1.5rem', maxWidth: 700, margin: '0 auto' }}>
      <button
        onClick={() => navigate('/')}
        style={{
          background: 'none',
          border: 'none',
          color: '#38bdf8',
          cursor: 'pointer',
          fontSize: '0.9rem',
          padding: 0,
          marginBottom: '1rem',
        }}
      >
        ← Back to Dashboard
      </button>

      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Find Nearby Facilities</h1>
      <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
        Use your location or enter coordinates to search
      </p>

      {/* Geolocation button */}
      <button
        onClick={useGeolocation}
        disabled={geoStatus === 'loading'}
        style={{
          width: '100%',
          padding: '0.75rem',
          background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          fontSize: '0.95rem',
          cursor: 'pointer',
          marginBottom: '1rem',
        }}
      >
        {geoStatus === 'loading' ? '📡 Detecting location…' : '📍 Use My Location'}
      </button>

      {/* Manual coordinate input */}
      <form onSubmit={handleManualSearch} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <input
          type="number"
          step="any"
          placeholder="Latitude"
          value={coords.lat}
          onChange={(e) => setCoords({ ...coords, lat: e.target.value })}
          style={{
            flex: 1,
            padding: '0.6rem 0.75rem',
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 6,
            color: '#e2e8f0',
            fontSize: '0.85rem',
          }}
        />
        <input
          type="number"
          step="any"
          placeholder="Longitude"
          value={coords.lng}
          onChange={(e) => setCoords({ ...coords, lng: e.target.value })}
          style={{
            flex: 1,
            padding: '0.6rem 0.75rem',
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 6,
            color: '#e2e8f0',
            fontSize: '0.85rem',
          }}
        />
        <button
          type="submit"
          style={{
            padding: '0.6rem 1rem',
            background: '#334155',
            color: '#e2e8f0',
            border: '1px solid #475569',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: '0.85rem',
          }}
        >
          Search
        </button>
      </form>

      {/* Name filter */}
      {facilities.length > 0 && (
        <input
          type="text"
          placeholder="🔍 Filter by name…"
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          style={{
            width: '100%',
            padding: '0.6rem 0.75rem',
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 6,
            color: '#e2e8f0',
            fontSize: '0.85rem',
            marginBottom: '1rem',
            boxSizing: 'border-box',
          }}
        />
      )}

      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: '#f87171',
          padding: '0.7rem 1rem',
          borderRadius: 8,
          fontSize: '0.85rem',
          marginBottom: '1rem',
        }}>
          {error}
        </div>
      )}

      {loading && <p style={{ color: '#94a3b8', textAlign: 'center' }}>Loading facilities…</p>}

      {/* Results */}
      {!loading && displayed.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {displayed.map((f) => (
            <div
              key={f.id}
              onClick={() => navigate(`/book/${f.id}`, { state: { facility: f } })}
              style={{
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 10,
                padding: '1rem 1.25rem',
                cursor: 'pointer',
                transition: 'border-color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#38bdf8')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#334155')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', color: '#f1f5f9' }}>{f.name}</h3>
                  <span style={{
                    display: 'inline-block',
                    background: 'rgba(56, 189, 248, 0.1)',
                    color: '#38bdf8',
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: '0.7rem',
                    marginTop: '0.35rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    {FACILITY_TYPE_LABELS[f.type] || f.type}
                  </span>
                </div>
                <span style={{
                  color: '#0ea5e9',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}>
                  {f.distance_km} km
                </span>
              </div>
              <p style={{ margin: '0.5rem 0 0', color: '#94a3b8', fontSize: '0.8rem' }}>{f.address}</p>
              {f.contact_phone && (
                <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.75rem' }}>
                  📞 {f.contact_phone}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && !error && facilities.length === 0 && geoStatus !== 'idle' && (
        <p style={{ color: '#94a3b8', textAlign: 'center', marginTop: '2rem' }}>
          No facilities found within range. Try increasing the search area.
        </p>
      )}
    </div>
  )
}
