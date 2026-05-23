// Shared visual language for the Moodify mobile app — a premium dark theme
// with a violet→pink brand gradient and per-mood accent palettes.

export const colors = {
  bg: '#0b0b11',
  bgElevated: '#13131c',
  surface: '#1a1a25',
  surfaceAlt: '#23232f',
  surfaceHi: '#2c2c3a',
  primary: '#8b5cf6',
  primaryDark: '#6d28d9',
  primarySoft: 'rgba(139, 92, 246, 0.18)',
  accent: '#ec4899',
  accentSoft: 'rgba(236, 72, 153, 0.18)',
  text: '#f6f6f8',
  textMuted: '#9595a4',
  textFaint: '#5e5e6c',
  border: '#2a2a38',
  borderHi: '#3a3a4c',
  danger: '#f43f5e',
  dangerSoft: 'rgba(244, 63, 94, 0.18)',
  success: '#34d399',
  successSoft: 'rgba(52, 211, 153, 0.18)',
  warning: '#fbbf24',
  overlay: 'rgba(11, 11, 17, 0.82)',
};

// Brand gradient (used on buttons, the mood card, avatars, the logo mark).
export const gradient = {
  colors: ['#8b5cf6', '#d946ef', '#ec4899'],
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
};

// Per-mood gradient palettes for mood-tinted hero / glow surfaces.
export const moodPalette = {
  joy:       { tint: '#fbbf24', colors: ['#f59e0b', '#f472b6', '#ec4899'], emoji: '😊', label: 'Joyful' },
  happy:     { tint: '#fbbf24', colors: ['#f59e0b', '#f472b6', '#ec4899'], emoji: '😊', label: 'Happy' },
  love:      { tint: '#ec4899', colors: ['#ec4899', '#f472b6', '#fb7185'], emoji: '🥰', label: 'In love' },
  excited:   { tint: '#f97316', colors: ['#f97316', '#ec4899', '#a855f7'], emoji: '🤩', label: 'Excited' },
  surprise:  { tint: '#22d3ee', colors: ['#06b6d4', '#22d3ee', '#a855f7'], emoji: '😲', label: 'Surprised' },
  surprised: { tint: '#22d3ee', colors: ['#06b6d4', '#22d3ee', '#a855f7'], emoji: '😲', label: 'Surprised' },
  calm:      { tint: '#34d399', colors: ['#10b981', '#22d3ee', '#3b82f6'], emoji: '😌', label: 'Calm' },
  neutral:   { tint: '#94a3b8', colors: ['#475569', '#64748b', '#94a3b8'], emoji: '😌', label: 'Neutral' },
  sad:       { tint: '#60a5fa', colors: ['#1e3a8a', '#3b82f6', '#60a5fa'], emoji: '😢', label: 'Sad' },
  sadness:   { tint: '#60a5fa', colors: ['#1e3a8a', '#3b82f6', '#60a5fa'], emoji: '😢', label: 'Sad' },
  fear:      { tint: '#a855f7', colors: ['#4c1d95', '#7c3aed', '#a855f7'], emoji: '😨', label: 'Anxious' },
  fearful:   { tint: '#a855f7', colors: ['#4c1d95', '#7c3aed', '#a855f7'], emoji: '😨', label: 'Anxious' },
  anger:     { tint: '#f43f5e', colors: ['#9f1239', '#e11d48', '#f43f5e'], emoji: '😠', label: 'Angry' },
  angry:     { tint: '#f43f5e', colors: ['#9f1239', '#e11d48', '#f43f5e'], emoji: '😠', label: 'Angry' },
  disgust:   { tint: '#65a30d', colors: ['#365314', '#65a30d', '#a3e635'], emoji: '😖', label: 'Disgust' },
};

export const moodPaletteFor = (emotion) =>
  moodPalette[String(emotion || '').toLowerCase()] || {
    tint: colors.primary,
    colors: gradient.colors,
    emoji: '🎧',
    label: String(emotion || 'Mood'),
  };

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 36, xxl: 56 };

export const radius = { xs: 6, sm: 10, md: 16, lg: 24, xl: 32, pill: 999 };

export const typography = {
  display: { fontSize: 34, fontWeight: '900', letterSpacing: -0.5, lineHeight: 40 },
  h1: { fontSize: 28, fontWeight: '900', letterSpacing: -0.3, lineHeight: 34 },
  h2: { fontSize: 22, fontWeight: '800', letterSpacing: -0.2, lineHeight: 28 },
  h3: { fontSize: 18, fontWeight: '800', letterSpacing: -0.1, lineHeight: 24 },
  body: { fontSize: 15, fontWeight: '500', lineHeight: 22 },
  bodyStrong: { fontSize: 15, fontWeight: '700', lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  micro: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  glow: {
    shadowColor: colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
};

export const motion = {
  fast: 180,
  base: 260,
  slow: 420,
};

export const navTheme = {
  dark: true,
  colors: {
    primary: colors.primary,
    background: colors.bg,
    card: colors.bgElevated,
    text: colors.text,
    border: 'transparent',
    notification: colors.accent,
  },
};
