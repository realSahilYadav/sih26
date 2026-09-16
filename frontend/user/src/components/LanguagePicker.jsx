import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { updateLanguage } from '../services/api'

const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English', icon: '🇬🇧' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी', icon: '🇮🇳' },
  { code: 'mr', label: 'Marathi', native: 'मराठी', icon: '🏛️' },
]

/**
 * Language picker modal shown after first login.
 *
 * Props:
 *   onDismiss — called after selection or skip
 */
export default function LanguagePicker({ onDismiss }) {
  const { updateUser } = useAuth()
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState(null)

  const handleSelect = async (code) => {
    setSelected(code)
    setSaving(true)
    try {
      await updateLanguage(code)
      updateUser({ preferred_language: code })
    } catch {
      // Silently continue with default
    }
    setSaving(false)
    onDismiss()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
    }}>
      <div style={{
        background: '#1e293b', border: '1px solid #334155',
        borderRadius: 20, padding: '2rem', maxWidth: 380, width: '100%',
        textAlign: 'center',
        animation: 'slide-up 0.3s ease-out',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14,
          background: 'linear-gradient(135deg, #6366f1, #ec4899)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.5rem', margin: '0 auto 1rem',
        }}>
          🗣️
        </div>

        <h2 style={{ color: '#f1f5f9', fontSize: '1.2rem', margin: '0 0 0.25rem' }}>
          Choose Your Language
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0 0 1.5rem' }}>
          Voice guidance and instructions will be in this language
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.25rem' }}>
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleSelect(lang.code)}
              disabled={saving}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.85rem 1rem',
                background: selected === lang.code ? 'rgba(99, 102, 241, 0.15)' : '#0f172a',
                border: `2px solid ${selected === lang.code ? '#6366f1' : '#334155'}`,
                borderRadius: 12, cursor: 'pointer',
                transition: 'all 0.2s',
                color: '#f1f5f9',
                width: '100%',
              }}
              onMouseEnter={(e) => {
                if (selected !== lang.code) e.currentTarget.style.borderColor = '#475569'
              }}
              onMouseLeave={(e) => {
                if (selected !== lang.code) e.currentTarget.style.borderColor = '#334155'
              }}
            >
              <span style={{ fontSize: '1.3rem' }}>{lang.icon}</span>
              <div style={{ textAlign: 'left', flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{lang.label}</div>
                <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{lang.native}</div>
              </div>
              {selected === lang.code && saving && (
                <span style={{
                  width: 16, height: 16,
                  border: '2px solid rgba(99, 102, 241, 0.3)',
                  borderTopColor: '#6366f1',
                  borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite',
                  display: 'inline-block',
                }} />
              )}
            </button>
          ))}
        </div>

        <button
          onClick={() => {
            handleSelect('en')
          }}
          style={{
            background: 'transparent', color: '#64748b',
            border: 'none', cursor: 'pointer',
            fontSize: '0.8rem', padding: '0.5rem',
          }}
        >
          Continue with English →
        </button>
      </div>

      <style>{`
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
