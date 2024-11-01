import React, { useEffect, useContext } from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
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
import "./styles/styles.css";

function App() {
  const { isDarkMode } = useContext(DarkModeContext);

  // Change the background color of the root div based on dark mode
  useEffect(() => {
    const root = document.getElementById("root");
    root.style.backgroundColor = isDarkMode ? "#121212" : "#f5f5f5"; // Dark mode and light mode colors
  }, [isDarkMode]);

  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/recommendations" element={<RecommendationsPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/terms-of-service" element={<TermsOfServicePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <Footer />
    </Router>
  );
}

export default function AppWithProvider() {
  return (
    <DarkModeProvider>
      <App />
    </DarkModeProvider>
  );
}
