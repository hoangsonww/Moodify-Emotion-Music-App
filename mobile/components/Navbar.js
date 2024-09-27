import React, { useEffect, useState } from 'react';
import { AppBar, Toolbar, Typography, Button, Box, IconButton } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import MenuIcon from '@mui/icons-material/Menu';
import useMediaQuery from '@mui/material/useMediaQuery';
import axios from 'axios';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation(); // Get the current location
  const isMobile = useMediaQuery('(max-width:600px)'); // Check if the screen is mobile size
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // Function to validate the token
  const validateToken = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setIsLoggedIn(false);
      return;
    }

    try {
      // Make an authenticated request to check the token validity
      const response = await axios.get('http://127.0.0.1:8000/users/user/profile/', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 200) {
        setIsLoggedIn(true);
      }
    } catch (error) {
      if (error.response && error.response.status === 401) {
        // If the response status is 401, the token is invalid or expired
        localStorage.removeItem('token');
        setIsLoggedIn(false);
        navigate('/login');
      }
    }
  };

  // Check if the user is logged in on component mount and whenever location changes
  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsLoggedIn(!!token);

    // Validate the token every 5 minutes (300000 ms)
    const intervalId = setInterval(validateToken, 300000);

    // Clear interval on component unmount
    return () => clearInterval(intervalId);
  }, [location]);

  // Function to determine if the current route is active
  const isActive = (path) => location.pathname === path;

  // Handle Logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsLoggedIn(false);
    navigate('/login');
  };

  // Toggle the mobile menu
  const toggleMenu = () => {
    setShowMenu((prev) => !prev);
  };

  return (
      <AppBar position="static" sx={{ bgcolor: 'white', color: 'black', boxShadow: 3 }}>
        <Toolbar sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'center', gap: isMobile ? '10px' : '0' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
            <Typography
                variant="h6"
                sx={{
                  flexGrow: 1,
                  cursor: 'pointer',
                  fontFamily: 'Poppins',
                  fontSize: '24px',
                  textAlign: isMobile ? 'center' : 'left',
                  marginTop: isMobile ? '10px' : '0',
                }}
                onClick={() => navigate('/')}
            >
              Moodify
            </Typography>
            {isMobile && (
                <IconButton onClick={toggleMenu} style={{ position: 'absolute', right: '10px', top: '10px', backgroundColor: 'white' }}>
                  <MenuIcon />
                </IconButton>
            )}
          </Box>

          {/* Desktop or Mobile Menu Display */}
          <Box
              sx={{
                display: isMobile ? (showMenu ? 'flex' : 'none') : 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                alignItems: 'center',
                gap: '10px',
                width: isMobile ? '100%' : 'auto',
              }}
          >
            <Button
                color="inherit"
                sx={{
                  marginRight: isMobile ? '0' : '10px',
                  fontFamily: 'Poppins',
                  backgroundColor: isActive('/home') ? '#ff4d4d' : isActive('/') ? '#ff4d4d' : 'transparent',
                  color: isActive('/home') ? 'white' : isActive('/') ? 'white' : 'black',
                  width: isMobile ? '100%' : 'auto',
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
                  marginRight: isMobile ? '0' : '10px',
                  fontFamily: 'Poppins',
                  backgroundColor: isActive('/profile') ? '#ff4d4d' : 'transparent',
                  color: isActive('/profile') ? 'white' : 'black',
                  width: isMobile ? '100%' : 'auto',
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
                  marginRight: isMobile ? '0' : '10px',
                  fontFamily: 'Poppins',
                  backgroundColor: isActive('/results') ? '#ff4d4d' : 'transparent',
                  color: isActive('/results') ? 'white' : 'black',
                  width: isMobile ? '100%' : 'auto',
                  '&:hover': {
                    backgroundColor: '#ff4d4d',
                    color: 'white',
                  },
                }}
                onClick={() => navigate('/results')}
            >
              Recommendations
            </Button>
            {isLoggedIn ? (
                <Button
                    color="error"
                    sx={{
                      marginRight: isMobile ? '0' : '10px',
                      fontFamily: 'Poppins',
                      width: isMobile ? '100%' : 'auto',
                      '&:hover': {
                        backgroundColor: '#ff4d4d',
                        color: 'white',
                      },
                    }}
                    onClick={handleLogout}
                >
                  Logout
                </Button>
            ) : (
                <Button
                    color="primary"
                    sx={{
                      marginRight: isMobile ? '0' : '10px',
                      fontFamily: 'Poppins',
                      width: isMobile ? '100%' : 'auto',
                      '&:hover': {
                        backgroundColor: '#ff4d4d',
                        color: 'white',
                      },
                    }}
                    onClick={() => navigate('/login')}
                >
                  Login
                </Button>
            )}
          </Box>
        </Toolbar>
      </AppBar>
  );
};

export default Navbar;
