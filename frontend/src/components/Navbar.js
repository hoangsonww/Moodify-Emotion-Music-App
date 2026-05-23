import React, { useContext, useEffect, useState } from "react";
import {
  AppBar,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Switch,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";
import HomeIcon from "@mui/icons-material/Home";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import RecommendIcon from "@mui/icons-material/Recommend";
import LoginIcon from "@mui/icons-material/Login";
import LogoutIcon from "@mui/icons-material/Logout";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import MusicNoteIcon from "@mui/icons-material/MusicNote";

import { DarkModeContext } from "../context/DarkModeContext";
import { AUTH_EVENT, isAuthenticated, logout } from "../services/auth";
import { gradients, tokens } from "../theme";

const NAV_ITEMS = [
  { label: "Home", path: "/home", icon: HomeIcon, authed: true },
  { label: "Results", path: "/results", icon: RecommendIcon, authed: true },
  { label: "Profile", path: "/profile", icon: AccountCircleIcon, authed: true },
];

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery("(max-width:760px)");
  const { isDarkMode, toggleDarkMode } = useContext(DarkModeContext);
  const [isLoggedIn, setIsLoggedIn] = useState(isAuthenticated());
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Re-sync auth state on every route change AND any auth-change event
  // (same-tab via AUTH_EVENT, cross-tab via storage).
  useEffect(() => {
    const sync = () => setIsLoggedIn(isAuthenticated());
    sync();
    window.addEventListener(AUTH_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(AUTH_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [location]);

  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    logout();
    setIsLoggedIn(false);
    setDrawerOpen(false);
    navigate("/login");
  };

  const goto = (path) => {
    setDrawerOpen(false);
    navigate(path);
  };

  const visibleItems = NAV_ITEMS.filter((item) => !item.authed || isLoggedIn);

  // --- desktop nav button ------------------------------------------------
  const NavButton = ({ item }) => {
    const Icon = item.icon;
    const active = isActive(item.path);
    return (
      <Button
        onClick={() => goto(item.path)}
        startIcon={<Icon sx={{ fontSize: 18 }} />}
        sx={{
          color: active ? "#fff" : "text.primary",
          background: active ? gradients.primary : "transparent",
          borderRadius: 999,
          px: 2,
          py: 0.75,
          fontWeight: 700,
          fontSize: 14,
          boxShadow: active ? `0 8px 22px ${tokens.primarySoft}` : "none",
          transition: "all .25s ease",
          "&:hover": {
            background: active ? gradients.primary : tokens.primarySoft,
            color: active ? "#fff" : "primary.main",
            transform: "translateY(-1px)",
          },
        }}
      >
        {item.label}
      </Button>
    );
  };

  // --- mobile drawer item ------------------------------------------------
  const DrawerItem = ({ item }) => {
    const Icon = item.icon;
    const active = isActive(item.path);
    return (
      <ListItemButton
        onClick={() => goto(item.path)}
        sx={{
          borderRadius: 2,
          mb: 0.5,
          background: active ? gradients.primarySoft : "transparent",
          "&:hover": { background: tokens.primarySoft },
        }}
      >
        <ListItemIcon sx={{ color: active ? "primary.main" : "text.primary", minWidth: 40 }}>
          <Icon />
        </ListItemIcon>
        <ListItemText
          primary={item.label}
          primaryTypographyProps={{
            fontWeight: 700,
            color: active ? "primary.main" : "text.primary",
          }}
        />
      </ListItemButton>
    );
  };

  return (
    <AppBar position="sticky" elevation={0}>
      <Toolbar
        sx={{
          maxWidth: 1280,
          mx: "auto",
          width: "100%",
          py: 0.5,
          gap: 2,
        }}
      >
        {/* Brand */}
        <Box
          onClick={() => navigate(isLoggedIn ? "/home" : "/")}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.25,
            cursor: "pointer",
            mr: "auto",
            "&:hover .brand-mark": { transform: "rotate(-8deg) scale(1.05)" },
          }}
        >
          <Box
            className="brand-mark"
            sx={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: gradients.primary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 10px 28px ${tokens.primarySoft}`,
              transition: "transform .3s cubic-bezier(.34,1.56,.64,1)",
            }}
          >
            <MusicNoteIcon sx={{ color: "#fff", fontSize: 22 }} />
          </Box>
          <Typography
            sx={{
              fontWeight: 900,
              fontSize: { xs: 18, sm: 22 },
              letterSpacing: "-0.02em",
              background: gradients.primary,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Moodify
          </Typography>
        </Box>

        {/* Desktop nav */}
        {!isMobile && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {visibleItems.map((item) => (
              <NavButton key={item.path} item={item} />
            ))}

            {isLoggedIn ? (
              <Button
                onClick={handleLogout}
                startIcon={<LogoutIcon sx={{ fontSize: 18 }} />}
                sx={{
                  borderRadius: 999,
                  px: 2,
                  py: 0.75,
                  color: "error.main",
                  fontWeight: 700,
                  fontSize: 14,
                  "&:hover": { background: "rgba(239,68,68,0.1)" },
                }}
              >
                Logout
              </Button>
            ) : (
              <Button
                onClick={() => navigate("/login")}
                startIcon={<LoginIcon sx={{ fontSize: 18 }} />}
                variant="contained"
                color="primary"
                sx={{ borderRadius: 999, px: 2.5, py: 0.85, fontWeight: 700 }}
              >
                Sign in
              </Button>
            )}

            <Tooltip title={isDarkMode ? "Switch to light" : "Switch to dark"}>
              <IconButton
                onClick={toggleDarkMode}
                sx={{
                  ml: 0.5,
                  color: "text.primary",
                  border: `1px solid ${tokens.border}`,
                  background: tokens.primarySoft,
                  "&:hover": { background: tokens.accentSoft },
                }}
              >
                {isDarkMode ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
            </Tooltip>
          </Box>
        )}

        {/* Mobile menu trigger */}
        {isMobile && (
          <IconButton onClick={() => setDrawerOpen(true)} sx={{ color: "text.primary" }}>
            <MenuIcon />
          </IconButton>
        )}
      </Toolbar>

      {/* Mobile drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: 300,
            background: "background.paper",
            backgroundImage: gradients.aurora,
            p: 2,
          },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
          <Typography
            sx={{
              fontWeight: 900,
              fontSize: 22,
              background: gradients.primary,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Moodify
          </Typography>
          <IconButton onClick={() => setDrawerOpen(false)}>
            <CloseIcon />
          </IconButton>
        </Box>

        <List sx={{ flexGrow: 1 }}>
          {visibleItems.map((item) => (
            <DrawerItem key={item.path} item={item} />
          ))}
        </List>

        <Divider sx={{ my: 1 }} />

        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 1, py: 1.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {isDarkMode ? <DarkModeIcon /> : <LightModeIcon />}
            <Typography sx={{ fontWeight: 700 }}>
              {isDarkMode ? "Dark mode" : "Light mode"}
            </Typography>
          </Box>
          <Switch checked={isDarkMode} onChange={toggleDarkMode} color="secondary" />
        </Box>

        {isLoggedIn ? (
          <Button
            onClick={handleLogout}
            startIcon={<LogoutIcon />}
            fullWidth
            sx={{
              mt: 1,
              borderRadius: 999,
              color: "error.main",
              fontWeight: 700,
              border: "1px solid",
              borderColor: "error.main",
            }}
          >
            Logout
          </Button>
        ) : (
          <Button
            onClick={() => goto("/login")}
            startIcon={<LoginIcon />}
            variant="contained"
            color="primary"
            fullWidth
            sx={{ mt: 1, borderRadius: 999, fontWeight: 700 }}
          >
            Sign in
          </Button>
        )}
      </Drawer>
    </AppBar>
  );
}
