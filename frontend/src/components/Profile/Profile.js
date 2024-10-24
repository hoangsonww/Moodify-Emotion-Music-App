import React, { useEffect, useState, useContext } from "react";
import {
  Paper,
  Typography,
  Box,
  CircularProgress,
  Card,
  CardContent,
} from "@mui/material";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { DarkModeContext } from "../../context/DarkModeContext";

const CACHE_KEY = "userProfileCache";

const ProfilePage = () => {
  const [userData, setUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  // Get dark mode state from DarkModeContext
  const { isDarkMode } = useContext(DarkModeContext);

  useEffect(() => {
    if (!token) {
      alert("You are not authenticated. Please log in.");
      navigate("/login");
      return;
    }

    fetchUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUserData = async () => {
    setIsLoading(true);

    try {
      const response = await axios.get(
        "https://moodify-emotion-music-app.onrender.com/users/user/profile/",
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 60000, // 60 seconds timeout
        },
      );

      setUserData(response.data);
      // Remove any existing cached data
      localStorage.removeItem(CACHE_KEY);

      // Cache user profile data
      localStorage.setItem(CACHE_KEY, JSON.stringify(response.data));
      setError(""); // Clear any existing errors
    } catch (error) {
      console.error("Error fetching user data:", error);

      // Use cached data as a fallback
      const cachedUserData = localStorage.getItem(CACHE_KEY);
      if (cachedUserData) {
        setUserData(JSON.parse(cachedUserData));
        console.log(
          "Failed to fetch profile data. Our servers might be down. Please try again later.",
        );
      } else {
        setError(
          "Failed to fetch profile data. Our servers might be down. Please try again later.",
        );
        console.error("No cached profile data available.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const styles = getStyles(isDarkMode); // Dynamically get styles based on dark mode

  return (
    <Box style={styles.container}>
      {isLoading ? (
        <CircularProgress />
      ) : error ? (
        <Typography variant="h6" color="error" style={{ font: "inherit" }}>
          {error}
        </Typography>
      ) : (
        <Paper elevation={4} style={styles.profileContainer}>
          <Typography variant="h5" style={styles.title}>
            Welcome, {userData.username}!
          </Typography>
          <Box style={styles.infoSection}>
            <Typography variant="h6" style={styles.text}>
              Your Username: {userData.username}
            </Typography>
            <Typography variant="h6" style={styles.text}>
              Your Email: {userData.email}
            </Typography>
          </Box>

          <Box sx={styles.section}>
            <Typography variant="h6" style={styles.sectionTitle}>
              Your Listening History
            </Typography>
            {userData.listening_history &&
            userData.listening_history.length > 0 ? (
              userData.listening_history.map((track, index) => (
                <Card key={index} style={styles.card}>
                  <CardContent>
                    <Typography variant="body1" style={styles.text}>
                      {track}
                    </Typography>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Typography variant="body2" style={styles.noData}>
                No listening history available.
              </Typography>
            )}
          </Box>

          <Box sx={styles.section}>
            <Typography variant="h6" style={styles.sectionTitle}>
              Your Mood History
            </Typography>
            {userData.mood_history && userData.mood_history.length > 0 ? (
              userData.mood_history.map((mood, index) => (
                <Card key={index} style={styles.card}>
                  <CardContent>
                    <Typography variant="body1" style={styles.text}>
                      {mood}
                    </Typography>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Typography variant="body2" style={styles.noData}>
                No mood history available.
              </Typography>
            )}
          </Box>

          <Box sx={styles.section}>
            <Typography variant="h6" style={styles.sectionTitle}>
              Your Recommendations History
            </Typography>
            {userData.recommendations && userData.recommendations.length > 0 ? (
              userData.recommendations.map((recommendation, index) => (
                <Card key={index} style={styles.card}>
                  <CardContent>
                    <Typography variant="body1" style={styles.text}>
                      <strong>{recommendation.name}</strong> by{" "}
                      {recommendation.artist}
                    </Typography>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Typography variant="body2" style={styles.noData}>
                No recommendations available.
              </Typography>
            )}
          </Box>
        </Paper>
      )}
    </Box>
  );
};

// Function to dynamically return styles based on dark mode
const getStyles = (isDarkMode) => ({
  container: {
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontFamily: "Poppins, sans-serif",
    padding: "20px",
    backgroundColor: isDarkMode ? "#121212" : "#f5f5f5",
    color: isDarkMode ? "#ffffff" : "#000000",
    transition: "background-color 0.3s ease",
  },
  profileContainer: {
    padding: "30px",
    width: "70%",
    maxHeight: "85vh",
    overflowY: "auto",
    borderRadius: "10px",
    boxShadow: "0px 4px 15px rgba(0, 0, 0, 0.2)",
    backgroundColor: isDarkMode ? "#1f1f1f" : "#ffffff",
    textAlign: "center",
    transition: "background-color 0.3s ease",
  },
  title: {
    marginBottom: "20px",
    fontFamily: "Poppins, sans-serif",
    color: isDarkMode ? "#ffffff" : "#333",
  },
  infoSection: {
    marginBottom: "20px",
    backgroundColor: isDarkMode ? "#333333" : "#fafafa",
    padding: "10px",
    borderRadius: "8px",
    boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.05)",
    transition: "all 0.3s ease",
    color: isDarkMode ? "#ffffff" : "#000000",
  },
  section: {
    marginTop: "15px",
    textAlign: "left",
    padding: "10px",
    color: isDarkMode ? "#ffffff" : "#000000",
  },
  sectionTitle: {
    textDecoration: "underline",
    font: "inherit",
    marginBottom: "10px",
    color: isDarkMode ? "#bbbbbb" : "#555",
    fontWeight: 500,
  },
  card: {
    marginBottom: "10px",
    borderRadius: "8px",
    boxShadow: "0px 2px 10px rgba(0, 0, 0, 0.1)",
    padding: "10px",
    backgroundColor: isDarkMode ? "#333333" : "#ffffff",
    transition: "transform 0.3s ease, box-shadow 0.3s ease",
    cursor: "pointer",
    "&:hover": {
      transform: "scale(1.02)",
      boxShadow: "0px 4px 15px rgba(0, 0, 0, 0.2)",
    },
    color: isDarkMode ? "#ffffff" : "#000000",
  },
  text: {
    font: "inherit",
    color: isDarkMode ? "#cccccc" : "#000000",
  },
  noData: {
    color: isDarkMode ? "#bbbbbb" : "#999",
    font: "inherit",
  },
});

export default ProfilePage;
