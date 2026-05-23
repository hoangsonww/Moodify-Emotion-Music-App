import React, { useContext, useEffect, useMemo } from "react";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { CssBaseline, ThemeProvider } from "@mui/material";

import Navbar from "./components/Navbar";
import RequireAuth from "./components/RequireAuth";
import Login from "./components/Auth/Login";
import Register from "./components/Auth/Register";
import HomePage from "./pages/HomePage";
import ProfilePage from "./pages/ProfilePage";
import ResultsPage from "./pages/ResultsPage";
import RecommendationsPage from "./pages/RecommendationsPage";
import Footer from "./components/Footer";
import NotFoundPage from "./pages/NotFoundPage";
import LandingPage from "./pages/LandingPage";
import ForgotPassword from "./pages/ForgotPassword";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import TermsOfServicePage from "./pages/TermsOfServicePage";
import { DarkModeProvider, DarkModeContext } from "./context/DarkModeContext";
import { installAuthInterceptor } from "./services/auth";
import { buildTheme } from "./theme";
import "./styles/styles.css";

// Install the global 401 -> token-refresh interceptor once at startup.
installAuthInterceptor();

function App() {
  const { isDarkMode } = useContext(DarkModeContext);

  // Re-build the MUI theme any time dark mode flips; this drives every
  // page's typography, colour palette, button shape, etc.
  const theme = useMemo(() => buildTheme(isDarkMode ? "dark" : "light"), [
    isDarkMode,
  ]);

  // Keep the root element's bg color in sync with theme mode -- belt and
  // suspenders alongside the CssBaseline body styles.
  useEffect(() => {
    const root = document.getElementById("root");
    if (root) {
      root.style.backgroundColor = theme.palette.background.default;
    }
  }, [theme]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <AppLayout />
      </Router>
    </ThemeProvider>
  );
}

function AppLayout() {
  const location = useLocation();
  const hideNavbar = location.pathname === "/";

  return (
    <>
      {!hideNavbar && <Navbar />}
      <Routes>
        {/* Public routes -- landing, auth, legal. */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/terms-of-service" element={<TermsOfServicePage />} />

        {/* Gated routes -- every feature page requires a signed-in user. */}
        <Route
          path="/home"
          element={
            <RequireAuth>
              <HomePage />
            </RequireAuth>
          }
        />
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          }
        />
        <Route
          path="/results"
          element={
            <RequireAuth>
              <ResultsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/recommendations"
          element={
            <RequireAuth>
              <RecommendationsPage />
            </RequireAuth>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <Footer />
    </>
  );
}

export default function AppWithProvider() {
  return (
    <DarkModeProvider>
      <App />
    </DarkModeProvider>
  );
}
