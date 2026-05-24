import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Box, Typography, Link, Divider, IconButton } from "@mui/material";
import {
  GitHub,
  LinkedIn,
  Mail,
  Language,
  MusicNote,
  Favorite,
  KeyboardArrowUp,
} from "@mui/icons-material";

const NAV_GROUPS = [
  {
    heading: "Product",
    items: [
      { label: "Home", path: "/home" },
      { label: "Explore", path: "/results", altLabel: "Results" },
      { label: "Profile", path: "/profile" },
      { label: "Landing", path: "/" },
    ],
  },
  {
    heading: "Account",
    items: [
      { label: "Login", path: "/login" },
      { label: "Register", path: "/register" },
    ],
  },
  {
    heading: "Legal",
    items: [
      { label: "Privacy Policy", path: "/privacy-policy" },
      { label: "Terms of Service", path: "/terms-of-service" },
    ],
  },
];

const SOCIAL_LINKS = [
  {
    label: "GitHub",
    href: "https://github.com/hoangsonww/Moodify-Emotion-Music-App",
    Icon: GitHub,
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/hoangsonw",
    Icon: LinkedIn,
  },
  {
    label: "Email",
    href: "mailto:hoangson091104@gmail.com",
    Icon: Mail,
  },
  {
    label: "Website",
    href: "https://sonnguyenhoang.com",
    Icon: Language,
  },
];

const Footer = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  // Mirror the navbar's behaviour: /results reads as "Explore" by default
  // and only flips to "Results" once the user lands there from an analysis
  // (state carries the emotion).
  const arrivedFromAnalysis =
    location.pathname === "/results" &&
    Boolean(location.state && location.state.emotion);

  const renderLabel = (item) =>
    item.path === "/results" && arrivedFromAnalysis
      ? item.altLabel || item.label
      : item.label;

  const scrollTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <Box component="footer" sx={styles.footer}>
      <Box sx={styles.glow} aria-hidden="true" />

      <Box sx={styles.inner}>
        {/* ---- brand row ---- */}
        <Box sx={styles.brandRow}>
          <Box sx={styles.brandLeft}>
            <Box sx={styles.brandMark}>
              <MusicNote sx={styles.brandIcon} />
              <Typography component="span" sx={styles.brandText}>
                Moodify
              </Typography>
            </Box>
            <Typography sx={styles.tagline}>
              Music that matches your mood - text, voice, or a single photo.
            </Typography>
          </Box>

          <IconButton
            onClick={scrollTop}
            aria-label="Back to top"
            sx={styles.toTop}
          >
            <KeyboardArrowUp sx={{ fontSize: 22 }} />
          </IconButton>
        </Box>

        <Divider sx={styles.divider} />

        {/* ---- grouped link grid ---- */}
        <Box sx={styles.grid}>
          {NAV_GROUPS.map((group) => (
            <Box key={group.heading} sx={styles.column}>
              <Typography sx={styles.columnHeading}>{group.heading}</Typography>
              <Box sx={styles.columnLinks}>
                {group.items.map((item) => (
                  <Link
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    sx={{
                      ...styles.link,
                      ...(isActive(item.path) ? styles.activeLink : null),
                    }}
                  >
                    {renderLabel(item)}
                  </Link>
                ))}
              </Box>
            </Box>
          ))}

          <Box sx={styles.column}>
            <Typography sx={styles.columnHeading}>Connect</Typography>
            <Box sx={styles.socialRow}>
              {SOCIAL_LINKS.map(({ label, href, Icon }) => (
                <IconButton
                  key={label}
                  component="a"
                  href={href}
                  target={href.startsWith("mailto:") ? undefined : "_blank"}
                  rel={
                    href.startsWith("mailto:")
                      ? undefined
                      : "noopener noreferrer"
                  }
                  aria-label={label}
                  sx={styles.socialButton}
                >
                  <Icon sx={styles.socialIcon} />
                </IconButton>
              ))}
            </Box>
          </Box>
        </Box>

        <Divider sx={styles.divider} />

        {/* ---- bottom row ---- */}
        <Box sx={styles.bottomRow}>
          <Typography sx={styles.copyright}>
            &copy; {new Date().getFullYear()} Moodify. All rights reserved.
          </Typography>
          <Typography sx={styles.madeWith}>
            Made with <Favorite sx={styles.heart} aria-label="love" /> in San
            Francisco, CA
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

