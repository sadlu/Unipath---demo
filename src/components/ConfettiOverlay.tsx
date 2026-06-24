import React from 'react'
import Confetti from 'react-confetti'
import { useStore } from '../store/useStore'

export default function ConfettiOverlay() {
  const confettiActive = useStore((s) => s.confettiActive)
  const dismissConfetti = useStore((s) => s.dismissConfetti)

  if (!confettiActive) return null

  return (
    <Confetti
      width={window.innerWidth}
      height={window.innerHeight}
      recycle={false}
      numberOfPieces={200}
      onConfettiComplete={dismissConfetti}
      colors={['#7C5CFC', '#6D4FF2', '#8D6CFF', '#A78BFA', '#C4B5FD']}
    />
  )
}
