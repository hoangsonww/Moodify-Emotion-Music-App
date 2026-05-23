import React, { useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import { API_URL } from "../config";
import { AuthShell } from "../components/Auth/Login";
import { tokens } from "../theme";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleVerify = async (event) => {
    if (event) event.preventDefault();
    setError("");

    if (!username.trim() || !email.trim()) {
      setError("Enter your username and email to continue.");
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API_URL}/users/verify-username-email/`, {
        username: username.trim(),
        email: email.trim(),
      });
      setStep(2);
    } catch (err) {
      setError(
        err?.response?.status === 404
          ? "We couldn't find that username and email combination."
          : "Could not verify your account. Try again shortly.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (event) => {
    if (event) event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API_URL}/users/reset-password/`, {
        username: username.trim(),
        new_password: password,
      });
      setSuccess("Password updated — redirecting you to sign in…");
      setTimeout(() => navigate("/login"), 1100);
    } catch (err) {
      setError("Could not reset your password. Try again shortly.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title={step === 1 ? "Reset your password" : "Set a new password"}
      sub={
        step === 1
          ? "Confirm your username and email to continue."
          : "Pick something memorable — at least 8 characters."
      }
      eyebrow={`Step ${step} of 2`}
    >
      <Box sx={{ mb: 3 }}>
        <LinearProgress
          variant="determinate"
          value={step === 1 ? 50 : 100}
          sx={{
            height: 6,
            borderRadius: 999,
            background: tokens.border,
            "& .MuiLinearProgress-bar": {
              background: "linear-gradient(90deg, #a855f7, #ec4899)",
              borderRadius: 999,
            },
          }}
        />
        <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: step >= 1 ? "primary.main" : "text.secondary" }}>
            Verify
          </Typography>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: step >= 2 ? "primary.main" : "text.secondary" }}>
            Reset
          </Typography>
        </Stack>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
          {success}
        </Alert>
      )}

      {step === 1 ? (
        <Box component="form" onSubmit={handleVerify} noValidate>
          <TextField
            label="Username"
            fullWidth
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            sx={{ mb: 2 }}
          />
          <TextField
            label="Email"
            type="email"
            fullWidth
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            sx={{ mb: 3 }}
          />
          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            disabled={loading}
            sx={{ py: 1.5, fontSize: 16, borderRadius: 999, mb: 2 }}
          >
            {loading ? <CircularProgress size={22} sx={{ color: "#fff" }} /> : "Verify"}
          </Button>
        </Box>
      ) : (
        <Box component="form" onSubmit={handleReset} noValidate>
          <TextField
            label="New password"
            fullWidth
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword((s) => !s)} edge="end">
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{ mb: 2 }}
          />
          <TextField
            label="Confirm new password"
            fullWidth
            type={showConfirm ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowConfirm((s) => !s)} edge="end">
                    {showConfirm ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{ mb: 3 }}
          />
          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            disabled={loading}
            sx={{ py: 1.5, fontSize: 16, borderRadius: 999, mb: 2 }}
          >
            {loading ? <CircularProgress size={22} sx={{ color: "#fff" }} /> : "Update password"}
          </Button>
        </Box>
      )}

      <Typography sx={{ textAlign: "center", color: "text.secondary", fontSize: 14 }}>
        Back to{" "}
        <Box
          component="span"
          role="button"
          onClick={() => navigate("/login")}
          sx={{
            color: "primary.main",
            fontWeight: 800,
            cursor: "pointer",
            "&:hover": { textDecoration: "underline" },
          }}
        >
          Sign in
        </Box>
      </Typography>
    </AuthShell>
  );
}
