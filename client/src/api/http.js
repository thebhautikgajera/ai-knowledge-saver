import axios from 'axios';

const baseURL =
    import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

let getAccessToken = null;
let refreshAccessToken = null;

export const setAuthTokenHandlers = (opts) => {
    getAccessToken = opts.getAccessToken;
    refreshAccessToken = opts.refreshAccessToken;
};

const http = axios.create({
    baseURL: `${baseURL}/api`,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor - add access token
// Note: tenantId is extracted from JWT token on server side, not sent from client
http.interceptors.request.use((config) => {
    if (getAccessToken) {
        const token = getAccessToken();
        if (token) {
            const headers = config.headers ?? {};
            headers.Authorization = `Bearer ${token}`;
            config.headers = headers;
        }
    }

    return config;
});

let isRefreshing = false;
let pendingRequests = [];

const processQueue = (token) => {
    pendingRequests.forEach((cb) => cb(token));
    pendingRequests = [];
};

// Response interceptor - handle token refresh
http.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (
            error.response?.status === 401 &&
                originalRequest &&
                !originalRequest._retry &&
                refreshAccessToken &&
                !originalRequest.url?.includes('/auth/refresh')
        ) {
            originalRequest._retry = true;

            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    pendingRequests.push((token) => {
                        if (!token) {
                            reject(error);
                            return;
                        }
                        const headers = originalRequest.headers ?? {};
                        headers.Authorization = `Bearer ${token}`;
                        originalRequest.headers = headers;
                        resolve(http(originalRequest));
                    });
                });
            }

            isRefreshing = true;

            try {
                const newToken = await refreshAccessToken();
                processQueue(newToken ?? null);

                if (!newToken) {
                    return Promise.reject(error);
                }

                const headers = originalRequest.headers ?? {};
                headers.Authorization = `Bearer ${newToken}`;
                originalRequest.headers = headers;

                return http(originalRequest);
            } catch (refreshError) {
                processQueue(null);
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

export default http;