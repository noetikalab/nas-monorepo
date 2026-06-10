"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Edges, Float, Line, Sparkles } from "@react-three/drei";
import * as THREE from "three";

type P3 = [number, number, number];

const DEVICES: { pos: P3; col: string; type: "phone" | "tablet" | "laptop" | "pc" | "web"; speed: number }[] = [
  { pos: [3.8, 0.3, 2.0], col: "#00d4ff", type: "phone", speed: 1.2 },
  { pos: [4.2, 1.8, -1.5], col: "#b388ff", type: "tablet", speed: 1.5 },
  { pos: [-3.8, 0.3, 2.0], col: "#00ff41", type: "laptop", speed: 1.0 },
  { pos: [-4.2, 1.8, -1.5], col: "#ffa940", type: "pc", speed: 1.0 },
  { pos: [0, 4.0, -2.5], col: "#ff6b9d", type: "web", speed: 0.8 },
];

const NAS_CENTER = new THREE.Vector3(0, 1, 0);

/* ========== DATA PARTICLE ========== */
function DataParticle({ start, end, color, speed, offset }: { start: THREE.Vector3; end: THREE.Vector3; color: string; speed: number; offset: number }) {
  const ref = useRef<THREE.Mesh>(null!);
  const prog = useRef(offset);
  useFrame((_, d) => {
    prog.current = (prog.current + d * speed * 0.5) % 1;
    if (ref.current) {
      ref.current.position.lerpVectors(start, end, prog.current);
      (ref.current.material as THREE.MeshBasicMaterial).opacity = 0.3 + 0.7 * Math.sin(prog.current * Math.PI);
    }
  });
  return (
    <mesh ref={ref}><sphereGeometry args={[0.08, 12, 12]} /><meshBasicMaterial color={color} transparent opacity={0.8} /></mesh>
  );
}

/* ========== CONNECTIONS ========== */
function ConnectionLines() {
  const conns = useMemo(() => DEVICES.map(d => ({ end: new THREE.Vector3(...d.pos), color: d.col, speed: d.speed })), []);
  return (
    <group>
      {conns.map((c, i) => (
        <group key={i}>
          <Line points={[NAS_CENTER, c.end]} color={c.color} lineWidth={1} transparent opacity={0.35} />
          <DataParticle start={NAS_CENTER} end={c.end} color={c.color} speed={c.speed} offset={0} />
          <DataParticle start={NAS_CENTER} end={c.end} color={c.color} speed={c.speed} offset={0.3} />
          <DataParticle start={NAS_CENTER} end={c.end} color={c.color} speed={c.speed} offset={0.6} />
        </group>
      ))}
    </group>
  );
}

/* ========== GRID FLOOR ========== */
function GridFloor() {
  const lines = useMemo(() => {
    const r: THREE.Vector3[][] = [];
    for (let i = 0; i <= 20; i++) {
      const p = -10 + i;
      r.push([new THREE.Vector3(p, -2.5, -10), new THREE.Vector3(p, -2.5, 10)]);
      r.push([new THREE.Vector3(-10, -2.5, p), new THREE.Vector3(10, -2.5, p)]);
    }
    return r;
  }, []);
  return <group>{lines.map((pts, i) => <Line key={i} points={pts} color="#1a2a3a" lineWidth={0.5} transparent opacity={0.2} />)}</group>;
}

/* ========== PROTOCOL BADGES ========== */
function ProtocolBadges() {
  return (
    <group>
      {DEVICES.map((d, i) => (
        <group key={i} position={[d.pos[0], d.pos[1] - 1.3, d.pos[2]]}>
          <mesh position={[0, 0, -0.01]}><planeGeometry args={[1.6, 0.28]} /><meshBasicMaterial color="#050a0f" transparent opacity={0.5} /></mesh>
          <mesh position={[0, 0, 0]}><planeGeometry args={[1.5, 0.012]} /><meshBasicMaterial color={d.col} transparent opacity={0.35} /></mesh>
        </group>
      ))}
    </group>
  );
}

