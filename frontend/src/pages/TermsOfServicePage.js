import React, { useContext } from "react";
import { Paper, Typography, Box } from "@mui/material";
import { DarkModeContext } from "../context/DarkModeContext";

const TermsOfServicePage = () => {
  const { isDarkMode } = useContext(DarkModeContext); // Access dark mode state from context
  const today = new Date().toLocaleDateString();

  const styles = getStyles(isDarkMode); // Dynamically get styles based on dark mode

  return (
    <Box style={styles.container}>
      <Paper elevation={4} style={styles.policyContainer}>
        <Typography variant="h4" style={styles.title}>
          Terms of Service
        </Typography>

        <Typography variant="body1" style={styles.text}>
          Last updated: {today}
        </Typography>

        {/* Introduction Section */}
        <Typography variant="body1" style={styles.text}>
          Welcome to Moodify! These terms and conditions outline the rules and
          regulations for the use of Moodify’s services. By accessing and using
          this application, you accept and agree to be bound by these terms. If
          you do not agree with any part of the terms, please discontinue use of
          our services.
        </Typography>

        {/* Agreement to Terms Section */}
        <Typography variant="h6" style={styles.sectionTitle}>
          1. Agreement to Terms
        </Typography>
        <Typography variant="body1" style={styles.text}>
          By accessing or using Moodify, you agree to comply with and be bound
          by these Terms of Service and our Privacy Policy. These terms apply to
          all visitors, users, and others who access or use the service.
        </Typography>

        {/* Prohibited Activities Section */}
        <Typography variant="h6" style={styles.sectionTitle}>
          2. Prohibited Activities
        </Typography>
        <Typography variant="body1" style={styles.text}>
          When using Moodify, you agree not to engage in the following
          prohibited activities:
        </Typography>
        <ul style={styles.list}>
          <li>
            Attempting to interfere with the proper functioning of the app.
          </li>
          <li>Engaging in unauthorized access to Moodify’s systems or data.</li>
          <li>Submitting false or misleading information.</li>
          <li>
            Violating any applicable laws or regulations while using the
            service.
          </li>
          <li>Infringing upon the rights of any third party.</li>
        </ul>

        {/* Intellectual Property Section */}
        <Typography variant="h6" style={styles.sectionTitle}>
          3. Intellectual Property Rights
        </Typography>
        <Typography variant="body1" style={styles.text}>
          All content, features, and functionality (including but not limited to
          text, graphics, logos, and software) provided by Moodify are owned by
          us and protected by intellectual property laws. You may not copy,
          modify, distribute, or create derivative works from our content
          without express permission.
        </Typography>

        {/* User-Generated Content Section */}
        <Typography variant="h6" style={styles.sectionTitle}>
          4. User-Generated Content
        </Typography>
        <Typography variant="body1" style={styles.text}>
          You may submit content, such as mood history or song recommendations,
          as part of your experience on Moodify. By submitting this content, you
          grant us the right to use, modify, and distribute your content as part
          of providing our services. You also affirm that your content does not
          violate any third-party rights.
        </Typography>

        {/* Termination Section */}
        <Typography variant="h6" style={styles.sectionTitle}>
          5. Termination
        </Typography>
        <Typography variant="body1" style={styles.text}>
          We may terminate or suspend your access to Moodify at our discretion,
          without prior notice or liability, for any reason, including your
          violation of these Terms of Service. Upon termination, you are no
          longer authorized to access the app, and all provisions of these terms
          will survive termination.
        </Typography>

        {/* Limitation of Liability Section */}
        <Typography variant="h6" style={styles.sectionTitle}>
          6. Limitation of Liability
        </Typography>
        <Typography variant="body1" style={styles.text}>
          In no event shall Moodify, its directors, employees, or agents be
          liable for any indirect, incidental, special, consequential, or
          punitive damages arising from your use of the app or these terms. This
          limitation of liability applies whether the damages arise from breach
          of contract, tort, or any other legal theory.
        </Typography>

        {/* Changes to Terms Section */}
        <Typography variant="h6" style={styles.sectionTitle}>
          7. Changes to These Terms
        </Typography>
        <Typography variant="body1" style={styles.text}>
          We reserve the right to modify these Terms of Service at any time. Any
          changes will be posted on this page, and your continued use of the app
          following the posting of changes constitutes your acceptance of the
          new terms.
        </Typography>

        {/* Governing Law Section */}
        <Typography variant="h6" style={styles.sectionTitle}>
          8. Governing Law
        </Typography>
        <Typography variant="body1" style={styles.text}>
          These terms shall be governed and construed in accordance with the
          laws of the United States, without regard to its conflict of law
          provisions. Any disputes arising under or in connection with these
          terms shall be resolved through arbitration in Chapel Hill, North
          Carolina.
        </Typography>

        {/* Contact Information Section */}
        <Typography variant="h6" style={styles.sectionTitle}>
          9. Contact Information
        </Typography>
        <Typography variant="body1" style={styles.text}>
          If you have any questions about these Terms of Service, please contact
          us at: hoangson091104@gmail.com.
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
    backgroundColor: isDarkMode ? "#121212" : "#f5f5f5", // Dark mode support
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
    backgroundColor: isDarkMode ? "#1f1f1f" : "white", // Dark mode support for background
    transition: "all 0.3s ease",
  },
  title: {
    marginBottom: "20px",
    fontFamily: "Poppins, sans-serif",
    color: isDarkMode ? "#ffffff" : "#333", // Dark mode title color
    fontWeight: 600,
  },
  sectionTitle: {
    marginTop: "20px",
    textDecoration: "underline",
    font: "inherit",
    marginBottom: "10px",
    color: isDarkMode ? "#bbbbbb" : "#555", // Dark mode section title color
    fontWeight: 500,
  },
  text: {
    font: "inherit",
    color: isDarkMode ? "#cccccc" : "#000000", // Dark mode text color
    marginBottom: "10px",
  },
  list: {
    paddingLeft: "20px",
    marginBottom: "20px",
    color: isDarkMode ? "#cccccc" : "#000000", // Dark mode list text color
  },
});

export default TermsOfServicePage;
