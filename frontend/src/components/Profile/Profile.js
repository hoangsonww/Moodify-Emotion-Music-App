import React, { useEffect, useState, useContext } from "react";
import {
  Paper,
  Typography,
  Box,
  CircularProgress,
  Card,
  CardContent,
  Button,
  Avatar,
} from "@mui/material";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { DarkModeContext } from "../../context/DarkModeContext";

const CACHE_KEY = "userProfileCache";

const timeout = (ms) => {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Request timed out")), ms),
  );
};

const ProfilePage = () => {
  const [userData, setUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadingText, setLoadingText] = useState("Loading...");
  const [randomImage, setRandomImage] = useState("");
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const placeholderImages = [
    require("../../assets/images/profile.webp"),
    require("../../assets/images/OIP.jpg"),
    require("../../assets/images/OIP2.webp"),
    require("../../assets/images/OIP3.png"),
    require("../../assets/images/OIP4.png"),
    require("../../assets/images/OIP5.png"),
    require("../../assets/images/OIP6.webp"),
    require("../../assets/images/OIP7.webp"),
    require("../../assets/images/OIP8.webp"),
    require("../../assets/images/OIP9.webp"),
    require("../../assets/images/OIP10.webp"),
    require("../../assets/images/OIP11.webp"),
    require("../../assets/images/OIP12.webp"),
    require("../../assets/images/OIP13.webp"),
    require("../../assets/images/OIP14.webp"),
    require("../../assets/images/OIP15.webp"),
    require("../../assets/images/OIP16.webp"),
    require("../../assets/images/OIP17.webp"),
    require("../../assets/images/OIP18.webp"),
    require("../../assets/images/OIP19.webp"),
    require("../../assets/images/OIP20.webp"),
  ];

  useEffect(() => {
    // Randomly select an image on component mount
    setRandomImage(
      placeholderImages[Math.floor(Math.random() * placeholderImages.length)],
    );

    if (!token) {
      alert("You are not authenticated. Please log in.");
      navigate("/login");
      return;
    }

    fetchUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Get dark mode state from DarkModeContext
  const { isDarkMode } = useContext(DarkModeContext);

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

  const handleMoodClick = async (mood) => {
    try {
      setLoadingText(`Fetching recommendations for "${mood}"...`);
      setIsLoading(true);
      const response = await Promise.race([
        axios.post(
          "https://moodify-emotion-music-app.onrender.com/api/music_recommendation/",
          { emotion: mood.toLowerCase() }, // Pass the mood as a parameter
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        ),
        timeout(60000),
      ]);

      const { emotion, recommendations } = response.data;
      navigate("/results", { state: { emotion, recommendations } });
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      alert("Failed to fetch recommendations. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  const styles = getStyles(isDarkMode); // Dynamically get styles based on dark mode

  return (
    <Box style={styles.container}>
      {isLoading && (
        <Box sx={styles.loadingOverlay}>
          <CircularProgress sx={{ color: "#ff4d4d" }} />
          <Typography
            variant="h6"
            style={{ marginTop: "10px", color: "white", font: "inherit" }}
          >
            {loadingText}
          </Typography>
          <Typography
            variant="h6"
            style={{
              marginTop: "10px",
              color: "white",
              font: "inherit",
              textAlign: "center",
              fontSize: "14px",
              padding: "0 2rem",
            }}
          >
            Note that our servers might be slow or experience downtime due to
            high traffic, or they may spin down after periods of inactivity. It
            may take up to 2 minutes to process during these times. We
            appreciate your patience, and apologize for any inconvenience.
          </Typography>
        </Box>
      )}

      {isLoading ? null : error ? (
        <Typography variant="h6" color="error" style={{ font: "inherit" }}>
          {error}
        </Typography>
      ) : (
        <Paper elevation={4} style={styles.profileContainer}>
          <Typography variant="h5" style={styles.title}>
            Welcome, {userData.username}!
          </Typography>
          <Box style={styles.infoSection}>
            <Avatar
              alt="User Avatar"
              src={randomImage}
              sx={{
                width: 100,
                height: 100,
                border: "4px solid #ff4d4d",
                margin: "0 auto",
                marginBottom: "20px",
              }}
            />
            <Typography variant="h6" style={styles.text}>
              Your Username: {userData.username}
            </Typography>
            <Typography variant="h6" style={styles.text}>
              Your Email: {userData.email}
            </Typography>
          </Box>

          {/*<Box sx={styles.section}>*/}
          {/*  <Typography variant="h6" style={styles.sectionTitle}>*/}
          {/*    Your Listening History*/}
          {/*  </Typography>*/}
          {/*  {userData.listening_history && userData.listening_history.length > 0 ? (*/}
          {/*    userData.listening_history.map((track, index) => (*/}
          {/*      <Card key={index} style={styles.card}>*/}
          {/*        <CardContent>*/}
          {/*          <Typography variant="body1" style={styles.text}>*/}
          {/*            {track}*/}
          {/*          </Typography>*/}
          {/*        </CardContent>*/}
          {/*      </Card>*/}
          {/*    ))*/}
          {/*  ) : (*/}
          {/*    <Typography variant="body2" style={styles.noData}>*/}
          {/*      No listening history available.*/}
          {/*    </Typography>*/}
          {/*  )}*/}
          {/*</Box>*/}

          <Box sx={styles.section}>
            <Typography variant="h6" style={styles.sectionTitle}>
              Your Mood History
            </Typography>
            {userData.mood_history && userData.mood_history.length > 0 ? (
              userData.mood_history.map((mood, index) => (
                <Card
                  key={index}
                  style={styles.moodCard}
                  onClick={() => handleMoodClick(mood)} // Redirect on click
                >
                  <CardContent style={styles.moodCardContent}>
                    <Typography variant="body1" style={styles.moodText}>
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
                <Card key={index} sx={styles.recommendationCard}>
                  <Box sx={styles.cardContentContainer}>
                    {/* Left Half: Image */}
                    <Box sx={styles.imageContainer}>
                      <img
                        src={recommendation.image_url}
                        alt={`${recommendation.name} album cover`}
                        style={styles.albumImage}
                      />
                    </Box>

                    {/* Right Half: Song Details */}
                    <CardContent sx={styles.cardDetails}>
                      <Typography variant="subtitle1" style={styles.songTitle}>
                        {recommendation.name}
                      </Typography>
                      <Typography variant="body2" style={styles.artistName}>
                        {recommendation.artist}
                      </Typography>
                      {recommendation.preview_url && (
                        <audio controls style={styles.audioPlayer}>
                          <source
                            src={recommendation.preview_url}
                            type="audio/mpeg"
                          />
                          Your browser does not support the audio element.
                        </audio>
                      )}
                      <Button
                        href={recommendation.external_url}
                        target="_blank"
                        variant="contained"
                        color="primary"
                        style={styles.spotifyButton}
                      >
                        Listen on Spotify
                      </Button>
                    </CardContent>
                  </Box>
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
    padding: "0",
    backgroundColor: isDarkMode ? "#121212" : "#f5f5f5",
    color: isDarkMode ? "#ffffff" : "#000000",
    transition: "background-color 0.3s ease",
  },
  loadingOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    zIndex: 1000,
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
    backgroundColor: isDarkMode ? "#333333" : "#ffffff",
    padding: "10px",
    borderRadius: "8px",
    boxShadow: "0px 2px 8px rgba(0, 0, 0, 0.1)",
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
    fontFamily: "Poppins, sans-serif",
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
    fontFamily: "Poppins, sans-serif",
    color: isDarkMode ? "#cccccc" : "#000000",
    fontSize: "16px",
  },
  noData: {
    color: isDarkMode ? "#bbbbbb" : "#999",
    fontFamily: "Poppins, sans-serif",
  },
  moodCard: {
    marginBottom: "10px",
    borderRadius: "8px",
    boxShadow: "0px 2px 10px rgba(0, 0, 0, 0.1)",
    backgroundColor: isDarkMode ? "#333333" : "#ffffff",
    cursor: "pointer",
    "&:hover": {
      transform: "scale(1.02)",
      boxShadow: "0px 4px 15px rgba(0, 0, 0, 0.2)",
    },
  },
  moodCardContent: {
    display: "flex",
    justifyContent: "center",
  },
  moodText: {
    fontFamily: "Poppins, sans-serif",
    color: isDarkMode ? "#ffffff" : "#000000",
    marginTop: "5px",
  },
  recommendationCard: {
    marginBottom: "15px",
    display: "flex",
    width: "100%",
    backgroundColor: isDarkMode ? "#333333" : "#ffffff",
    borderRadius: "8px",
  },
  cardContentContainer: {
    display: "flex",
    alignItems: "center",
    padding: "10px",
    width: "100%", // Take full width
  },
  imageContainer: {
    padding: "0 10px 0 0",
    flexShrink: 0,
  },
  albumImage: {
    width: "100px",
    borderRadius: "5px",
  },
  cardDetails: {
    flexGrow: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    width: "100%",
  },
  songTitle: {
    fontWeight: "bold",
    fontSize: "16px",
    fontFamily: "Poppins, sans-serif",
    marginBottom: "5px",
    color: isDarkMode ? "#ffffff" : "#000000",
  },
  artistName: {
    color: isDarkMode ? "#cccccc" : "#777",
    fontFamily: "Poppins, sans-serif",
    marginBottom: "10px",
  },
  audioPlayer: {
    width: "100%",
    marginBottom: "10px",
  },
  spotifyButton: {
    fontFamily: "Poppins, sans-serif",
  },
});

export default ProfilePage;
