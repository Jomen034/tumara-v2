import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "../lib/api";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem("tumara_session_token");
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    let attempts = 0;
    const maxAttempts = 3;
    while (attempts < maxAttempts) {
      try {
        attempts++;
        const res = await api.get("/auth/me");
        setUser(res.data);
        setLoading(false);
        return;
      } catch (err) {
        // Only evict token if explicitly rejected by server with 401 or 403
        if (err?.response?.status === 401 || err?.response?.status === 403) {
          localStorage.removeItem("tumara_session_token");
          setUser(null);
          setLoading(false);
          return;
        }

        const isColdStartOrNetwork =
          !err.response ||
          err.code === "ECONNABORTED" ||
          err.message === "Network Error" ||
          [502, 503, 504].includes(err.response?.status);

        if (isColdStartOrNetwork && attempts < maxAttempts) {
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }

        // On network/cold boot failure, keep token in localStorage so user isn't logged out
        setUser(null);
        setLoading(false);
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
  }, []);

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    localStorage.removeItem("tumara_session_token");
    setUser(null);
    window.location.href = "/";
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loginWithSession, loading, checkAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
