import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  Suspense,
  lazy,
} from "react";
import { createPortal } from "react-dom";
import "../styles/aurora.css";

// The 3D canvas (three + drei) lives in its own lazy chunk and is only ever
// imported on capable GPUs — weak devices never download it.
const BackdropCanvas = lazy(() => import("./MoodScene"));

// Keeps the page alive if the 3D chunk fails to load or WebGL throws: the CSS
// aurora underneath always remains.
class CanvasBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {}
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function detectTier() {
  if (typeof window === "undefined") return "none";

  const reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let gl = null;
  try {
    const c = document.createElement("canvas");
    gl =
      c.getContext("webgl2") ||
      c.getContext("webgl") ||
      c.getContext("experimental-webgl");
  } catch (e) {
    gl = null;
  }
  if (!gl) return "none";

  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  const w = window.innerWidth;
  const mobile =
    /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "") || w < 700;

  // Reduced-motion or low-power hardware: CSS aurora only, no WebGL.
  if (reduce || mem <= 2 || cores <= 2) return "none";
  if (mobile || cores <= 4 || w < 1024) return "mid";
  return "high";
}

function tierSettings(tier) {
  if (tier === "high") {
    return { detail: 6, ambient: 9, sparkles: 90, dpr: [1, 1.7], env: true };
  }
  return { detail: 3, ambient: 6, sparkles: 40, dpr: [1, 1.25], env: false };
}

const PageBackground = ({ isDarkMode = false }) => {
  const tier = useMemo(detectTier, []);
  const [lost, setLost] = useState(false);
  const scrollRef = useRef(0);
  const pointerRef = useRef({ x: 0, y: 0 });
  const auroraRef = useRef(null);

  // One scroll listener feeds both layers; one pointer listener drives the 3D
  // (the canvas is pointer-events:none, so we read the window directly).
  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const onScroll = () => {
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      const p = max > 0 ? Math.min(Math.max(el.scrollTop / max, 0), 1) : 0;
      scrollRef.current = p;
      if (auroraRef.current) {
        auroraRef.current.style.setProperty("--sy", p.toFixed(4));
      }
    };
    const onPointer = (e) => {
      pointerRef.current = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: -((e.clientY / window.innerHeight) * 2 - 1),
      };
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    window.addEventListener("pointermove", onPointer, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("pointermove", onPointer);
    };
  }, []);

  const settings = useMemo(() => tierSettings(tier), [tier]);
  const showCanvas = (tier === "mid" || tier === "high") && !lost;

  // Portal the fixed layers straight to <body> so they live outside the page's
  // route-transition wrapper — a transform on that wrapper must not drag or
  // clip the fixed background.
  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <div
        ref={auroraRef}
        className="moodify-aurora"
        data-theme={isDarkMode ? "dark" : "light"}
        aria-hidden="true"
      />
      {showCanvas && (
        <div className="moodify-canvas-layer" aria-hidden="true">
          <CanvasBoundary>
            <Suspense fallback={null}>
              <BackdropCanvas
                isDarkMode={isDarkMode}
                settings={settings}
                scrollRef={scrollRef}
                pointerRef={pointerRef}
                onLost={() => setLost(true)}
              />
            </Suspense>
          </CanvasBoundary>
        </div>
      )}
    </>,
    document.body,
  );
};

export default PageBackground;
