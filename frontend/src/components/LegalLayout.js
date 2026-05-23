import React, { useContext } from "react";
import { Box, Chip, Paper, Stack, Typography } from "@mui/material";
import {
  Gavel,
  PolicyOutlined,
  Schedule,
  ShieldOutlined,
} from "@mui/icons-material";

import { DarkModeContext } from "../context/DarkModeContext";

/**
 * Shared "legal page" shell for the Privacy Policy + Terms of Service
 * pages -- gradient hero, structured cards for each section, modern
 * typography. Caller passes:
 *
 *   - kind: "privacy" | "terms"
 *   - title
 *   - intro: short paragraph under the title
 *   - sections: [{ title, body: ReactNode[] }]
 */
export default function LegalLayout({ kind, title, intro, sections }) {
  const { isDarkMode } = useContext(DarkModeContext);
  const styles = getStyles(isDarkMode);
  const today = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const HeroIcon = kind === "terms" ? Gavel : ShieldOutlined;

  return (
    <Box sx={styles.page}>
      <Box sx={styles.shell}>
        {/* Hero */}
        <Paper elevation={6} sx={styles.hero}>
          <Box sx={styles.heroBlobA} />
          <Box sx={styles.heroBlobB} />

          <Stack direction="row" spacing={2} alignItems="center" sx={{ position: "relative" }}>
            <Box sx={styles.heroMark}>
              <HeroIcon sx={{ color: "#fff", fontSize: 30 }} />
            </Box>
            <Box>
              <Typography variant="overline" sx={styles.heroKicker}>
                <PolicyOutlined sx={{ fontSize: 14, mr: 0.5, verticalAlign: "middle" }} />
                {kind === "terms" ? "Legal · Terms" : "Legal · Privacy"}
              </Typography>
              <Typography variant="h3" component="h1" sx={styles.heroTitle}>
                {title}
              </Typography>
              <Stack direction="row" spacing={1.25} sx={{ mt: 1 }}>
                <Chip
                  icon={<Schedule sx={{ fontSize: 14 }} />}
                  label={`Last updated: ${today}`}
                  sx={styles.dateChip}
                />
              </Stack>
            </Box>
          </Stack>

          <Typography sx={styles.heroIntro}>{intro}</Typography>
        </Paper>

        {/* Body sections */}
        <Box sx={styles.sectionList}>
          {sections.map((section, i) => (
            <Paper key={section.title} elevation={3} sx={styles.section}>
              <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1.5 }}>
                <Box sx={styles.sectionNumber}>{String(i + 1).padStart(2, "0")}</Box>
                <Typography variant="h6" component="h2" sx={styles.sectionTitle}>
                  {section.title}
                </Typography>
              </Stack>
              <Box sx={styles.sectionBody}>{section.body}</Box>
            </Paper>
          ))}
        </Box>

        {/* Footer note */}
        <Paper elevation={0} sx={styles.footerNote}>
          <Typography sx={styles.footerText}>
            Questions about this {kind === "terms" ? "agreement" : "policy"}?{" "}
            Reach out at{" "}
            <Box
              component="a"
              href="mailto:hoangson091104@gmail.com"
              sx={styles.footerLink}
            >
              hoangson091104@gmail.com
            </Box>
            .
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
}

