// Shared visual language for the Moodify mobile app — a premium dark theme
// with a violet→pink brand gradient.

export const colors = {
  bg: '#0d0d12',
  bgElevated: '#14141c',
  surface: '#1a1a24',
  surfaceAlt: '#24242f',
  primary: '#8b5cf6',
  primaryDark: '#6d28d9',
  accent: '#ec4899',
  text: '#f6f6f8',
  textMuted: '#8f8f9e',
  textFaint: '#5e5e6c',
  border: '#2a2a38',
  danger: '#f43f5e',
  success: '#34d399',
};

// Brand gradient (used on buttons, the mood card, avatars, the logo mark).
export const gradient = {
  colors: ['#8b5cf6', '#d946ef', '#ec4899'],
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 36 };

export const radius = { sm: 10, md: 16, lg: 24, pill: 999 };

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
