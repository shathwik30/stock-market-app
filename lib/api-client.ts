import axios from 'axios';
import { useAuthStore } from '@/store/useAuthStore';

const apiClient = axios.create();

// Attach access token to every request
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let pendingRequests: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

function onRefreshed(newToken: string) {
  pendingRequests.forEach(({ resolve }) => resolve(newToken));
  pendingRequests = [];
}

function onRefreshFailed(error: unknown) {
  pendingRequests.forEach(({ reject }) => reject(error));
  pendingRequests = [];
}

// On 401, use refresh token to get new tokens and retry the request
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only handle 401s, skip if already retried or if it's the refresh endpoint itself
    if (
      error.response?.status !== 401 ||
      originalRequest._retry ||
      originalRequest.url === '/api/auth/refresh'
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    const { refreshToken, setAuth, logout } = useAuthStore.getState();

    if (!refreshToken) {
      logout();
      return Promise.reject(error);
    }

    // If already refreshing, queue this request
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        pendingRequests.push({ resolve, reject });
      }).then((newToken) => {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      });
    }

    isRefreshing = true;

    try {
      const response = await axios.post('/api/auth/refresh', { refreshToken });
      const { accessToken: newAccessToken, refreshToken: newRefreshToken, user } = response.data;

      setAuth(user, newAccessToken, newRefreshToken);

      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

      onRefreshed(newAccessToken);

      return apiClient(originalRequest);
    } catch (refreshError) {
      onRefreshFailed(refreshError);
      logout();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default apiClient;
