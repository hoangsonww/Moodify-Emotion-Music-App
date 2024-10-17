import React from "react";
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

const LandingPage = () => {
  const navigate = useNavigate();

  const settings = {
    dots: true,
    infinite: true,
    speed: 500,
    slidesToShow: 3,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 3000,
    pauseOnHover: true,
    arrows: false,
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
        <Slider {...settings}>
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
          <Slider {...settings}>
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
    author: "Jane Doe",
  },
  {
    text: "I love the different ways to input my mood. The facial analysis is really cool!",
    author: "John Smith",
  },
  {
    text: "The best music app I’ve ever used. It feels like it knows me!",
    author: "Sarah Johnson",
  },
  {
    text: "I've discovered so many great songs through Moodify!",
    author: "Emily Davis",
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

// Styles
const styles = {
  pageContainer: {
    minHeight: "100vh",
    backgroundColor: "#f9f9f9",
    display: "flex",
    flexDirection: "column",
  },
  heroSection: {
    backgroundColor: "#ff4d4d",
    padding: "80px 0",
    color: "#fff",
    textAlign: "center",
  },
  additionalHeroSection: {
    backgroundColor: "#f5f5f5",
    padding: "50px 0",
    textAlign: "center",
  },
  heroTitle: {
    font: "inherit",
    fontWeight: "bold",
    fontSize: "2.5rem",
    marginBottom: "20px",
    color: "#fff",
  },
  heroSubtitle: {
    font: "inherit",
    fontSize: "1.2rem",
    marginBottom: "30px",
    color: "#fff",
  },
  buttonContainer: {
    display: "flex",
    justifyContent: "center",
    gap: "15px",
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
  },
  sectionContainer: {
    padding: "60px 0",
    textAlign: "center",
  },
  sectionTitle: {
    font: "inherit",
    fontSize: "2rem",
    textAlign: "center",
    marginBottom: "40px",
    fontWeight: "bold",
  },
  featureSlide: {
    padding: "10px",
  },
  featureCard: {
    padding: "20px",
    boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.1)",
    borderRadius: "8px",
    margin: "0 10px",
    height: "200px",
  },
  featureTitle: {
    font: "inherit",
    fontWeight: "bold",
    fontSize: "1.2rem",
    marginBottom: "10px",
  },
  featureDescription: {
    font: "inherit",
    color: "#666",
  },
  testimonialSection: {
    backgroundColor: "#fafafa",
    padding: "60px 0",
  },
  testimonialCard: {
    padding: "20px",
    boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.1)",
    borderRadius: "8px",
    margin: "0 10px",
    height: "180px",
  },
  testimonialText: {
    font: "inherit",
    fontStyle: "italic",
    marginBottom: "10px",
    color: "#555",
  },
  testimonialAuthor: {
    font: "inherit",
    color: "#333",
    fontWeight: "bold",
  },
  informativeSection: {
    font: "inherit",
    padding: "60px 0",
    backgroundColor: "#fff",
  },
  infoCard: {
    padding: "20px",
    boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.1)",
    borderRadius: "8px",
  },
  infoTitle: {
    font: "inherit",
    fontSize: "1.2rem",
    fontWeight: "bold",
    marginBottom: "10px",
  },
  infoDescription: {
    font: "inherit",
    color: "#666",
  },
};

export default LandingPage;
