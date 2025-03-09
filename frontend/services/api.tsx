import axios from 'axios';
                   

export const API_URL = 'http://13.60.180.213:4000/api';
export const baseURL = 'http://13.60.180.213:4000';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Register User

// Function to handle user signup
export const registerUser = async (name: string, email: string, password: string,  fullPhoneNumber: string) => {
  try {
    const response = await api.post('/user/signup', {name, email, fullPhoneNumber, password});
    return response.data;
  } catch (error:string) {
    if (error.response) {
      // Backend returned a response with an error
      console.error('Server Error:', error.response.data);
    } else {
      // Other error (network issues, timeout, etc.)
      console.error('Error signing up:', error.message);
    }
    throw error;
  }
};

// Function to handle user login
export const loginUser = async (email: string, password: string, latitude: string, longitude: string) => {
  try {
    const response = await api.post('/user/login', { email, password, latitude, longitude });
    return response.data;
  } catch (error) {
    console.error('Error logging in:', error);
    throw error;
  }
};