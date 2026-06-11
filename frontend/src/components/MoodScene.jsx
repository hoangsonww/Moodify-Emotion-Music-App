import React, { useMemo, useRef, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Float,
  Icosahedron,
  MeshDistortMaterial,
  GradientTexture,
  Sparkles,
  Environment,
  Lightformer,
} from "@react-three/drei";
import * as THREE from "three";

/**
 * BackdropCanvas — the react-three-fiber half of the page background.
 *
 * Lazy-loaded (this whole module, three + drei included, sits in its own
 * chunk) and mounted ONLY on capable GPUs by PageBackground. Fully procedural:
 * geometry primitives, a canvas GradientTexture, and inline Lightformers for
 * reflections — no .glb / .hdr / image assets are ever loaded.
 *
 * Reacts to scroll (the shape field travels vertically as you scroll) and to
 * the cursor (parallax on the whole world + a light that chases the pointer).
 */

const CORAL = "#ff4d4d";
const TEAL = "#2bb3b1";
const VIOLET = "#7c5cff";

export const SCROLL_TRAVEL = 16; // world units the field travels over a full scroll

function MoodOrb({ detail, env }) {
  const ref = useRef();
  const shell = useRef();
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.12;
    if (shell.current) {
      shell.current.rotation.y -= delta * 0.22;
      shell.current.rotation.x += delta * 0.05;
    }
  });
  return (
    <Float speed={1.4} rotationIntensity={0.4} floatIntensity={0.7}>
      <Icosahedron ref={ref} args={[1.45, detail]}>
        <MeshDistortMaterial
          speed={1.8}
          distort={0.4}
          radius={1}
          roughness={0.18}
          metalness={env ? 0.55 : 0.35}
          envMapIntensity={env ? 1.4 : 0.6}
        >
          <GradientTexture
            attach="map"
            stops={[0, 0.45, 1]}
            colors={[CORAL, VIOLET, TEAL]}
            size={512}
          />
        </MeshDistortMaterial>
      </Icosahedron>
      <Icosahedron ref={shell} args={[1.85, 1]}>
        <meshBasicMaterial color={TEAL} wireframe transparent opacity={0.14} />
      </Icosahedron>
    </Float>
  );
}

// Vertically-spread low-poly shapes; different ones drift into view per section
// as the world group scrolls upward.
function ShapeField({ count }) {
  const shapes = useMemo(() => {
    const palette = [TEAL, CORAL, VIOLET];
    const geos = ["octa", "ico", "tetra"];
    const out = [];
    for (let i = 0; i < count; i += 1) {
      const y = 2 - (i / Math.max(count - 1, 1)) * (SCROLL_TRAVEL + 4);
      const side = i % 2 === 0 ? -1 : 1;
      const x = side * (2.4 + ((i * 1.7) % 3));
      const z = -1 - ((i * 1.3) % 4);
      out.push({
        pos: [x, y, z],
        scale: 0.3 + ((i * 0.13) % 0.45),
        color: palette[i % palette.length],
        geo: geos[i % geos.length],
        speed: 1 + (i % 5) * 0.2,
      });
    }
    return out;
  }, [count]);

  return (
    <>
      {shapes.map((s, i) => (
        <Float
          key={i}
          speed={s.speed}
          rotationIntensity={0.9}
          floatIntensity={1.1}
        >
          <mesh position={s.pos} scale={s.scale}>
            {s.geo === "octa" && <octahedronGeometry args={[1, 0]} />}
            {s.geo === "ico" && <icosahedronGeometry args={[1, 0]} />}
            {s.geo === "tetra" && <tetrahedronGeometry args={[1, 0]} />}
            <meshStandardMaterial
              color={s.color}
              roughness={0.3}
              metalness={0.5}
              envMapIntensity={0.8}
              flatShading
            />
          </mesh>
        </Float>
      ))}
    </>
  );
}

