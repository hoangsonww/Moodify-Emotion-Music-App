// Route guard for any page that requires a signed-in user.
//
// Reads the JWT from localStorage via `isAuthenticated`, subscribes to
// AUTH_EVENT (login / logout in the same tab) and the cross-tab
// `storage` event so the gate stays in sync without polling. When the
// user is not signed in, redirects to /login while preserving the
// attempted location in router state -- Login can read that and bounce
// the user back after a successful sign-in.

import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { AUTH_EVENT, isAuthenticated } from "../services/auth";

export default function RequireAuth({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(() => isAuthenticated());
  // Fire the redirect at most once per unauthenticated episode. Re-arms
  // when the user becomes authenticated again.
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

  // Redirect imperatively, guarded by a ref so it can fire only ONCE.
  //
  // Why the ref (a pathname check is not enough): during the page
  // transition, react-transition-group keeps this guard mounted on the
  // exiting route while react-router renders it inside `<Routes
  // location={frozenOldLocation}>`. That overrides the location context,
  // so `useLocation()` here returns the OLD path (e.g. /home), not /login
  // -- a `pathname !== "/login"` check passes and the navigate re-fires on
  // every re-render the transition triggers. That floods
  // history.replaceState() until Safari throws `SecurityError: ... more
  // than 100 times per 10 seconds` and the screen goes black on logout.
  useEffect(() => {
    if (authed) {
      redirected.current = false;
      return;
    }
    if (redirected.current) return;
    redirected.current = true;
    navigate("/login", { replace: true, state: { from: location } });
  }, [authed, location, navigate]);

  // Render nothing while unauthenticated so no protected children re-render
  // behind the redirect.
  if (!authed) return null;
  return children;
}
