// Inverse of RequireAuth: bounces a signed-in user away from public
// auth pages (Login, Register, ForgotPassword) so they don't see the
// sign-in form when they already have a valid session.
//
// Same AUTH_EVENT / storage subscriptions as RequireAuth keep the gate
// in sync without polling.

import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { AUTH_EVENT, isAuthenticated } from "../services/auth";

export default function RedirectIfAuthed({ children, to = "/home" }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(() => isAuthenticated());
  const redirected = useRef(false);

  useEffect(() => {
    const sync = () => setAuthed(isAuthenticated());
    window.addEventListener(AUTH_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(AUTH_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Imperative redirect, ref-guarded so it fires only ONCE per
  // authenticated episode. See RequireAuth for the full rationale: during
  // a page transition the exiting guard's `useLocation()` returns the
  // frozen old path, so a pathname check is unreliable and the navigate
  // would re-fire on every transition re-render -- a history.replaceState()
  // storm that crashes Safari (login has the same shape as logout).
  useEffect(() => {
    if (!authed) {
      redirected.current = false;
      return;
    }
    if (redirected.current) return;
    redirected.current = true;
    navigate(to, { replace: true });
  }, [authed, location, navigate, to]);

  if (authed) return null;
  return children;
}
