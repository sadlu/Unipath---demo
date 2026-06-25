import { useState, useEffect } from 'react'

export default function FloatingCrystal({ size = 60 }: { size?: number }) {
  const [ok, setOk] = useState(true)
  const [Scene, setScene] = useState<any>(null)

  useEffect(() => {
    let cancelled = false
    import('./CrystalScene').then(mod => {
      if (!cancelled) setScene(() => mod.default)
    }).catch(() => {
      if (!cancelled) setOk(false)
    })
    return () => { cancelled = true }
  }, [])

  if (!ok) return null
  if (!Scene) return <div style={{ width: size, height: size }} className="shrink-0" />

  return <Scene size={size} />
}
