import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { textToSpeech } from '../services/api'

/**
 * A small speaker icon button that plays TTS audio for the given text.
 *
 * Props:
 *   text  — the text to speak
 *   lang  — optional language override (defaults to user's preferred_language)
 */
export default function SpeakerButton({ text, lang }) {
  const { user } = useAuth()
  const [state, setState] = useState('idle') // 'idle' | 'loading' | 'playing'

  const language = lang || user?.preferred_language || 'en'

  const handleClick = async () => {
    if (state === 'playing') return
    if (state === 'loading') return

    setState('loading')
    try {
      const data = await textToSpeech(text, language)
      if (!data?.audio_base64) {
        setState('idle')
        return
      }

      // Decode base64 → audio blob → play
      const byteChars = atob(data.audio_base64)
      const byteArray = new Uint8Array(byteChars.length)
      for (let i = 0; i < byteChars.length; i++) {
        byteArray[i] = byteChars.charCodeAt(i)
      }
      const blob = new Blob([byteArray], { type: 'audio/wav' })
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)

      setState('playing')
      audio.onended = () => {
        URL.revokeObjectURL(url)
        setState('idle')
      }
      audio.onerror = () => {
        URL.revokeObjectURL(url)
        setState('idle')
      }
      await audio.play()
    } catch {
      setState('idle')
    }
  }

  const btnStyle = {
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: 'none',
    cursor: state === 'loading' ? 'wait' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.9rem',
    flexShrink: 0,
    transition: 'all 0.2s',
    background:
      state === 'playing'
        ? 'rgba(56, 189, 248, 0.25)'
        : state === 'loading'
          ? 'rgba(148, 163, 184, 0.15)'
          : 'rgba(56, 189, 248, 0.1)',
    color: state === 'playing' ? '#38bdf8' : '#94a3b8',
    animation: state === 'playing' ? 'pulse-speaker 1s ease-in-out infinite' : 'none',
  }

  return (
    <>
      <button
        onClick={handleClick}
        style={btnStyle}
        title={`Listen in ${language === 'hi' ? 'Hindi' : language === 'mr' ? 'Marathi' : 'English'}`}
        aria-label="Listen"
      >
        {state === 'loading' ? (
          <span style={{
            width: 14, height: 14,
            border: '2px solid rgba(148, 163, 184, 0.3)',
            borderTopColor: '#94a3b8',
            borderRadius: '50%',
            animation: 'spin 0.7s linear infinite',
            display: 'inline-block',
          }} />
        ) : '🔊'}
      </button>
      <style>{`
        @keyframes pulse-speaker {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }
      `}</style>
    </>
  )
}
