// Moodify web design system.
//
// Brand language mirrors the mobile app: violet -> pink gradient anchor,
// deep near-black surface, glowing primary CTAs, generous rounding.
//
// Exports:
//   * tokens        -- raw design values (colors, gradients, shadows,
//                      radius, spacing) for direct use in sx props or
//                      inline styles where MUI's theme is awkward.
//   * buildTheme()  -- returns a configured MUI theme for `mode`
//                      ('light' | 'dark'). Light mode keeps the same
//                      gradient + accent but on a soft paper background.
//   * default       -- a ready-built dark theme (back-compat with old
//                      `import theme from './theme'` call sites).

import { createTheme } from "@mui/material/styles";

// --- raw design tokens ---------------------------------------------------
export const tokens = {
  // Brand palette -- violet -> pink, matches mobile/theme.js.
  primary: "#a855f7",
  primarySoft: "rgba(168, 85, 247, 0.16)",
  primaryStrong: "#7c3aed",
  accent: "#ec4899",
  accentSoft: "rgba(236, 72, 153, 0.16)",
  success: "#34d399",
  successSoft: "rgba(52, 211, 153, 0.16)",
  warning: "#f59e0b",
  danger: "#ef4444",

  // Dark surfaces.
  bg: "#0a0a14",
  bgElevated: "#11111c",
  surface: "#181826",
  surfaceAlt: "#222234",
  border: "#2c2c42",

  // Text on dark.
  text: "#f5f5fa",
  textMuted: "#a8a8c0",
  textFaint: "#6b6b84",
};

export const gradients = {
  // Primary brand gradient used on hero text, CTAs, and accents.
  primary: "linear-gradient(135deg, #a855f7 0%, #ec4899 100%)",
  primarySoft:
    "linear-gradient(135deg, rgba(168, 85, 247, 0.18) 0%, rgba(236, 72, 153, 0.18) 100%)",
  cool: "linear-gradient(135deg, #6366f1 0%, #22d3ee 100%)",
  warm: "linear-gradient(135deg, #f97316 0%, #ec4899 100%)",
  // A subtle full-screen background "aurora" -- two radial glows.
  aurora:
    "radial-gradient(60% 50% at 20% 20%, rgba(168, 85, 247, 0.18) 0%, transparent 60%), " +
    "radial-gradient(50% 50% at 85% 75%, rgba(236, 72, 153, 0.14) 0%, transparent 60%)",
};

export const shadows = {
  sm: "0 1px 2px rgba(0, 0, 0, 0.35)",
  md: "0 10px 30px rgba(0, 0, 0, 0.35)",
  lg: "0 24px 60px rgba(0, 0, 0, 0.5)",
  // Coloured glows that match the brand gradient.
  glow: "0 16px 44px rgba(168, 85, 247, 0.35)",
  glowPink: "0 16px 44px rgba(236, 72, 153, 0.35)",
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 22,
  xl: 32,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 40,
  xxl: 64,
};

// --- MUI theme factory ---------------------------------------------------
export function buildTheme(mode = "dark") {
  const isDark = mode === "dark";

  const palette = {
    mode,
    primary: { main: tokens.primary, contrastText: "#ffffff" },
    secondary: { main: tokens.accent, contrastText: "#ffffff" },
    success: { main: tokens.success },
    warning: { main: tokens.warning },
    error: { main: tokens.danger },
    background: {
      default: isDark ? tokens.bg : "#f7f5fb",
      paper: isDark ? tokens.surface : "#ffffff",
    },
    text: {
      primary: isDark ? tokens.text : "#1a1a2e",
      secondary: isDark ? tokens.textMuted : "#5e5e7a",
    },
    divider: isDark ? tokens.border : "#e6e6f0",
  };

  return createTheme({
    palette,
    shape: { borderRadius: radius.md },
    typography: {
      fontFamily:
        '"Poppins", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      h1: { fontWeight: 900, letterSpacing: "-0.03em" },
      h2: { fontWeight: 900, letterSpacing: "-0.02em" },
      h3: { fontWeight: 800, letterSpacing: "-0.015em" },
      h4: { fontWeight: 800, letterSpacing: "-0.01em" },
      h5: { fontWeight: 700 },
      h6: { fontWeight: 700 },
      subtitle1: { fontWeight: 600 },
      subtitle2: { fontWeight: 600 },
      button: { textTransform: "none", fontWeight: 700, letterSpacing: 0.2 },
      overline: {
        fontWeight: 800,
        letterSpacing: "0.18em",
        fontSize: "0.72rem",
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: palette.background.default,
            backgroundImage: gradients.aurora,
            backgroundAttachment: "fixed",
          },
          "::selection": {
            backgroundColor: tokens.accent,
            color: "#ffffff",
          },
          "*::-webkit-scrollbar": { width: 10, height: 10 },
          "*::-webkit-scrollbar-thumb": {
            background: isDark ? tokens.surfaceAlt : "#d6d6e2",
            borderRadius: 8,
          },
          "*::-webkit-scrollbar-track": { background: "transparent" },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: "none" },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            backgroundColor: isDark
              ? "rgba(10, 10, 20, 0.72)"
              : "rgba(255, 255, 255, 0.78)",
            backdropFilter: "saturate(180%) blur(18px)",
            WebkitBackdropFilter: "saturate(180%) blur(18px)",
            borderBottom: `1px solid ${palette.divider}`,
            boxShadow: "none",
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: radius.pill,
            paddingLeft: 22,
            paddingRight: 22,
            paddingTop: 10,
            paddingBottom: 10,
          },
          containedPrimary: {
            background: gradients.primary,
            boxShadow: shadows.glow,
            "&:hover": {
              background: gradients.primary,
              boxShadow: shadows.glow,
              filter: "brightness(1.05)",
            },
          },
          outlined: {
            borderWidth: 1.5,
            "&:hover": { borderWidth: 1.5 },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: radius.lg,
            border: `1px solid ${palette.divider}`,
            boxShadow: shadows.md,
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { borderRadius: radius.md },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 600 },
        },
      },
    },
  });
}

// Back-compat default export so existing `import theme from "./theme"`
// callers (e.g. index.js) keep working without edits.
const theme = buildTheme("dark");
export default theme;
