import axios from "axios";

// Clean trailing slashes from the backend URL
const RAW_BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || "").trim().replace(/\/+$/, "");
export const API = RAW_BACKEND_URL ? `${RAW_BACKEND_URL}/api` : "/api";

const api = axios.create({
  baseURL: API,
  withCredentials: true,
  timeout: 60000, // 60s to accommodate Render free-tier cold starts
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("tumara_session_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Retry helper specifically for cold-starting backends
export async function postWithColdStartRetry(url, data, onStatusUpdate = null, maxRetries = 3) {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      attempt++;
      if (attempt > 1 && onStatusUpdate) {
        onStatusUpdate(`Server sedang bangun (${attempt}/${maxRetries}), mohon tunggu...`);
      }
      return await api.post(url, data);
    } catch (err) {
      const isNetworkOrColdStart =
        !err.response ||
        err.code === "ECONNABORTED" ||
        err.message === "Network Error" ||
        [502, 503, 504].includes(err.response?.status);

      if (isNetworkOrColdStart && attempt < maxRetries) {
        if (onStatusUpdate) {
          onStatusUpdate("Server backend sedang proses bangun, mencoba ulang...");
        }
        await new Promise((resolve) => setTimeout(resolve, 3000));
        continue;
      }
      throw err;
    }
  }
}

export default api;
