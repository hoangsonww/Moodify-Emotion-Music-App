// Inverse of RequireAuth: bounces a signed-in user away from public
// auth pages (Login, Register, ForgotPassword) so they don't see the
// sign-in form when they already have a valid session.
//
// Same AUTH_EVENT / storage subscriptions as RequireAuth keep the gate
// in sync without polling.

import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { AUTH_EVENT, isAuthenticated } from "../services/auth";

export default function RedirectIfAuthed({ children, to = "/home" }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(() => isAuthenticated());

  useEffect(() => {
    const sync = () => setAuthed(isAuthenticated());
    window.addEventListener(AUTH_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(AUTH_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Imperative one-shot redirect (see RequireAuth for why): a declarative
  // `<Navigate replace>` re-fires on every render and, during a page
  // transition, floods history.replaceState() until Safari throws.
  useEffect(() => {
    if (authed && location.pathname !== to) {
      navigate(to, { replace: true });
    }
  }, [authed, location, navigate, to]);

  if (authed) return null;
  return children;
}