/* ========== NAS DEVICE ========== */
function NasDevice() {
  const g = useRef<THREE.Group>(null!);
  useFrame((_, d) => { g.current.rotation.y += d * 0.25; });
  return (
    <Float speed={1} floatIntensity={0.3}>
      <group ref={g}>
        {/* body */}
        <mesh><boxGeometry args={[2.4, 1.6, 2.0]} /><meshStandardMaterial color="#0d1420" metalness={0.85} roughness={0.2} /><Edges color="#00ff41" threshold={15} scale={1.01} /></mesh>
        {/* ventilation grille */}
        {Array.from({ length: 4 }, (_, i) => <mesh key={`v${i}`} position={[-0.6 + i * 0.4, 0.82, 0]}><boxGeometry args={[0.25, 0.02, 1.5]} /><meshStandardMaterial color="#1a2a3a" metalness={0.9} roughness={0.1} /></mesh>)}
        {/* drive bays */}
        {Array.from({ length: 4 }, (_, i) => <mesh key={`b${i}`} position={[-0.75 + i * 0.5, -0.15, 1.006]}><boxGeometry args={[0.3, 0.1, 0.008]} /><meshStandardMaterial color="#00ff41" emissive="#00ff41" emissiveIntensity={0.25 + i * 0.1} /></mesh>)}
        {/* USB port */}
        <mesh position={[0.65, -0.55, 1.006]}><boxGeometry args={[0.1, 0.05, 0.01]} /><meshStandardMaterial color="#1a1f2e" metalness={0.5} roughness={0.4} /></mesh>
        {/* power button */}
        <mesh position={[0.95, 0.55, 1.01]}><circleGeometry args={[0.05, 16]} /><meshStandardMaterial color="#00ff41" emissive="#00ff41" emissiveIntensity={0.6} /></mesh>
        {/* status LEDs */}
        <mesh position={[0.85, 0.35, 1.01]}><circleGeometry args={[0.02, 16]} /><meshStandardMaterial color="#00d4ff" emissive="#00d4ff" emissiveIntensity={1} /></mesh>
        <mesh position={[0.78, 0.35, 1.01]}><circleGeometry args={[0.02, 16]} /><meshStandardMaterial color="#00ff41" emissive="#00ff41" emissiveIntensity={0.5} /></mesh>
      </group>
    </Float>
  );
}

/* ========== PHONE ========== */
function PhoneDevice({ position, color }: { position: P3; color: string }) {
  return (
    <Float speed={2} floatIntensity={0.2} rotationIntensity={0.1}>
      <group position={position}>
        <mesh><boxGeometry args={[0.7, 1.4, 0.1]} /><meshStandardMaterial color="#151a25" metalness={0.6} roughness={0.4} /></mesh>
        <mesh scale={[1.04, 1.02, 0.85]}><boxGeometry args={[0.7, 1.4, 0.1]} /><meshStandardMaterial color="#2a3040" metalness={0.95} roughness={0.15} /></mesh>
        <mesh position={[0, 0.05, 0.051]}><planeGeometry args={[0.55, 1.1]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} metalness={0.9} roughness={0.05} transparent opacity={0.5} /></mesh>
        <mesh position={[0, 0.58, 0.055]}><boxGeometry args={[0.15, 0.02, 0.008]} /><meshStandardMaterial color="#0a0a0a" /></mesh>
        <mesh position={[0.15, 0.6, 0.055]}><circleGeometry args={[0.02, 16]} /><meshStandardMaterial color="#111" metalness={0.9} roughness={0.1} /></mesh>
        <mesh position={[0.36, 0.4, 0]}><boxGeometry args={[0.015, 0.06, 0.015]} /><meshStandardMaterial color="#2a3040" metalness={0.85} roughness={0.2} /></mesh>
        <mesh position={[0.36, 0.2, 0]}><boxGeometry args={[0.015, 0.06, 0.015]} /><meshStandardMaterial color="#2a3040" metalness={0.85} roughness={0.2} /></mesh>
        <mesh position={[0, -0.62, 0.055]}><boxGeometry args={[0.15, 0.012, 0.008]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} /></mesh>
      </group>
    </Float>
  );
}

