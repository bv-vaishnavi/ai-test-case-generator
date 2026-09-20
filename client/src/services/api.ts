import axios from "axios";
import { clearSession } from "../lib/session";
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  timeout: 190_000,
});
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      !error.config?.url?.startsWith("/auth/")
    ) {
      clearSession();
      window.location.assign("/login");
    }
    return Promise.reject(error);
  },
);
export function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    if (typeof error.response?.data?.message === "string")
      return error.response.data.message;
    if (error.code === "ECONNABORTED")
      return "The request timed out. Refresh to check its status before retrying.";
    if (!error.response)
      return "Unable to reach the server. Check your connection and try again.";
  }
  return "Something went wrong. Please try again.";
}
export default api;
