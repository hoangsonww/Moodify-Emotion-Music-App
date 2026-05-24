import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Box, Typography, Link } from "@mui/material";
import { GitHub, LinkedIn, Mail, Language } from "@mui/icons-material";

const Footer = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  // Match the navbar's behaviour: /results is labelled "Explore" by
  // default and only flips to "Results" once the user is actually on
  // /results AND arrived from an analysis (state carries the emotion).
  const arrivedFromAnalysis =
    location.pathname === "/results" &&
    Boolean(location.state && location.state.emotion);
  const resultsLabel = arrivedFromAnalysis ? "Results" : "Explore";

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
          {resultsLabel}
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
    // Horizontal padding keeps wrapped links off the viewport edge
    // on tight phone widths; box-sizing keeps the 100% width honest.
    padding: { xs: "16px 12px", sm: "20px 24px" },
    textAlign: "center",
    fontFamily: "Poppins, sans-serif",
    marginTop: "20px",
    width: "100%",
    maxWidth: "100vw",
    boxSizing: "border-box",
    overflow: "hidden",
  },
  navLinks: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    // Tighter gap on phones — eight pills + 20px gaps overflow
    // anything narrower than ~410 px.
    columnGap: { xs: "12px", sm: "20px" },
    rowGap: { xs: "8px", sm: "10px" },
    marginBottom: "10px",
    flexWrap: "wrap",
    maxWidth: "100%",
    fontFamily: "Poppins, sans-serif",
  },
  link: {
    cursor: "pointer",
    color: "white",
    textDecoration: "none",
    fontFamily: "Poppins, sans-serif",
    fontSize: { xs: "12px", sm: "14px" },
    fontWeight: 500,
    lineHeight: 1.3,
    position: "relative",
    // Long labels stay on one line — they wrap to a new row instead
    // of breaking mid-word, which looked ugly with two-word labels
    // like "Privacy Policy" / "Terms of Service".
    whiteSpace: "nowrap",
    transition: "transform 0.2s",
    "&:hover": {
      transform: "scale(1.05)",
    },
  },
  activeLink: {
    borderBottom: "2px solid white",
    borderRadius: 0,
  },
  iconContainer: {
    display: "flex",
    justifyContent: "center",
    gap: { xs: "16px", sm: "20px" },
    marginTop: { xs: "12px", sm: "20px" },
    marginBottom: "10px",
    flexWrap: "wrap",
    maxWidth: "100%",
    fontFamily: "Poppins, sans-serif",
  },
  iconLink: {
    color: "white",
    display: "inline-flex",
  },
  icon: {
    fontSize: { xs: "26px", sm: "30px" },
    transition: "transform 0.3s",
    "&:hover": {
      transform: "scale(1.2)",
    },
  },
  copyright: {
    marginTop: "10px",
    fontSize: { xs: "12px", sm: "14px" },
    fontFamily: "Poppins, sans-serif",
    px: 1,
    overflowWrap: "anywhere",
  },
};

export default Footer;
