// src/pages/ResultsPage.js
import React from 'react';
import { useLocation } from 'react-router-dom';
import { Box, Card, CardContent, Typography, Paper, Button } from '@mui/material';

const ResultsPage = () => {
  const location = useLocation();
  const { emotion, recommendations } = location.state || { emotion: "", recommendations: [] };

  return (
      <div style={styles.container}>
        {/* Display the detected emotion above the modal */}
        <Typography variant="h4" style={styles.emotionText}>
          Detected Mood: <span style={styles.emotion}>{emotion}</span>
        </Typography>

        <Paper elevation={4} style={styles.resultsContainer}>
          <Typography variant="h6" style={{ fontFamily: 'Poppins', marginBottom: '10px' }}>
            Recommendations
          </Typography>
          <Box sx={styles.recommendationsList}>
            {recommendations.map((rec, index) => (
                <Card key={index} sx={styles.recommendationCard}>
                  <CardContent>
                    <Typography variant="subtitle1" style={styles.songTitle}>
                      {rec.name}
                    </Typography>
                    <Typography variant="body2" style={styles.artistName}>
                      {rec.artist}
                    </Typography>
                    {rec.preview_url && (
                        <audio controls style={styles.audioPlayer}>
                          <source src={rec.preview_url} type="audio/mpeg" />
                          Your browser does not support the audio element.
                        </audio>
                    )}
                    <Button
                        href={rec.external_url}
                        target="_blank"
                        variant="contained"
                        color="primary"
                        style={styles.spotifyButton}
                    >
                      Listen on Spotify
                    </Button>
                  </CardContent>
                </Card>
            ))}
          </Box>
        </Paper>
      </div>
  );
};

const styles = {
  container: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    fontFamily: 'Poppins',
    padding: '20px',
  },
  emotionText: {
    marginBottom: '15px',
    color: '#333',
    fontFamily: 'Poppins',
  },
  emotion: {
    color: '#ff4d4d',
    fontWeight: 'bold',
  },
  resultsContainer: {
    padding: '20px',
    borderRadius: '12px',
    width: '90%',
    maxWidth: '1000px',
    height: '650px',
    boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.1)',
    backgroundColor: 'white',
    overflowY: 'auto',
    overflowX: 'hidden'
  },
  recommendationsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
    overflowY: 'auto',
    padding: '10px 0',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    alignContent: 'center',
  },
  recommendationCard: {
    width: '90%',
    borderRadius: '10px',
    padding: '15px',
    boxShadow: '0px 2px 10px rgba(0, 0, 0, 0.15)',
    backgroundColor: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  songTitle: {
    fontSize: '1rem',
    fontWeight: 'bold',
    color: '#333',
    marginBottom: '5px',
  },
  artistName: {
    fontSize: '0.9rem',
    color: '#555',
    marginBottom: '8px',
  },
  audioPlayer: {
    width: '100%',
    marginTop: '10px',
    borderRadius: '5px',
  },
  spotifyButton: {
    marginTop: '10px',
    backgroundColor: '#1DB954',
    color: '#fff',
    textTransform: 'none',
    fontWeight: 'normal',
    '&:hover': {
      backgroundColor: '#1ed760',
    },
  },
};

export default ResultsPage;
