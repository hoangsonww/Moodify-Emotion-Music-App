// App-wide toast notifications.
//
// Replaces `alert()` calls everywhere -- wrap the app in <ToastProvider>
// once, then call `useToast()` from any component to push:
//
//   const toast = useToast();
//   toast.success("Welcome back!");
//   toast.error("Login failed.");
//   toast.show({ severity: "warning", message: "Heads up", duration: 6000 });
//
// Toasts stack at the top-right (top-center on mobile), auto-dismiss
// after `duration` ms (default 4000), and respect dark mode by pulling
// MUI's Alert styling from the active theme.

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { Alert, Slide, Snackbar, Stack, useMediaQuery } from "@mui/material";

const ToastContext = createContext(null);

let toastSeq = 0;
const nextId = () => {
  toastSeq += 1;
  return `t${Date.now()}_${toastSeq}`;
};

function SlideTransition(props) {
  return <Slide {...props} direction="left" />;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const isMobile = useMediaQuery("(max-width: 600px)");

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((input) => {
    // Accept either a string ("simple message") or an options object.
    const opts = typeof input === "string" ? { message: input } : input || {};
    const toast = {
      id: nextId(),
      severity: opts.severity || opts.type || "info",
      message: opts.message || "",
      title: opts.title,
      duration: opts.duration ?? 4000,
    };
    setToasts((current) => [...current, toast]);
    return toast.id;
  }, []);

  const api = useMemo(
    () => ({
      show,
      dismiss,
      success: (message, opts = {}) => show({ ...opts, severity: "success", message }),
      error: (message, opts = {}) => show({ ...opts, severity: "error", message }),
      warning: (message, opts = {}) => show({ ...opts, severity: "warning", message }),
      info: (message, opts = {}) => show({ ...opts, severity: "info", message }),
    }),
    [show, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Snackbar
        open={toasts.length > 0}
        anchorOrigin={{
          vertical: "top",
          horizontal: isMobile ? "center" : "right",
        }}
        sx={{
          top: { xs: 16, sm: 24 },
          right: { xs: 16, sm: 24 },
          left: { xs: 16, sm: "auto" },
          maxWidth: { xs: "calc(100% - 32px)", sm: 420 },
        }}
        TransitionComponent={SlideTransition}
        // We render the stack ourselves; Snackbar is just the positioning shell.
        message=""
      >
        <Stack spacing={1} sx={{ width: "100%" }}>
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </Stack>
      </Snackbar>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }) {
  // Self-dismiss after `duration`. Cleared on unmount.
  React.useEffect(() => {
    if (!toast.duration) return undefined;
    const handle = window.setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => window.clearTimeout(handle);
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <Alert
      onClose={() => onDismiss(toast.id)}
      severity={toast.severity}
      variant="filled"
      sx={{
        width: "100%",
        fontFamily: "Poppins, sans-serif",
        boxShadow: "0 10px 28px rgba(0,0,0,0.25)",
        borderRadius: "12px",
        alignItems: "center",
        ".MuiAlert-message": { fontWeight: 500 },
      }}
    >
      {toast.title && (
        <strong style={{ display: "block", marginBottom: 2 }}>
          {toast.title}
        </strong>
      )}
      {toast.message}
    </Alert>
  );
}

// A no-op API used when `useToast` is called outside a <ToastProvider>.
// This keeps tests and standalone component renders working without
// having to wrap every render tree in the provider.
const noopToast = {
  show: () => undefined,
  dismiss: () => undefined,
  success: () => undefined,
  error: () => undefined,
  warning: () => undefined,
  info: () => undefined,
};

export function useToast() {
  return useContext(ToastContext) || noopToast;
}
