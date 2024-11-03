import React, { useState, useContext } from "react";
import {
  Button,
  TextField,
  Typography,
  Paper,
  CircularProgress,
  IconButton,
  InputAdornment,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { DarkModeContext } from "../context/DarkModeContext";

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

  const { isDarkMode } = useContext(DarkModeContext); // Use DarkModeContext

  const handleVerify = async () => {
    if (!username || !email) {
      alert("Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        "https://moodify-emotion-music-app.onrender.com/users/verify-username-email/",
        { username, email },
      );
      if (response.status === 200) {
        setStep(2); // Move to the next step (reset password)
      }
    } catch (error) {
      alert("Verification failed. Please check your details.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      alert("Please fill in all fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        "https://moodify-emotion-music-app.onrender.com/users/reset-password/",
        { username, new_password: newPassword },
      );
      if (response.status === 200) {
        alert("Password reset successfully!");
        navigate("/login");
      }
    } catch (error) {
      alert("Failed to reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Function to handle "Enter" key press for form submission
  const handleKeyPress = (event) => {
    if (event.key === "Enter") {
      step === 1 ? handleVerify() : handleResetPassword();
    }
  };

  const handleToggleNewPasswordVisibility = () => {
    setShowNewPassword((prev) => !prev);
  };

  const handleToggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword((prev) => !prev);
  };

  return (
    <div
      style={{
        ...styles.container,
        backgroundColor: isDarkMode ? "#121212" : "#f9f9f9", // Dark mode background
        color: isDarkMode ? "#ffffff" : "#000000", // Dark mode text color
      }}
    >
      <Paper
        elevation={4}
        style={{
          ...styles.formContainer,
          backgroundColor: isDarkMode ? "#1f1f1f" : "white", // Dark mode form container
          color: isDarkMode ? "#ffffff" : "#000000", // Dark mode text color
        }}
      >
        {step === 1 ? (
          <>
            <Typography
              variant="h4"
              align="center"
              sx={{
                mb: 3,
                fontFamily: "Poppins",
                color: isDarkMode ? "#ffffff" : "#000000",
              }} // Dynamic color
            >
              Verify Account
            </Typography>
            <TextField
              label="Username"
              variant="outlined"
              fullWidth
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={handleKeyPress} // Add key press handler
              sx={{ mb: 2 }}
              InputProps={{
                style: {
                  fontFamily: "Poppins",
                  fontSize: "16px",
                  color: isDarkMode ? "#ffffff" : "#000000", // Dark mode text color
                },
              }}
              InputLabelProps={{
                style: {
                  fontFamily: "Poppins",
                  color: isDarkMode ? "#ffffff" : "#000000", // Dark mode label color
                },
              }}
            />
            <TextField
              label="Email"
              variant="outlined"
              fullWidth
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyPress={handleKeyPress} // Add key press handler
              sx={{ mb: 2 }}
              InputProps={{
                style: {
                  fontFamily: "Poppins",
                  fontSize: "16px",
                  color: isDarkMode ? "#ffffff" : "#000000", // Dark mode text color
                },
              }}
              InputLabelProps={{
                style: {
                  fontFamily: "Poppins",
                  color: isDarkMode ? "#ffffff" : "#000000", // Dark mode label color
                },
              }}
            />
            <Button
              variant="contained"
              color="secondary"
              fullWidth
              onClick={handleVerify}
              sx={{ mb: 2, backgroundColor: "#ff4d4d", font: "inherit" }}
              disabled={loading}
            >
              {loading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                "Verify"
              )}
            </Button>
          </>
        ) : (
          <>
            <Typography
              variant="h4"
              align="center"
              sx={{
                mb: 3,
                fontFamily: "Poppins",
                color: isDarkMode ? "#ffffff" : "#000000",
              }} // Dynamic color
            >
              Reset Password
            </Typography>
            <TextField
              label="New Password"
              type={showNewPassword ? "text" : "password"}
              variant="outlined"
              fullWidth
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              onKeyPress={handleKeyPress} // Add key press handler
              sx={{ mb: 2 }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle new password visibility"
                      onClick={handleToggleNewPasswordVisibility}
                      edge="end"
                      sx={{ color: isDarkMode ? "white" : "#333" }}
                    >
                      {showNewPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
                style: {
                  fontFamily: "Poppins",
                  fontSize: "16px",
                  color: isDarkMode ? "#ffffff" : "#000000", // Dark mode text color
                },
              }}
              InputLabelProps={{
                style: {
                  fontFamily: "Poppins",
                  color: isDarkMode ? "#ffffff" : "#000000", // Dark mode label color
                },
              }}
            />
            <TextField
              label="Confirm Password"
              type={showConfirmPassword ? "text" : "password"}
              variant="outlined"
              fullWidth
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyPress={handleKeyPress} // Add key press handler
              sx={{ mb: 2 }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle confirm password visibility"
                      onClick={handleToggleConfirmPasswordVisibility}
                      edge="end"
                      sx={{ color: isDarkMode ? "white" : "#333" }}
                    >
                      {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
                style: {
                  fontFamily: "Poppins",
                  fontSize: "16px",
                  color: isDarkMode ? "#ffffff" : "#000000", // Dark mode text color
                },
              }}
              InputLabelProps={{
                style: {
                  fontFamily: "Poppins",
                  color: isDarkMode ? "#ffffff" : "#000000", // Dark mode label color
                },
              }}
            />
            <Button
              variant="contained"
              color="secondary"
              fullWidth
              onClick={handleResetPassword}
              sx={{ mb: 2, backgroundColor: "#ff4d4d", font: "inherit" }}
              disabled={loading}
            >
              {loading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                "Reset Password"
              )}
            </Button>
          </>
        )}
        <Typography
          variant="body2"
          align="center"
          sx={{
            cursor: "pointer",
            textDecoration: "underline",
            fontFamily: "Poppins",
            "&:hover": {
              color: "#ff4d4d",
              transition: "color 0.2s",
            },
          }}
          onClick={() => navigate("/login")}
        >
          Back to Login
        </Typography>
      </Paper>
    </div>
  );
};

const styles = {
  container: {
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    transition: "background-color 0.3s ease",
  },
  formContainer: {
    padding: "30px",
    width: "350px",
    borderRadius: "10px",
    boxShadow: "0px 4px 15px rgba(0, 0, 0, 0.2)",
    transition: "background-color 0.3s ease",
  },
};

export default ForgotPassword;
