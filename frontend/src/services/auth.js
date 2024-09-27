// src/services/auth.js
import axios from 'axios';

const API_URL = 'http://127.0.0.1:8000';

export const register = async (username, password, email) => {
  try {
    await axios.post(`${API_URL}/users/register/`, { username, password, email });
  } catch (error) {
    console.error('Registration error:', error);
  }
};

// Other endpoints follow the same pattern
