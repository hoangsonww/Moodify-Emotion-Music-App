// Shared visual theme for the Moodify mobile app (dark).

export const colors = {
  bg: '#0f0f14',
  surface: '#1b1b25',
  surfaceAlt: '#262633',
  primary: '#8b5cf6',
  primaryDark: '#6d28d9',
  text: '#f4f4f6',
  textMuted: '#9a9aa7',
  border: '#2f2f3b',
  danger: '#ef4444',
  success: '#22c55e',
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 36 };

export const radius = { sm: 8, md: 14, lg: 22, pill: 999 };

export const navTheme = {
  dark: true,
  colors: {
    primary: colors.primary,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.primary,
  },
};
