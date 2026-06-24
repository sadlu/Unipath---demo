import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'

function WireframeTorus() {
  const ref = useRef<any>(null)
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.1) * 0.2
      ref.current.rotation.y += 0.003
      ref.current.rotation.z = Math.cos(clock.getElapsedTime() * 0.08) * 0.1
    }
  })
  return (
    <mesh ref={ref} position={[0, 0, -5]}>
      <torusKnotGeometry args={[2, 0.6, 64, 8]} />
      <meshBasicMaterial color="#7C5CFC" wireframe transparent opacity={0.12} />
    </mesh>
  )
}

function Particles() {
  const count = 300
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count * 3; i++) positions[i] = (Math.random() - 0.5) * 50
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.03} color="#7C5CFC" transparent opacity={0.3} />
    </points>
  )
}

export default function CosmicBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0" style={{ opacity: 0.5 }}>
      <Canvas camera={{ position: [0, 0, 8], fov: 60 }} dpr={[1, 1.5]} gl={{ alpha: true }}>
        <Particles />
        <WireframeTorus />
      </Canvas>
    </div>
  )
}
