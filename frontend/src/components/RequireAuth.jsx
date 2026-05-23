// Route guard for any page that needs a signed-in user.
//
// Wraps a child route element and:
//   * On mount, reads the JWT from localStorage (via `isAuthenticated`).
//   * Subscribes to AUTH_EVENT (login / logout in the same tab) and the
//     `storage` event (login / logout in another tab) so the gate stays
//     in sync without polling.
//   * If unauthenticated, redirects to /login while preserving the
//     attempted location in router state so the login screen can bounce
//     the user back after a successful sign-in.

import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { AUTH_EVENT, isAuthenticated } from "../services/auth";

export default function RequireAuth({ children }) {
  const location = useLocation();
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

  if (!authed) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}
