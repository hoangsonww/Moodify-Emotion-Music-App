import React, { useState } from 'react';
import { Box, Button, TextField, Typography, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = async () => {
    if (!username || !password) {
      alert('Please fill in all fields');
      return;
    }

    try {
      const response = await axios.post('http://127.0.0.1:8000/users/login/', { username, password });
      const { token } = response.data;

      // Store token in localStorage
      localStorage.setItem('token', token);
      alert('Login successful!');

      // Redirect to the home page
      navigate('/home');
    } catch (error) {
      console.error('Login failed:', error);
      alert('Login failed. Please check your credentials.');
    }
  };

  return (
      <div style={styles.container}>
        <Paper elevation={4} style={styles.formContainer}>
          <Typography variant="h4" align="center" sx={{ mb: 3, fontFamily: 'Poppins' }}>
            Login
          </Typography>
          <TextField
              label="Username"
              variant="outlined"
              fullWidth
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              sx={{ mb: 2 }}
          />
          <TextField
              label="Password"
              type="password"
              variant="outlined"
              fullWidth
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              sx={{ mb: 2 }}
          />
          <Button
              variant="contained"
              color="primary"
              fullWidth
              onClick={handleLogin}
              sx={{ mb: 2 }}
          >
            Login
          </Button>
          <Typography
              variant="body2"
              align="center"
              sx={{ cursor: 'pointer', textDecoration: 'underline', fontFamily: 'Poppins' }}
              onClick={() => navigate('/register')}
          >
            Don't have an account? Register
          </Typography>
        </Paper>
      </div>
  );
};

const styles = {
  container: {
    height: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
  },
  formContainer: {
    padding: '30px',
    width: '350px',
    borderRadius: '10px',
    boxShadow: '0px 4px 15px rgba(0, 0, 0, 0.2)',
    backgroundColor: 'white',
  },
};

export default Login;
