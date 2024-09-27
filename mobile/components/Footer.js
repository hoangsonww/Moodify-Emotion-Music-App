import React from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import { Box, Typography, Link } from '@mui/material';
import { GitHub, Instagram, LinkedIn, Mail } from '@mui/icons-material';

const Footer = () => {
  const navigate = useNavigate();

  return (
      <Box style={styles.footer}>
        {/* Navigation Links */}
        <Box style={styles.navLinks}>
          <Link style={styles.link} onClick={() => navigate('/')}>
            Home
          </Link>
          <Link style={styles.link} onClick={() => navigate('/results')}>
            Results
          </Link>
          <Link style={styles.link} onClick={() => navigate('/recommendations')}>
            Profile
          </Link>
          <Link style={styles.link} onClick={() => navigate('/login')}>
            Login
          </Link>
          <Link style={styles.link} onClick={() => navigate('/register')}>
            Logout
          </Link>
        </Box>

        {/* Icon Links */}
        <Box style={styles.iconContainer}>
          <Link href="https://github.com/hoangsonww" target="_blank" rel="noopener noreferrer" style={styles.iconLink}>
            <GitHub style={styles.icon} />
          </Link>
          <Link href="https://www.instagram.com/hoangsonw_" target="_blank" rel="noopener noreferrer" style={styles.iconLink}>
            <Instagram style={styles.icon} />
          </Link>
          <Link href="https://www.linkedin.com/in/hoangsonw" target="_blank" rel="noopener noreferrer" style={styles.iconLink}>
            <LinkedIn style={styles.icon} />
          </Link>
          <Link href="mailto:hoangson091104@gmail.com" style={styles.iconLink}>
            <Mail style={styles.icon} />
          </Link>
        </Box>

        {/* Copyright Text */}
        <Typography variant="body2" style={styles.copyright}>
          &copy; {new Date().getFullYear()} Moodify. All rights reserved.
        </Typography>
      </Box>
  );
};

const styles = {
  footer: {
    backgroundColor: '#ff4d4d',
    color: 'white',
    padding: '20px 0',
    textAlign: 'center',
    marginTop: '20px',
  },
  navLinks: {
    display: 'flex',
    justifyContent: 'center',
    gap: '20px',
    marginBottom: '10px',
  },
  link: {
    cursor: 'pointer',
    color: 'white',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: 500,
    '&:hover': {
      textDecoration: 'underline',
    },
  },
  iconContainer: {
    display: 'flex',
    justifyContent: 'center',
    gap: '20px',
    marginBottom: '10px',
  },
  iconLink: {
    color: 'white',
  },
  icon: {
    fontSize: '30px',
    transition: 'transform 0.3s',
    '&:hover': {
      transform: 'scale(1.2)',
    },
  },
  copyright: {
    font: 'inherit',
    marginTop: '10px',
    fontSize: '14px',
  },
};

export default Footer;
