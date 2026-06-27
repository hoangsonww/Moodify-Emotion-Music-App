import React, { useEffect, useContext, useRef } from "react";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { SwitchTransition, CSSTransition } from "react-transition-group";
import Navbar from "./components/Navbar";
import RequireAuth from "./components/RequireAuth";
import RedirectIfAuthed from "./components/RedirectIfAuthed";
import Login from "./components/Auth/Login";
import Register from "./components/Auth/Register";
import HomePage from "./pages/HomePage";
import ProfilePage from "./pages/ProfilePage";
import PasskeysPage from "./pages/PasskeysPage";
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
  return (
    <Router>
      <AppLayout />
    </Router>
  );
}

function AppLayout() {
  const location = useLocation();
  const { isDarkMode } = useContext(DarkModeContext);
  const hideNavbar = location.pathname === "/";

  // One CSSTransition node ref PER route key. Sharing a single ref across
  // the SwitchTransition children is the documented footgun here: on logout
  // the auth-change event makes the still-mounted (exiting) page render a
  // live <Navigate>, which re-fires on every re-render during the 300ms
  // exit. Those re-renders reassign a shared ref mid-transition, so the
  // entering page's `page-enter-active` class lands on the wrong node and
  // the new page is stuck at opacity:0 -- a blank/gray screen until reload.
  // Per-path refs keep the exiting and entering nodes isolated.
  const nodeRefs = useRef(new Map());
  let nodeRef = nodeRefs.current.get(location.pathname);
  if (!nodeRef) {
    nodeRef = React.createRef();
    nodeRefs.current.set(location.pathname, nodeRef);
  }

  // Landing renders its own full-page background, so #root stays transparent
  // there; every other route gets the solid theme background.
  useEffect(() => {
    const root = document.getElementById("root");
    if (!root) return;
    root.style.backgroundColor =
      location.pathname === "/"
        ? "transparent"
        : isDarkMode
          ? "#121212"
          : "#f5f5f5";
  }, [location.pathname, isDarkMode]);

  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const timeout = reduceMotion ? 0 : { enter: 480, exit: 300 };

  return (
    <>
      {!hideNavbar && <Navbar />}
      <SwitchTransition mode="out-in">
        <CSSTransition
          key={location.pathname}
          nodeRef={nodeRef}
          timeout={timeout}
          classNames="page"
          appear
          unmountOnExit
        >
          <div ref={nodeRef} className="page-anim">
            <Routes location={location}>
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
              <Route
                path="/terms-of-service"
                element={<TermsOfServicePage />}
              />

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
                path="/passkeys"
                element={
                  <RequireAuth>
                    <PasskeysPage />
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
          </div>
        </CSSTransition>
      </SwitchTransition>
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