const getStyles = (isDark) => ({
  page: {
    minHeight: "calc(100vh - 80px)",
    fontFamily: "Poppins, sans-serif",
    backgroundColor: isDark ? "#121212" : "#f7f5f4",
    backgroundImage:
      "radial-gradient(60% 50% at 20% 0%, rgba(255,77,77,0.10) 0%, transparent 60%), radial-gradient(50% 50% at 85% 100%, rgba(255,77,77,0.06) 0%, transparent 60%)",
    color: isDark ? "#fff" : "#000",
    padding: { xs: "16px", sm: "32px" },
    transition: "background-color 0.3s ease",
  },
  shell: {
    maxWidth: 900,
    mx: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 3,
  },

  hero: {
    position: "relative",
    overflow: "hidden",
    borderRadius: "20px",
    padding: { xs: "24px", sm: "32px" },
    color: "#fff",
    background: "linear-gradient(135deg, #ff4d4d 0%, #ff7a59 65%, #ffa46d 100%)",
    boxShadow: "0 20px 50px rgba(255,77,77,0.35)",
  },
  heroBlobA: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: "50%",
    top: -80,
    left: -60,
    background:
      "radial-gradient(circle, rgba(255,255,255,0.35) 0%, transparent 60%)",
    pointerEvents: "none",
  },
  heroBlobB: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: "50%",
    bottom: -100,
    right: -80,
    background:
      "radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 60%)",
    pointerEvents: "none",
  },
  heroMark: {
    width: 64,
    height: 64,
    borderRadius: "16px",
    background: "rgba(255,255,255,0.22)",
    border: "2px solid rgba(255,255,255,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backdropFilter: "blur(6px)",
    boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
    flexShrink: 0,
  },
  heroKicker: {
    fontFamily: "Poppins",
    fontWeight: 800,
    fontSize: 12,
    letterSpacing: "0.2em",
    opacity: 0.9,
  },
  heroTitle: {
    fontFamily: "Poppins",
    fontWeight: 900,
    fontSize: { xs: 30, sm: 38 },
    letterSpacing: "-0.02em",
    mt: 0.25,
    lineHeight: 1.1,
  },
  dateChip: {
    fontFamily: "Poppins",
    fontWeight: 700,
    fontSize: 12,
    color: "#fff",
    background: "rgba(255,255,255,0.2)",
    backdropFilter: "blur(4px)",
    border: "1px solid rgba(255,255,255,0.25)",
    "& .MuiChip-icon": { color: "#fff" },
  },
  heroIntro: {
    position: "relative",
    fontFamily: "Poppins",
    fontSize: 14.5,
    lineHeight: 1.7,
    opacity: 0.95,
    mt: 2.5,
    maxWidth: 720,
  },

  sectionList: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  section: {
    borderRadius: "16px",
    padding: { xs: 2.5, sm: 3 },
    background: isDark ? "#1f1f1f" : "#ffffff",
    border: isDark ? "1px solid #2a2a2a" : "1px solid #f0e8e6",
    boxShadow: isDark
      ? "0 12px 30px rgba(0,0,0,0.35)"
      : "0 12px 30px rgba(255,77,77,0.06)",
    transition: "transform .25s ease, box-shadow .25s ease, border-color .25s ease",
    "&:hover": {
      transform: "translateY(-2px)",
      boxShadow: "0 18px 36px rgba(255,77,77,0.10)",
      borderColor: "rgba(255,77,77,0.25)",
    },
  },
  sectionNumber: {
    width: 38,
    height: 38,
    borderRadius: "10px",
    background: "linear-gradient(135deg, #ff4d4d 0%, #ff7a59 100%)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "Poppins",
    fontWeight: 800,
    fontSize: 14,
    letterSpacing: "0.04em",
    boxShadow: "0 8px 16px rgba(255,77,77,0.3)",
    flexShrink: 0,
  },
  sectionTitle: {
    fontFamily: "Poppins",
    fontWeight: 800,
    color: isDark ? "#fff" : "#1a1a1a",
    letterSpacing: "-0.01em",
  },
  sectionBody: {
    fontFamily: "Poppins",
    fontSize: 14.5,
    lineHeight: 1.7,
    color: isDark ? "#d0d0d0" : "#3a3a3a",
    "& p": { mb: 1, mt: 0 },
    "& ul": { pl: 2.5, my: 1, "& li": { mb: 0.5 } },
    "& strong": { color: isDark ? "#fff" : "#1a1a1a", fontWeight: 700 },
    "& a": {
      color: "#ff4d4d",
      fontWeight: 700,
      textDecoration: "none",
      "&:hover": { textDecoration: "underline" },
    },
  },

  footerNote: {
    background: "rgba(255,77,77,0.06)",
    border: "1px solid rgba(255,77,77,0.18)",
    borderRadius: "14px",
    padding: 2,
    textAlign: "center",
  },
  footerText: {
    fontFamily: "Poppins",
    fontSize: 13.5,
    color: isDark ? "#bbb" : "#555",
  },
  footerLink: {
    color: "#ff4d4d",
    fontWeight: 700,
    textDecoration: "none",
    "&:hover": { textDecoration: "underline" },
  },
});
