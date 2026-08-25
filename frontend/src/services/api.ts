import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach Authorization Bearer token to outgoing requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("workforce_access_token");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh / 401 redirection
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem("workforce_refresh_token");

      if (refreshToken) {
        try {
          const res = await axios.post(`${API_URL}/auth/refresh`, {
            refresh_token: refreshToken,
          });
          const newAccessToken = res.data.access_token;
          localStorage.setItem("workforce_access_token", newAccessToken);
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        } catch {
          // If refresh fails, clear local storage
          localStorage.removeItem("workforce_access_token");
          localStorage.removeItem("workforce_refresh_token");
          localStorage.removeItem("workforce_user");
          window.location.href = "/login";
        }
      } else {
        localStorage.removeItem("workforce_access_token");
        localStorage.removeItem("workforce_user");
      }
    }
    return Promise.reject(error);
  }
);

export default api;
