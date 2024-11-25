import React, { useContext, useRef } from "react";
import {
  Box,
  Typography,
  Button,
  Container,
  Grid,
  Card,
  CardContent,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import Slider from "react-slick";
import { DarkModeContext } from "../context/DarkModeContext";
import "../App.css";

const LandingPage = () => {
  const navigate = useNavigate();
  const { isDarkMode } = useContext(DarkModeContext);

  // Ref to access Slider instance
  const sliderRef = useRef(null);

  const settings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 3,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 2000,
    pauseOnHover: true,
    arrows: false,
    appendDots: (dots) => (
      <div
        style={{
          position: "absolute",
          bottom: "-25px",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ul
          style={{ display: "flex", listStyle: "none", margin: 0, padding: 0 }}
        >
          {dots.map((dot, index) => (
            <li
              key={index}
              style={{
                margin: "0 5px",
                cursor: "pointer",
              }}
              onClick={() => {
                // Use sliderRef to navigate to the specific slide
                sliderRef.current.slickGoTo(index);
              }}
            >
              <div
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  backgroundColor: isDarkMode
                    ? dot.props.className.includes("slick-active")
                      ? "#fff"
                      : "#888"
                    : dot.props.className.includes("slick-active")
                      ? "#333"
                      : "#bbb",
                  opacity: dot.props.className.includes("slick-active")
                    ? "1"
                    : "0.5",
                  transform: dot.props.className.includes("slick-active")
                    ? "scale(1.2)"
                    : "scale(1)",
                  transition: "all 0.3s ease",
                }}
              />
            </li>
          ))}
        </ul>
      </div>
    ),
    customPaging: (i) => (
      <div
        style={{
          width: "10px",
          height: "10px",
          borderRadius: "50%",
          cursor: "pointer",
          backgroundColor: isDarkMode ? "#fff" : "#333",
          opacity: "0.5",
          transition: "opacity 0.3s ease, transform 0.3s ease",
        }}
      ></div>
    ),
    responsive: [
      {
        breakpoint: 960,
        settings: {
          slidesToShow: 2,
        },
      },
      {
        breakpoint: 600,
        settings: {
          slidesToShow: 1,
        },
      },
    ],
  };

  const styles = getStyles(isDarkMode); // Get dynamic styles based on dark mode

  return (
    <Box sx={styles.pageContainer}>
      {/* Hero Section */}
      <Box sx={styles.heroSection}>
        <Container maxWidth="md">
          <Typography variant="h3" sx={styles.heroTitle}>
            Welcome to Moodify
          </Typography>
          <Typography variant="h6" sx={styles.heroSubtitle}>
            The AI-powered emotion-based music recommendation app that matches
            your mood with the perfect soundtrack.
          </Typography>
          <Box sx={styles.buttonContainer}>
            <Button
              variant="contained"
              color="primary"
              sx={styles.heroButton}
              onClick={() => navigate("/register")}
            >
              Get Started
            </Button>
            <Button
              variant="outlined"
              color="primary"
              sx={styles.heroButton1}
              onClick={() => navigate("/login")}
            >
              Log In
            </Button>
          </Box>
        </Container>
      </Box>

      {/* Features Section with Carousel */}
      <Container sx={styles.sectionContainer}>
        <Typography variant="h4" sx={styles.sectionTitle}>
          Features
        </Typography>
        <Slider {...settings} ref={sliderRef}>
          {features.map((feature, index) => (
            <Grid item xs={12} md={4} key={index}>
              <Card sx={styles.featureCard}>
                <CardContent>
                  <Typography variant="h6" sx={styles.featureTitle}>
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" sx={styles.featureDescription}>
                    {feature.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Slider>
      </Container>

      {/* Additional Hero Banner */}
      <Box sx={styles.heroSection}>
        <Container maxWidth="md">
          <Typography variant="h4" sx={styles.heroTitle}>
            Your Emotions. Our Music.
          </Typography>
          <Typography variant="h6" sx={styles.heroSubtitle}>
            Discover songs that perfectly match every mood. Music that resonates
            with your feelings.
          </Typography>
        </Container>
      </Box>

      {/* Testimonials Section */}
      <Box sx={styles.testimonialSection}>
        <Container>
          <Typography variant="h4" sx={styles.sectionTitle}>
            What Our Users Say
          </Typography>
          <Slider {...settings} ref={sliderRef}>
            {testimonials.map((testimonial, index) => (
              <Grid item xs={12} md={4} key={index}>
                <Card sx={styles.testimonialCard}>
                  <CardContent>
                    <Typography variant="body2" sx={styles.testimonialText}>
                      "{testimonial.text}"
                    </Typography>
                    <Typography
                      variant="subtitle2"
                      sx={styles.testimonialAuthor}
                    >
                      - {testimonial.author}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Slider>
        </Container>
      </Box>

      {/* Additional Hero Banner */}
      <Box sx={styles.heroSection}>
        <Container maxWidth="md">
          <Typography variant="h4" sx={styles.heroTitle}>
            Your Mood. Your Music.
          </Typography>
          <Typography variant="h6" sx={styles.heroSubtitle}>
            Simply tell us how you feel, and we'll take care of the rest.
            Moodify - music that understands you.
          </Typography>
        </Container>
      </Box>

      {/* Additional Informative Section */}
      <Box sx={styles.informativeSection}>
        <Container>
          <Typography variant="h4" sx={styles.sectionTitle}>
            Why Choose Moodify?
          </Typography>
          <Grid container spacing={4}>
            {whyChooseMoodify.map((item, index) => (
              <Grid item xs={12} md={4} key={index}>
                <Card sx={styles.infoCard}>
                  <CardContent>
                    <Typography variant="h6" sx={styles.infoTitle}>
                      {item.title}
                    </Typography>
                    <Typography variant="body2" sx={styles.infoDescription}>
                      {item.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>
    </Box>
  );
};

// Features Data
const features = [
  {
    title: "Emotion-Based Recommendations",
    description:
      "Get personalized music recommendations based on your current mood.",
  },
  {
    title: "Multiple Input Modes",
    description:
      "Analyze your emotions through text, speech, or facial expressions.",
  },
  {
    title: "Track Your Mood History",
    description:
      "View and manage your mood history and music listening trends over time.",
  },
  {
    title: "AI-Powered Insights",
    description:
      "Our AI learns your preferences to provide better recommendations.",
  },
  {
    title: "Cross-Platform Support",
    description: "Access Moodify from any device, anytime, anywhere.",
  },
  {
    title: "Social Sharing",
    description: "Share your favorite tracks and moods with friends.",
  },
];

// Testimonials Data
const testimonials = [
  {
    text: "Moodify's recommendations are spot on! It really understands my moods.",
    author: "Ricky Nguyen",
  },
  {
    text: "I love the different ways to input my mood. The facial analysis is really cool!",
    author: "Adam Smith",
  },
  {
    text: "The best music app I’ve ever used. It feels like it knows me!",
    author: "Richard Le",
  },
  {
    text: "I've discovered so many great songs through Moodify!",
    author: "Katarina Chen",
  },
];

// Additional Section Data
const whyChooseMoodify = [
  {
    title: "Personalized Experience",
    description:
      "Moodify tailors music recommendations based on your unique emotional journey.",
  },
  {
    title: "Advanced AI Technology",
    description:
      "Our cutting-edge AI models ensure you get accurate emotion detection and recommendations.",
  },
  {
    title: "Seamless Integration",
    description:
      "Moodify integrates effortlessly with your favorite music streaming services.",
  },
];

// Function to dynamically return styles based on dark mode
const getStyles = (isDarkMode) => ({
  pageContainer: {
    minHeight: "100vh",
    backgroundColor: isDarkMode ? "#121212" : "#f9f9f9", // Dark mode support
    display: "flex",
    flexDirection: "column",
    transition: "background-color 0.3s ease",
    animation: "slideUp 0.6s ease-out",
  },
  heroSection: {
    backgroundColor: isDarkMode ? "#333" : "#ff4d4d", // Dark mode support for hero
    padding: "80px 0",
    color: isDarkMode ? "#fff" : "#fff",
    textAlign: "center",
    transition: "background-color 0.3s ease",
    animation: "slideUp 0.6s ease-out",
  },
  heroTitle: {
    font: "inherit",
    fontWeight: "bold",
    fontSize: "2.5rem",
    marginBottom: "20px",
    color: isDarkMode ? "#fff" : "#fff", // Ensure white text for both modes
    animation: "slideUp 0.6s ease-out",
  },
  heroSubtitle: {
    font: "inherit",
    fontSize: "1.2rem",
    marginBottom: "30px",
    color: isDarkMode ? "#ddd" : "#fff", // Lighter color for subtitle in dark mode
    animation: "slideUp 0.6s ease-out",
  },
  buttonContainer: {
    display: "flex",
    justifyContent: "center",
    gap: "15px",
    animation: "slideUp 0.6s ease-out",
  },
  heroButton: {
    font: "inherit",
    textTransform: "none",
    fontWeight: "bold",
    padding: "10px 20px",
    backgroundColor: "#ff4d4d",
    "&:hover": {
      backgroundColor: "#ff3333",
    },
  },
  heroButton1: {
    font: "inherit",
    textTransform: "none",
    fontWeight: "bold",
    padding: "10px 20px",
    color: "#ff4d4d",
    borderColor: "#ff4d4d",
    backgroundColor: "#fff",
    "&:hover": {
      backgroundColor: "#ff4d4d",
      color: "#fff",
    },
    transition: "background-color 0.3s ease",
  },
  sectionContainer: {
    padding: "60px 0",
    textAlign: "center",
    animation: "slideUp 0.6s ease-out",
  },
  sectionTitle: {
    font: "inherit",
    fontSize: "2rem",
    textAlign: "center",
    marginBottom: "40px",
    fontWeight: "bold",
    color: isDarkMode ? "#fff" : "#333", // Adjust title color based on dark mode
    animation: "slideUp 0.6s ease-out",
  },
  featureCard: {
    padding: "20px",
    boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.1)",
    borderRadius: "8px",
    margin: "0 10px",
    height: "200px",
    backgroundColor: isDarkMode ? "#2e2e2e" : "#fff", // Adjust card background for dark mode
    color: isDarkMode ? "#fff" : "#333", // Adjust text color for dark mode
    transition: "background-color 0.3s ease",
    animation: "slideUp 0.6s ease-out",
  },
  featureTitle: {
    font: "inherit",
    fontWeight: "bold",
    fontSize: "1.2rem",
    marginBottom: "10px",
    color: isDarkMode ? "#fff" : "#333", // Adjust title color for dark mode
    animation: "slideUp 0.6s ease-out",
  },
  featureDescription: {
    font: "inherit",
    color: isDarkMode ? "#ddd" : "#666", // Adjust description text for dark mode
    animation: "slideUp 0.6s ease-out",
  },
  testimonialSection: {
    backgroundColor: isDarkMode ? "#121212" : "#fafafa", // Adjust testimonial background for dark mode
    padding: "60px 0",
    transition: "background-color 0.3s ease",
    animation: "slideUp 0.6s ease-out",
  },
  testimonialCard: {
    padding: "20px",
    boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.1)",
    borderRadius: "8px",
    margin: "0 10px",
    height: "180px",
    backgroundColor: isDarkMode ? "#333" : "#fff", // Adjust testimonial card background for dark mode
    color: isDarkMode ? "#fff" : "#333", // Adjust text color for dark mode
    transition: "background-color 0.3s ease",
    animation: "slideUp 0.6s ease-out",
  },
  testimonialText: {
    font: "inherit",
    fontStyle: "italic",
    marginBottom: "10px",
    color: isDarkMode ? "#ddd" : "#555", // Adjust text color for dark mode
    animation: "slideUp 0.6s ease-out",
  },
  testimonialAuthor: {
    font: "inherit",
    color: isDarkMode ? "#fff" : "#333", // Adjust author text color for dark mode
    fontWeight: "bold",
    animation: "slideUp 0.6s ease-out",
  },
  informativeSection: {
    font: "inherit",
    padding: "60px 0",
    backgroundColor: isDarkMode ? "#121212" : "#fff", // Adjust section background for dark mode
    transition: "background-color 0.3s ease",
    animation: "slideUp 0.6s ease-out",
  },
  infoCard: {
    padding: "20px",
    boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.1)",
    borderRadius: "8px",
    backgroundColor: isDarkMode ? "#333" : "#fff", // Adjust info card background for dark mode
    color: isDarkMode ? "#fff" : "#333", // Adjust text color for dark mode
    transition: "background-color 0.3s ease",
    animation: "slideUp 0.6s ease-out",
  },
  infoTitle: {
    font: "inherit",
    fontSize: "1.2rem",
    fontWeight: "bold",
    marginBottom: "10px",
    color: isDarkMode ? "#fff" : "#333", // Adjust title color for dark mode
    animation: "slideUp 0.6s ease-out",
  },
  infoDescription: {
    font: "inherit",
    color: isDarkMode ? "#ddd" : "#666", // Adjust description text for dark mode
    animation: "slideUp 0.6s ease-out",
  },
});

export default LandingPage;
