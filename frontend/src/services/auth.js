import axios from "axios";

import { API_URL } from "../config";

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
