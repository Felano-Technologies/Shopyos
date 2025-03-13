import axios from 'axios';
                   

export const API_URL = 'http://172.20.10.3:5000/api/';
export const baseURL = 'http://172.20.10.3:5000';

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
    const response = await api.post('/auth/register', {name, email, fullPhoneNumber, password});
    return response.data;
  } catch (error:any) {
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
export const loginUser = async (email: string, password: string, latitude: number, longitude: number) => {
  try {
    const response = await api.post('/auth/login', { email, password, latitude, longitude });
    return response.data;
  } catch (error: any) {
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