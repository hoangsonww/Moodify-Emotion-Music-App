import React, { createContext, useState, useEffect } from "react";

// Create the context
export const DarkModeContext = createContext();

// DarkModeProvider to wrap the app and provide dark mode state
export const DarkModeProvider = ({ children }) => {
  // Check the initial value from localStorage
  const [isDarkMode, setIsDarkMode] = useState(
    localStorage.getItem("darkMode") === "true",
  );

  // Effect to sync with localStorage when state changes
  useEffect(() => {
    localStorage.setItem("darkMode", isDarkMode);
  }, [isDarkMode]);

  // Function to toggle dark mode
  const toggleDarkMode = () => {
    setIsDarkMode((prevMode) => !prevMode);
  };

  return (
    <DarkModeContext.Provider value={{ isDarkMode, toggleDarkMode }}>
      {children}
    </DarkModeContext.Provider>
  );
};
