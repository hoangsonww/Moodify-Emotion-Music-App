import React from "react";
import { Box, Typography, Paper, Button } from "@mui/material";
import { Link } from "react-router-dom";
import { useLocation } from "react-router-dom";

const Emotion = () => {
  const location = useLocation();
  const { emotion } = location.state || { emotion: "" };

  return (
    <Box style={styles.container}>
      <Typography variant="h5" style={styles.title}>
        <strong>
          Detected Mood: <span style={styles.emotion}>{emotion}</span>
        </strong>
      </Typography>
      <Paper elevation={4} style={styles.paper}>
        <Typography variant="h6" style={styles.subtitle}>
          How are you feeling today?
        </Typography>
        <Box style={styles.buttonContainer}>
          <Link to="/results" style={styles.link}>
            <Button variant="contained" color="primary" style={styles.button}>
              Get Recommendations
            </Button>
          </Link>
        </Box>
      </Paper>
    </Box>
  );
};
