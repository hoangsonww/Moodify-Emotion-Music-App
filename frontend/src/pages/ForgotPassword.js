import React, { useState } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  CircularProgress,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const ForgotPassword = () => {
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleVerify = async () => {
    if (!username || !email) {
      alert("Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        "http://127.0.0.1:8000/users/verify-username-email/",
        { username, email }
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
        "http://127.0.0.1:8000/users/reset-password/",
        { username, new_password: newPassword }
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

  return (
    <div style={styles.container}>
      <Paper elevation={4} style={styles.formContainer}>
        {step === 1 ? (
          <>
            <Typography
              variant="h4"
              align="center"
              sx={{ mb: 3, fontFamily: "Poppins" }}
            >
              Verify Account
            </Typography>
            <TextField
              label="Username"
              variant="outlined"
              fullWidth
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              sx={{ mb: 2 }}
              InputProps={{
                style: { fontFamily: "Poppins", fontSize: "16px" },
              }}
              InputLabelProps={{
                style: { fontFamily: "Poppins" },
              }}
            />
            <TextField
              label="Email"
              variant="outlined"
              fullWidth
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              sx={{ mb: 2 }}
              InputProps={{
                style: { fontFamily: "Poppins", fontSize: "16px" },
              }}
              InputLabelProps={{
                style: { fontFamily: "Poppins" },
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
              {loading ? <CircularProgress size={24} color="inherit" /> : "Verify"}
            </Button>
          </>
        ) : (
          <>
            <Typography
              variant="h4"
              align="center"
              sx={{ mb: 3, fontFamily: "Poppins" }}
            >
              Reset Password
            </Typography>
            <TextField
              label="New Password"
              type="password"
              variant="outlined"
              fullWidth
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              sx={{ mb: 2 }}
              InputProps={{
                style: { fontFamily: "Poppins", fontSize: "16px" },
              }}
              InputLabelProps={{
                style: { fontFamily: "Poppins" },
              }}
            />
            <TextField
              label="Confirm Password"
              type="password"
              variant="outlined"
              fullWidth
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              sx={{ mb: 2 }}
              InputProps={{
                style: { fontFamily: "Poppins", fontSize: "16px" },
              }}
              InputLabelProps={{
                style: { fontFamily: "Poppins" },
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
    backgroundColor: "#f9f9f9",
  },
  formContainer: {
    padding: "30px",
    width: "350px",
    borderRadius: "10px",
    boxShadow: "0px 4px 15px rgba(0, 0, 0, 0.2)",
    backgroundColor: "white",
  },
};

export default ForgotPassword;
