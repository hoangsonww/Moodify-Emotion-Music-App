import React, { useEffect, useContext } from "react";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import Navbar from "./components/Navbar";
import RequireAuth from "./components/RequireAuth";
import RedirectIfAuthed from "./components/RedirectIfAuthed";
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
import { ToastProvider } from "./components/Toast";
import { installAuthInterceptor } from "./services/auth";
import "./styles/styles.css";

// Install the global 401 -> token-refresh interceptor once at startup.
installAuthInterceptor();

function App() {
  const { isDarkMode } = useContext(DarkModeContext);

  // Change the background color of the root div based on dark mode
  useEffect(() => {
    const root = document.getElementById("root");
    root.style.backgroundColor = isDarkMode ? "#121212" : "#f5f5f5"; // Dark mode and light mode colors
  }, [isDarkMode]);

  return (
    <Router>
      <AppLayout />
    </Router>
  );
}

function AppLayout() {
  const location = useLocation();
  const hideNavbar = location.pathname === "/";

  return (
    <>
      {!hideNavbar && <Navbar />}
      <Routes>
        {/* Public routes -- landing, auth, legal. Auth pages bounce a
            signed-in user back to /home so they never see the form. */}
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/login"
          element={
            <RedirectIfAuthed>
              <Login />
            </RedirectIfAuthed>
          }
        />
        <Route
          path="/register"
          element={
            <RedirectIfAuthed>
              <Register />
            </RedirectIfAuthed>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <RedirectIfAuthed>
              <ForgotPassword />
            </RedirectIfAuthed>
          }
        />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/terms-of-service" element={<TermsOfServicePage />} />

        {/* Gated feature routes -- redirect to /login when signed out. */}
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
      <ToastProvider>
        <App />
      </ToastProvider>
    </DarkModeProvider>
  );
}
