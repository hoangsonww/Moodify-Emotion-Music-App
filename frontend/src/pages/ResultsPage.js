import React from 'react';
import { useLocation } from 'react-router-dom';
import { Box, Card, CardContent, Typography, Paper, Button } from '@mui/material';

const ResultsPage = () => {
  const location = useLocation();
  const { emotion, recommendations } = location.state || { emotion: "", recommendations: [] };

  return (
      <div style={styles.container}>
        {/* Display the detected emotion above the modal */}
        <Typography variant="h5" style={styles.emotionText}>
          <strong>Detected Mood: <span style={styles.emotion}>{emotion}</span></strong>
        </Typography>

        <Paper elevation={4} style={styles.resultsContainer}>
          <Typography variant="h6" style={{ fontFamily: 'Poppins', marginBottom: '10px' }}>
            Your Recommendations
          </Typography>
          <Box sx={styles.recommendationsList}>
            {recommendations.map((rec, index) => (
                <Card key={index} sx={styles.recommendationCard}>
                  <Box sx={styles.cardContentContainer}>
                    {/* Left Half: Image */}
                    <Box sx={styles.imageContainer}>
                      <img
                          src={rec.image_url}
                          alt={`${rec.name} album cover`}
                          style={styles.albumImage}
                      />
                    </Box>

                    {/* Right Half: Song Details */}
                    <CardContent sx={styles.cardDetails}>
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
                  </Box>
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
  },
  recommendationsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
    padding: '10px 0',
    alignItems: 'center',
  },
  recommendationCard: {
    width: '100%',
    maxWidth: '800px',
    borderRadius: '10px',
    padding: '15px',
    boxShadow: '0px 2px 10px rgba(0, 0, 0, 0.15)',
    backgroundColor: '#ffffff',
    display: 'flex',
    flexDirection: 'row', // Change to row to split into two halves
    gap: '10px',
  },
  cardContentContainer: {
    display: 'flex',
    flexDirection: 'row',
    width: '100%',
  },
  imageContainer: {
    flex: 1, // Take up 1/3 of the space
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  albumImage: {
    width: '100%', // Adjust the size to fit the container
    maxWidth: '150px',
    height: 'auto',
    borderRadius: '10px',
    boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.2)',
  },
  cardDetails: {
    flex: 2, // Take up 2/3 of the space
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
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
    font: 'inherit',
    fontWeight: 'normal',
    '&:hover': {
      backgroundColor: '#1ed760',
    },
  },
};

export default ResultsPage;
