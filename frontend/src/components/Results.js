import React from 'react';
import { Box, Typography } from '@mui/material';
import { useLocation } from 'react-router-dom';

const Results = () => {
  const location = useLocation();
  const results = location.state; // Assuming the results are passed via state

  return (
    <Box sx={{ p: 3, bgcolor: 'white', boxShadow: 3 }}>
      <Typography variant="h4">Recommended Songs</Typography>
      {results && results.map((song, index) => (
        <Typography key={index} variant="body1">{song.title} - {song.artist}</Typography>
      ))}
    </Box>
  );
};

export default Results;
