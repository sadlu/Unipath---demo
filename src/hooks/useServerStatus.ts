import { useState, useEffect, useRef } from 'react'
import { getApiBase } from '../services/api'

export type ServerStatus = 'checking' | 'online' | 'offline'

export function useServerStatus() {
  const [status, setStatus] = useState<ServerStatus>('checking')
  const [latency, setLatency] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval>>()

  const check = async () => {
    const base = getApiBase()
    if (!base) {
      setStatus('online')
      return
    }
    const start = performance.now()
    try {
      const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(5000) })
      if (res.ok) {
        setStatus('online')
        setLatency(Math.round(performance.now() - start))
      } else {
        setStatus('offline')
      }
    } catch {
      setStatus('offline')
    }
  }

  useEffect(() => {
    check()
    intervalRef.current = setInterval(check, 15000)
    return () => clearInterval(intervalRef.current)
  }, [])

  return { status, latency, check }
}
