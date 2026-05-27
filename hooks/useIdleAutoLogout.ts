'use client'

import { useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * useIdleAutoLogout
 *
 * Tracks user activity and automatically signs out the session when:
 *   1. The user is idle for `idleTimeoutMs` milliseconds (default 30 min).
 *   2. The browser tab is closed or the browser is closed
 *      (via the Page Visibility API + beforeunload).
 *
 * A warning callback fires `warningBeforeMs` milliseconds before the logout
 * so the UI can show a countdown modal. The user can reset the timer by
 * calling `resetTimer()`.
 *
 * Activity events that reset the idle timer:
 *   mousemove, mousedown, keydown, touchstart, scroll, click, focus
 *
 * @param options.idleTimeoutMs      Total idle duration before logout (default 30 min)
 * @param options.warningBeforeMs    How long before logout to fire onWarning (default 60s)
 * @param options.onWarning          Called when countdown begins — receives remainingMs
 * @param options.onWarning_dismiss  Called when the warning is dismissed by activity
 * @param options.onLogout           Called just before the session is destroyed
 * @param options.logoutOnTabClose   Whether to sign out when the tab/browser is closed (default false)
 *                                   Set to false by default because browser close is not always
 *                                   distinguishable from a page navigation in all browsers.
 */
export interface IdleAutoLogoutOptions {
  idleTimeoutMs?: number
  warningBeforeMs?: number
  onWarning?: (remainingMs: number) => void
  onWarning_dismiss?: () => void
  onLogout?: () => void
  logoutOnTabClose?: boolean
}

const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'click',
  'focus',
] as const

/**
 * FIX 2 — Clear all in-memory / storage state on logout.
 * The project uses React Context (no Zustand store found), so we clear
 * localStorage and sessionStorage in full to prevent stale data leaks
 * after the session ends. The Supabase token keys are also flushed here
 * as a belt-and-suspenders measure (signOut() already revokes the server
 * token, but the local copy should be gone before the redirect).
 */
function clearClientState(): void {
  try { localStorage.clear() } catch { /* sandboxed iframe */ }
  try { sessionStorage.clear() } catch { /* sandboxed iframe */ }
}

export function useIdleAutoLogout({
  idleTimeoutMs    = 30 * 60 * 1000, // 30 minutes
  warningBeforeMs  = 60 * 1000,      // Show warning 60s before logout
  onWarning,
  onWarning_dismiss,
  onLogout,
  logoutOnTabClose = false,
}: IdleAutoLogoutOptions = {}) {
  const idleTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warnTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warningActiveRef = useRef(false)

  // IMPROVEMENT 1 — BroadcastChannel for cross-tab logout sync.
  // If this tab goes idle and signs out, all other open tabs follow immediately.
  // Constructed once per hook instance; closed on unmount.
  const channelRef = useRef<BroadcastChannel | null>(null)

  const performLogout = useCallback(async () => {
    try {
      onLogout?.()

      // IMPROVEMENT 1 — broadcast logout to sibling tabs BEFORE signing out
      // so they can react even if the current tab's network call is slow.
      try {
        channelRef.current?.postMessage({ type: 'IDLE_LOGOUT' })
      } catch { /* BroadcastChannel unavailable (e.g. cross-origin iframe) */ }

      const supabase = createClient()
      await supabase.auth.signOut()

      // FIX 2 — clear all client-side state BEFORE the redirect
      clearClientState()
    } catch (err) {
      console.error('[IdleLogout] signOut error:', err)
      // Still clear local state and redirect even if the network call fails
      clearClientState()
    } finally {
      // FIX 1 — use location.replace() so the back-button can't return to dashboard
      window.location.replace('/auth/login?reason=idle')
    }
  }, [onLogout])

  const clearTimers = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    if (warnTimerRef.current) clearTimeout(warnTimerRef.current)
    idleTimerRef.current = null
    warnTimerRef.current = null
  }, [])

  const resetTimer = useCallback(() => {
    clearTimers()

    // If a warning was showing, dismiss it
    if (warningActiveRef.current) {
      warningActiveRef.current = false
      onWarning_dismiss?.()
    }

    // Schedule warning timer
    const warnAfterMs = idleTimeoutMs - warningBeforeMs
    if (warnAfterMs > 0) {
      warnTimerRef.current = setTimeout(() => {
        warningActiveRef.current = true
        onWarning?.(warningBeforeMs)
      }, warnAfterMs)
    }

    // Schedule logout timer
    idleTimerRef.current = setTimeout(() => {
      performLogout()
    }, idleTimeoutMs)
  }, [clearTimers, idleTimeoutMs, warningBeforeMs, onWarning, onWarning_dismiss, performLogout])

  useEffect(() => {
    // IMPROVEMENT 1 — open BroadcastChannel and listen for cross-tab logout
    const channel = new BroadcastChannel('whatsflow_auth_idle')
    channelRef.current = channel

    channel.onmessage = (e: MessageEvent) => {
      if (e.data?.type === 'IDLE_LOGOUT') {
        // Another tab logged out — clear state and redirect this tab too
        clearClientState()
        window.location.replace('/auth/login?reason=idle')
      }
    }

    // Start the idle timer on mount
    resetTimer()

    // Attach activity listeners
    const handleActivity = () => resetTimer()
    ACTIVITY_EVENTS.forEach((evt) =>
      window.addEventListener(evt, handleActivity, { passive: true })
    )

    // FIX 3 — Reset timer when tab becomes visible again.
    // Prevents logout when the user was reading a long message, watching
    // content, or had another app in the foreground without moving the mouse.
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') resetTimer()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearTimers()
      channel.close()
      channelRef.current = null
      ACTIVITY_EVENTS.forEach((evt) =>
        window.removeEventListener(evt, handleActivity)
      )
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [resetTimer, clearTimers])

  // ── Tab / browser close ───────────────────────────────────────────────────
  // NOTE: The visibilitychange handler above resets the timer on tab restore.
  // The block below is a separate, opt-in path for signing out when the browser
  // is CLOSED (not just backgrounded). It keeps its own hidden→5s grace period
  // to avoid false-positives on Alt+Tab / quick navigation away.
  useEffect(() => {
    if (!logoutOnTabClose) return

    const handleVisibilityChange = () => {
      // Page hidden = tab closed or browser minimised.
      // We only act on hidden → not visible for extended period, so we
      // use a short grace period (5s) to avoid logging out on
      // Alt+Tab or quick navigation away.
      if (document.visibilityState === 'hidden') {
        const grace = setTimeout(() => {
          if (document.visibilityState === 'hidden') {
            performLogout()
          }
        }, 5_000)
        const onVisible = () => {
          clearTimeout(grace)
          document.removeEventListener('visibilitychange', onVisible)
        }
        document.addEventListener('visibilitychange', onVisible, { once: true })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [logoutOnTabClose, performLogout])

  return { resetTimer }
}
