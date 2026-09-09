import React, { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);
export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem("tumara-theme") || localStorage.getItem("nusa-theme") || "dark");
  const [privacy, setPrivacy] = useState(() => (localStorage.getItem("tumara-privacy") || localStorage.getItem("nusa-privacy")) === "1");

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("tumara-theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("tumara-privacy", privacy ? "1" : "0");
  }, [privacy]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  const togglePrivacy = () => setPrivacy((p) => !p);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, privacy, togglePrivacy }}>
      {children}
    </ThemeContext.Provider>
  );
}
