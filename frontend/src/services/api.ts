import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

export const ACCESS_TOKEN_KEY = "workforce_access_token";
export const REFRESH_TOKEN_KEY = "workforce_refresh_token";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export const clearStoredTokens = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem("workforce_user");
};

/** Extract a human-readable message from an API error (FastAPI `detail`), with a fallback. */
export const getErrorMessage = (err: unknown, fallback: string): string => {
  const detail = (err as AxiosError<{ detail?: unknown }>)?.response?.data?.detail;
  return typeof detail === "string" ? detail : fallback;
};

// Attach Authorization Bearer token to outgoing requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Refresh tokens are single-use (rotated by the backend), so concurrent 401s must share
// one refresh call - otherwise the second refresh would present an already-used token
// and log the user out.
let refreshInFlight: Promise<string> | null = null;

const refreshAccessToken = (): Promise<string> => {
  if (!refreshInFlight) {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    refreshInFlight = (
      refreshToken
        ? axios
            .post(`${API_URL}/auth/refresh`, { refresh_token: refreshToken })
            .then((res) => {
              localStorage.setItem(ACCESS_TOKEN_KEY, res.data.access_token);
              localStorage.setItem(REFRESH_TOKEN_KEY, res.data.refresh_token);
              return res.data.access_token as string;
            })
        : Promise.reject(new Error("No refresh token"))
    ).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
};

// Endpoints whose 401 means "bad credentials", not "access token expired"
const isAuthEndpoint = (url?: string) =>
  !!url && ["/auth/login", "/auth/refresh", "/auth/logout"].some((path) => url.includes(path));

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

// Response interceptor to handle token refresh / 401 redirection
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableConfig | undefined;
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthEndpoint(originalRequest.url)
    ) {
      originalRequest._retry = true;
      try {
        const newAccessToken = await refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch {
        clearStoredTokens();
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
