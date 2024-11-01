import React, { useEffect, useState, useContext } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Switch,
  Divider,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useNavigate, useLocation } from "react-router-dom";
import MenuIcon from "@mui/icons-material/Menu";
import HomeIcon from "@mui/icons-material/Home";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import RecommendIcon from "@mui/icons-material/Recommend";
import LoginIcon from "@mui/icons-material/Login";
import LogoutIcon from "@mui/icons-material/Logout";
import useMediaQuery from "@mui/material/useMediaQuery";
import axios from "axios";
import { DarkModeContext } from "../context/DarkModeContext";

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery("(max-width:600px)");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // Use DarkModeContext for dark mode state and toggle function
  const { isDarkMode, toggleDarkMode } = useContext(DarkModeContext);

  // Function to validate the token
  const validateToken = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setIsLoggedIn(false);
      return;
    }

    try {
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
        localStorage.removeItem("token");
        setIsLoggedIn(false);
      }
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsLoggedIn(!!token);

    const intervalId = setInterval(validateToken, 300000); // Validate token every 5 minutes
    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  useEffect(() => {
    validateToken();
    const intervalId = setInterval(validateToken, 5000); // Validate token every 5 seconds
    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    localStorage.removeItem("token");
    setIsLoggedIn(false);
    navigate("/login");
  };

  const toggleDrawer = (open) => setShowMenu(open);

  const drawerList = (
    <Box
      sx={{
        width: 250,
        bgcolor: isDarkMode ? "#222" : "white", // Apply dark mode background color
        color: isDarkMode ? "white" : "black", // Apply dark mode text color
      }}
      role="presentation"
    >
      <List sx={{ transition: "background-color 0.3s ease" }}>
        <ListItem
          button
          sx={listItemStyle(isActive("/home"), isDarkMode)}
          style={{ cursor: "pointer" }}
          onClick={() => {
            navigate("/home");
            toggleDrawer(false);
          }}
        >
          <ListItemIcon sx={{ color: isDarkMode ? "white" : "inherit" }}>
            <HomeIcon />
          </ListItemIcon>
          <ListItemText
            primary="Home"
            primaryTypographyProps={{
              fontFamily: "Poppins",
              fontSize: "16px",
            }}
          />
        </ListItem>
        <ListItem
          button
          style={{ cursor: "pointer" }}
          sx={listItemStyle(isActive("/profile"), isDarkMode)}
          onClick={() => {
            navigate("/profile");
            toggleDrawer(false);
          }}
        >
          <ListItemIcon sx={{ color: isDarkMode ? "white" : "inherit" }}>
            <AccountCircleIcon />
          </ListItemIcon>
          <ListItemText
            primary="Profile"
            primaryTypographyProps={{
              fontFamily: "Poppins",
              fontSize: "16px",
            }}
          />
        </ListItem>
        <ListItem
          button
          style={{ cursor: "pointer" }}
          sx={listItemStyle(isActive("/results"), isDarkMode)}
          onClick={() => {
            navigate("/results");
            toggleDrawer(false);
          }}
        >
          <ListItemIcon sx={{ color: isDarkMode ? "white" : "inherit" }}>
            <RecommendIcon />
          </ListItemIcon>
          <ListItemText
            primary="Recommendations"
            primaryTypographyProps={{
              fontFamily: "Poppins",
              fontSize: "16px",
            }}
          />
        </ListItem>
        {isLoggedIn ? (
          <ListItem
            button
            style={{ cursor: "pointer" }}
            sx={listItemStyle(false, isDarkMode)}
            onClick={() => {
              handleLogout();
              toggleDrawer(false);
            }}
          >
            <ListItemIcon sx={{ color: isDarkMode ? "white" : "inherit" }}>
              <LogoutIcon />
            </ListItemIcon>
            <ListItemText
              primary="Logout"
              primaryTypographyProps={{
                fontFamily: "Poppins",
                fontSize: "16px",
              }}
            />
          </ListItem>
        ) : (
          <ListItem
            button
            style={{ cursor: "pointer" }}
            sx={listItemStyle(isActive("/login"), isDarkMode)}
            onClick={() => {
              navigate("/login");
              toggleDrawer(false);
            }}
          >
            <ListItemIcon sx={{ color: isDarkMode ? "white" : "inherit" }}>
              <LoginIcon />
            </ListItemIcon>
            <ListItemText
              primary="Login"
              primaryTypographyProps={{
                fontFamily: "Poppins",
                fontSize: "16px",
              }}
            />
          </ListItem>
        )}
        <ListItem
          button
          style={{ cursor: "pointer" }}
          onClick={() => toggleDrawer(false)}
          sx={listItemStyle(false, isDarkMode)}
        >
          <ListItemIcon sx={{ color: isDarkMode ? "white" : "inherit" }}>
            <CloseIcon />
          </ListItemIcon>
          <ListItemText
            primary="Close"
            primaryTypographyProps={{
              fontFamily: "Poppins",
              fontSize: "16px",
            }}
          />
        </ListItem>
      </List>
      <Divider sx={{ bgcolor: isDarkMode ? "white" : "inherit" }} />
      {/* Dark Mode Toggle */}
      <ListItem>
        <ListItemIcon sx={{ color: isDarkMode ? "white" : "inherit" }}>
          {isDarkMode ? <DarkModeIcon /> : <LightModeIcon />}
        </ListItemIcon>
        <Switch
          checked={isDarkMode}
          onChange={toggleDarkMode}
          inputProps={{ "aria-label": "dark mode toggle" }}
          sx={{ cursor: "pointer" }}
        />
      </ListItem>
    </Box>
  );

  return (
    <AppBar
      position="static"
      sx={{
        bgcolor: isDarkMode ? "#222" : "white",
        color: isDarkMode ? "white" : "black",
        boxShadow: 3,
        transition: "background-color 0.3s ease",
      }}
    >
      <Toolbar
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Typography
          variant="h6"
          sx={{
            cursor: "pointer",
            fontFamily: "Poppins",
            fontSize: "24px",
            fontWeight: "bold",
            color: isDarkMode ? "white" : "black",
          }}
          onClick={() => navigate("/home")}
        >
          Moodify
        </Typography>

        {/* Mobile Menu Icon */}
        {isMobile && (
          <IconButton onClick={() => toggleDrawer(true)} color="inherit">
            <MenuIcon />
          </IconButton>
        )}

        {/* Drawer for Mobile Menu */}
        <Drawer
          anchor="right"
          open={showMenu}
          onClose={() => toggleDrawer(false)}
          sx={{
            "& .MuiDrawer-paper": {
              bgcolor: isDarkMode ? "#222" : "white", // Dark mode drawer background
              color: isDarkMode ? "white" : "black", // Dark mode drawer text color
            },
          }}
        >
          {drawerList}
        </Drawer>

        {/* Desktop Menu */}
        <Box
          sx={{
            display: isMobile ? "none" : "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <Button
            color="inherit"
            startIcon={<HomeIcon />}
            sx={buttonStyle(isActive("/home"))}
            onClick={() => navigate("/home")}
          >
            Home
          </Button>
          <Button
            color="inherit"
            startIcon={<AccountCircleIcon />}
            sx={buttonStyle(isActive("/profile"))}
            onClick={() => navigate("/profile")}
          >
            Profile
          </Button>
          <Button
            color="inherit"
            startIcon={<RecommendIcon />}
            sx={buttonStyle(isActive("/results"))}
            onClick={() => navigate("/results")}
          >
            Recommendations
          </Button>
          {isLoggedIn ? (
            <Button
              color="inherit"
              startIcon={<LogoutIcon />}
              sx={logoutButtonStyle()}
              onClick={handleLogout}
            >
              Logout
            </Button>
          ) : (
            <Button
              color="inherit"
              startIcon={<LoginIcon />}
              sx={loginButtonStyle(isDarkMode)}
              onClick={() => navigate("/login")}
            >
              Login
            </Button>
          )}
          {/* Dark Mode Toggle for Desktop */}
          <IconButton onClick={toggleDarkMode} color="inherit">
            {isDarkMode ? <DarkModeIcon /> : <LightModeIcon />}
          </IconButton>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

// Styles for the ListItems with border radius and active styles
const listItemStyle = (isActive, isDarkMode) => ({
  fontFamily: "Poppins",
  borderRadius: "8px",
  backgroundColor: isActive ? "#ff4d4d" : "transparent",
  color: isActive && isDarkMode ? "white" : "inherit",
  transition: "background-color 0.3s ease",
});

// Styles for the buttons in the desktop navbar
const buttonStyle = (isActive) => ({
  fontFamily: "Poppins",
  backgroundColor: isActive ? "#ff4d4d" : "transparent",
  color: isActive ? "white" : "inherit",
  "&:hover": {
    backgroundColor: "#ff4d4d",
    color: "white",
  },
  transition: "background-color 0.3s ease",
});

// Styles for the Logout button (red text)
const logoutButtonStyle = () => ({
  fontFamily: "Poppins",
  color: "red",
  "&:hover": {
    backgroundColor: "#ff4d4d",
    color: "white",
  },
  transition: "background-color 0.3s ease",
});

// Styles for the Login button (blue text)
const loginButtonStyle = (isDark) => ({
  fontFamily: "Poppins",
  color: isDark ? "#fff" : "blue",
  "&:hover": {
    backgroundColor: "#ff4d4d",
    color: "white",
  },
  transition: "background-color 0.3s ease",
});

export default Navbar;
