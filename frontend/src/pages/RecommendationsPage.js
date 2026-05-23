import React, { useContext } from "react";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import {
  AutoAwesome,
  LibraryMusic,
  MusicNote,
  OpenInNew,
} from "@mui/icons-material";

import { DarkModeContext } from "../context/DarkModeContext";

const SAMPLE_TRACKS = [
  { title: "Track 1", artist: "Artist 1", src: "track1.mp3" },
  { title: "Track 2", artist: "Artist 2", src: "track2.mp3" },
  { title: "Track 3", artist: "Artist 3", src: "track3.mp3" },
];

const RecommendationsPage = () => {
  // Tolerate missing provider (used by tests that mount the page in isolation).
  const { isDarkMode = false } = useContext(DarkModeContext) || {};
  const styles = getStyles(isDarkMode);

  return (
    <Box sx={styles.page}>
      {/* ---- Hero ---- */}
      <Paper elevation={6} sx={styles.hero}>
        <Box sx={styles.heroBlobA} />
        <Box sx={styles.heroBlobB} />

        <Stack direction="row" spacing={2} alignItems="center" sx={{ position: "relative" }}>
          <Box sx={styles.heroMark}>
            <LibraryMusic sx={{ color: "#fff", fontSize: 30 }} />
          </Box>
          <Box>
            <Typography variant="overline" sx={styles.heroKicker}>
              <AutoAwesome sx={{ fontSize: 14, mr: 0.5, verticalAlign: "middle" }} />
              Sample playlist
            </Typography>
            <Typography variant="h4" component="h1" sx={styles.heroTitle}>
              Music Recommendations
            </Typography>
            <Typography sx={styles.heroSub}>
              Here are some music recommendations based on your mood: a
              preview of what every Results page looks like once you've
              analysed a mood.
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {/* ---- Tracks ---- */}
      <Box sx={styles.grid}>
        {SAMPLE_TRACKS.map((track, i) => (
          <Paper key={track.title} elevation={3} sx={styles.card}>
            <Box sx={styles.cover}>
              <MusicNote sx={{ color: "#fff", fontSize: 44 }} />
              <Box sx={styles.coverBadge}>#{i + 1}</Box>
            </Box>
            <Box sx={styles.cardBody}>
              <Typography variant="h6" component="h3" sx={styles.trackTitle}>
                {track.title}
              </Typography>
              <Typography sx={styles.trackArtist}>
                Artist: {track.artist}
              </Typography>

              <audio controls style={styles.audio}>
                <source src={track.src} type="audio/mpeg" />
                Your browser does not support the audio element.
              </audio>

              <Button
                component="a"
                href="https://www.deezer.com"
                target="_blank"
                rel="noreferrer"
                endIcon={<OpenInNew sx={{ fontSize: 16 }} />}
                sx={styles.cta}
              >
                Listen on Deezer
              </Button>
            </Box>
          </Paper>
        ))}
      </Box>
    </Box>
  );
};

const getStyles = (isDark) => ({
  page: {
    minHeight: "calc(100vh - 80px)",
    padding: { xs: "16px", sm: "32px" },
    fontFamily: "Poppins",
    backgroundColor: isDark ? "#121212" : "#f7f5f4",
    backgroundImage:
      "radial-gradient(60% 50% at 20% 0%, rgba(255,77,77,0.10) 0%, transparent 60%), radial-gradient(50% 50% at 85% 100%, rgba(255,77,77,0.06) 0%, transparent 60%)",
    color: isDark ? "#fff" : "#000",
    maxWidth: 1100,
    mx: "auto",
  },

  hero: {
    position: "relative",
    overflow: "hidden",
    borderRadius: "20px",
    padding: { xs: "24px", sm: "32px" },
    color: "#fff",
    background: "linear-gradient(135deg, #ff4d4d 0%, #ff7a59 65%, #ffa46d 100%)",
    boxShadow: "0 20px 50px rgba(255,77,77,0.35)",
    mb: 4,
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
    fontSize: { xs: 28, sm: 34 },
    letterSpacing: "-0.02em",
    mt: 0.25,
  },
  heroSub: {
    fontFamily: "Poppins",
    fontSize: 14,
    opacity: 0.92,
    mt: 0.75,
    maxWidth: 560,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: {
      xs: "1fr",
      sm: "repeat(2, 1fr)",
      md: "repeat(3, 1fr)",
    },
    gap: 3,
  },

  card: {
    borderRadius: "18px",
    overflow: "hidden",
    background: isDark ? "#1f1f1f" : "#ffffff",
    border: isDark ? "1px solid #2a2a2a" : "1px solid #f0e8e6",
    boxShadow: isDark
      ? "0 12px 30px rgba(0,0,0,0.35)"
      : "0 12px 30px rgba(255,77,77,0.06)",
    display: "flex",
    flexDirection: "column",
    transition: "transform .25s ease, box-shadow .25s ease",
    "&:hover": {
      transform: "translateY(-4px)",
      boxShadow: "0 18px 40px rgba(255,77,77,0.18)",
      borderColor: "rgba(255,77,77,0.35)",
    },
  },
  cover: {
    position: "relative",
    height: 140,
    background: "linear-gradient(135deg, #ff4d4d 0%, #ff7a59 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  coverBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    fontFamily: "Poppins",
    fontWeight: 800,
    fontSize: 12,
    background: "rgba(0,0,0,0.4)",
    color: "#fff",
    padding: "4px 10px",
    borderRadius: 999,
    backdropFilter: "blur(4px)",
  },
  cardBody: {
    padding: "16px 18px 18px",
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
  },
  trackTitle: {
    fontFamily: "Poppins",
    fontWeight: 800,
    color: isDark ? "#fff" : "#1a1a1a",
    letterSpacing: "-0.01em",
  },
  trackArtist: {
    fontFamily: "Poppins",
    fontSize: 13,
    color: isDark ? "#bbb" : "#555",
    mt: 0.25,
    mb: 1.5,
  },
  audio: {
    width: "100%",
    height: 32,
    marginBottom: 12,
  },
  cta: {
    borderRadius: "999px",
    fontFamily: "Poppins",
    fontWeight: 700,
    fontSize: 14,
    textTransform: "none",
    color: "#fff",
    background: "linear-gradient(135deg, #ff4d4d 0%, #ff6b6b 100%)",
    boxShadow: "0 10px 22px rgba(255,77,77,0.32)",
    px: 2,
    py: 1,
    alignSelf: "flex-start",
    "&:hover": {
      background: "linear-gradient(135deg, #ff5e5e 0%, #ff7d7d 100%)",
      transform: "translateY(-1px)",
    },
  },
});

export default RecommendationsPage;