function CursorLight({ pointerRef }) {
  const light = useRef();
  useFrame((_, delta) => {
    if (!light.current) return;
    const p = pointerRef.current;
    light.current.position.x = THREE.MathUtils.damp(
      light.current.position.x,
      p.x * 6,
      5,
      delta,
    );
    light.current.position.y = THREE.MathUtils.damp(
      light.current.position.y,
      p.y * 4,
      5,
      delta,
    );
  });
  return (
    <pointLight
      ref={light}
      position={[0, 0, 5]}
      intensity={1.6}
      color={CORAL}
      distance={18}
    />
  );
}

function Backdrop({ isDarkMode, settings, scrollRef, pointerRef }) {
  const world = useRef();
  useFrame((_, delta) => {
    if (!world.current) return;
    const targetY = scrollRef.current * SCROLL_TRAVEL;
    world.current.position.y = THREE.MathUtils.damp(
      world.current.position.y,
      targetY,
      3,
      delta,
    );
    const p = pointerRef.current;
    world.current.rotation.y = THREE.MathUtils.damp(
      world.current.rotation.y,
      p.x * 0.35,
      4,
      delta,
    );
    world.current.rotation.x = THREE.MathUtils.damp(
      world.current.rotation.x,
      -p.y * 0.22,
      4,
      delta,
    );
    world.current.position.x = THREE.MathUtils.damp(
      world.current.position.x,
      p.x * 0.6,
      4,
      delta,
    );
  });

  return (
    <>
      <ambientLight intensity={isDarkMode ? 0.4 : 0.65} />
      <pointLight
        position={[6, 6, 6]}
        intensity={isDarkMode ? 1 : 1.3}
        color={CORAL}
      />
      <pointLight
        position={[-6, -4, 2]}
        intensity={isDarkMode ? 0.8 : 1}
        color={TEAL}
      />
      <CursorLight pointerRef={pointerRef} />

      <group ref={world}>
        <group position={[2.2, 0.4, 0]}>
          <MoodOrb detail={settings.detail} env={settings.env} />
        </group>
        <ShapeField count={settings.ambient} />
        <Sparkles
          count={settings.sparkles}
          scale={[14, SCROLL_TRAVEL + 10, 6]}
          position={[0, -SCROLL_TRAVEL / 2 + 2, 0]}
          size={settings.env ? 3 : 2.2}
          speed={0.3}
          opacity={isDarkMode ? 0.6 : 0.5}
          color={isDarkMode ? "#ffffff" : TEAL}
        />
      </group>

      {settings.env && (
        <Environment resolution={256} frames={1}>
          <color
            attach="background"
            args={[isDarkMode ? "#0b0d12" : "#fdfbfa"]}
          />
          <Lightformer
            intensity={2.4}
            position={[3, 2, 3]}
            scale={[6, 6, 1]}
            color={CORAL}
          />
          <Lightformer
            intensity={2}
            position={[-4, -1, 2]}
            scale={[6, 6, 1]}
            color={TEAL}
          />
          <Lightformer
            intensity={1.2}
            position={[0, 4, -3]}
            scale={[10, 3, 1]}
            color={VIOLET}
          />
        </Environment>
      )}
    </>
  );
}

const BackdropCanvas = ({
  isDarkMode,
  settings,
  scrollRef,
  pointerRef,
  onLost,
}) => (
  <Canvas
    dpr={settings.dpr}
    camera={{ position: [0, 0, 8], fov: 46 }}
    gl={{
      antialias: settings.env,
      alpha: true,
      powerPreference: "high-performance",
      failIfMajorPerformanceCaveat: false,
    }}
    onCreated={({ gl }) => {
      gl.domElement.addEventListener(
        "webglcontextlost",
        (e) => {
          e.preventDefault();
          if (onLost) onLost();
        },
        { once: true },
      );
    }}
    style={{ width: "100%", height: "100%", pointerEvents: "none" }}
  >
    <Suspense fallback={null}>
      <Backdrop
        isDarkMode={isDarkMode}
        settings={settings}
        scrollRef={scrollRef}
        pointerRef={pointerRef}
      />
    </Suspense>
  </Canvas>
);

export default BackdropCanvas;
