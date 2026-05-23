// Inverse of RequireAuth: bounces a signed-in user away from public
// auth pages (Login, Register, ForgotPassword) so they don't see the
// sign-in form when they already have a valid session.
//
// Same AUTH_EVENT / storage subscriptions as RequireAuth keep the gate
// in sync without polling.

import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import { AUTH_EVENT, isAuthenticated } from "../services/auth";

export default function RedirectIfAuthed({ children, to = "/home" }) {
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

  if (authed) {
    return <Navigate to={to} replace />;
  }
  return children;
}
