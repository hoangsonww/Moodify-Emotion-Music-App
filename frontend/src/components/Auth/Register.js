import React, { useState } from "react";
import {Button, TextField, Typography, Paper, CircularProgress} from "@mui/material";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const Register = () => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async () => {
    setLoading(true);

    if (!username || !email || !password || !confirmPassword) {
      alert("Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    try {
      // Sending username, email, and password to the backend
      const response = await axios.post(
        "https://moodify-emotion-music-app.onrender.com/users/register/",
        {
          username,
          email,
          password,
        },
      );

      if (response.status === 201) {
        alert("Registration successful! Please log in.");
        navigate("/login"); // Redirect to the login page
      }

      setLoading(false);
    } catch (error) {
      console.error("Registration failed:", error);
      alert(
        error.response?.data?.error || "Registration failed due to internal server error. Please try again later.",
      );

      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <Paper elevation={4} style={styles.formContainer}>
        <Typography
          variant="h4"
          align="center"
          sx={{ mb: 3, fontFamily: "Poppins" }}
        >
          Register
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
        <TextField
          label="Password"
          type="password"
          variant="outlined"
          fullWidth
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
          color="primary"
          fullWidth
          onClick={handleRegister}
          sx={{ mb: 2, backgroundColor: "#ff4d4d", font: "inherit" }}
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : "Register"}
        </Button>
        <Typography
          variant="body2"
          align="center"
          sx={{
            cursor: "pointer",
            textDecoration: "underline",
            fontFamily: "Poppins",
            '&:hover': {
              color: "#ff4d4d",
              transition: "color 0.2s",
            }
          }}
          onClick={() => navigate("/login")}
        >
          Already have an account? Login
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

export default Register;
