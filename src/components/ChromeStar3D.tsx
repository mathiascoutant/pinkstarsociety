import { Canvas, useFrame } from "@react-three/fiber";
import {
  Environment,
  MeshTransmissionMaterial,
  Float,
  Sparkles,
} from "@react-three/drei";
import { useMemo, useRef, Suspense } from "react";
import * as THREE from "three";

function useStarGeometry() {
  return useMemo(() => {
    const shape = new THREE.Shape();
    const outer = 1;
    const inner = 0.42;
    const points = 5;
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.34,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.06,
      bevelSegments: 6,
      curveSegments: 24,
    });
    geo.center();
    return geo;
  }, []);
}

function Star() {
  const geo = useStarGeometry();
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    ref.current.rotation.y = t * 0.4;
    ref.current.rotation.x = Math.sin(t * 0.5) * 0.2;
  });

  return (
    <Float speed={1.2} rotationIntensity={0.3} floatIntensity={0.9}>
      <mesh ref={ref} geometry={geo} scale={1.45}>
        <MeshTransmissionMaterial
          color="#ff7ad1"
          thickness={0.6}
          chromaticAberration={0.25}
          transmission={0.3}
          roughness={0.08}
          metalness={0.85}
          ior={1.5}
          clearcoat={1}
          clearcoatRoughness={0.05}
          backside
          backsideThickness={0.4}
          distortion={0.2}
          distortionScale={0.3}
          temporalDistortion={0.04}
        />
      </mesh>
    </Float>
  );
}

function ChromeRing() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (!ref.current) return;
    const t = s.clock.getElapsedTime();
    ref.current.rotation.x = Math.PI / 2.4 + Math.sin(t * 0.5) * 0.2;
    ref.current.rotation.y = t * 0.2;
  });
  return (
    <mesh ref={ref} scale={2.2}>
      <torusGeometry args={[1, 0.018, 24, 220]} />
      <meshStandardMaterial
        color="#ffffff"
        metalness={1}
        roughness={0.05}
        envMapIntensity={1.6}
      />
    </mesh>
  );
}

export default function ChromeStar3D() {
  return (
    <Canvas
      dpr={[1, 1.8]}
      camera={{ position: [0, 0, 4.6], fov: 35 }}
      gl={{ antialias: true, alpha: true }}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[3, 4, 4]} intensity={1.2} color="#ffd4ee" />
        <directionalLight position={[-4, -2, 2]} intensity={0.9} color="#ff007a" />
        <pointLight position={[0, 0, 3]} intensity={1.5} color="#ffffff" />
        <Star />
        <ChromeRing />
        <Sparkles
          count={70}
          size={3}
          speed={0.3}
          opacity={0.9}
          color="#ff7ad1"
          scale={[6, 4, 4]}
        />
        <Environment preset="studio" />
      </Suspense>
    </Canvas>
  );
}
