import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Box, Card, CardContent, Typography, Paper, Button, MenuItem, Select, FormControl, InputLabel } from '@mui/material';
import axios from 'axios';

const ResultsPage = () => {
  const location = useLocation();
  const { emotion, recommendations } = location.state || { emotion: "None", recommendations: [] };

  const [selectedMood, setSelectedMood] = useState(emotion || "None");
  const [displayRecommendations, setDisplayRecommendations] = useState(recommendations || []);

  // Load stored data from localStorage
  useEffect(() => {
    if (emotion && recommendations) {
      // Save the new data to localStorage if available
      localStorage.setItem('storedEmotion', emotion);
      localStorage.setItem('storedRecommendations', JSON.stringify(recommendations));
    } else {
      // Retrieve data from localStorage if no new data is available
      const storedEmotion = localStorage.getItem('storedEmotion') || "None";
      const storedRecommendations = JSON.parse(localStorage.getItem('storedRecommendations')) || [];
      setSelectedMood(storedEmotion);
      setDisplayRecommendations(storedRecommendations);
    }
  }, [emotion, recommendations]);

  // Function to handle mood change
  const handleMoodChange = async (event) => {
    const newMood = event.target.value;
    setSelectedMood(newMood);

    try {
      // Call the API with the selected mood
      const response = await axios.post('http://127.0.0.1:8000/api/music_recommendation/', {
        "emotion": newMood.toLowerCase(),
      });

      const newRecommendations = response.data.recommendations || [];

      // Update the displayed recommendations
      setDisplayRecommendations(newRecommendations);

      // Store the new mood and recommendations in localStorage
      localStorage.setItem('storedEmotion', newMood);
      localStorage.setItem('storedRecommendations', JSON.stringify(newRecommendations));
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    }
  };

  return (
      <div style={styles.container}>
        <Typography variant="h5" style={styles.emotionText}>
          <strong>Detected Mood: <span style={styles.emotion}>{selectedMood.charAt(0).toUpperCase() + selectedMood.slice(1)}</span></strong>
        </Typography>

        <Typography variant="body2" style={{ color: '#999', marginBottom: '20px', textAlign: 'center', font: 'inherit', fontSize: '14px' }}>
          Or select a mood from the dropdown below to get recommendations based on that mood:
        </Typography>

        {/* Dropdown to select mood */}
        <FormControl fullWidth style={{ marginBottom: '20px', maxWidth: '300px' }}>
          <InputLabel>Select Mood</InputLabel>
          <Select
              value={selectedMood}
              onChange={handleMoodChange}
              variant={'outlined'}
              label="Select Mood"
              style={{ fontFamily: 'Poppins' }}
          >
            {Object.keys(emotionToGenre).map((mood, index) => (
                <MenuItem key={index} value={mood}>
                  {mood.charAt(0).toUpperCase() + mood.slice(1)}
                </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Paper elevation={4} style={styles.resultsContainer}>
          <Typography variant="h6" style={{ fontFamily: 'Poppins', marginBottom: '10px' }}>
            Your Recommendations
          </Typography>
          <Box sx={styles.recommendationsList}>
            {displayRecommendations.length > 0 ? (
                displayRecommendations.map((rec, index) => (
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
                ))
            ) : (
                <Typography variant="body2" style={{ color: '#999', marginTop: '20px', textAlign: 'center', font: 'inherit', fontSize: '14px' }}>
                  No recommendations available. Try inputting a new image, changing the mood, entering some texts, or recording something...
                </Typography>
            )}
          </Box>
        </Paper>
      </div>
  );
};

// Define the mood to genre mapping
const emotionToGenre = {
  "joy": "hip-hop",
  "happy": "happy",
  "sadness": "sad",
  "anger": "metal",
  "love": "romance",
  "fear": "sad",
  "neutral": "pop",
  "calm": "chill",
  "disgust": "blues",
  "surprised": "party",
  "surprise": "party",
  "excited": "party",
  "bored": "pop",
  "tired": "chill",
  "relaxed": "chill",
  "stressed": "chill",
  "anxious": "chill",
  "depressed": "sad",
  "lonely": "sad",
  "energetic": "hip-hop",
  "nostalgic": "pop",
  "confused": "pop",
  "frustrated": "metal",
  "hopeful": "romance",
  "proud": "hip-hop",
  "guilty": "blues",
  "jealous": "pop",
  "ashamed": "blues",
  "disappointed": "pop",
  "content": "chill",
  "insecure": "pop",
  "embarassed": "blues",
  "overwhelmed": "chill",
  "amused": "party",
};

const styles = {
  // existing styles
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
    font: 'inherit',
    flexDirection: 'row',
    gap: '10px',
  },
  cardContentContainer: {
    display: 'flex',
    flexDirection: 'row',
    width: '100%',
  },
  imageContainer: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  albumImage: {
    width: '100%',
    maxWidth: '150px',
    height: 'auto',
    borderRadius: '10px',
    boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.2)',
  },
  cardDetails: {
    flex: 2,
    display: 'flex',
    font: 'inherit',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  songTitle: {
    font: 'inherit',
    fontSize: '1rem',
    fontWeight: 'bold',
    color: '#333',
    marginBottom: '5px',
  },
  artistName: {
    font: 'inherit',
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
