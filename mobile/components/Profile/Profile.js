import React, { useEffect, useState } from 'react';
import { Paper, Typography, Box, CircularProgress, Card, CardContent } from '@mui/material';
import axios from 'axios';

const ProfilePage = () => {
  const [userData, setUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) {
      alert("You are not authenticated. Please log in.");
      return;
    }
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:8000/users/user/profile/', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setUserData(response.data);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching user data:', error);
      setError('Failed to fetch user data. Please try again.');
      setIsLoading(false);
    }
  };

  return (
      <Box style={styles.container}>
        {isLoading ? (
            <CircularProgress />
        ) : error ? (
            <Typography variant="h6" color="error">{error}</Typography>
        ) : (
            <Paper elevation={4} style={styles.profileContainer}>
              <Typography variant="h5" style={styles.title}>
                Welcome, {userData.username}!
              </Typography>
              <Box style={styles.infoSection}>
                <Typography variant="h6" style={styles.text}>Your Username: {userData.username}</Typography>
                <Typography variant="h6" style={styles.text}>Your Email: {userData.email}</Typography>
              </Box>

              <Box sx={styles.section}>
                <Typography variant="h6" style={styles.sectionTitle}>Your Listening History</Typography>
                {userData.listening_history && userData.listening_history.length > 0 ? (
                    userData.listening_history.map((track, index) => (
                        <Card key={index} style={styles.card}>
                          <CardContent>
                            <Typography variant="body1" style={styles.text}>{track}</Typography>
                          </CardContent>
                        </Card>
                    ))
                ) : (
                    <Typography variant="body2" style={styles.noData}>No listening history available.</Typography>
                )}
              </Box>

              <Box sx={styles.section}>
                <Typography variant="h6" style={styles.sectionTitle}>Your Mood History</Typography>
                {userData.mood_history && userData.mood_history.length > 0 ? (
                    userData.mood_history.map((mood, index) => (
                        <Card key={index} style={styles.card}>
                          <CardContent>
                            <Typography variant="body1" style={styles.text}>{mood}</Typography>
                          </CardContent>
                        </Card>
                    ))
                ) : (
                    <Typography variant="body2" style={styles.noData}>No mood history available.</Typography>
                )}
              </Box>

              <Box sx={styles.section}>
                <Typography variant="h6" style={styles.sectionTitle}>Your Recommendations History</Typography>
                {userData.recommendations && userData.recommendations.length > 0 ? (
                    userData.recommendations.map((recommendation, index) => (
                        <Card key={index} style={styles.card}>
                          <CardContent>
                            <Typography variant="body1" style={styles.text}>
                              <strong>{recommendation.name}</strong> by {recommendation.artist}
                            </Typography>
                          </CardContent>
                        </Card>
                    ))
                ) : (
                    <Typography variant="body2" style={styles.noData}>No recommendations available.</Typography>
                )}
              </Box>
            </Paper>
        )}
      </Box>
  );
};

const styles = {
  container: {
    height: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontFamily: 'Poppins, sans-serif',
    padding: '20px',
  },
  profileContainer: {
    padding: '30px',
    width: '70%',
    maxHeight: '85vh',
    overflowY: 'auto',
    borderRadius: '10px',
    boxShadow: '0px 4px 15px rgba(0, 0, 0, 0.2)',
    backgroundColor: 'white',
    textAlign: 'center',
    transition: 'all 0.3s ease-in-out',
  },
  title: {
    marginBottom: '20px',
    fontFamily: 'Poppins, sans-serif',
    color: '#333',
  },
  infoSection: {
    marginBottom: '20px',
    backgroundColor: '#fafafa',
    padding: '10px',
    borderRadius: '8px',
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.05)',
    transition: 'all 0.3s ease',
  },
  section: {
    marginTop: '15px',
    textAlign: 'left',
    padding: '10px',
  },
  sectionTitle: {
    textDecoration: 'underline',
    font: 'inherit',
    marginBottom: '10px',
    color: '#555',
    fontWeight: 500,
  },
  card: {
    marginBottom: '10px',
    borderRadius: '8px',
    boxShadow: '0px 2px 10px rgba(0, 0, 0, 0.1)',
    padding: '10px',
    backgroundColor: '#ffffff',
    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
    cursor: 'pointer',
    '&:hover': {
      transform: 'scale(1.02)',
      boxShadow: '0px 4px 15px rgba(0, 0, 0, 0.2)',
    },
  },
  text: {
    font: 'inherit',
  },
  noData: {
    color: '#999',
    fontStyle: 'italic',
  },
};

export default ProfilePage;
