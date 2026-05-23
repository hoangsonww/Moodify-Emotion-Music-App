import React, { useEffect, useRef } from "react";
import {
  Box,
  Button,
  Chip,
  Container,
  Grid,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import MicIcon from "@mui/icons-material/Mic";
import FaceRetouchingNaturalIcon from "@mui/icons-material/FaceRetouchingNatural";
import KeyboardIcon from "@mui/icons-material/Keyboard";
import HeadphonesIcon from "@mui/icons-material/Headphones";
import BoltIcon from "@mui/icons-material/Bolt";
import GraphicEqIcon from "@mui/icons-material/GraphicEq";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import PsychologyIcon from "@mui/icons-material/Psychology";
import TuneIcon from "@mui/icons-material/Tune";
import VerifiedIcon from "@mui/icons-material/Verified";

import { gradients, shadows, tokens } from "../theme";

const MODES = [
  {
    icon: KeyboardIcon,
    title: "Text",
    description: "Type a sentence about how you feel and we'll read the mood.",
    accent: "#8b5cf6",
    accentSoft: "rgba(139, 92, 246, 0.18)",
  },
  {
    icon: MicIcon,
    title: "Voice",
    description: "Speak a few seconds — tone, pace and energy all read.",
    accent: "#22d3ee",
    accentSoft: "rgba(34, 211, 238, 0.18)",
  },
  {
    icon: FaceRetouchingNaturalIcon,
    title: "Face",
    description: "Snap a selfie — your expression tells us the rest.",
    accent: "#ec4899",
    accentSoft: "rgba(236, 72, 153, 0.18)",
  },
];

const FEATURES = [
  {
    icon: PsychologyIcon,
    title: "Real ML, not just keywords",
    body:
      "A fine-tuned BERT classifier reads text; speech and facial models pick up tone and expression.",
  },
  {
    icon: BoltIcon,
    title: "Sub-second recommendations",
    body:
      "Mood detection and tracks return in under a second, with the model warm on a serverless GPU.",
  },
  {
    icon: TuneIcon,
    title: "Personalised over time",
    body:
      "A lightweight EWMA + Markov model blends your recurring moods into every new recommendation.",
  },
  {
    icon: HeadphonesIcon,
    title: "Free Deezer previews",
    body:
      "Every track comes with a 30-second preview and album art — no streaming subscription needed.",
  },
  {
    icon: GraphicEqIcon,
    title: "All three modalities",
    body:
      "Text, voice, and face — pick whichever fits the moment. They all use the same recommender.",
  },
  {
    icon: VerifiedIcon,
    title: "Yours, securely",
    body:
      "JWT auth, hashed passwords, MongoDB Atlas. Your mood history is private and easy to wipe.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Share a moment",
    body: "Type, talk, or smile — three taps, no calibration.",
  },
  {
    n: "02",
    title: "We read the mood",
    body: "Our ensemble of small models infers the emotion in under a second.",
  },
  {
    n: "03",
    title: "Listen",
    body: "Mood-matched tracks with previews, ranked and personalised to you.",
  },
];

const MOODS = ["Joy", "Calm", "Focus", "Sad", "Energetic", "Nostalgic", "Love"];

export default function LandingPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isLight = theme.palette.mode === "light";

  // Lightweight scroll-reveal -- no extra dep.
  const sectionsRef = useRef([]);
  useEffect(() => {
    const els = sectionsRef.current.filter(Boolean);
    if (!els.length) return;
    if (typeof IntersectionObserver === "undefined") {
      els.forEach((el) => (el.style.opacity = 1));
      return;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.style.opacity = 1;
            e.target.style.transform = "translateY(0)";
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  const addSection = (el, i) => {
    if (el) {
      sectionsRef.current[i] = el;
      el.style.opacity = 0;
      el.style.transform = "translateY(28px)";
      el.style.transition = "opacity .8s ease, transform .8s ease";
    }
  };

  return (
    <Box
      sx={{
        position: "relative",
        overflow: "hidden",
        bgcolor: "background.default",
        backgroundImage: gradients.aurora,
      }}
    >
      {/* ---------------- HERO ---------------- */}
      <Box sx={{ position: "relative", pt: { xs: 10, md: 16 }, pb: { xs: 10, md: 14 } }}>
        {/* Floating orbs */}
        <Orb
          size={420}
          color="#a855f7"
          style={{ top: -120, left: -120, opacity: 0.35 }}
        />
        <Orb
          size={360}
          color="#ec4899"
          style={{ top: 80, right: -100, opacity: 0.28 }}
        />
        <Orb
          size={520}
          color="#6366f1"
          style={{ bottom: -240, left: "30%", opacity: 0.22 }}
        />

        {/* Top brand strip */}
        <Container maxWidth="lg" sx={{ position: "relative", zIndex: 2 }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ mb: { xs: 6, md: 10 } }}
          >
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: "14px",
                  background: gradients.primary,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: shadows.glow,
                }}
              >
                <MusicNoteIcon sx={{ color: "#fff" }} />
              </Box>
              <Typography
                sx={{
                  fontWeight: 900,
                  fontSize: 24,
                  background: gradients.primary,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Moodify
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1.5} sx={{ display: { xs: "none", md: "flex" } }}>
              <Button
                onClick={() => navigate("/login")}
                sx={{ color: "text.primary", fontWeight: 700, borderRadius: 999, px: 2.5 }}
              >
                Sign in
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={() => navigate("/register")}
                endIcon={<ArrowForwardIcon />}
              >
                Create account
              </Button>
            </Stack>
          </Stack>

          {/* Hero content */}
          <Box sx={{ textAlign: "center", maxWidth: 900, mx: "auto", position: "relative" }}>
            <Chip
              icon={<AutoAwesomeIcon sx={{ fontSize: 16 }} />}
              label="Emotion-aware soundtracks"
              sx={{
                mb: 3,
                px: 1.2,
                background: gradients.primarySoft,
                border: `1px solid ${tokens.primarySoft}`,
                color: "primary.main",
                fontWeight: 700,
                "& .MuiChip-icon": { color: "primary.main" },
              }}
            />
            <Typography
              variant="h3"
              sx={{
                fontWeight: 900,
                fontSize: { xs: 44, sm: 60, md: 84 },
                lineHeight: 1.02,
                letterSpacing: "-0.04em",
                mb: 2.5,
              }}
            >
              Welcome to{" "}
              <Box
                component="span"
                sx={{
                  background: gradients.primary,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  display: "inline-block",
                }}
              >
                Moodify
              </Box>
            </Typography>
            <Typography
              sx={{
                color: "text.secondary",
                fontSize: { xs: 17, md: 21 },
                lineHeight: 1.55,
                mb: 5,
                maxWidth: 720,
                mx: "auto",
              }}
            >
              The AI-powered emotion-based music recommendation app that tunes
              every playlist to how you actually feel. Detect your mood from
              text, voice, or face — get a Deezer set you'll want on repeat.
            </Typography>

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              justifyContent="center"
              sx={{ mb: 6 }}
            >
              <Button
                size="large"
                variant="contained"
                color="primary"
                onClick={() => navigate("/register")}
                endIcon={<ArrowForwardIcon />}
                sx={{ px: 4, py: 1.5, fontSize: 16, borderRadius: 999 }}
              >
                Get Started
              </Button>
              <Button
                size="large"
                variant="outlined"
                onClick={() => navigate("/login")}
                sx={{
                  px: 4,
                  py: 1.5,
                  fontSize: 16,
                  borderRadius: 999,
                  borderColor: tokens.border,
                  color: "text.primary",
                  "&:hover": {
                    borderColor: "primary.main",
                    background: tokens.primarySoft,
                  },
                }}
              >
                Log In
              </Button>
            </Stack>

            {/* Mood pills */}
            <Stack
              direction="row"
              spacing={1.25}
              justifyContent="center"
              flexWrap="wrap"
              useFlexGap
              sx={{ mb: 1 }}
            >
              {MOODS.map((m, i) => (
                <Chip
                  key={m}
                  label={m}
                  sx={{
                    px: 0.5,
                    background: isLight ? "#fff" : tokens.surface,
                    border: `1px solid ${tokens.border}`,
                    color: "text.primary",
                    fontWeight: 700,
                    transition: "all .25s",
                    "&:hover": {
                      transform: "translateY(-2px)",
                      borderColor: "primary.main",
                      color: "primary.main",
                      boxShadow: shadows.md,
                    },
                    animation: `float 6s ease-in-out ${i * 0.4}s infinite`,
                    "@keyframes float": {
                      "0%, 100%": { transform: "translateY(0)" },
                      "50%": { transform: "translateY(-4px)" },
                    },
                  }}
                />
              ))}
            </Stack>
          </Box>
        </Container>
      </Box>

      {/* ---------------- MODES ---------------- */}
      <Container maxWidth="lg" sx={{ position: "relative", py: { xs: 8, md: 12 } }} ref={(el) => addSection(el, 0)}>
        <SectionHead
          eyebrow="Three ways to share a mood"
          title="Pick whichever fits the moment"
          sub="Text, voice or face — same recommender, same instant Deezer results."
        />
        <Grid container spacing={3} sx={{ mt: 4 }}>
          {MODES.map((m) => (
            <Grid item xs={12} md={4} key={m.title}>
              <ModeCard mode={m} />
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* ---------------- HOW IT WORKS ---------------- */}
      <Container maxWidth="lg" sx={{ position: "relative", py: { xs: 8, md: 12 } }} ref={(el) => addSection(el, 1)}>
        <SectionHead
          eyebrow="How it works"
          title="From mood to music in three steps"
          sub="No setup. No calibration. Sign in once, and every detection makes the next one better."
        />
        <Grid container spacing={3} sx={{ mt: 4 }}>
          {STEPS.map((s, i) => (
            <Grid item xs={12} md={4} key={s.n}>
              <StepCard step={s} isLast={i === STEPS.length - 1} />
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* ---------------- FEATURES ---------------- */}
      <Container maxWidth="lg" sx={{ position: "relative", py: { xs: 8, md: 12 } }} ref={(el) => addSection(el, 2)}>
        <SectionHead
          eyebrow="What's inside"
          title="Features"
          sub="Built around a small, fast ML stack and the music APIs that actually still work."
        />
        <Grid container spacing={3} sx={{ mt: 4 }}>
          {FEATURES.map((f) => (
            <Grid item xs={12} sm={6} md={4} key={f.title}>
              <FeatureCard feature={f} />
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* ---------------- FINAL CTA ---------------- */}
      <Container maxWidth="md" sx={{ position: "relative", py: { xs: 10, md: 14 } }} ref={(el) => addSection(el, 3)}>
        <Box
          sx={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 6,
            p: { xs: 5, md: 8 },
            background: gradients.primary,
            boxShadow: shadows.glow,
            textAlign: "center",
            color: "#fff",
          }}
        >
          {/* sheen overlay */}
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(60% 60% at 50% 0%, rgba(255,255,255,0.25) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
          />
          <Typography
            variant="h3"
            sx={{
              fontWeight: 900,
              fontSize: { xs: 32, md: 48 },
              mb: 2,
              letterSpacing: "-0.02em",
            }}
          >
            Ready to feel your music?
          </Typography>
          <Typography sx={{ fontSize: { xs: 16, md: 18 }, opacity: 0.9, mb: 4 }}>
            Create a free account in 10 seconds. No card, no install.
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="center">
            <Button
              size="large"
              onClick={() => navigate("/register")}
              endIcon={<ArrowForwardIcon />}
              sx={{
                background: "#fff",
                color: "primary.main",
                fontWeight: 800,
                borderRadius: 999,
                px: 4,
                py: 1.5,
                fontSize: 16,
                "&:hover": { background: "#f3f3ff", transform: "translateY(-2px)" },
                transition: "all .25s",
              }}
            >
              Sign me up
            </Button>
            <Button
              size="large"
              onClick={() => navigate("/login")}
              sx={{
                color: "#fff",
                fontWeight: 700,
                borderRadius: 999,
                px: 4,
                py: 1.5,
                fontSize: 16,
                border: "1.5px solid rgba(255,255,255,0.5)",
                "&:hover": { background: "rgba(255,255,255,0.1)", borderColor: "#fff" },
              }}
            >
              I have an account
            </Button>
          </Stack>
        </Box>
      </Container>
    </Box>
  );
}

// ---------- helpers ----------

function Orb({ size = 320, color = "#a855f7", style = {} }) {
  return (
    <Box
      aria-hidden
      sx={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        filter: "blur(40px)",
        pointerEvents: "none",
        ...style,
      }}
    />
  );
}

function SectionHead({ eyebrow, title, sub }) {
  return (
    <Box sx={{ textAlign: "center", maxWidth: 720, mx: "auto" }}>
      <Typography
        variant="overline"
        sx={{
          color: "primary.main",
          fontWeight: 800,
          letterSpacing: "0.2em",
          fontSize: 12,
        }}
      >
        {eyebrow}
      </Typography>
      <Typography
        variant="h4"
        sx={{
          fontWeight: 900,
          fontSize: { xs: 30, md: 42 },
          letterSpacing: "-0.02em",
          mt: 1,
          mb: 1.5,
        }}
      >
        {title}
      </Typography>
      <Typography sx={{ color: "text.secondary", fontSize: { xs: 15, md: 17 } }}>
        {sub}
      </Typography>
    </Box>
  );
}

function ModeCard({ mode }) {
  const Icon = mode.icon;
  return (
    <Box
      sx={{
        position: "relative",
        p: 4,
        borderRadius: 4,
        height: "100%",
        background: "background.paper",
        border: `1px solid ${tokens.border}`,
        overflow: "hidden",
        transition: "transform .35s cubic-bezier(.34,1.56,.64,1), box-shadow .35s",
        cursor: "default",
        "&:hover": {
          transform: "translateY(-6px)",
          boxShadow: `0 24px 60px ${mode.accentSoft}`,
          borderColor: mode.accent,
        },
        "&:hover .mode-icon-bg": {
          transform: "scale(1.15) rotate(-6deg)",
        },
      }}
    >
      {/* corner glow */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          top: -40,
          right: -40,
          width: 180,
          height: 180,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${mode.accent} 0%, transparent 70%)`,
          opacity: 0.18,
          filter: "blur(20px)",
        }}
      />
      <Box
        className="mode-icon-bg"
        sx={{
          width: 60,
          height: 60,
          borderRadius: 3,
          background: mode.accentSoft,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          mb: 2.5,
          transition: "transform .4s cubic-bezier(.34,1.56,.64,1)",
        }}
      >
        <Icon sx={{ color: mode.accent, fontSize: 28 }} />
      </Box>
      <Typography sx={{ fontWeight: 800, fontSize: 22, mb: 1 }}>
        {mode.title}
      </Typography>
      <Typography sx={{ color: "text.secondary", lineHeight: 1.55 }}>
        {mode.description}
      </Typography>
    </Box>
  );
}

function StepCard({ step, isLast }) {
  return (
    <Box
      sx={{
        position: "relative",
        p: 4,
        borderRadius: 4,
        height: "100%",
        background: "background.paper",
        border: `1px solid ${tokens.border}`,
        transition: "all .3s",
        "&:hover": { transform: "translateY(-4px)", borderColor: "primary.main" },
      }}
    >
      <Typography
        sx={{
          fontWeight: 900,
          fontSize: 56,
          lineHeight: 1,
          background: gradients.primary,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          mb: 1.5,
          letterSpacing: "-0.04em",
        }}
      >
        {step.n}
      </Typography>
      <Typography sx={{ fontWeight: 800, fontSize: 20, mb: 1 }}>
        {step.title}
      </Typography>
      <Typography sx={{ color: "text.secondary", lineHeight: 1.55 }}>
        {step.body}
      </Typography>
      {!isLast && (
        <Box
          aria-hidden
          sx={{
            display: { xs: "none", md: "block" },
            position: "absolute",
            top: "50%",
            right: -18,
            transform: "translateY(-50%)",
            width: 32,
            height: 2,
            background: gradients.primary,
            opacity: 0.4,
          }}
        />
      )}
    </Box>
  );
}

function FeatureCard({ feature }) {
  const Icon = feature.icon;
  return (
    <Box
      sx={{
        p: 3.5,
        borderRadius: 4,
        height: "100%",
        background: "background.paper",
        border: `1px solid ${tokens.border}`,
        transition: "all .3s",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: shadows.md,
          borderColor: "primary.main",
          "& .feat-icon": { background: gradients.primary, color: "#fff" },
        },
      }}
    >
      <Box
        className="feat-icon"
        sx={{
          width: 48,
          height: 48,
          borderRadius: 2.5,
          background: tokens.primarySoft,
          color: "primary.main",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          mb: 2,
          transition: "all .3s",
        }}
      >
        <Icon />
      </Box>
      <Typography sx={{ fontWeight: 800, fontSize: 18, mb: 1 }}>
        {feature.title}
      </Typography>
      <Typography sx={{ color: "text.secondary", lineHeight: 1.55, fontSize: 14.5 }}>
        {feature.body}
      </Typography>
    </Box>
  );
}
