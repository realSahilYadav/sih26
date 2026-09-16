import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fetchFacilitySummary, fetchFacilities } from '../services/api'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from 'recharts'

// ── Colors ──────────────────────────────────────────────────────────────────

const URGENCY_COLORS = { red: '#ef4444', yellow: '#f59e0b', green: '#22c55e' }

const REFERRAL_COLORS = {
  referred: '#38bdf8',
  accepted: '#fbbf24',
  in_transit: '#a855f7',
  follow_up_needed: '#f87171',
}

const APPT_STATUS_COLORS = {
  booked: '#38bdf8',
  checked_in: '#fbbf24',
  in_progress: '#a855f7',
  completed: '#22c55e',
  cancelled: '#64748b',
  no_show: '#f87171',
}

export default function FacilityDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [facilityId, setFacilityId] = useState(() => localStorage.getItem('admin_facility_id'))
  const [facilities, setFacilities] = useState([])
  const [loadingFacilities, setLoadingFacilities] = useState(!facilityId)
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Load facilities if no facility selected
  useEffect(() => {
    if (!facilityId) {
      setLoadingFacilities(true)
      fetchFacilities(19.076, 72.8777, 500)
        .then(setFacilities)
        .catch((err) => setError(err.message))
        .finally(() => setLoadingFacilities(false))
    }
  }, [facilityId])

  // Load dashboard summary
  useEffect(() => {
    if (!facilityId) return
    setLoading(true)
    setError(null)
    fetchFacilitySummary(facilityId)
      .then(setSummary)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [facilityId])

  function handleSelectFacility(id) {
    localStorage.setItem('admin_facility_id', id)
    setFacilityId(id)
  }

  // ── Facility selector ─────────────────────────────────────────────────

  if (!facilityId) {
    return (
      <div style={{ padding: '2rem', maxWidth: 600, margin: '0 auto', color: '#f1f5f9' }}>
        <button
          onClick={() => navigate('/')}
          style={{ background: 'none', border: 'none', color: '#fb923c', cursor: 'pointer', fontSize: '0.9rem', padding: 0, marginBottom: '1.5rem' }}
        >
          ← Back
        </button>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Select Your Facility</h1>
        {loadingFacilities ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ width: 40, height: 40, border: '3px solid rgba(251,146,60,0.2)', borderTopColor: '#fb923c', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto' }} />
          </div>
        ) : error ? (
          <div style={{ color: '#f87171' }}>{error}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {facilities.map((f) => (
              <button
                key={f.id}
                onClick={() => handleSelectFacility(f.id)}
                style={{
                  background: '#1e293b', border: '1px solid #334155', borderRadius: 10,
                  padding: '1rem', cursor: 'pointer', textAlign: 'left',
                  color: '#f1f5f9', transition: 'border-color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#fb923c')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#334155')}
              >
                <div style={{ fontWeight: 600 }}>{f.name}</div>
                <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: 2 }}>{f.address}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Loading ───────────────────────────────────────────────────────────

  if (loading || !summary) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0f172a' }}>
        <div style={{ width: 40, height: 40, border: '3px solid rgba(251,146,60,0.2)', borderTopColor: '#fb923c', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      </div>
    )
  }

  // ── Prepare chart data ────────────────────────────────────────────────

  const apptData = Object.entries(APPT_STATUS_COLORS)
    .map(([key]) => ({ name: key.replace('_', ' '), value: summary.appointments[key] || 0, key }))
    .filter((d) => d.value > 0)

  const referralPieData = Object.entries(summary.referrals.by_status)
    .map(([key, value]) => ({ name: key.replace('_', ' '), value }))
    .filter((d) => d.value > 0)

  const triageData = summary.triage_trend.map((d) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
  }))

  // ── Card component ────────────────────────────────────────────────────

  const Card = ({ title, icon, children, style: extraStyle }) => (
    <div style={{
      background: '#1e293b', border: '1px solid #334155', borderRadius: 14,
      padding: '1.25rem', ...extraStyle,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <span style={{ fontSize: '1.1rem' }}>{icon}</span>
        <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#f1f5f9', fontWeight: 600 }}>{title}</h3>
      </div>
      {children}
    </div>
  )

  const StatBadge = ({ label, value, color }) => (
    <div style={{
      background: `${color}15`, border: `1px solid ${color}30`,
      borderRadius: 8, padding: '0.6rem 0.75rem', textAlign: 'center', flex: 1, minWidth: 70,
    }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 2, textTransform: 'capitalize' }}>{label}</div>
    </div>
  )

  return (
    <div style={{ padding: '1.5rem 1.5rem 3rem', maxWidth: 1100, margin: '0 auto', color: '#f1f5f9' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <button
            onClick={() => navigate('/')}
            style={{ background: 'none', border: 'none', color: '#fb923c', cursor: 'pointer', fontSize: '0.85rem', padding: 0, marginBottom: '0.5rem' }}
          >
            ← Back to Admin Home
          </button>
          <h1 style={{ fontSize: '1.5rem', margin: '0 0 0.25rem' }}>{summary.facility_name}</h1>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.85rem' }}>
            Dashboard — {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button
          onClick={() => { localStorage.removeItem('admin_facility_id'); setFacilityId(null); setSummary(null) }}
          style={{
            background: '#334155', color: '#94a3b8', border: 'none', borderRadius: 6,
            padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '0.8rem',
          }}
        >
          Change Facility
        </button>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
          color: '#f87171', padding: '0.7rem 1rem', borderRadius: 8, marginBottom: '1rem', fontSize: '0.85rem',
        }}>{error}</div>
      )}

      {/* ── Top row: Appointment stats ────────────────────────────────── */}
      <Card title="Today's Appointments" icon="📋">
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <StatBadge label="Total" value={summary.appointments.total} color="#38bdf8" />
          <StatBadge label="Booked" value={summary.appointments.booked} color="#38bdf8" />
          <StatBadge label="Checked In" value={summary.appointments.checked_in} color="#fbbf24" />
          <StatBadge label="In Progress" value={summary.appointments.in_progress} color="#a855f7" />
          <StatBadge label="Completed" value={summary.appointments.completed} color="#22c55e" />
          <StatBadge label="Cancelled" value={summary.appointments.cancelled} color="#64748b" />
          <StatBadge label="No Show" value={summary.appointments.no_show} color="#f87171" />
        </div>

        {apptData.length > 0 && (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={apptData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                labelStyle={{ color: '#f1f5f9' }}
                itemStyle={{ color: '#94a3b8' }}
              />
              <Bar dataKey="value" name="Count" radius={[4, 4, 0, 0]}>
                {apptData.map((entry) => (
                  <Cell key={entry.key} fill={APPT_STATUS_COLORS[entry.key] || '#38bdf8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* ── Middle row: Referrals + Low Stock ─────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', margin: '1rem 0' }}>

        {/* Referral donut */}
        <Card title="Active Referrals" icon="🔄">
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <StatBadge label="Incoming" value={summary.referrals.incoming_total} color="#22c55e" />
            <StatBadge label="Outgoing" value={summary.referrals.outgoing_total} color="#f59e0b" />
          </div>

          {referralPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={referralPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {referralPieData.map((entry, i) => (
                    <Cell key={entry.name} fill={Object.values(REFERRAL_COLORS)[i % Object.values(REFERRAL_COLORS).length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ color: '#64748b', textAlign: 'center', padding: '2rem 0', fontSize: '0.85rem' }}>
              No active referrals
            </div>
          )}
        </Card>

        {/* Low-stock alerts */}
        <Card title="Low Stock Alerts" icon="⚠️">
          {summary.low_stock_alerts.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: 250, overflowY: 'auto' }}>
              {summary.low_stock_alerts.map((alert) => (
                <div
                  key={alert.medicine_name}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: alert.quantity_available === 0 ? 'rgba(239,68,68,0.08)' : 'rgba(251,191,36,0.06)',
                    border: `1px solid ${alert.quantity_available === 0 ? 'rgba(239,68,68,0.2)' : 'rgba(251,191,36,0.15)'}`,
                    borderRadius: 8, padding: '0.6rem 0.75rem',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{alert.medicine_name}</div>
                    <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Threshold: {alert.threshold}</div>
                  </div>
                  <div style={{
                    fontWeight: 700, fontSize: '1.1rem',
                    color: alert.quantity_available === 0 ? '#ef4444' : '#fbbf24',
                  }}>
                    {alert.quantity_available}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#4ade80', textAlign: 'center', padding: '2rem 0', fontSize: '0.85rem' }}>
              ✓ All medicines above threshold
            </div>
          )}
        </Card>
      </div>

      {/* ── Bottom: Triage trend ─────────────────────────────────────── */}
      <Card title="Triage Volume — Last 7 Days" icon="📊">
        {triageData.some((d) => d.total > 0) ? (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={triageData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                labelStyle={{ color: '#f1f5f9' }}
              />
              <Legend
                iconType="circle"
                wrapperStyle={{ fontSize: '0.8rem', color: '#94a3b8' }}
              />
              <Line type="monotone" dataKey="red" name="Emergency" stroke={URGENCY_COLORS.red} strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="yellow" name="Urgent" stroke={URGENCY_COLORS.yellow} strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="green" name="Non-Urgent" stroke={URGENCY_COLORS.green} strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ color: '#64748b', textAlign: 'center', padding: '2rem 0', fontSize: '0.85rem' }}>
            No triage data in the last 7 days
          </div>
        )}
      </Card>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
