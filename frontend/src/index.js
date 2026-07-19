import React from "react";
import ReactDOM from "react-dom";
import * as Sentry from "@sentry/react";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import App from "./App";
import theme from "./theme";
import reportWebVitals from "./reportWebVitals";

// --- Error + performance monitoring (Sentry) ------------------------------
// Opt-in: with no REACT_APP_SENTRY_DSN the SDK never initializes, so local
// dev and CI builds send nothing to Sentry. The DSN and tunables come from
// the build-time env (see frontend/.env.example). Project: unc-a4/moodify-app.
const SENTRY_DSN = process.env.REACT_APP_SENTRY_DSN;
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment:
      process.env.REACT_APP_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    // Fraction of transactions traced for performance. 10% by default.
    tracesSampleRate:
      Number(process.env.REACT_APP_SENTRY_TRACES_SAMPLE_RATE) || 0.1,
    // Record 10% of sessions, plus 100% of any session that hits an error.
    // Replay masks all text and blocks media by default (privacy-preserving).
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

// Plain, theme-independent fallback so it still renders even if the failure
// is inside the theme/provider tree.
const FallbackComponent = () => (
  <div
    style={{ padding: "2rem", textAlign: "center", fontFamily: "sans-serif" }}
  >
    <h1>Something went wrong.</h1>
    <p>An unexpected error occurred. Please refresh the page to try again.</p>
  </div>
);

ReactDOM.render(
  <Sentry.ErrorBoundary fallback={<FallbackComponent />} showDialog>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </Sentry.ErrorBoundary>,
  document.getElementById("root"),
);

reportWebVitals();
