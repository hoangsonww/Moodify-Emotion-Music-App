import React, { createContext, useState, useEffect } from "react";

// Create the context
export const DarkModeContext = createContext();

// DarkModeProvider to wrap the app and provide dark mode state
export const DarkModeProvider = ({ children }) => {
  // Check the initial value from localStorage
  const [isDarkMode, setIsDarkMode] = useState(
    localStorage.getItem("darkMode") === "true",
  );

  // Sync to localStorage AND drive the global theme classes on <body>.
  // styles.css defines `body.dark-mode` / `body.light-mode` rules (page
  // background, default text, raw button/input/link colours, scrollbars),
  // but nothing was ever applying those classes -- so toggling the switch
  // only re-coloured the React components that read this context inline and
  // left the body-level theming stuck until a reload. Toggling the class
  // here (on mount and on every change) recolours the whole app the instant
  // the switch flips.
  useEffect(() => {
    localStorage.setItem("darkMode", isDarkMode);
    const body = document.body;
    body.classList.toggle("dark-mode", isDarkMode);
    body.classList.toggle("light-mode", !isDarkMode);
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
