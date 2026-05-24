import React, { useState, useContext } from "react";
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  AlternateEmail,
  Key,
  LockOutlined,
  PersonOutline,
  ShieldOutlined,
  Visibility,
  VisibilityOff,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import axios from "axios";

import { DarkModeContext } from "../context/DarkModeContext";
import { useToast } from "../components/Toast";
import { API_URL } from "../config";

const ForgotPassword = () => {
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const { isDarkMode } = useContext(DarkModeContext);
  const styles = getStyles(isDarkMode);

  const handleVerify = async () => {
    if (!username || !email) {
      toast.warning("Enter your username and email to continue.");
      return;
    }
    setLoading(true);
    try {
      const response = await axios.post(
        `${API_URL}/users/verify-username-email/`,
        { username, email },
      );
      if (response.status === 200) {
        toast.success("Verified - pick a new password.");
        setStep(2);
      }
    } catch (error) {
      toast.error(
        error?.response?.status === 404
          ? "We couldn't find that username and email combination."
          : "Verification failed. Try again shortly.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.warning("Fill in both password fields.");
      return;
    }
    if (newPassword.length < 8) {
      toast.warning("Use at least 8 characters for your password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.warning("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/users/reset-password/`, {
        username,
        new_password: newPassword,
      });
      if (response.status === 200) {
        toast.success("Password updated - sign in to continue.");
        setTimeout(() => navigate("/login"), 700);
      }
    } catch (error) {
      toast.error("Failed to reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (event) => {
    if (event.key === "Enter") {
      step === 1 ? handleVerify() : handleResetPassword();
    }
  };

  const HeroIcon = step === 1 ? ShieldOutlined : Key;
  const subHeading =
    step === 1
      ? "Confirm your username and email to continue."
      : "Choose a new password (at least 8 characters).";

  return (
    <div style={styles.container}>
      <Paper elevation={6} sx={styles.formContainer}>
        {/* Hero strip with step indicator */}
        <Box sx={styles.heroStrip}>
          <Box sx={styles.heroMark}>
            <HeroIcon sx={{ color: "#fff", fontSize: 28 }} />
          </Box>
          <Typography sx={styles.heroBrand}>Reset your password</Typography>
          <Typography sx={styles.heroTag}>
            Step {step} of 2 - {step === 1 ? "verify" : "set new password"}
          </Typography>

          <Box sx={{ mt: 2, position: "relative", zIndex: 1 }}>
            <LinearProgress
              variant="determinate"
              value={step === 1 ? 50 : 100}
              sx={{
                height: 6,
                borderRadius: 999,
                background: "rgba(255,255,255,0.25)",
                "& .MuiLinearProgress-bar": {
                  background: "#ffffff",
                  borderRadius: 999,
                },
              }}
            />
            <Stack
              direction="row"
              justifyContent="space-between"
              sx={{ mt: 0.75 }}
            >
              <Typography sx={styles.stepLabel}>Verify</Typography>
              <Typography sx={styles.stepLabel}>Reset</Typography>
            </Stack>
          </Box>
        </Box>

        <Box sx={styles.body}>
          <Typography sx={styles.subtitle}>{subHeading}</Typography>

          {step === 1 ? (
            <>
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
                      <PersonOutline
                        sx={{ color: isDarkMode ? "#bbb" : "#666" }}
                      />
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
                sx={{ mb: 3 }}
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
              <Button
                variant="contained"
                fullWidth
                onClick={handleVerify}
                disabled={loading}
                sx={styles.cta}
              >
                {loading ? (
                  <CircularProgress size={22} sx={{ color: "#fff" }} />
                ) : (
                  "Verify"
                )}
              </Button>
            </>
          ) : (
            <>
              <TextField
                label="New password"
                type={showNewPassword ? "text" : "password"}
                variant="outlined"
                fullWidth
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                onKeyPress={handleKeyPress}
                autoComplete="new-password"
                autoFocus
                sx={{ mb: 2 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockOutlined
                        sx={{ color: isDarkMode ? "#bbb" : "#666" }}
                      />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle new password visibility"
                        onClick={() => setShowNewPassword((p) => !p)}
                        edge="end"
                        sx={{ color: isDarkMode ? "#fff" : "#333" }}
                      >
                        {showNewPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                  style: styles.inputText,
                }}
                InputLabelProps={{ style: styles.inputLabel }}
              />
              <TextField
                label="Confirm new password"
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
                      <LockOutlined
                        sx={{ color: isDarkMode ? "#bbb" : "#666" }}
                      />
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
                        {showConfirmPassword ? (
                          <VisibilityOff />
                        ) : (
                          <Visibility />
                        )}
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
                onClick={handleResetPassword}
                disabled={loading}
                sx={styles.cta}
              >
                {loading ? (
                  <CircularProgress size={22} sx={{ color: "#fff" }} />
                ) : (
                  "Update password"
                )}
              </Button>
            </>
          )}

          <Typography sx={styles.footer}>
            Back to{" "}
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
  stepLabel: {
    fontFamily: "Poppins",
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    opacity: 0.9,
  },
  body: { padding: "28px 32px 32px" },
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

export default ForgotPassword;
