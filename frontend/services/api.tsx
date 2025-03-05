//import axios from 'axios';

const API_URL = 'http://172.20.10.4:3000';


// Register User
export const registerUser = async (name: string, email: string, password: string) => {
  try {
    const response = await axios.post(`${API_URL}/api/auth/register`, {
       name,
      email,
      password,
    });
    return response.data;
  } catch (error) {
    throw error.response.data;
  }
};

// Login User
export const loginUser = async (email: string, password: string) => {
  try {
    const response = await axios.post(`${API_URL}/api/auth/login`, {
      email,
      password,
    });
    return response.data;
  } catch (error) {
    throw error.response.data;
  }
};

