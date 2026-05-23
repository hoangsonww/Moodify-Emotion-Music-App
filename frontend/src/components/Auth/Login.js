import React, { useState, useContext } from "react";
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Paper,
  TextField,
  Typography,
} from "@mui/material";
import {
  LockOutlined,
  PersonOutline,
  Visibility,
  VisibilityOff,
  MusicNote,
} from "@mui/icons-material";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

import { DarkModeContext } from "../../context/DarkModeContext";
import { useToast } from "../Toast";
import { API_URL } from "../../config";
import { setTokens } from "../../services/auth";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const { isDarkMode } = useContext(DarkModeContext);
  const styles = getStyles(isDarkMode);

  // If RequireAuth bounced the user here, send them back to where they
  // were trying to go after a successful sign-in.
  const redirectTo = location.state?.from?.pathname || "/home";

  const handleLogin = async () => {
    if (!username || !password) {
      toast.warning("Please fill in both your username and password.");
      return;
    }
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/users/login/`, {
        username,
        password,
      });
      const { access, refresh } = response.data;
      if (access) {
        setTokens(access, refresh);
        toast.success("Welcome back!");
        navigate(redirectTo, { replace: true });
      } else {
        toast.error("Login failed. Please check your credentials.");
      }
    } catch (error) {
      const status = error?.response?.status;
      toast.error(
        status === 401
          ? "Invalid username or password."
          : "Login failed. Our servers may be having a moment — try again shortly.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (event) => {
    if (event.key === "Enter") handleLogin();
  };

  return (
    <div style={styles.container}>
      <Paper elevation={6} sx={styles.formContainer}>
        {/* Brand hero strip */}
        <Box sx={styles.heroStrip}>
          <Box sx={styles.heroMark}>
            <MusicNote sx={{ color: "#fff", fontSize: 28 }} />
          </Box>
          <Typography sx={styles.heroBrand}>Moodify</Typography>
          <Typography sx={styles.heroTag}>
            Music tuned to how you feel.
          </Typography>
        </Box>

        <Box sx={styles.body}>
          <Typography variant="h5" sx={styles.title}>
            Welcome back
          </Typography>
          <Typography sx={styles.subtitle}>
            Sign in to pick up where your mood left off.
          </Typography>

          <TextField
            label="Username"
            variant="outlined"
            fullWidth
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyPress={handleKeyPress}
            autoComplete="username"
            autoFocus
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PersonOutline sx={{ color: isDarkMode ? "#bbb" : "#666" }} />
                </InputAdornment>
              ),
              style: styles.inputText,
            }}
            InputLabelProps={{ style: styles.inputLabel }}
          />

          <TextField
            label="Password"
            type={showPassword ? "text" : "password"}
            variant="outlined"
            fullWidth
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={handleKeyPress}
            autoComplete="current-password"
            sx={{ mb: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockOutlined sx={{ color: isDarkMode ? "#bbb" : "#666" }} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={() => setShowPassword((p) => !p)}
                    edge="end"
                    sx={{ color: isDarkMode ? "#fff" : "#333" }}
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
              style: styles.inputText,
            }}
            InputLabelProps={{ style: styles.inputLabel }}
          />

          <Box sx={styles.forgotRow}>
            <Typography
              onClick={() => navigate("/forgot-password")}
              sx={styles.forgotLink}
            >
              Forgot password?
            </Typography>
          </Box>

          <Button
            variant="contained"
            fullWidth
            onClick={handleLogin}
            disabled={loading}
            sx={styles.cta}
          >
            {loading ? (
              <CircularProgress size={22} sx={{ color: "#fff" }} />
            ) : (
              "Sign in"
            )}
          </Button>

          <Typography sx={styles.footer}>
            New to Moodify?{" "}
            <Box
              component="span"
              onClick={() => navigate("/register")}
              sx={styles.footerLink}
            >
              Create an account
            </Box>
          </Typography>
        </Box>
      </Paper>
    </div>
  );
};

const getStyles = (isDark) => ({
  container: {
    minHeight: "calc(100vh - 80px)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "24px",
    backgroundColor: isDark ? "#121212" : "#f9f9f9",
    backgroundImage: isDark
      ? "radial-gradient(60% 50% at 20% 0%, rgba(255,77,77,0.10) 0%, transparent 60%), radial-gradient(50% 50% at 85% 100%, rgba(255,77,77,0.07) 0%, transparent 60%)"
      : "radial-gradient(60% 50% at 20% 0%, rgba(255,77,77,0.10) 0%, transparent 60%), radial-gradient(50% 50% at 85% 100%, rgba(255,77,77,0.06) 0%, transparent 60%)",
    transition: "background-color 0.3s ease, color 0.3s ease",
  },
  formContainer: {
    width: "100%",
    maxWidth: 420,
    borderRadius: "18px",
    overflow: "hidden",
    boxShadow: isDark
      ? "0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,77,77,0.18)"
      : "0 18px 48px rgba(255,77,77,0.18), 0 0 0 1px rgba(0,0,0,0.04)",
    backgroundColor: isDark ? "#1f1f1f" : "#ffffff",
    color: isDark ? "#ffffff" : "#000000",
    transition: "background-color 0.3s ease, color 0.3s ease",
  },
  heroStrip: {
    padding: "28px 32px 24px",
    background: "linear-gradient(135deg, #ff4d4d 0%, #ff7a59 100%)",
    color: "#fff",
    position: "relative",
    overflow: "hidden",
    "&::after": {
      content: '""',
      position: "absolute",
      inset: 0,
      background:
        "radial-gradient(70% 70% at 0% 0%, rgba(255,255,255,0.22) 0%, transparent 60%)",
      pointerEvents: "none",
    },
  },
  heroMark: {
    width: 48,
    height: 48,
    borderRadius: "14px",
    background: "rgba(255,255,255,0.2)",
    backdropFilter: "blur(6px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    mb: 1.5,
    boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
    position: "relative",
    zIndex: 1,
  },
  heroBrand: {
    fontFamily: "Poppins",
    fontWeight: 800,
    fontSize: 22,
    letterSpacing: "-0.02em",
    position: "relative",
    zIndex: 1,
  },
  heroTag: {
    fontFamily: "Poppins",
    fontSize: 13,
    opacity: 0.92,
    mt: 0.25,
    position: "relative",
    zIndex: 1,
  },
  body: { padding: "28px 32px 32px" },
  title: {
    fontFamily: "Poppins",
    fontWeight: 800,
    color: isDark ? "#fff" : "#1a1a1a",
    letterSpacing: "-0.02em",
    mb: 0.5,
  },
  subtitle: {
    fontFamily: "Poppins",
    fontSize: 14,
    color: isDark ? "#bbb" : "#666",
    mb: 3,
  },
  inputText: {
    fontFamily: "Poppins",
    fontSize: 15,
    color: isDark ? "#ffffff" : "#000000",
  },
  inputLabel: {
    fontFamily: "Poppins",
    color: isDark ? "#cccccc" : "#666",
  },
  forgotRow: {
    display: "flex",
    justifyContent: "flex-end",
    mb: 2,
  },
  forgotLink: {
    fontFamily: "Poppins",
    fontSize: 13,
    fontWeight: 600,
    color: isDark ? "#ff7a7a" : "#ff4d4d",
    cursor: "pointer",
    "&:hover": { textDecoration: "underline" },
  },
  cta: {
    py: 1.5,
    borderRadius: "999px",
    fontFamily: "Poppins",
    fontSize: 15,
    fontWeight: 700,
    textTransform: "none",
    color: "#fff",
    background: "linear-gradient(135deg, #ff4d4d 0%, #ff6b6b 100%)",
    boxShadow: "0 10px 24px rgba(255,77,77,0.35)",
    transition: "transform .2s ease, box-shadow .2s ease",
    "&:hover": {
      background: "linear-gradient(135deg, #ff5e5e 0%, #ff7d7d 100%)",
      boxShadow: "0 14px 30px rgba(255,77,77,0.45)",
      transform: "translateY(-1px)",
    },
    mb: 2,
  },
  footer: {
    fontFamily: "Poppins",
    fontSize: 14,
    textAlign: "center",
    color: isDark ? "#bbb" : "#555",
  },
  footerLink: {
    fontFamily: "Poppins",
    fontWeight: 700,
    color: isDark ? "#ff7a7a" : "#ff4d4d",
    cursor: "pointer",
    "&:hover": { textDecoration: "underline" },
  },
});

export default Login;
