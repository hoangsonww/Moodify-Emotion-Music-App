// Route guard for any page that requires a signed-in user.
//
// Reads the JWT from localStorage via `isAuthenticated`, subscribes to
// AUTH_EVENT (login / logout in the same tab) and the cross-tab
// `storage` event so the gate stays in sync without polling. When the
// user is not signed in, redirects to /login while preserving the
// attempted location in router state -- Login can read that and bounce
// the user back after a successful sign-in.

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
