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
  AlternateEmail,
  LockOutlined,
  PersonOutline,
  Visibility,
  VisibilityOff,
  MusicNote,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import { DarkModeContext } from "../../context/DarkModeContext";
import { useToast } from "../Toast";
import { API_URL } from "../../config";

const Register = () => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const { isDarkMode } = useContext(DarkModeContext);
  const styles = getStyles(isDarkMode);

  const handleRegister = async () => {
    if (!username || !email || !password || !confirmPassword) {
      toast.warning("Please fill in every field.");
      return;
    }
    if (password.length < 8) {
      toast.warning("Use at least 8 characters for your password.");
      return;
    }
    if (password !== confirmPassword) {
      toast.warning("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/users/register/`, {
        username,
        email,
        password,
      });
      if (response.status === 201) {
        toast.success("Account created - please sign in.");
        navigate("/login");
      } else {
        toast.error("Registration didn't go through. Try again.");
      }
    } catch (error) {
      const status = error?.response?.status;
      toast.error(
        status === 409 || /already/i.test(error?.response?.data?.error || "")
          ? "That username or email is already taken."
          : error?.response?.data?.error ||
              "Registration failed due to a server error. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (event) => {
    if (event.key === "Enter") handleRegister();
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
            Create an account in seconds.
          </Typography>
        </Box>

        <Box sx={styles.body}>
          <Typography variant="h5" sx={styles.title}>
            Get started
          </Typography>
          <Typography sx={styles.subtitle}>
            One account, three ways to detect a mood.
          </Typography>

          <TextField
            label="Username"
            variant="outlined"
            fullWidth
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyPress={handleKeyPress}
            autoComplete="username"
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
            label="Email"
            type="email"
            variant="outlined"
            fullWidth
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyPress={handleKeyPress}
            autoComplete="email"
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <AlternateEmail
                    sx={{ color: isDarkMode ? "#bbb" : "#666" }}
                  />
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
            autoComplete="new-password"
            helperText="At least 8 characters."
            sx={{ mb: 2 }}
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
            FormHelperTextProps={{
              sx: {
                fontFamily: "Poppins",
                color: isDarkMode ? "#888" : "#666",
                ml: 0,
              },
            }}
          />

          <TextField
            label="Confirm password"
            type={showConfirmPassword ? "text" : "password"}
            variant="outlined"
            fullWidth
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyPress={handleKeyPress}
            autoComplete="new-password"
            sx={{ mb: 3 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockOutlined sx={{ color: isDarkMode ? "#bbb" : "#666" }} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle confirm password visibility"
                    onClick={() => setShowConfirmPassword((p) => !p)}
                    edge="end"
                    sx={{ color: isDarkMode ? "#fff" : "#333" }}
                  >
                    {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
              style: styles.inputText,
            }}
            InputLabelProps={{ style: styles.inputLabel }}
          />

          <Button
            variant="contained"
            fullWidth
            onClick={handleRegister}
            disabled={loading}
            sx={styles.cta}
          >
            {loading ? (
              <CircularProgress size={22} sx={{ color: "#fff" }} />
            ) : (
              "Create account"
            )}
          </Button>

          <Typography sx={styles.footer}>
            Already have an account?{" "}
            <Box
              component="span"
              onClick={() => navigate("/login")}
              sx={styles.footerLink}
            >
              Sign in
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
    maxWidth: 460,
    borderRadius: "18px",
    overflow: "hidden",
    boxShadow: isDark
      ? "0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,77,77,0.18)"
      : "0 18px 48px rgba(255,77,77,0.18), 0 0 0 1px rgba(0,0,0,0.04)",
    backgroundColor: isDark ? "#1f1f1f" : "#ffffff",
    color: isDark ? "#ffffff" : "#000000",
    transition: "background-color 0.3s ease, color 0.3s ease",
    // Force the OutlinedInput AND the inner <input> element to be fully
    // transparent so the field's inside matches the card's outside.
    "& .MuiOutlinedInput-root, & .MuiOutlinedInput-root.Mui-focused, & .MuiOutlinedInput-root:hover":
      {
        backgroundColor: "transparent !important",
        boxShadow: "none !important",
      },
    "& .MuiInputBase-root, & .MuiInputBase-input, & .MuiOutlinedInput-input": {
      backgroundColor: "transparent !important",
      boxShadow: "none !important",
      WebkitAppearance: "none",
      appearance: "none",
    },
    // Defeat Chrome / Edge autofill background tint.
    "& input:-webkit-autofill, & input:-webkit-autofill:hover, & input:-webkit-autofill:focus, & input:-webkit-autofill:active":
      {
        WebkitBoxShadow: `0 0 0 1000px ${isDark ? "#1f1f1f" : "#ffffff"} inset !important`,
        WebkitTextFillColor: `${isDark ? "#ffffff" : "#000000"} !important`,
        caretColor: isDark ? "#ffffff" : "#000000",
        transition: "background-color 5000s ease-in-out 0s",
      },
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

export default Register;
