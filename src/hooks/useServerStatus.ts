import { useState, useEffect, useRef } from 'react'
import { discoverApiBase, getDiscoveredBase } from '../services/api'

export type ServerStatus = 'checking' | 'online' | 'offline'

export function useServerStatus() {
  const [status, setStatus] = useState<ServerStatus>('checking')
  const [latency, setLatency] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval>>()

  const check = async () => {
    setStatus('checking')
    const base = await discoverApiBase() || getDiscoveredBase()
    if (!base) {
      setStatus('offline')
      return
    }
    const start = performance.now()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    try {
      const res = await fetch(`${base}/api/health`, { signal: controller.signal })
      clearTimeout(timer)
      if (res.ok) {
        setStatus('online')
        setLatency(Math.round(performance.now() - start))
      } else {
        setStatus('offline')
      }
    } catch {
      clearTimeout(timer)
      setStatus('offline')
    }
  }

  useEffect(() => {
    check()
    intervalRef.current = setInterval(check, 30000)
    return () => clearInterval(intervalRef.current)
  }, [])

  return { status, latency, check }
}