/* ========== TABLET ========== */
function TabletDevice({ position, color }: { position: P3; color: string }) {
  return (
    <Float speed={1.8} floatIntensity={0.15} rotationIntensity={0.08}>
      <group position={position}>
        <mesh><boxGeometry args={[1.3, 1.7, 0.08]} /><meshStandardMaterial color="#151a25" metalness={0.6} roughness={0.4} /></mesh>
        <mesh scale={[1.03, 1.015, 0.8]}><boxGeometry args={[1.3, 1.7, 0.08]} /><meshStandardMaterial color="#2a3040" metalness={0.95} roughness={0.15} /></mesh>
        <mesh position={[0, 0.05, 0.041]}><planeGeometry args={[1.15, 1.4]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} metalness={0.9} roughness={0.05} transparent opacity={0.45} /></mesh>
        <mesh position={[0.4, 0.72, 0.045]}><circleGeometry args={[0.025, 16]} /><meshStandardMaterial color="#111" metalness={0.9} roughness={0.1} /></mesh>
        <mesh position={[0.66, 0.5, 0]}><boxGeometry args={[0.012, 0.05, 0.012]} /><meshStandardMaterial color="#2a3040" metalness={0.85} roughness={0.2} /></mesh>
        <mesh position={[0.66, 0.25, 0]}><boxGeometry args={[0.012, 0.05, 0.012]} /><meshStandardMaterial color="#2a3040" metalness={0.85} roughness={0.2} /></mesh>
      </group>
    </Float>
  );
}

/* ========== LAPTOP ========== */
function LaptopDevice({ position, color }: { position: P3; color: string }) {
  return (
    <Float speed={1.5} floatIntensity={0.15} rotationIntensity={0.05}>
      <group position={position}>
        <mesh><boxGeometry args={[1.8, 0.07, 1.2]} /><meshStandardMaterial color="#252a35" metalness={0.75} roughness={0.25} /></mesh>
        <mesh position={[0, 0.04, -0.05]}><boxGeometry args={[1.5, 0.008, 0.7]} /><meshStandardMaterial color="#1a1f2a" metalness={0.95} roughness={0.05} /></mesh>
        <mesh position={[0, 0.04, 0.35]}><boxGeometry args={[0.45, 0.01, 0.25]} /><meshStandardMaterial color="#2a303a" metalness={0.85} roughness={0.15} /></mesh>
        <group position={[0, 0.035, -0.55]} rotation={[-0.3, 0, 0]}>
          <mesh><boxGeometry args={[1.8, 1.1, 0.05]} /><meshStandardMaterial color="#1a1f2e" metalness={0.6} roughness={0.4} /></mesh>
          <mesh position={[0, 0, 0.026]}><planeGeometry args={[1.65, 0.95]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} metalness={0.9} roughness={0.05} transparent opacity={0.4} /></mesh>
          <mesh position={[0, 0.48, 0.03]}><circleGeometry args={[0.018, 16]} /><meshStandardMaterial color="#0a0f1a" /></mesh>
        </group>
      </group>
    </Float>
  );
}

/* ========== MONITOR ========== */
function MonitorDevice({ position, color }: { position: P3; color: string }) {
  return (
    <Float speed={1.5} floatIntensity={0.15} rotationIntensity={0.05}>
      <group position={position}>
        <mesh><boxGeometry args={[1.8, 1.15, 0.08]} /><meshStandardMaterial color="#151a25" metalness={0.6} roughness={0.4} /></mesh>
        <mesh position={[0, 0, 0.041]}><planeGeometry args={[1.65, 0.95]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} metalness={0.9} roughness={0.05} transparent opacity={0.45} /></mesh>
        <mesh position={[0, -0.7, -0.05]}><boxGeometry args={[0.08, 0.3, 0.08]} /><meshStandardMaterial color="#252a35" metalness={0.85} roughness={0.2} /></mesh>
        <mesh position={[0, -0.85, 0]}><boxGeometry args={[0.5, 0.03, 0.35]} /><meshStandardMaterial color="#252a35" metalness={0.85} roughness={0.2} /></mesh>
        <mesh position={[0.8, -0.48, 0.045]}><circleGeometry args={[0.012, 16]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} /></mesh>
        {/* bottom bezel brand bar */}
        <mesh position={[0, -0.5, 0.045]}><boxGeometry args={[1.1, 0.03, 0.01]} /><meshStandardMaterial color="#2a3040" metalness={0.9} roughness={0.1} /></mesh>
      </group>
    </Float>
  );
}

