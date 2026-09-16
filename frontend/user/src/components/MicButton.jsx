import { useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { speechToText } from '../services/api'

/**
 * A mic button that records audio and sends it to STT.
 *
 * Props:
 *   onResult  — callback with transcribed text: (text: string) => void
 *   lang      — optional language override
 */
export default function MicButton({ onResult, lang }) {
  const { user } = useAuth()
  const [state, setState] = useState('idle') // 'idle' | 'recording' | 'processing'
  const mediaRecorder = useRef(null)
  const chunks = useRef([])
  const timeoutRef = useRef(null)

  const language = lang || user?.preferred_language || 'en'

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      })
      mediaRecorder.current = recorder
      chunks.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data)
      }

      recorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach((t) => t.stop())
        clearTimeout(timeoutRef.current)

        if (chunks.current.length === 0) {
          setState('idle')
          return
        }

        setState('processing')
        try {
          const blob = new Blob(chunks.current, { type: 'audio/webm' })
          const reader = new FileReader()
          reader.onloadend = async () => {
            const base64 = reader.result.split(',')[1]
            try {
              const data = await speechToText(base64, language)
              if (data?.text) {
                onResult(data.text)
              }
            } catch {
              // Silently fail — don't block the user
            }
            setState('idle')
          }
          reader.readAsDataURL(blob)
        } catch {
          setState('idle')
        }
      }

      recorder.start()
      setState('recording')

      // Auto-stop after 15 seconds
      timeoutRef.current = setTimeout(() => {
        if (mediaRecorder.current?.state === 'recording') {
          mediaRecorder.current.stop()
        }
      }, 15000)
    } catch {
      setState('idle')
    }
  }

  const stopRecording = () => {
    if (mediaRecorder.current?.state === 'recording') {
      mediaRecorder.current.stop()
    }
  }

  const handleClick = () => {
    if (state === 'recording') {
      stopRecording()
    } else if (state === 'idle') {
      startRecording()
    }
  }

  const btnStyle = {
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: state === 'recording' ? '2px solid #ef4444' : '1px solid #334155',
    cursor: state === 'processing' ? 'wait' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1rem',
    flexShrink: 0,
    transition: 'all 0.2s',
    background:
      state === 'recording'
        ? 'rgba(239, 68, 68, 0.15)'
        : state === 'processing'
          ? 'rgba(148, 163, 184, 0.1)'
          : 'rgba(99, 102, 241, 0.1)',
    color: state === 'recording' ? '#f87171' : '#94a3b8',
    animation: state === 'recording' ? 'pulse-mic 1.2s ease-in-out infinite' : 'none',
  }

  return (
    <>
      <button
        onClick={handleClick}
        style={btnStyle}
        disabled={state === 'processing'}
        title={
          state === 'recording'
            ? 'Tap to stop recording'
            : state === 'processing'
              ? 'Processing…'
              : 'Tap to speak'
        }
        aria-label={state === 'recording' ? 'Stop recording' : 'Start voice input'}
      >
        {state === 'processing' ? (
          <span style={{
            width: 14, height: 14,
            border: '2px solid rgba(148, 163, 184, 0.3)',
            borderTopColor: '#94a3b8',
            borderRadius: '50%',
            animation: 'spin 0.7s linear infinite',
            display: 'inline-block',
          }} />
        ) : state === 'recording' ? (
          <span style={{
            width: 10, height: 10, borderRadius: '50%',
            background: '#ef4444',
            display: 'inline-block',
          }} />
        ) : '🎙️'}
      </button>
      <style>{`
        @keyframes pulse-mic {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          50% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
        }
      `}</style>
    </>
  )
}
