import axios from 'axios';

const API_URL = 'http://127.0.0.1:8000'; // Change to your backend URL

export const loginUser = async (credentials) => {
  const response = await axios.post(`${API_URL}/users/login/`, credentials);
  localStorage.setItem('token', response.data.token);
  return response.data;
};

export const logoutUser = () => {
  localStorage.removeItem('token');
};
