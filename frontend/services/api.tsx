import axios from 'axios';
                   

export const API_URL = 'http://172.20.10.3:5000/api/';
export const baseURL = 'http://172.20.10.2:5000';
// export const API_URL = 'https://dios-mnxg.onrender.com/api/';
// export const baseURL = 'https://dios-mnxg.onrender.com';

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
export const getUserData = async (token: string) => {
  try {
    const response = await api.get('/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error: any) {
    if (error.response) {
      // Backend returned a response with an error payload
      console.error('Server Error:', error.response.data);
    } else {
      // Something else went wrong (network, timeout, etc.)
      console.error('Error fetching user data:', error.message);
    }
    throw error;
  }
};

export const registerBusiness = async (businessName: string, email: string, phone: string, password: string) => {
  try {
    const response = await api.post('/business/register', { businessName, email, phone, password });
    return response.data;
  } catch (error: any) {
    if (error.response) {
      console.error('Server Error:', error.response.data);
    } else {
      console.error('Error registering business:', error.message);
    }
    throw error;
  }
};


export const loginBusiness = async (email: string, password: string, latitude: number, longitude: number) => {
  try {
    const response = await api.post('/business/login', { email, password, latitude, longitude });
    return response.data;
  } catch (error: any) {
    if (error.response) {
      console.error('Server Error:', error.response.data);
    } else {
      console.error('Error logging in business:', error.message);
    }
    throw error;
  }
};