const styles = {
  footer: {
    position: "relative",
    color: "white",
    // Brand gradient - same coral/red palette the rest of the app uses,
    // but with a soft angle so the footer doesn't read as a flat block.
    background:
      "linear-gradient(135deg, #ff4d4d 0%, #ff6b6b 45%, #ff8a5b 100%)",
    padding: { xs: "20px 14px 16px", sm: "32px 32px 20px" },
    fontFamily: "Poppins, sans-serif",
    marginTop: "20px",
    width: "100%",
    maxWidth: "100vw",
    boxSizing: "border-box",
    overflow: "hidden",
    // Subtle top accent so the footer visually separates from the page
    // even if the previous section is also red/coral.
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18)",
  },

  // Decorative blur behind the brand to give depth without busy chrome.
  glow: {
    position: "absolute",
    top: "-60px",
    left: "50%",
    transform: "translateX(-50%)",
    width: "60%",
    maxWidth: "640px",
    height: "120px",
    background:
      "radial-gradient(ellipse at center, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 70%)",
    pointerEvents: "none",
    filter: "blur(8px)",
  },

  inner: {
    position: "relative",
    maxWidth: 1180,
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: { xs: "16px", sm: "20px" },
  },

  // ---- brand row ----
  brandRow: {
    display: "flex",
    alignItems: { xs: "flex-start", sm: "center" },
    justifyContent: "space-between",
    gap: "16px",
    flexWrap: "wrap",
  },
  brandLeft: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    minWidth: 0,
    flex: 1,
  },
  brandMark: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
  },
  brandIcon: {
    fontSize: { xs: 22, sm: 26 },
    color: "white",
    filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.25))",
  },
  brandText: {
    fontFamily: "Poppins, sans-serif",
    fontWeight: 700,
    fontSize: { xs: "18px", sm: "22px" },
    letterSpacing: "0.5px",
  },
  tagline: {
    fontFamily: "Poppins, sans-serif",
    fontSize: { xs: "12px", sm: "13px" },
    color: "rgba(255,255,255,0.85)",
    maxWidth: 360,
    lineHeight: 1.45,
  },
  toTop: {
    color: "white",
    border: "1px solid rgba(255,255,255,0.35)",
    borderRadius: "999px",
    width: 36,
    height: 36,
    flexShrink: 0,
    transition: "transform 0.2s, background-color 0.2s",
    "&:hover": {
      backgroundColor: "rgba(255,255,255,0.18)",
      transform: "translateY(-2px)",
    },
  },

  divider: {
    borderColor: "rgba(255,255,255,0.22)",
  },

  // ---- link grid ----
  grid: {
    display: "grid",
    gridTemplateColumns: {
      xs: "repeat(2, minmax(0, 1fr))",
      sm: "repeat(4, minmax(0, 1fr))",
    },
    columnGap: { xs: "12px", sm: "24px" },
    rowGap: { xs: "16px", sm: "20px" },
  },
  column: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    minWidth: 0,
  },
  columnHeading: {
    fontFamily: "Poppins, sans-serif",
    fontSize: { xs: "11px", sm: "12px" },
    fontWeight: 700,
    letterSpacing: "1.2px",
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.78)",
  },
  columnLinks: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  link: {
    cursor: "pointer",
    color: "white",
    textDecoration: "none",
    fontFamily: "Poppins, sans-serif",
    fontSize: { xs: "13px", sm: "14px" },
    fontWeight: 500,
    lineHeight: 1.4,
    position: "relative",
    width: "fit-content",
    whiteSpace: "nowrap",
    transition: "color 0.2s, transform 0.2s",
    // Sliding underline that grows from the left on hover.
    "&::after": {
      content: '""',
      position: "absolute",
      left: 0,
      bottom: -2,
      width: "100%",
      height: "1.5px",
      background: "currentColor",
      transformOrigin: "left",
      transform: "scaleX(0)",
      transition: "transform 0.25s ease",
    },
    "&:hover": {
      transform: "translateX(2px)",
    },
    "&:hover::after": {
      transform: "scaleX(1)",
    },
  },
  activeLink: {
    fontWeight: 700,
    "&::after": {
      content: '""',
      position: "absolute",
      left: 0,
      bottom: -2,
      width: "100%",
      height: "1.5px",
      background: "currentColor",
      transform: "scaleX(1)",
    },
  },

  // ---- social row ----
  socialRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: { xs: "6px", sm: "8px" },
  },
  socialButton: {
    color: "white",
    width: { xs: 36, sm: 40 },
    height: { xs: 36, sm: 40 },
    backgroundColor: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.18)",
    transition: "transform 0.2s, background-color 0.2s",
    "&:hover": {
      backgroundColor: "rgba(255,255,255,0.24)",
      transform: "translateY(-2px) scale(1.04)",
    },
  },
  socialIcon: {
    fontSize: { xs: 18, sm: 20 },
  },

  // ---- bottom row ----
  bottomRow: {
    display: "flex",
    flexDirection: { xs: "column", sm: "row" },
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    textAlign: { xs: "center", sm: "left" },
  },
  copyright: {
    fontFamily: "Poppins, sans-serif",
    fontSize: { xs: "11px", sm: "12px" },
    color: "rgba(255,255,255,0.85)",
    overflowWrap: "anywhere",
  },
  madeWith: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    fontFamily: "Poppins, sans-serif",
    fontSize: { xs: "11px", sm: "12px" },
    color: "rgba(255,255,255,0.85)",
  },
  heart: {
    fontSize: { xs: 12, sm: 13 },
    color: "#ffd1d1",
    verticalAlign: "middle",
    animation: "moodifyFooterPulse 1.8s ease-in-out infinite",
    "@keyframes moodifyFooterPulse": {
      "0%, 100%": { transform: "scale(1)" },
      "50%": { transform: "scale(1.18)" },
    },
  },
};

export default Footer;