/* ========== WEB GLOBE ========== */
function WebGlobe({ position, color }: { position: P3; color: string }) {
  const g = useRef<THREE.Group>(null!);
  const nodes = useMemo(() => Array.from({ length: 30 }, () => {
    const phi = Math.acos(2 * Math.random() - 1);
    const theta = 2 * Math.PI * Math.random();
    return new THREE.Vector3(0.78 * Math.sin(phi) * Math.cos(theta), 0.78 * Math.sin(phi) * Math.sin(theta), 0.78 * Math.cos(phi));
  }), []);
  useFrame((_, d) => { if (g.current) { g.current.rotation.y += d * 0.15; g.current.rotation.z += d * 0.04; } });
  return (
    <Float speed={1.2} floatIntensity={0.2} rotationIntensity={0.1}>
      <group position={position} ref={g}>
        <mesh><sphereGeometry args={[0.75, 32, 32]} /><meshStandardMaterial color={color} metalness={0.9} roughness={0.1} transparent opacity={0.85} /></mesh>
        <mesh><sphereGeometry args={[0.77, 12, 12]} /><meshBasicMaterial color={color} wireframe transparent opacity={0.3} /></mesh>
        {nodes.map((p, i) => <mesh key={i} position={p}><sphereGeometry args={[0.025, 8, 8]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={1} /></mesh>)}
        <mesh rotation={[Math.PI / 3, 0, 0]}><torusGeometry args={[0.95, 0.012, 8, 48]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} transparent opacity={0.7} /></mesh>
        <mesh rotation={[-Math.PI / 4, Math.PI / 6, 0]}><torusGeometry args={[0.88, 0.01, 8, 48]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} transparent opacity={0.4} /></mesh>
        <mesh rotation={[0, -Math.PI / 5, Math.PI / 8]}><torusGeometry args={[1.02, 0.008, 8, 48]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} transparent opacity={0.5} /></mesh>
      </group>
    </Float>
  );
}

/* ========== MAIN ========== */
export default function NasHero() {
  return (
    <div className="h-full w-full opacity-90">
      <Canvas camera={{ position: [0, 2.5, 11], fov: 60 }} gl={{ antialias: true, alpha: true }} style={{ background: "transparent" }}>
        <ambientLight intensity={0.35} />
        <pointLight position={[8, 8, 8]} intensity={1.5} color="#00d4ff" />
        <pointLight position={[-8, -4, -4]} intensity={0.8} color="#00ff41" />
        <pointLight position={[0, 3, -6]} intensity={0.6} color="#b388ff" />

        <GridFloor />
        <ConnectionLines />
        <NasDevice />
        <ProtocolBadges />

        {DEVICES.map(d => {
          if (d.type === "phone") return <PhoneDevice key={d.type} position={d.pos} color={d.col} />;
          if (d.type === "tablet") return <TabletDevice key={d.type} position={d.pos} color={d.col} />;
          if (d.type === "laptop") return <LaptopDevice key={d.type} position={d.pos} color={d.col} />;
          if (d.type === "pc") return <MonitorDevice key={d.type} position={d.pos} color={d.col} />;
          if (d.type === "web") return <WebGlobe key={d.type} position={d.pos} color={d.col} />;
        })}

        <Sparkles count={30} scale={12} size={2} speed={0.3} opacity={0.15} color="#00d4ff" position={[0, 1, 0]} />
      </Canvas>
    </div>
  );
}
