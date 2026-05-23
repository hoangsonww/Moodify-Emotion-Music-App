import { createTheme } from "@mui/material/styles";

// Force every MUI component to inherit Poppins. Without `fontFamily` here
// MUI components (Typography, Button, TextField, MenuItem, Chip, etc.)
// fall back to Roboto and override the body CSS that already sets
// Poppins for raw DOM nodes. Listing the per-variant `fontFamily` keeps
// the rule effective even when MUI internally re-creates the variant.
const POPPINS = '"Poppins", "Helvetica Neue", Arial, sans-serif';

const theme = createTheme({
  palette: {
    primary: { main: "#ff4d4d" }, // Orange-ish primary color
    secondary: { main: "#ffffff" }, // White secondary color
  },
  typography: {
    fontFamily: POPPINS,
    h1: { fontFamily: POPPINS },
    h2: { fontFamily: POPPINS },
    h3: { fontFamily: POPPINS },
    h4: { fontFamily: POPPINS, fontWeight: 600 },
    h5: { fontFamily: POPPINS },
    h6: { fontFamily: POPPINS },
    subtitle1: { fontFamily: POPPINS },
    subtitle2: { fontFamily: POPPINS },
    body1: { fontFamily: POPPINS },
    body2: { fontFamily: POPPINS },
    button: { fontFamily: POPPINS, textTransform: "none" },
    caption: { fontFamily: POPPINS },
    overline: { fontFamily: POPPINS },
  },
  components: {
    // Belt-and-braces overrides for components that don't read
    // typography.fontFamily by default.
    //
    // The input overrides below also defeat two annoying browser/MUI
    // defaults that make inputs look "elevated" or differently-coloured
    // from their parent card:
    //
    //   1. Native macOS/Webkit `appearance: textfield` paints a subtle
    //      inset shadow on every <input>. Force `appearance: none`.
    //   2. MUI's Paper elevation overlay tints any input area that
    //      defaults to `transparent` slightly differently from the
    //      surrounding Paper. Pin every input wrapper's background to
    //      `transparent` (not `!important` so a local sx can opt in
    //      to an explicit colour like the search-field cards).
    //   3. Chrome's autofill paints a cream/yellow box. Defeat with the
    //      WebkitBoxShadow inset trick using `currentColor` so the
    //      effective tint matches whatever the dialog/card already is.
    MuiCssBaseline: {
      styleOverrides: {
        body: { fontFamily: POPPINS },
        input: {
          fontFamily: POPPINS,
          WebkitAppearance: "none",
          appearance: "none",
        },
        textarea: { fontFamily: POPPINS },
        button: { fontFamily: POPPINS },
        select: {
          fontFamily: POPPINS,
          WebkitAppearance: "none",
          appearance: "none",
        },
        // Defeat Chrome / Edge autofill background tint globally.
        "input:-webkit-autofill, input:-webkit-autofill:hover, input:-webkit-autofill:focus, input:-webkit-autofill:active":
          {
            WebkitBoxShadow: "0 0 0 1000px transparent inset",
            WebkitTextFillColor: "currentColor",
            caretColor: "currentColor",
            transition: "background-color 5000s ease-in-out 0s",
            backgroundColor: "transparent !important",
            backgroundImage: "none !important",
          },
      },
    },
    MuiButton: { styleOverrides: { root: { fontFamily: POPPINS } } },
    MuiInputBase: {
      styleOverrides: {
        root: {
          fontFamily: POPPINS,
          // Transparent baseline -- inputs visually merge with the
          // surrounding Paper unless a screen explicitly overrides.
          backgroundColor: "transparent",
        },
        input: {
          backgroundColor: "transparent",
          WebkitAppearance: "none",
          appearance: "none",
          boxShadow: "none",
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: "transparent",
          boxShadow: "none",
          "&:hover": { backgroundColor: "transparent" },
          "&.Mui-focused": { backgroundColor: "transparent" },
        },
        input: {
          backgroundColor: "transparent",
          WebkitAppearance: "none",
          appearance: "none",
          boxShadow: "none",
        },
      },
    },
    MuiFilledInput: {
      styleOverrides: {
        root: {
          backgroundColor: "transparent",
          "&:hover": { backgroundColor: "transparent" },
          "&.Mui-focused": { backgroundColor: "transparent" },
          "&::before, &::after": { display: "none" },
        },
        input: {
          backgroundColor: "transparent",
          WebkitAppearance: "none",
          appearance: "none",
          boxShadow: "none",
        },
      },
    },
    MuiInput: {
      styleOverrides: {
        root: { backgroundColor: "transparent" },
        input: {
          backgroundColor: "transparent",
          WebkitAppearance: "none",
          appearance: "none",
          boxShadow: "none",
        },
      },
    },
    MuiInputLabel: { styleOverrides: { root: { fontFamily: POPPINS } } },
    MuiMenuItem: { styleOverrides: { root: { fontFamily: POPPINS } } },
    MuiChip: { styleOverrides: { root: { fontFamily: POPPINS } } },
    MuiTab: { styleOverrides: { root: { fontFamily: POPPINS } } },
    MuiTooltip: { styleOverrides: { tooltip: { fontFamily: POPPINS } } },
  },
});

export default theme;
