import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Octahedron } from '@react-three/drei'

function Crystal() {
  const ref = useRef<any>(null)
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.2) * 0.3
      ref.current.rotation.y += 0.005
      ref.current.position.y = Math.sin(clock.getElapsedTime() * 0.5) * 0.15
    }
  })
  return (
    <Octahedron ref={ref} args={[1, 0]} position={[0, 0, 0]}>
      <meshPhysicalMaterial
        color="#7C5CFC"
        wireframe
        transparent
        opacity={0.6}
        emissive="#7C5CFC"
        emissiveIntensity={0.2}
        metalness={0.8}
        roughness={0.2}
      />
    </Octahedron>
  )
}

export default function FloatingCrystal({ size = 60 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size }} className="shrink-0">
      <Canvas camera={{ position: [0, 0, 3], fov: 45 }} dpr={[1, 1.5]} gl={{ alpha: true }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={0.8} color="#7C5CFC" />
        <Crystal />
      </Canvas>
    </div>
  )
}
