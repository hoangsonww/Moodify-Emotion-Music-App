import React, { useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import { API_URL } from "../../config";
import { setTokens } from "../../services/auth";
import { AuthShell } from "./Login";

export default function Register() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async (event) => {
    if (event) event.preventDefault();
    setError("");

    if (!username.trim() || !email.trim() || !password) {
      setError("Please fill in every field.");
      return;
    }
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
      const register = await axios.post(`${API_URL}/users/register/`, {
        username: username.trim(),
        email: email.trim(),
        password,
      });

      if (register.status === 201) {
        // Auto sign-in: register + immediately log in for a smoother first run.
        try {
          const { data } = await axios.post(`${API_URL}/users/login/`, {
            username: username.trim(),
            password,
          });
          if (data?.access) {
            setTokens(data.access, data.refresh);
            navigate("/home", { replace: true });
            return;
          }
        } catch {
          // Fall through to the manual sign-in path.
        }
        navigate("/login", { replace: true });
      } else {
        setError("Registration failed. Please try again.");
      }
    } catch (err) {
      const status = err?.response?.status;
      setError(
        status === 409 || /already/i.test(err?.response?.data?.error || "")
          ? "That username or email is already taken."
          : err?.response?.data?.error ||
              "Registration failed. Please try again shortly.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      sub="Start getting music tuned to how you feel."
      eyebrow="Sign up"
    >
      <Box component="form" onSubmit={handleRegister} noValidate>
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
          sx={{ mb: 2 }}
        />
        <TextField
          label="Email"
          type="email"
          fullWidth
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          sx={{ mb: 2 }}
        />
        <TextField
          label="Password"
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
          helperText="At least 8 characters."
        />
        <TextField
          label="Confirm password"
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
          {loading ? <CircularProgress size={22} sx={{ color: "#fff" }} /> : "Create account"}
        </Button>

        <Typography sx={{ textAlign: "center", color: "text.secondary", fontSize: 14 }}>
          Already have an account?{" "}
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
      </Box>
    </AuthShell>
  );
}
