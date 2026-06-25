import { useState, useEffect } from 'react'

export default function CosmicBackground() {
  const [ok, setOk] = useState(true)
  const [Scene, setScene] = useState<any>(null)

  useEffect(() => {
    let cancelled = false
    import('./CosmicScene').then(mod => {
      if (!cancelled) setScene(() => mod.default)
    }).catch(() => {
      if (!cancelled) setOk(false)
    })
    return () => { cancelled = true }
  }, [])

  if (!ok) return null
  if (!Scene) return null

  return <Scene />
}
