// src/components/Navbar.js
import React from 'react';
import { AppBar, Toolbar, Typography, Button } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation(); // Get the current location

  // Function to determine if the current route is active
  const isActive = (path) => location.pathname === path;

  return (
      <AppBar position="static" sx={{ bgcolor: 'white', color: 'black', boxShadow: 3 }}>
        <Toolbar>
          <Typography
              variant="h6"
              sx={{ flexGrow: 1, cursor: 'pointer', fontFamily: 'Poppins', fontSize: '24px' }}
              onClick={() => navigate('/')}
          >
            Moodify
          </Typography>
          <Button
              color="inherit"
              sx={{
                marginRight: '10px', fontFamily: 'Poppins',
                backgroundColor: isActive('/home') ? '#ff4d4d' : 'transparent', // Orange background if active
                color: isActive('/home') ? 'white' : 'black',
                '&:hover': {
                  backgroundColor: '#ff4d4d',
                  color: 'white',
                },
              }}
              onClick={() => navigate('/home')}
          >
            Home
          </Button>
          <Button
              color="inherit"
              sx={{
                marginRight: '10px', fontFamily: 'Poppins',
                backgroundColor: isActive('/profile') ? '#ff4d4d' : 'transparent', // Orange background if active
                color: isActive('/profile') ? 'white' : 'black',
                '&:hover': {
                  backgroundColor: '#ff4d4d',
                  color: 'white',
                },
              }}
              onClick={() => navigate('/profile')}
          >
            Profile
          </Button>
          <Button
              color="inherit"
              sx={{
                marginRight: '10px', fontFamily: 'Poppins',
                backgroundColor: isActive('/recommendations') ? '#ff4d4d' : 'transparent', // Orange background if active
                color: isActive('/recommendations') ? 'white' : 'black',
                '&:hover': {
                  backgroundColor: '#ff4d4d',
                  color: 'white',
                },
              }}
              onClick={() => navigate('/recommendations')}
          >
            Recommendations
          </Button>
          <Button
              color="error"
              sx={{ marginRight: '10px', fontFamily: 'Poppins' }}
              onClick={() => {
                localStorage.removeItem('token');
                navigate('/login');
              }}
          >
            Logout
          </Button>
        </Toolbar>
      </AppBar>
  );
};

export default Navbar;
