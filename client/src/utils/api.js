import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000'
});

// Automatically attach the barber token to every request
API.interceptors.request.use(config => {
  const token = localStorage.getItem('barberToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const joinQueue = (data) => API.post('/api/customer/join', data);
export const getCustomerStatus = (id) => API.get(`/api/customer/status/${id}`);
export const getQueueOpenStatus = () => API.get('/api/customer/queue-status');
export const loginBarber = (credentials) => API.post('/api/auth/login', credentials);
export const getQueue = () => API.get('/api/queue');
export const addWalkIn = (data) => API.post('/api/queue/add', data);
export const removeCustomer = (id) => API.delete(`/api/queue/remove/${id}`);
export const barberNext = () => API.post('/api/queue/next');
export const barberArrived = () => API.post('/api/queue/arrived');
export const barberNoShow = () => API.post('/api/queue/noshow');
export const startWorkingDay = () => API.post('/api/queue/start-day');
export const endWorkingDay = () => API.post('/api/queue/end-day');
export const getAdminLog = () => API.get('/api/queue/log');
export const subscribePush = (data) => API.post('/api/customer/subscribe', data);
export const confirmComing = (id) => API.post(`/api/customer/confirm-coming/${id}`);
export const getMyReservation = (deviceId) => API.get(`/api/customer/my-reservation?deviceId=${deviceId}`);
export const cancelReservation = (id) => API.post(`/api/customer/cancel/${id}`);
export const rejoinQueue = (id) => API.post(`/api/customer/rejoin/${id}`);