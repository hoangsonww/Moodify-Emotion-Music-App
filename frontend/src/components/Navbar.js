import React, { useEffect, useState } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  IconButton,
} from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";
import MenuIcon from "@mui/icons-material/Menu";
import useMediaQuery from "@mui/material/useMediaQuery";
import axios from "axios";

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation(); // Get the current location
  const isMobile = useMediaQuery("(max-width:600px)");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // Function to validate the token
  const validateToken = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setIsLoggedIn(false);
      return;
    }

    try {
      // Make an authenticated request to check the token validity
      const response = await axios.get(
        "https://moodify-emotion-music-app.onrender.com/users/validate_token/",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.status === 200) {
        setIsLoggedIn(true);
      }
    } catch (error) {
      if (error.response && error.response.status === 401) {
        // If the response status is 401, the token is invalid or expired
        localStorage.removeItem("token");
        setIsLoggedIn(false);
        navigate("/login");
      }
    }
  };

  // Check if the user is logged in on component mount and whenever location changes
  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsLoggedIn(!!token);

    // Validate the token every 5 minutes (300000 ms)
    const intervalId = setInterval(validateToken, 300000);

    // Clear interval on component unmount
    return () => clearInterval(intervalId);
  }, [location]);

  // Validate token once every 5 seconds
  useEffect(() => {
    validateToken();
    const intervalId = setInterval(validateToken, 5000);
    return () => clearInterval(intervalId);
  }, []);

  // Function to determine if the current route is active
  const isActive = (path) => location.pathname === path;

  // Handle Logout
  const handleLogout = () => {
    localStorage.removeItem("token");
    setIsLoggedIn(false);
    navigate("/login");
  };

  // Toggle the mobile menu
  const toggleMenu = () => {
    setShowMenu((prev) => !prev);
  };

  return (
    <AppBar
      position="static"
      sx={{ bgcolor: "white", color: "black", boxShadow: 3 }}
    >
      <Toolbar
        sx={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          alignItems: "center",
          gap: isMobile ? "10px" : "0",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
          }}
        >
          <Typography
            variant="h6"
            sx={{
              flexGrow: 1,
              cursor: "pointer",
              fontFamily: "Poppins",
              fontSize: "24px",
              textAlign: isMobile ? "center" : "left",
              marginTop: isMobile ? "10px" : "0",
              fontWeight: "bold",
            }}
            onClick={() => navigate("/home")}
          >
            Moodify
          </Typography>
          {isMobile && (
            <IconButton
              onClick={toggleMenu}
              style={{
                position: "absolute",
                right: "10px",
                top: "10px",
                backgroundColor: "white",
              }}
            >
              <MenuIcon />
            </IconButton>
          )}
        </Box>

        {/* Mobile Menu Animation */}
        <Box
          sx={{
            display: isMobile ? "flex" : "none",
            flexDirection: "column",
            alignItems: "center",
            gap: "10px",
            width: "100%",
            maxHeight: showMenu ? "500px" : "0px", // animate maxHeight
            opacity: showMenu ? 1 : 0, // animate opacity
            overflow: "hidden",
            transition: "max-height 0.4s ease, opacity 0.4s ease", // smooth animation
          }}
        >
          <Button
            color="inherit"
            sx={buttonStyle(isActive("/home"), isMobile)}
            onClick={() => navigate("/home")}
          >
            Home
          </Button>
          <Button
            color="inherit"
            sx={buttonStyle(isActive("/profile"), isMobile)}
            onClick={() => navigate("/profile")}
          >
            Profile
          </Button>
          <Button
            color="inherit"
            sx={buttonStyle(isActive("/results"), isMobile)}
            onClick={() => navigate("/results")}
          >
            Recommendations
          </Button>
          {isLoggedIn ? (
            <Button sx={logoutButtonStyle(isMobile)} onClick={handleLogout}>
              Logout
            </Button>
          ) : (
            <Button
              sx={loginButtonStyle(isMobile)}
              onClick={() => navigate("/login")}
            >
              Login
            </Button>
          )}
        </Box>

        {/* Desktop Menu */}
        <Box
          sx={{
            display: isMobile ? "none" : "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: "10px",
            width: "auto",
          }}
        >
          <Button
            color="inherit"
            sx={buttonStyle(isActive("/home"), false)}
            onClick={() => navigate("/home")}
          >
            Home
          </Button>
          <Button
            color="inherit"
            sx={buttonStyle(isActive("/profile"), false)}
            onClick={() => navigate("/profile")}
          >
            Profile
          </Button>
          <Button
            color="inherit"
            sx={buttonStyle(isActive("/results"), false)}
            onClick={() => navigate("/results")}
          >
            Recommendations
          </Button>
          {isLoggedIn ? (
            <Button sx={logoutButtonStyle(false)} onClick={handleLogout}>
              Logout
            </Button>
          ) : (
            <Button
              sx={loginButtonStyle(false)}
              onClick={() => navigate("/login")}
            >
              Login
            </Button>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

// Styles for the buttons
const buttonStyle = (isActive, isMobile) => ({
  marginRight: isMobile ? "0" : "10px",
  fontFamily: "Poppins",
  backgroundColor: isActive ? "#ff4d4d" : "transparent",
  color: isActive ? "white" : "black",
  width: isMobile ? "100%" : "auto",
  "&:hover": {
    backgroundColor: "#ff4d4d",
    color: "white",
  },
});

// Styles for the Logout button (red text)
const logoutButtonStyle = (isMobile) => ({
  marginRight: isMobile ? "0" : "10px",
  fontFamily: "Poppins",
  color: "red", // Red text for logout
  width: isMobile ? "100%" : "auto",
  "&:hover": {
    backgroundColor: "#ff4d4d",
    color: "white",
  },
});

// Styles for the Login button (blue text)
const loginButtonStyle = (isMobile) => ({
  marginRight: isMobile ? "0" : "10px",
  fontFamily: "Poppins",
  color: "blue", // Blue text for login
  width: isMobile ? "100%" : "auto",
  "&:hover": {
    backgroundColor: "#ff4d4d",
    color: "white",
  },
});

export default Navbar;
