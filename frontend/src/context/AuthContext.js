import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "../lib/api";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [serverWaking, setServerWaking] = useState(false);
  const [wakingAttempt, setWakingAttempt] = useState(0);
  const [connectionError, setConnectionError] = useState(false);

  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem("tumara_session_token");
    if (!token) {
      setUser(null);
      setLoading(false);
      setServerWaking(false);
      setConnectionError(false);
      return;
    }

    setLoading(true);
    setConnectionError(false);

    let attempts = 0;
    // Render free-tier cold starts can take up to 70-90 seconds
    const maxAttempts = 15;
    while (attempts < maxAttempts) {
      try {
        attempts++;
        if (attempts > 1) {
          setServerWaking(true);
          setWakingAttempt(attempts);
        }
        const res = await api.get("/auth/me");
        setUser(res.data);
        setLoading(false);
        setServerWaking(false);
        setConnectionError(false);
        return;
      } catch (err) {
        // Only evict token if explicitly rejected by server with 401 or 403
        if (err?.response?.status === 401 || err?.response?.status === 403) {
          localStorage.removeItem("tumara_session_token");
          setUser(null);
          setLoading(false);
          setServerWaking(false);
          setConnectionError(false);
          return;
        }

        const isColdStartOrNetwork =
          !err.response ||
          err.code === "ECONNABORTED" ||
          err.message === "Network Error" ||
          [502, 503, 504].includes(err.response?.status);

        if (isColdStartOrNetwork && attempts < maxAttempts) {
          setServerWaking(true);
          setWakingAttempt(attempts);
          await new Promise((r) => setTimeout(r, 2500));
          continue;
        }

        // Token is preserved in localStorage, but let user know server took too long to connect
        setServerWaking(false);
        setConnectionError(true);
        // Do NOT set user = null or remove token; keep loading = true so user stays on reconnection screen
        return;
      }
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const loginWithSession = useCallback((userData, sessionToken) => {
    if (sessionToken) {
      localStorage.setItem("tumara_session_token", sessionToken);
    }
    setUser(userData);
    setLoading(false);
    setServerWaking(false);
    setConnectionError(false);
  }, []);

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    localStorage.removeItem("tumara_session_token");
    setUser(null);
    setServerWaking(false);
    setConnectionError(false);
    window.location.href = "/";
  };

  const retryAuth = () => {
    setConnectionError(false);
    checkAuth();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        loginWithSession,
        loading,
        serverWaking,
        wakingAttempt,
        connectionError,
        checkAuth,
        retryAuth,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
