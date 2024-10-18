import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Box, Typography, Link } from "@mui/material";
import { GitHub, LinkedIn, Mail, Language } from "@mui/icons-material";

const Footer = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <Box sx={styles.footer}>
      {/* Navigation Links */}
      <Box sx={styles.navLinks}>
        <Link
          sx={
            isActive("/home")
              ? { ...styles.link, ...styles.activeLink }
              : styles.link
          }
          onClick={() => navigate("/home")}
        >
          Home
        </Link>
        <Link
          sx={
            isActive("/results")
              ? { ...styles.link, ...styles.activeLink }
              : styles.link
          }
          onClick={() => navigate("/results")}
        >
          Results
        </Link>
        <Link
          sx={
            isActive("/profile")
              ? { ...styles.link, ...styles.activeLink }
              : styles.link
          }
          onClick={() => navigate("/profile")}
        >
          Profile
        </Link>
        <Link
          sx={
            isActive("/login")
              ? { ...styles.link, ...styles.activeLink }
              : styles.link
          }
          onClick={() => navigate("/login")}
        >
          Login
        </Link>
        <Link
          sx={
            isActive("/register")
              ? { ...styles.link, ...styles.activeLink }
              : styles.link
          }
          onClick={() => navigate("/register")}
        >
          Register
        </Link>
        <Link
          sx={
            isActive("/privacy-policy")
              ? { ...styles.link, ...styles.activeLink }
              : styles.link
          }
          onClick={() => navigate("/privacy-policy")}
        >
          Privacy Policy
        </Link>
        <Link
          sx={
            isActive("/terms-of-service")
              ? { ...styles.link, ...styles.activeLink }
              : styles.link
          }
          onClick={() => navigate("/terms-of-service")}
        >
          Terms of Service
        </Link>
        <Link
          sx={
            isActive("/")
              ? { ...styles.link, ...styles.activeLink }
              : styles.link
          }
          onClick={() => navigate("/")}
        >
          Landing
        </Link>
      </Box>

      {/* Icon Links */}
      <Box sx={styles.iconContainer}>
        <Link
          href="https://github.com/hoangsonww/Moodify-Emotion-Music-App"
          target="_blank"
          rel="noopener noreferrer"
          sx={styles.iconLink}
        >
          <GitHub sx={styles.icon} />
        </Link>
        <Link
          href="https://www.linkedin.com/in/hoangsonw"
          target="_blank"
          rel="noopener noreferrer"
          sx={styles.iconLink}
        >
          <LinkedIn sx={styles.icon} />
        </Link>
        <Link href="mailto:hoangson091104@gmail.com" sx={styles.iconLink}>
          <Mail sx={styles.icon} />
        </Link>
        <Link
          href="https://sonnguyenhoang.com"
          target="_blank"
          rel="noopener noreferrer"
          sx={styles.iconLink}
        >
          <Language sx={styles.icon} />
        </Link>
      </Box>

      {/* Copyright Text */}
      <Typography variant="body2" sx={styles.copyright}>
        &copy; {new Date().getFullYear()} Moodify. All rights reserved.
      </Typography>
    </Box>
  );
};

const styles = {
  footer: {
    backgroundColor: "#ff4d4d",
    color: "white",
    padding: "20px 0",
    textAlign: "center",
    fontFamily: "Poppins, sans-serif", // Use Poppins font
    marginTop: "20px",
    width: "100%",
    "@media (max-width: 600px)": {
      padding: "15px 0",
    },
  },
  navLinks: {
    display: "flex",
    justifyContent: "center",
    gap: "20px",
    marginBottom: "10px",
    flexWrap: "wrap", // Makes it responsive
    fontFamily: "Poppins, sans-serif", // Use Poppins font
  },
  link: {
    cursor: "pointer",
    color: "white",
    textDecoration: "none",
    fontFamily: "Poppins, sans-serif", // Use Poppins font
    fontSize: "14px",
    fontWeight: 500,
    position: "relative",
    "&:hover": {
      transform: "scale(1.05)",
      transition: "transform 0.2s",
    },
  },
  activeLink: {
    borderBottom: "2px solid white",
    borderRadius: 0,
  },
  iconContainer: {
    display: "flex",
    justifyContent: "center",
    gap: "20px",
    marginTop: "20px",
    marginBottom: "10px",
    flexWrap: "wrap", // Makes the icons responsive
    fontFamily: "Poppins, sans-serif", // Use Poppins font
  },
  iconLink: {
    color: "white",
  },
  icon: {
    fontSize: "30px",
    transition: "transform 0.3s",
    "&:hover": {
      transform: "scale(1.2)",
    },
  },
  copyright: {
    marginTop: "10px",
    fontSize: "14px",
    fontFamily: "Poppins, sans-serif", // Use Poppins font
  },
};

export default Footer;
