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

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!username || !password) {
      alert("Please fill in all fields");
      return;
    }

    setLoading(true); // Set loading to true when login starts

    try {
      // Make the login request
      const response = await axios.post(
        "https://moodify-emotion-music-app.onrender.com/users/login/",
        { username, password },
      );
      const { access } = response.data; // Extract the access token from the response

      if (access) {
        // Store the access token in localStorage
        localStorage.setItem("token", access);
        alert("Login successful!");

        // Redirect to the home page
        navigate("/home");
      } else {
        alert("Login failed. No access token received.");
      }
    } catch (error) {
      console.error("Login failed:", error);
      alert("Login failed. Please check your credentials.");
    } finally {
      setLoading(false); // Reset loading state when login process finishes
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
          Login
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
        <Button
          variant="contained"
          color="secondary"
          fullWidth
          onClick={handleLogin}
          sx={{ mb: 2, backgroundColor: "#ff4d4d", font: "inherit" }}
          disabled={loading} // Disable the button while loading
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : "Login"}{" "}
          {/* Show spinner or "Login" */}
        </Button>
        <Typography
          variant="body2"
          align="center"
          sx={{
            cursor: "pointer",
            textDecoration: "underline",
            fontFamily: "Poppins",
          }}
          onClick={() => navigate("/register")}
        >
          Don't have an account? Register
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

export default Login;
