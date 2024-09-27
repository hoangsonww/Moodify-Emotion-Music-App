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
              <Typography variant="h4" style={styles.title}>
                Welcome, {userData.username}!
              </Typography>
              <Box style={styles.infoSection}>
                <Typography variant="h6">Your Username: {userData.username}</Typography>
                <Typography variant="h6">Your Email: {userData.email}</Typography>
              </Box>

              <Box sx={styles.section}>
                <Typography variant="h6" style={styles.sectionTitle}>Your Listening History</Typography>
                {userData.listening_history && userData.listening_history.length > 0 ? (
                    userData.listening_history.map((track, index) => (
                        <Card key={index} style={styles.card}>
                          <CardContent>
                            <Typography variant="body1">{track}</Typography>
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
                            <Typography variant="body1">{mood}</Typography>
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
                            <Typography variant="body1"><strong>{recommendation.name}</strong> by {recommendation.artist}</Typography>
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
    backgroundColor: 'white',
    fontFamily: 'Poppins',
  },
  profileContainer: {
    padding: '30px',
    width: '60%',
    maxHeight: '80vh',
    overflowY: 'auto',
    borderRadius: '10px',
    boxShadow: '0px 4px 15px rgba(0, 0, 0, 0.2)',
    backgroundColor: 'white',
    textAlign: 'center',
  },
  title: {
    marginBottom: '20px',
    fontFamily: 'Poppins',
    color: '#333',
  },
  infoSection: {
    marginBottom: '20px',
    backgroundColor: '#f5f5f5',
    padding: '10px',
    borderRadius: '8px',
  },
  section: {
    marginTop: '15px',
    textAlign: 'left',
  },
  sectionTitle: {
    textDecoration: 'underline',
    marginBottom: '10px',
    color: '#555',
  },
  card: {
    marginBottom: '10px',
    borderRadius: '8px',
    boxShadow: '0px 2px 10px rgba(0, 0, 0, 0.1)',
    padding: '10px',
    backgroundColor: '#f9f9f9',
  },
  noData: {
    color: '#999',
  },
};

export default ProfilePage;
