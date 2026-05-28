import React, { useEffect, useState, useContext } from "react";
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
  Menu,
  MenuItem,
  Switch,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import MenuIcon from "@mui/icons-material/Menu";
import HomeIcon from "@mui/icons-material/Home";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import RecommendIcon from "@mui/icons-material/Recommend";
import LoginIcon from "@mui/icons-material/Login";
import LogoutIcon from "@mui/icons-material/Logout";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import FingerprintIcon from "@mui/icons-material/Fingerprint";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { useNavigate, useLocation } from "react-router-dom";

import { DarkModeContext } from "../context/DarkModeContext";
import { isAuthenticated, logout, AUTH_EVENT } from "../services/auth";

// The /results tab is labelled "Explore" by default. It only flips to
// "Results" when the user is actually on /results AND arrived there from
// an analysis (location.state carries the detected emotion). Visiting
// /results directly via the tab itself keeps the "Explore" label so the
// nav doesn't promise a result the user hasn't generated yet.
const NAV_ITEMS = [
  { label: "Home", path: "/home", icon: HomeIcon, requireAuth: true },
  {
    label: "Profile",
    path: "/profile",
    icon: AccountCircleIcon,
    requireAuth: true,
  },
  {
    label: "Explore",
    resultsLabel: "Results",
    path: "/results",
    icon: RecommendIcon,
    requireAuth: true,
  },
];

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery("(max-width:760px)");
  const [isLoggedIn, setIsLoggedIn] = useState(isAuthenticated());
  const [showMenu, setShowMenu] = useState(false);
  const [accountAnchor, setAccountAnchor] = useState(null);

  const { isDarkMode, toggleDarkMode } = useContext(DarkModeContext);

  // Token validity is determined by decoding the JWT locally (no network,
  // no polling). The navbar re-syncs on route changes and on auth-change
  // events -- login/logout/refresh in this tab, or token changes in
  // another tab (via the storage event).
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
    setShowMenu(false);
    setAccountAnchor(null);
    navigate("/login");
  };

  const goto = (path) => {
    setShowMenu(false);
    setAccountAnchor(null);
    navigate(path);
  };

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.requireAuth || isLoggedIn,
  ).map((item) => {
    if (item.path !== "/results" || !item.resultsLabel) return item;
    const arrivedFromAnalysis =
      location.pathname === "/results" &&
      Boolean(location.state && location.state.emotion);
    return {
      ...item,
      label: arrivedFromAnalysis ? item.resultsLabel : item.label,
    };
  });

  // The mobile drawer lists Passkeys inline (the desktop nav hides it behind
  // the Account dropdown). Only meaningful when signed in.
  const drawerItems = isLoggedIn
    ? [...visibleItems, { label: "Passkeys", path: "/passkeys", icon: FingerprintIcon }]
    : visibleItems;

  // ---- desktop button ----
  const NavButton = ({ item }) => {
    const Icon = item.icon;
    const active = isActive(item.path);
    return (
      <Button
        onClick={() => goto(item.path)}
        startIcon={<Icon sx={{ fontSize: 18 }} />}
        sx={{
          fontFamily: "Poppins",
          color: active ? "#fff" : isDarkMode ? "#eee" : "#222",
          background: active
            ? "linear-gradient(135deg, #ff4d4d 0%, #ff6b6b 100%)"
            : "transparent",
          boxShadow: active ? "0 8px 18px rgba(255,77,77,0.32)" : "none",
          borderRadius: "999px",
          px: 2,
          py: 0.85,
          fontSize: 14,
          fontWeight: 700,
          textTransform: "none",
          transition: "all .2s ease",
          "&:hover": {
            background: active
              ? "linear-gradient(135deg, #ff5e5e 0%, #ff7d7d 100%)"
              : isDarkMode
                ? "rgba(255,77,77,0.12)"
                : "rgba(255,77,77,0.10)",
            color: active ? "#fff" : "#ff4d4d",
            transform: "translateY(-1px)",
          },
        }}
      >
        {item.label}
      </Button>
    );
  };

  // ---- drawer item ----
  const DrawerItem = ({ item }) => {
    const Icon = item.icon;
    const active = isActive(item.path);
    return (
      <ListItemButton
        onClick={() => goto(item.path)}
        sx={{
          borderRadius: 2,
          mb: 0.5,
          background: active ? "rgba(255,77,77,0.12)" : "transparent",
          "&:hover": { background: "rgba(255,77,77,0.10)" },
        }}
      >
        <ListItemIcon
          sx={{
            color: active ? "#ff4d4d" : isDarkMode ? "#eee" : "#333",
            minWidth: 40,
          }}
        >
          <Icon />
        </ListItemIcon>
        <ListItemText
          primary={item.label}
          primaryTypographyProps={{
            fontFamily: "Poppins",
            fontWeight: active ? 800 : 600,
            fontSize: 15,
            color: active ? "#ff4d4d" : isDarkMode ? "#eee" : "#222",
          }}
        />
      </ListItemButton>
    );
  };

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        background: isDarkMode
          ? "rgba(18, 18, 18, 0.78)"
          : "rgba(255, 255, 255, 0.85)",
        color: isDarkMode ? "#fff" : "#000",
        backdropFilter: "saturate(180%) blur(18px)",
        WebkitBackdropFilter: "saturate(180%) blur(18px)",
        borderBottom: isDarkMode
          ? "1px solid rgba(255,255,255,0.08)"
          : "1px solid rgba(0,0,0,0.06)",
        transition: "background 0.3s ease",
      }}
    >
      <Toolbar
        sx={{
          maxWidth: 1280,
          mx: "auto",
          width: "100%",
          gap: 2,
          py: 0.5,
        }}
      >
        {/* ---- Brand ---- */}
        <Box
          onClick={() => navigate(isLoggedIn ? "/home" : "/")}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.25,
            cursor: "pointer",
            mr: "auto",
            "&:hover .brand-mark": { transform: "rotate(-6deg) scale(1.04)" },
          }}
        >
          <Box
            className="brand-mark"
            sx={{
              width: 38,
              height: 38,
              borderRadius: "12px",
              background: "linear-gradient(135deg, #ff4d4d 0%, #ff7a59 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 8px 18px rgba(255,77,77,0.4)",
              transition: "transform .3s cubic-bezier(.34,1.56,.64,1)",
            }}
          >
            <MusicNoteIcon sx={{ color: "#fff", fontSize: 22 }} />
          </Box>
          <Typography
            sx={{
              fontFamily: "Poppins",
              fontWeight: 900,
              fontSize: { xs: 19, sm: 22 },
              letterSpacing: "-0.02em",
              background: "linear-gradient(135deg, #ff4d4d 0%, #ff7a59 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Moodify
          </Typography>
        </Box>

        {/* ---- Desktop nav ---- */}
        {!isMobile && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {visibleItems.map((item) => (
              <NavButton key={item.path} item={item} />
            ))}

            {isLoggedIn ? (
              <>
                <Button
                  onClick={(e) => setAccountAnchor(e.currentTarget)}
                  startIcon={<AccountCircleIcon sx={{ fontSize: 18 }} />}
                  endIcon={
                    <KeyboardArrowDownIcon
                      sx={{
                        fontSize: 18,
                        transition: "transform .2s ease",
                        transform: accountAnchor
                          ? "rotate(180deg)"
                          : "rotate(0deg)",
                      }}
                    />
                  }
                  aria-haspopup="true"
                  aria-expanded={Boolean(accountAnchor)}
                  sx={{
                    fontFamily: "Poppins",
                    color: isDarkMode ? "#eee" : "#222",
                    fontWeight: 700,
                    fontSize: 14,
                    borderRadius: "999px",
                    textTransform: "none",
                    px: 2,
                    py: 0.85,
                    border: isDarkMode
                      ? "1px solid rgba(255,255,255,0.12)"
                      : "1px solid rgba(0,0,0,0.08)",
                    background: accountAnchor
                      ? "rgba(255,77,77,0.10)"
                      : "transparent",
                    "&:hover": { background: "rgba(255,77,77,0.10)" },
                  }}
                >
                  Account
                </Button>
                <Menu
                  anchorEl={accountAnchor}
                  open={Boolean(accountAnchor)}
                  onClose={() => setAccountAnchor(null)}
                  anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                  transformOrigin={{ vertical: "top", horizontal: "right" }}
                  slotProps={{
                    paper: {
                      sx: {
                        mt: 1,
                        minWidth: 200,
                        borderRadius: "14px",
                        overflow: "hidden",
                        background: isDarkMode ? "#1a1a25" : "#ffffff",
                        border: isDarkMode
                          ? "1px solid #2a2a36"
                          : "1px solid #f0e8e6",
                        boxShadow: isDarkMode
                          ? "0 18px 44px rgba(0,0,0,0.55)"
                          : "0 18px 44px rgba(255,77,77,0.18)",
                      },
                    },
                  }}
                >
                  <MenuItem
                    onClick={() => goto("/passkeys")}
                    sx={{
                      fontFamily: "Poppins",
                      fontWeight: 600,
                      fontSize: 14,
                      py: 1.25,
                      color: isDarkMode ? "#f6f6f8" : "#1a1a1a",
                      "&:hover": { background: "rgba(255,77,77,0.10)" },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 36, color: "#ff4d4d" }}>
                      <FingerprintIcon fontSize="small" />
                    </ListItemIcon>
                    Passkeys
                  </MenuItem>
                  <Divider sx={{ my: 0.5 }} />
                  <MenuItem
                    onClick={handleLogout}
                    sx={{
                      fontFamily: "Poppins",
                      fontWeight: 700,
                      fontSize: 14,
                      py: 1.25,
                      color: "#ff4d4d",
                      "&:hover": { background: "rgba(255,77,77,0.12)" },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 36, color: "#ff4d4d" }}>
                      <LogoutIcon fontSize="small" />
                    </ListItemIcon>
                    Log Out
                  </MenuItem>
                </Menu>
              </>
            ) : (
              <Button
                onClick={() => navigate("/login")}
                startIcon={<LoginIcon sx={{ fontSize: 18 }} />}
                sx={{
                  fontFamily: "Poppins",
                  color: "#fff",
                  background:
                    "linear-gradient(135deg, #ff4d4d 0%, #ff6b6b 100%)",
                  fontWeight: 700,
                  fontSize: 14,
                  borderRadius: "999px",
                  textTransform: "none",
                  px: 2.5,
                  py: 0.85,
                  boxShadow: "0 8px 18px rgba(255,77,77,0.32)",
                  "&:hover": {
                    background:
                      "linear-gradient(135deg, #ff5e5e 0%, #ff7d7d 100%)",
                    transform: "translateY(-1px)",
                  },
                }}
              >
                Sign in
              </Button>
            )}

            <Tooltip title={isDarkMode ? "Switch to light" : "Switch to dark"}>
              <IconButton
                onClick={toggleDarkMode}
                sx={{
                  ml: 0.5,
                  color: isDarkMode ? "#eee" : "#222",
                  border: isDarkMode
                    ? "1px solid rgba(255,255,255,0.12)"
                    : "1px solid rgba(0,0,0,0.08)",
                  borderRadius: "12px",
                  background: isDarkMode
                    ? "rgba(255,255,255,0.05)"
                    : "rgba(255,77,77,0.06)",
                  "&:hover": { background: "rgba(255,77,77,0.12)" },
                }}
              >
                {isDarkMode ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
            </Tooltip>
          </Box>
        )}

        {/* ---- Mobile menu trigger ---- */}
        {isMobile && (
          <IconButton
            onClick={() => setShowMenu(true)}
            sx={{
              color: isDarkMode ? "#eee" : "#222",
              border: isDarkMode
                ? "1px solid rgba(255,255,255,0.12)"
                : "1px solid rgba(0,0,0,0.08)",
              borderRadius: "12px",
              "&:hover": { background: "rgba(255,77,77,0.12)" },
            }}
          >
            <MenuIcon />
          </IconButton>
        )}
      </Toolbar>

      {/* ---- Drawer ---- */}
      <Drawer
        anchor="right"
        open={showMenu}
        onClose={() => setShowMenu(false)}
        PaperProps={{
          sx: {
            width: 290,
            background: isDarkMode ? "#181818" : "#ffffff",
            color: isDarkMode ? "#fff" : "#000",
            backgroundImage:
              "radial-gradient(70% 50% at 20% 0%, rgba(255,77,77,0.10) 0%, transparent 60%)",
            p: 2,
          },
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: "10px",
                background: "linear-gradient(135deg, #ff4d4d 0%, #ff7a59 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 6px 14px rgba(255,77,77,0.4)",
              }}
            >
              <MusicNoteIcon sx={{ color: "#fff", fontSize: 18 }} />
            </Box>
            <Typography
              sx={{
                fontFamily: "Poppins",
                fontWeight: 900,
                fontSize: 20,
                background: "linear-gradient(135deg, #ff4d4d, #ff7a59)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Moodify
            </Typography>
          </Box>
          <IconButton
            onClick={() => setShowMenu(false)}
            sx={{ color: isDarkMode ? "#eee" : "#222" }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        <List sx={{ flexGrow: 1 }}>
          {drawerItems.map((item) => (
            <DrawerItem key={item.path} item={item} />
          ))}
        </List>

        <Divider sx={{ my: 1, borderColor: "rgba(255,77,77,0.18)" }} />

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 1.5,
            py: 1.5,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {isDarkMode ? <DarkModeIcon /> : <LightModeIcon />}
            <Typography sx={{ fontFamily: "Poppins", fontWeight: 700 }}>
              {isDarkMode ? "Dark mode" : "Light mode"}
            </Typography>
          </Box>
          <Switch
            checked={isDarkMode}
            onChange={toggleDarkMode}
            sx={{
              "& .MuiSwitch-switchBase.Mui-checked": { color: "#ff4d4d" },
              "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                backgroundColor: "#ff4d4d",
              },
            }}
          />
        </Box>

        {isLoggedIn ? (
          <Button
            onClick={handleLogout}
            startIcon={<LogoutIcon />}
            fullWidth
            sx={{
              mt: 1,
              borderRadius: "999px",
              color: "#ff4d4d",
              fontFamily: "Poppins",
              fontWeight: 700,
              textTransform: "none",
              border: "1px solid #ff4d4d",
              "&:hover": { background: "rgba(255,77,77,0.10)" },
            }}
          >
            Logout
          </Button>
        ) : (
          <Button
            onClick={() => goto("/login")}
            startIcon={<LoginIcon />}
            fullWidth
            sx={{
              mt: 1,
              borderRadius: "999px",
              color: "#fff",
              background: "linear-gradient(135deg, #ff4d4d 0%, #ff6b6b 100%)",
              fontFamily: "Poppins",
              fontWeight: 700,
              textTransform: "none",
              boxShadow: "0 10px 22px rgba(255,77,77,0.35)",
              "&:hover": {
                background: "linear-gradient(135deg, #ff5e5e 0%, #ff7d7d 100%)",
              },
            }}
          >
            Sign in
          </Button>
        )}
      </Drawer>
    </AppBar>
  );
};

export default Navbar;
