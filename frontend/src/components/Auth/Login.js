import React, { useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

import { API_URL } from "../../config";
import { setTokens } from "../../services/auth";
import { gradients, shadows, tokens } from "../../theme";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from?.pathname || "/home";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (event) => {
    if (event) event.preventDefault();
    setError("");

    if (!username.trim() || !password) {
      setError("Please fill in both your username and password.");
      return;
    }

    setLoading(true);
    try {
      const { data } = await axios.post(`${API_URL}/users/login/`, {
        username: username.trim(),
        password,
      });
      if (data?.access) {
        setTokens(data.access, data.refresh);
        navigate(redirectTo, { replace: true });
      } else {
        setError("Login failed. Please check your credentials and try again.");
      }
    } catch (err) {
      const status = err?.response?.status;
      setError(
        status === 401
          ? "Invalid username or password."
          : "Login failed. Our servers may be having a moment — try again shortly.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      sub="Pick up where your mood left off."
      eyebrow="Sign in"
    >
      <Box component="form" onSubmit={handleLogin} noValidate>
        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          label="Username"
          fullWidth
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoFocus
          sx={{ mb: 2 }}
        />
        <TextField
          label="Password"
          fullWidth
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowPassword((s) => !s)}
                  edge="end"
                  aria-label="toggle password visibility"
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{ mb: 1 }}
        />

        <Box sx={{ textAlign: "right", mb: 2.5 }}>
          <Button
            onClick={() => navigate("/forgot-password")}
            sx={{
              p: 0,
              minWidth: 0,
              color: "primary.main",
              fontWeight: 700,
              fontSize: 13,
              "&:hover": { background: "transparent", textDecoration: "underline" },
            }}
          >
            Forgot password?
          </Button>
        </Box>

        <Button
          type="submit"
          variant="contained"
          color="primary"
          fullWidth
          disabled={loading}
          sx={{ py: 1.5, fontSize: 16, borderRadius: 999, mb: 2 }}
        >
          {loading ? <CircularProgress size={22} sx={{ color: "#fff" }} /> : "Log In"}
        </Button>

        <Typography sx={{ textAlign: "center", color: "text.secondary", fontSize: 14 }}>
          New to Moodify?{" "}
          <Box
            component="span"
            role="button"
            onClick={() => navigate("/register")}
            sx={{
              color: "primary.main",
              fontWeight: 800,
              cursor: "pointer",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            Create an account
          </Box>
        </Typography>
      </Box>
    </AuthShell>
  );
}

// Shared two-panel layout for Login / Register / ForgotPassword.
// The left panel is the brand "hero" -- gradient, music note, tagline.
// The right panel hosts the form. Collapses to single column on mobile.
export function AuthShell({ title, sub, eyebrow, children }) {
  return (
    <Box
      sx={{
        minHeight: "calc(100vh - 80px)",
        display: "flex",
        alignItems: "stretch",
        justifyContent: "center",
        p: { xs: 2, md: 4 },
        position: "relative",
        backgroundImage: gradients.aurora,
      }}
    >
      <Box
        sx={{
          width: "100%",
          maxWidth: 1100,
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1.05fr 1fr" },
          borderRadius: 5,
          overflow: "hidden",
          border: `1px solid ${tokens.border}`,
          background: "background.paper",
          boxShadow: shadows.lg,
        }}
      >
        {/* Brand panel */}
        <Box
          sx={{
            display: { xs: "none", md: "flex" },
            position: "relative",
            background: gradients.primary,
            color: "#fff",
            p: 6,
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* aurora overlay */}
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(60% 60% at 30% 20%, rgba(255,255,255,0.18) 0%, transparent 60%), radial-gradient(40% 50% at 80% 80%, rgba(255,255,255,0.10) 0%, transparent 60%)",
              pointerEvents: "none",
            }}
          />

          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: "auto" }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: "12px",
                background: "rgba(255,255,255,0.18)",
                backdropFilter: "blur(10px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MusicNoteIcon sx={{ color: "#fff" }} />
            </Box>
            <Typography sx={{ fontWeight: 900, fontSize: 22 }}>Moodify</Typography>
          </Stack>

          <Box sx={{ position: "relative", zIndex: 1 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2, opacity: 0.85 }}>
              <AutoAwesomeIcon sx={{ fontSize: 18 }} />
              <Typography
                sx={{ fontWeight: 800, letterSpacing: "0.2em", fontSize: 12 }}
              >
                EMOTION-AWARE SOUNDTRACKS
              </Typography>
            </Stack>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 900,
                fontSize: { md: 44, lg: 52 },
                lineHeight: 1.05,
                letterSpacing: "-0.03em",
                mb: 2,
              }}
            >
              Music that matches the moment.
            </Typography>
            <Typography sx={{ fontSize: 17, opacity: 0.92, mb: 4, lineHeight: 1.55 }}>
              Tell us how you feel — text, voice or face — and we'll line up a
              Deezer set that fits.
            </Typography>
            <Stack spacing={1.5}>
              {["Real ML, sub-second results", "Personalised over time", "Free 30s previews from Deezer"].map(
                (b) => (
                  <Stack key={b} direction="row" alignItems="center" spacing={1.5}>
                    <Box
                      sx={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        background: "rgba(255,255,255,0.2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 900,
                        fontSize: 13,
                      }}
                    >
                      ✓
                    </Box>
                    <Typography sx={{ fontWeight: 600, opacity: 0.95 }}>{b}</Typography>
                  </Stack>
                ),
              )}
            </Stack>
          </Box>
        </Box>

        {/* Form panel */}
        <Box
          sx={{
            p: { xs: 4, md: 6 },
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            background: "background.paper",
          }}
        >
          <Typography
            variant="overline"
            sx={{ color: "primary.main", fontWeight: 800, letterSpacing: "0.2em", mb: 1 }}
          >
            {eyebrow}
          </Typography>
          <Typography
            variant="h4"
            sx={{ fontWeight: 900, mb: 1, letterSpacing: "-0.02em" }}
          >
            {title}
          </Typography>
          <Typography sx={{ color: "text.secondary", mb: 4 }}>{sub}</Typography>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
