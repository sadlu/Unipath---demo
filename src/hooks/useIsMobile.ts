import { useState, useEffect } from 'react'

function detectMobile(): boolean {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  const isMobileUA = /android|iphone|ipad|ipod|webos|blackberry|windows phone/i.test(ua)
  const isSmallScreen = window.innerWidth < 768
  return (isMobileUA || (isTouchDevice && isSmallScreen))
}

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(detectMobile)

  useEffect(() => {
    const onResize = () => setIsMobile(detectMobile())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return isMobile
}
