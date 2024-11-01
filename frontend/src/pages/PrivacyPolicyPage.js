import React, { useContext } from "react";
import { Paper, Typography, Box } from "@mui/material";
import { DarkModeContext } from "../context/DarkModeContext";

const PrivacyPolicyPage = () => {
  const { isDarkMode } = useContext(DarkModeContext); // Access dark mode state from context
  const today = new Date().toLocaleDateString();

  const styles = getStyles(isDarkMode); // Dynamically get styles based on dark mode

  return (
    <Box style={styles.container}>
      <Paper elevation={4} style={styles.policyContainer}>
        <Typography variant="h4" style={styles.title}>
          Privacy Policy
        </Typography>

        <Typography variant="body1" style={styles.text}>
          Last updated: {today}
        </Typography>

        <Typography variant="body1" style={styles.text}>
          At Moodify, we value your privacy and are committed to protecting your
          personal information. This Privacy Policy explains how we collect,
          use, and safeguard your information when you use our application.
          Please read this policy carefully to understand our views and
          practices regarding your data.
        </Typography>

        {/* Data Collection Section */}
        <Typography variant="h6" style={styles.sectionTitle}>
          1. Data Collection
        </Typography>
        <Typography variant="body1" style={styles.text}>
          We collect the following types of information:
        </Typography>
        <ul style={styles.list}>
          <li>
            <strong>Personal Information:</strong> When you create an account,
            we collect personal data such as your username, email address, and
            password.
          </li>
          <li>
            <strong>Usage Data:</strong> We automatically collect data about
            your interactions with the app, including your mood history,
            listening history, and song recommendations.
          </li>
          <li>
            <strong>Device Data:</strong> We may collect information about the
            device you use to access the app, such as your IP address, browser
            type, and device identifiers.
          </li>
        </ul>

        {/* Data Usage Section */}
        <Typography variant="h6" style={styles.sectionTitle}>
          2. How We Use Your Data
        </Typography>
        <Typography variant="body1" style={styles.text}>
          We use your data to:
        </Typography>
        <ul style={styles.list}>
          <li>
            Provide and maintain our service, including personalizing your
            experience based on your mood and music preferences.
          </li>
          <li>
            Communicate with you, including sending updates, notifications, and
            support messages.
          </li>
          <li>
            Analyze usage trends to improve the app and provide better
            recommendations.
          </li>
        </ul>

        {/* Data Sharing Section */}
        <Typography variant="h6" style={styles.sectionTitle}>
          3. Data Sharing
        </Typography>
        <Typography variant="body1" style={styles.text}>
          We do not sell or rent your personal information to third parties.
          However, we may share your data with:
        </Typography>
        <ul style={styles.list}>
          <li>
            <strong>Service Providers:</strong> We may share your information
            with trusted service providers to perform certain tasks, such as
            hosting and maintaining the app.
          </li>
          <li>
            <strong>Legal Requirements:</strong> We may disclose your
            information if required by law or in response to valid legal
            processes, such as subpoenas or court orders.
          </li>
        </ul>

        {/* Data Security Section */}
        <Typography variant="h6" style={styles.sectionTitle}>
          4. Data Security
        </Typography>
        <Typography variant="body1" style={styles.text}>
          We implement security measures to protect your personal information
          from unauthorized access, alteration, disclosure, or destruction.
          However, please be aware that no method of transmitting or storing
          data is completely secure.
        </Typography>

        {/* User Rights Section */}
        <Typography variant="h6" style={styles.sectionTitle}>
          5. Your Rights
        </Typography>
        <Typography variant="body1" style={styles.text}>
          You have the right to:
        </Typography>
        <ul style={styles.list}>
          <li>
            Access, update, or delete your personal data through your account
            settings.
          </li>
          <li>Request a copy of the data we hold about you.</li>
          <li>Request that we correct any inaccuracies in your data.</li>
          <li>
            Withdraw your consent for data processing at any time, though this
            may limit your ability to use some features of the app.
          </li>
        </ul>

        {/* Changes to Policy Section */}
        <Typography variant="h6" style={styles.sectionTitle}>
          6. Changes to This Privacy Policy
        </Typography>
        <Typography variant="body1" style={styles.text}>
          We may update this Privacy Policy from time to time to reflect changes
          in our practices or for other operational, legal, or regulatory
          reasons. We will notify you of any significant changes by posting the
          new policy on this page and updating the "Last updated" date at the
          top.
        </Typography>

        {/* Contact Us Section */}
        <Typography variant="h6" style={styles.sectionTitle}>
          7. Contact Us
        </Typography>
        <Typography variant="body1" style={styles.text}>
          If you have any questions or concerns about this Privacy Policy or our
          data practices, please contact us at: hoangson091104@gmail.com.
        </Typography>
      </Paper>
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
    backgroundColor: isDarkMode ? "#121212" : "#f5f5f5", // Dynamic background color
    color: isDarkMode ? "#ffffff" : "#000000", // Dynamic text color
    transition: "background-color 0.3s ease",
  },
  policyContainer: {
    padding: "30px",
    width: "70%",
    maxHeight: "85vh",
    overflowY: "auto",
    borderRadius: "10px",
    boxShadow: "0px 4px 15px rgba(0, 0, 0, 0.2)",
    backgroundColor: isDarkMode ? "#1f1f1f" : "white", // Dynamic paper background color
    transition: "all 0.3s ease",
  },
  title: {
    marginBottom: "20px",
    fontFamily: "Poppins, sans-serif",
    color: isDarkMode ? "#ffffff" : "#333", // Dynamic title color
    fontWeight: 600,
  },
  sectionTitle: {
    marginTop: "20px",
    textDecoration: "underline",
    font: "inherit",
    marginBottom: "10px",
    color: isDarkMode ? "#bbbbbb" : "#555", // Dynamic section title color
    fontWeight: 500,
  },
  text: {
    font: "inherit",
    color: isDarkMode ? "#cccccc" : "#000000", // Dynamic text color
    marginBottom: "10px",
  },
  list: {
    paddingLeft: "20px",
    marginBottom: "20px",
    color: isDarkMode ? "#cccccc" : "#000000", // Dynamic list text color
  },
});

export default PrivacyPolicyPage;
