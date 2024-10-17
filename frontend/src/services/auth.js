import axios from "axios";

const API_URL = "https://moodify-emotion-music-app.onrender.com";

export const register = async (username, password, email) => {
  try {
    await axios.post(`${API_URL}/users/register/`, {
      username,
      password,
      email,
    });
  } catch (error) {
    console.error("Registration error:", error);
  }
};
