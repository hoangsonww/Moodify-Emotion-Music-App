// Route guard for any page that requires a signed-in user.
//
// Reads the JWT from localStorage via `isAuthenticated`, subscribes to
// AUTH_EVENT (login / logout in the same tab) and the cross-tab
// `storage` event so the gate stays in sync without polling. When the
// user is not signed in, redirects to /login while preserving the
// attempted location in router state -- Login can read that and bounce
// the user back after a successful sign-in.

import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { AUTH_EVENT, isAuthenticated } from "../services/auth";

export default function RequireAuth({ children }) {
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

  // Redirect imperatively, exactly once per auth/route change. The old
  // declarative `<Navigate replace>` re-ran its navigation on EVERY render
  // (its effect has no deps); while a page transition keeps this guard
  // mounted and re-rendering, that became a history.replaceState() storm --
  // Safari throws `SecurityError: ... more than 100 times per 10 seconds`
  // and the screen goes black on logout. Gating on pathname stops the
  // post-redirect re-run from firing again.
  useEffect(() => {
    if (!authed && location.pathname !== "/login") {
      navigate("/login", { replace: true, state: { from: location } });
    }
  }, [authed, location, navigate]);

  // Render nothing while unauthenticated so there's no live <Navigate> (or
  // protected children) re-rendering behind the redirect.
  if (!authed) return null;
  return children;
}
