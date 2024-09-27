import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button } from '@mui/material';

const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
      <Box sx={styles.container}>
        {/* Animated illustration with pulse effect */}
        <Box sx={styles.illustration} className="pulse-animation">
          <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width="150px"
              height="150px"
              fill="#ff4d4d"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm1-13h-2v6h2V7zm0 8h-2v2h2v-2z" />
          </svg>
        </Box>

        <Typography variant="h3" style={styles.title} className="fade-in">
          404 - Page Not Found
        </Typography>
        <Typography variant="body1" style={styles.message} className="fade-in">
          Oops! The page you are looking for does not exist or has been moved.
        </Typography>

        <Button
            variant="contained"
            onClick={() => navigate('/')}
            style={styles.button}
            className="fade-in"
        >
          Go Back Home
        </Button>
      </Box>
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
    padding: '20px',
    fontFamily: 'Poppins',
  },
  illustration: {
    marginBottom: '20px',
    animation: 'pulse 1.5s infinite',
  },
  title: {
    color: '#ff4d4d',
    font: 'inherit',
    fontSize: '32px',
    fontWeight: 'bold',
    marginBottom: '10px',
    textAlign: 'center',
  },
  message: {
    color: '#666',
    font: 'inherit',
    marginBottom: '20px',
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#ff4d4d',
    color: 'white',
    textTransform: 'none',
    font: 'inherit',
    fontWeight: 'normal',
    padding: '10px 20px',
    '&:hover': {
      backgroundColor: '#ff1a1a',
    },
  },
};

export default NotFoundPage;
