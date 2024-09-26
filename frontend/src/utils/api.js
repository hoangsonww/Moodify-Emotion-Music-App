import axios from 'axios';

const API_URL = 'http://127.0.0.1:8000'; // Change to your backend URL

const getToken = () => localStorage.getItem('token');

export const getProfile = async () => {
  return await axios.get(`${API_URL}/users/user/profile/`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
};

export const analyzeText = async (text) => {
  return await axios.post(`${API_URL}/api/text_emotion/`, { text });
};

// Add functions for speech and facial emotion analysis as well
