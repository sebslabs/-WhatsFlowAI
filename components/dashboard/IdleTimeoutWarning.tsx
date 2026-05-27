'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useIdleAutoLogout } from '@/hooks/useIdleAutoLogout'

/**
 * IdleTimeoutWarning
 *
 * Renders a full-screen overlay warning when the user has been idle
 * for too long. Shows a live countdown and lets the user click
 * "Stay Logged In" to reset the timer.
 *
 * This component is self-contained — just drop it inside the
 * dashboard layout and it wires up the idle detection automatically.
 *
 * IMPROVEMENT 2: Timeout durations are now configurable via props so the
 * parent layout (or a future settings page) can tune them without editing
 * this file. Falls back to the same 30-min / 60-s defaults as before.
 */

interface IdleTimeoutWarningProps {
  /** Total idle duration before auto-logout (default 30 min) */
  idleTimeoutMs?: number
  /** How long before logout to show the countdown warning (default 60 s) */
  warningBeforeMs?: number
}

export function IdleTimeoutWarning({
  idleTimeoutMs   = 30 * 60 * 1000,
  warningBeforeMs = 60 * 1000,
}: IdleTimeoutWarningProps = {}) {
  const [isWarning, setIsWarning]     = useState(false)
  const [remaining, setRemaining]     = useState(warningBeforeMs)
  const countdownRef                  = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
  }, [])

  const startCountdown = useCallback((totalMs: number) => {
    clearCountdown()
    const deadline = Date.now() + totalMs
    setRemaining(totalMs)
    countdownRef.current = setInterval(() => {
      const left = deadline - Date.now()
      if (left <= 0) {
        clearCountdown()
        setRemaining(0)
      } else {
        setRemaining(left)
      }
    }, 500)
  }, [clearCountdown])

  const { resetTimer } = useIdleAutoLogout({
    idleTimeoutMs:   idleTimeoutMs,
    warningBeforeMs: warningBeforeMs,

    onWarning: (remainingMs) => {
      setIsWarning(true)
      startCountdown(remainingMs)
    },

    onWarning_dismiss: () => {
      setIsWarning(false)
      clearCountdown()
    },

    onLogout: () => {
      setIsWarning(false)
      clearCountdown()
    },
  })

  // Cleanup on unmount
  useEffect(() => () => clearCountdown(), [clearCountdown])

  const handleStayLoggedIn = () => {
    setIsWarning(false)
    clearCountdown()
    resetTimer()
  }

  const secs = Math.max(0, Math.ceil(remaining / 1000))
  const mins  = Math.floor(secs / 60)
  const s     = secs % 60
  const label = mins > 0
    ? `${mins}:${String(s).padStart(2, '0')}`
    : `${secs}s`

  // Progress arc (0→1) for the circular timer
  const progress   = remaining / warningBeforeMs
  const radius     = 30
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - progress)

  if (!isWarning) return null

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Session timeout warning"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #0f1923 0%, #0B0F1A 100%)',
          border: '1px solid rgba(22,163,74,0.25)',
        }}
      >
        {/* Top accent bar */}
        <div
          className="h-1 w-full"
          style={{
            background: `linear-gradient(to right, #16A34A ${(1 - progress) * 100}%, #1F2937 ${(1 - progress) * 100}%)`,
            transition: 'background 0.5s linear',
          }}
        />

        <div className="px-8 py-8 flex flex-col items-center gap-6 text-center">
          {/* Circular countdown timer */}
          <div className="relative flex items-center justify-center">
            {/* Subtle glow ring */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                boxShadow: `0 0 40px rgba(22,163,74,${0.15 + progress * 0.25})`,
              }}
            />
            <svg width="88" height="88" viewBox="0 0 88 88" className="-rotate-90">
              {/* Track */}
              <circle
                cx="44" cy="44" r={radius}
                fill="none"
                stroke="rgba(255,255,255,0.07)"
                strokeWidth="6"
              />
              {/* Progress arc */}
              <circle
                cx="44" cy="44" r={radius}
                fill="none"
                stroke={progress > 0.33 ? '#16A34A' : progress > 0.15 ? '#F59E0B' : '#EF4444'}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                style={{ transition: 'stroke-dashoffset 0.5s linear, stroke 0.5s ease' }}
              />
            </svg>
            <span
              className="absolute text-2xl font-bold tabular-nums"
              style={{ color: progress > 0.33 ? '#16A34A' : progress > 0.15 ? '#F59E0B' : '#EF4444' }}
            >
              {label}
            </span>
          </div>

          {/* Text */}
          <div className="space-y-1">
            <h2 className="text-white text-xl font-semibold tracking-tight">
              Still there?
            </h2>
            <p className="text-[#9CA3AF] text-sm leading-relaxed">
              You&apos;ve been inactive for a while. For your security, you&apos;ll be
              signed out automatically in{' '}
              <span className="text-white font-semibold">{label}</span>.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <button
              id="idle-stay-logged-in-btn"
              onClick={handleStayLoggedIn}
              className="flex-1 px-5 py-2.5 rounded-xl font-semibold text-sm text-white transition-all duration-150 hover:brightness-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#16A34A] focus:ring-offset-2 focus:ring-offset-[#0B0F1A]"
              style={{ background: 'linear-gradient(135deg, #16A34A, #15803D)' }}
            >
              Stay Logged In
            </button>
            <button
              id="idle-logout-now-btn"
              onClick={async () => {
                try {
                  const { createClient } = await import('@/lib/supabase/client')
                  const supabase = createClient()
                  await supabase.auth.signOut()
                } catch { /* sign-out best-effort */ } finally {
                  // FIX 1: replace() prevents back-button returning to dashboard
                  // FIX 2: clear all local state before redirect
                  try { localStorage.clear() } catch { /* sandboxed */ }
                  try { sessionStorage.clear() } catch { /* sandboxed */ }
                  window.location.replace('/auth/login?reason=manual_idle')
                }
              }}
              className="flex-1 px-5 py-2.5 rounded-xl font-semibold text-sm text-[#9CA3AF] border border-[#374151] hover:border-[#4B5563] hover:text-white transition-all duration-150 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#374151] focus:ring-offset-2 focus:ring-offset-[#0B0F1A]"
            >
              Sign Out Now
            </button>
          </div>

          <p className="text-[#4B5563] text-[11px]">
            Move your mouse or press any key to dismiss
          </p>
        </div>
      </div>
    </div>
  )
}
