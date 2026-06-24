import { useEffect, useRef, useState } from 'react'
import { animate } from 'framer-motion'

export default function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(value)
  const prevRef = useRef(value)

  useEffect(() => {
    const from = prevRef.current
    if (from !== value) {
      const controls = animate(from, value, {
        duration: 0.6,
        ease: 'easeOut',
        onUpdate: (latest) => setDisplay(Math.round(latest)),
      })
      prevRef.current = value
      return controls.stop
    }
  }, [value])

  return <>{display}</>
}
