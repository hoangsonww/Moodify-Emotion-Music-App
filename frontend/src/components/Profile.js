import React, { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { getProfile } from '../utils/api';

const Profile = () => {
  const [user, setUser] = useState({});

  useEffect(() => {
    const fetchProfile = async () => {
      const response = await getProfile();
      setUser(response.data);
    };
    fetchProfile();
  }, []);

  return (
    <Box sx={{ p: 3, bgcolor: 'white', boxShadow: 3 }}>
      <Typography variant="h4">User Profile</Typography>
      <Typography variant="h6">Username: {user.username}</Typography>
      <Typography variant="h6">Email: {user.email}</Typography>
    </Box>
  );
};

export default Profile;
