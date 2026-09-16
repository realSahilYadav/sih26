import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { fetchFacilityStock, updateMedicineStock } from '../services/api'

export default function StockManagement() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [facilityId, setFacilityId] = useState('')
  const [stock, setStock] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [filter, setFilter] = useState('')

  // Editing state
  const [editingId, setEditingId] = useState(null)
  const [editQty, setEditQty] = useState(0)
  const [saving, setSaving] = useState(false)

  // New medicine form
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newQty, setNewQty] = useState(0)

  // Try to detect facility from user profile
  useEffect(() => {
    if (user?.facility_id) {
      setFacilityId(user.facility_id)
    }
  }, [user])

  const loadStock = useCallback(async () => {
    if (!facilityId) return
    setLoading(true)
    setError(null)
    try {
      const data = await fetchFacilityStock(facilityId)
      setStock(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [facilityId])

  useEffect(() => {
    if (facilityId) loadStock()
  }, [facilityId, loadStock])

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleSave = async (medicineName, quantity) => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      await updateMedicineStock(facilityId, medicineName, quantity)
      setSuccess(`Updated ${medicineName} → ${quantity}`)
      setEditingId(null)
      await loadStock()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleAdd = async () => {
    if (!newName.trim()) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      await updateMedicineStock(facilityId, newName.trim(), newQty)
      setSuccess(`Added ${newName.trim()} with quantity ${newQty}`)
      setNewName('')
      setNewQty(0)
      setShowAdd(false)
      await loadStock()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (item) => {
    setEditingId(item.id)
    setEditQty(item.quantity_available)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditQty(0)
  }

  // ── Filter ────────────────────────────────────────────────────────────
  const displayed = filter
    ? stock.filter((s) =>
        s.medicine_name.toLowerCase().includes(filter.toLowerCase())
      )
    : stock

  // ── Styles ────────────────────────────────────────────────────────────
  const inputStyle = {
    padding: '0.6rem 0.75rem',
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 6,
    color: '#e2e8f0',
    fontSize: '0.85rem',
    outline: 'none',
    transition: 'border-color 0.2s',
  }

  const thStyle = {
    padding: '0.7rem 1rem',
    textAlign: 'left',
    fontSize: '0.7rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#64748b',
    borderBottom: '1px solid #334155',
    background: 'rgba(15, 23, 42, 0.4)',
  }

  const tdStyle = {
    padding: '0.75rem 1rem',
    fontSize: '0.9rem',
    borderBottom: '1px solid rgba(51, 65, 85, 0.5)',
    verticalAlign: 'middle',
  }

  return (
    <div style={{ padding: '2rem', maxWidth: 900, margin: '0 auto', color: '#f1f5f9' }}>
      {/* Back */}
      <button
        onClick={() => navigate('/')}
        style={{
          background: 'none', border: 'none', color: '#fb923c',
          cursor: 'pointer', fontSize: '0.9rem', padding: 0, marginBottom: '1.5rem',
        }}
      >
        ← Back to Dashboard
      </button>

      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem',
      }}>
        <div>
          <span style={{
            display: 'inline-block', padding: '4px 14px', borderRadius: 999,
            fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
            background: 'rgba(251, 146, 60, 0.12)', color: '#fb923c',
            marginBottom: '0.75rem', letterSpacing: '0.05em',
          }}>
            Medicine Inventory
          </span>
          <h1 style={{ fontSize: '1.75rem', margin: 0 }}>💊 Stock Management</h1>
          <p style={{ color: '#94a3b8', margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
            View and update medicine quantities for your facility
          </p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          disabled={!facilityId}
          style={{
            padding: '0.65rem 1.25rem',
            background: showAdd ? 'rgba(239, 68, 68, 0.15)' : 'linear-gradient(135deg, #fb923c, #f59e0b)',
            color: showAdd ? '#f87171' : '#fff',
            border: showAdd ? '1px solid rgba(239, 68, 68, 0.3)' : 'none',
            borderRadius: 8, cursor: 'pointer',
            fontSize: '0.85rem', fontWeight: 600,
          }}
        >
          {showAdd ? '✕ Cancel' : '+ Add Medicine'}
        </button>
      </div>

      {/* Facility ID input (if not auto-detected) */}
      {!user?.facility_id && (
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
            Facility ID
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="Enter your facility UUID…"
              value={facilityId}
              onChange={(e) => setFacilityId(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
              onFocus={(e) => (e.target.style.borderColor = '#fb923c')}
              onBlur={(e) => (e.target.style.borderColor = '#334155')}
            />
            <button
              onClick={loadStock}
              disabled={!facilityId || loading}
              style={{
                padding: '0.6rem 1rem',
                background: '#334155', color: '#e2e8f0',
                border: '1px solid #475569', borderRadius: 6,
                cursor: 'pointer', fontSize: '0.85rem',
              }}
            >
              Load
            </button>
          </div>
        </div>
      )}

      {/* Alerts */}
      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: '#f87171', padding: '0.6rem 1rem', borderRadius: 8,
          fontSize: '0.85rem', marginBottom: '1rem',
        }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{
          background: 'rgba(34, 197, 94, 0.1)',
          border: '1px solid rgba(34, 197, 94, 0.2)',
          color: '#4ade80', padding: '0.6rem 1rem', borderRadius: 8,
          fontSize: '0.85rem', marginBottom: '1rem',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}>
          <span style={{ fontSize: '1rem' }}>✓</span> {success}
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div style={{
          background: '#1e293b', border: '1px solid #fb923c40',
          borderRadius: 12, padding: '1.25rem', marginBottom: '1rem',
        }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', color: '#fb923c' }}>
            Add New Medicine
          </h3>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 2, minWidth: 200 }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.3rem' }}>
                Medicine Name
              </label>
              <input
                type="text"
                placeholder="e.g. Paracetamol 500mg"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
                onFocus={(e) => (e.target.style.borderColor = '#fb923c')}
                onBlur={(e) => (e.target.style.borderColor = '#334155')}
              />
            </div>
            <div style={{ flex: 1, minWidth: 100 }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.75rem', marginBottom: '0.3rem' }}>
                Quantity
              </label>
              <input
                type="number"
                min="0"
                value={newQty}
                onChange={(e) => setNewQty(Math.max(0, parseInt(e.target.value) || 0))}
                style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
                onFocus={(e) => (e.target.style.borderColor = '#fb923c')}
                onBlur={(e) => (e.target.style.borderColor = '#334155')}
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={saving || !newName.trim()}
              style={{
                padding: '0.6rem 1.5rem',
                background: 'linear-gradient(135deg, #fb923c, #f59e0b)',
                color: '#fff', border: 'none', borderRadius: 6,
                cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
                opacity: saving || !newName.trim() ? 0.5 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {saving ? 'Saving…' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {/* Filter */}
      {stock.length > 0 && (
        <input
          type="text"
          placeholder="🔍 Filter medicines…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            ...inputStyle, width: '100%', boxSizing: 'border-box',
            marginBottom: '1rem',
          }}
          onFocus={(e) => (e.target.style.borderColor = '#fb923c')}
          onBlur={(e) => (e.target.style.borderColor = '#334155')}
        />
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem 0' }}>
          <div style={{
            width: 36, height: 36,
            border: '3px solid rgba(251, 146, 60, 0.2)',
            borderTopColor: '#fb923c',
            borderRadius: '50%',
            animation: 'spin 0.7s linear infinite',
            margin: '0 auto 0.75rem',
          }} />
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Loading stock…</p>
        </div>
      )}

      {/* Stock table */}
      {!loading && displayed.length > 0 && (
        <div style={{
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: 12,
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>Medicine</th>
                <th style={{ ...thStyle, textAlign: 'center', width: 120 }}>Quantity</th>
                <th style={{ ...thStyle, width: 140 }}>Last Updated</th>
                <th style={{ ...thStyle, textAlign: 'center', width: 140 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((item) => (
                <tr
                  key={item.id}
                  style={{ transition: 'background 0.15s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(51, 65, 85, 0.3)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{ fontSize: '1.1rem' }}>💊</span>
                      <div>
                        <div style={{ fontWeight: 500, color: '#f1f5f9' }}>{item.medicine_name}</div>
                        {item.updater_name && (
                          <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: 2 }}>
                            by {item.updater_name}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    {editingId === item.id ? (
                      <input
                        type="number"
                        min="0"
                        value={editQty}
                        onChange={(e) => setEditQty(Math.max(0, parseInt(e.target.value) || 0))}
                        autoFocus
                        style={{
                          ...inputStyle, width: 80,
                          textAlign: 'center', borderColor: '#fb923c',
                          padding: '0.4rem',
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSave(item.medicine_name, editQty)
                          if (e.key === 'Escape') cancelEdit()
                        }}
                      />
                    ) : (
                      <span style={{
                        display: 'inline-block',
                        padding: '3px 12px', borderRadius: 6,
                        fontSize: '0.85rem', fontWeight: 700,
                        background: item.quantity_available > 10
                          ? 'rgba(34, 197, 94, 0.15)'
                          : item.quantity_available > 0
                            ? 'rgba(251, 191, 36, 0.15)'
                            : 'rgba(239, 68, 68, 0.15)',
                        color: item.quantity_available > 10
                          ? '#4ade80'
                          : item.quantity_available > 0
                            ? '#fbbf24'
                            : '#f87171',
                      }}>
                        {item.quantity_available}
                      </span>
                    )}
                  </td>

                  <td style={{ ...tdStyle, fontSize: '0.8rem', color: '#94a3b8' }}>
                    {new Date(item.updated_at).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                    <br />
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                      {new Date(item.updated_at).toLocaleTimeString('en-IN', {
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </td>

                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    {editingId === item.id ? (
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                        <button
                          onClick={() => handleSave(item.medicine_name, editQty)}
                          disabled={saving}
                          style={{
                            padding: '0.35rem 0.75rem',
                            background: 'rgba(34, 197, 94, 0.15)',
                            color: '#4ade80',
                            border: '1px solid rgba(34, 197, 94, 0.3)',
                            borderRadius: 6, cursor: 'pointer',
                            fontSize: '0.8rem', fontWeight: 600,
                          }}
                        >
                          {saving ? '…' : '✓ Save'}
                        </button>
                        <button
                          onClick={cancelEdit}
                          style={{
                            padding: '0.35rem 0.75rem',
                            background: 'rgba(148, 163, 184, 0.1)',
                            color: '#94a3b8',
                            border: '1px solid rgba(148, 163, 184, 0.15)',
                            borderRadius: 6, cursor: 'pointer',
                            fontSize: '0.8rem',
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(item)}
                        style={{
                          padding: '0.35rem 0.9rem',
                          background: 'rgba(251, 146, 60, 0.12)',
                          color: '#fb923c',
                          border: '1px solid rgba(251, 146, 60, 0.25)',
                          borderRadius: 6, cursor: 'pointer',
                          fontSize: '0.8rem', fontWeight: 500,
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.background = 'rgba(251, 146, 60, 0.25)'
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.background = 'rgba(251, 146, 60, 0.12)'
                        }}
                      >
                        ✏ Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {!loading && facilityId && stock.length === 0 && !error && (
        <div style={{
          textAlign: 'center', padding: '3rem 1rem',
          background: '#1e293b', borderRadius: 12,
          border: '1px solid #334155',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📦</div>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>No medicines in stock</h3>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.9rem' }}>
            Click "Add Medicine" to start tracking inventory for this facility.
          </p>
        </div>
      )}

      {/* Summary bar */}
      {!loading && stock.length > 0 && (
        <div style={{
          display: 'flex', gap: '1rem', marginTop: '1rem',
          flexWrap: 'wrap',
        }}>
          <div style={{
            flex: 1, minWidth: 150,
            background: '#1e293b', border: '1px solid #334155',
            borderRadius: 10, padding: '1rem',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fb923c' }}>
              {stock.length}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Medicines
            </div>
          </div>
          <div style={{
            flex: 1, minWidth: 150,
            background: '#1e293b', border: '1px solid #334155',
            borderRadius: 10, padding: '1rem',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#4ade80' }}>
              {stock.filter((s) => s.quantity_available > 0).length}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              In Stock
            </div>
          </div>
          <div style={{
            flex: 1, minWidth: 150,
            background: '#1e293b', border: '1px solid #334155',
            borderRadius: 10, padding: '1rem',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f87171' }}>
              {stock.filter((s) => s.quantity_available === 0).length}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Out of Stock
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
