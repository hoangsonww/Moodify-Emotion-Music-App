import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";

import MoodIcon from "@mui/icons-material/Mood";
import PublicIcon from "@mui/icons-material/Public";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RefreshIcon from "@mui/icons-material/Refresh";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import MusicNoteIcon from "@mui/icons-material/MusicNote";

import { API_URL, MODAL_API_URL } from "../config";
import { gradients, shadows, tokens } from "../theme";

// Mood emoji + colour mapping for the hero banner.
const MOOD_VISUAL = {
  joy: { emoji: "😊", color: "#fbbf24" },
  happy: { emoji: "😊", color: "#fbbf24" },
  sadness: { emoji: "😢", color: "#60a5fa" },
  sad: { emoji: "😢", color: "#60a5fa" },
  anger: { emoji: "😠", color: "#ef4444" },
  angry: { emoji: "😠", color: "#ef4444" },
  love: { emoji: "🥰", color: "#ec4899" },
  fear: { emoji: "😨", color: "#a78bfa" },
  fearful: { emoji: "😨", color: "#a78bfa" },
  neutral: { emoji: "😌", color: "#94a3b8" },
  surprised: { emoji: "😲", color: "#22d3ee" },
  surprise: { emoji: "😲", color: "#22d3ee" },
  calm: { emoji: "😌", color: "#34d399" },
  excited: { emoji: "🤩", color: "#f472b6" },
  disgust: { emoji: "😖", color: "#84cc16" },
};

const MOODS = [
  "joy", "happy", "sadness", "sad", "love", "anger", "fear", "neutral",
  "calm", "excited", "surprised", "disgust", "nostalgic", "energetic",
  "hopeful", "tired", "content", "amused",
];

const MARKETS = [
  { code: "", label: "Global" },
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "CA", label: "Canada" },
  { code: "AU", label: "Australia" },
  { code: "IN", label: "India" },
  { code: "IE", label: "Ireland" },
  { code: "DE", label: "Germany" },
  { code: "FR", label: "France" },
  { code: "ES", label: "Spain" },
  { code: "IT", label: "Italy" },
  { code: "NL", label: "Netherlands" },
  { code: "SE", label: "Sweden" },
  { code: "BR", label: "Brazil" },
  { code: "MX", label: "Mexico" },
  { code: "JP", label: "Japan" },
  { code: "KR", label: "South Korea" },
];

export default function ResultsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const initial = location.state || { emotion: "None", recommendations: [] };

  const [selectedMood, setSelectedMood] = useState(initial.emotion || "None");
  const [selectedMarket, setSelectedMarket] = useState("");
  const [tracks, setTracks] = useState(initial.recommendations || []);
  const [loading, setLoading] = useState(false);
  const [moodHistory, setMoodHistory] = useState([]);

  // Fetch profile mood history on mount (only when signed in). When there
  // is history, immediately re-request a personalised list so the first
  // view is already history-aware.
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const profile = await axios.get(`${API_URL}/users/user/profile/`);
        const history = Array.isArray(profile?.data?.mood_history)
          ? profile.data.mood_history
          : [];
        if (cancelled) return;
        setMoodHistory(history);
        if (history.length === 0) return;

        setLoading(true);
        const response = await axios.post(
          `${MODAL_API_URL}/music_recommendation`,
          {
            emotion: (initial.emotion || "None").toLowerCase(),
            history: history.slice(-50),
          },
        );
        if (!cancelled) setTracks(response.data.recommendations || []);
      } catch {
        // keep the non-personalised list
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refetch = async (emotion, market) => {
    setLoading(true);
    try {
      const response = await axios.post(
        `${MODAL_API_URL}/music_recommendation`,
        {
          emotion: emotion.toLowerCase(),
          market: market || undefined,
          history: moodHistory.slice(-50),
        },
      );
      setTracks(response.data.recommendations || []);
    } catch {
      // keep the previous list; the recommender always returns *something*.
    } finally {
      setLoading(false);
    }
  };

  const handleMoodChange = async (event) => {
    const value = event.target.value;
    setSelectedMood(value);
    await refetch(value, selectedMarket);
  };

  const handleMarketChange = async (event) => {
    const value = event.target.value;
    setSelectedMarket(value);
    await refetch(selectedMood, value);
  };

  const moodKey = (selectedMood || "neutral").toLowerCase();
  const moodVisual = MOOD_VISUAL[moodKey] || { emoji: "🎧", color: "#a855f7" };
  const moodTitle =
    selectedMood && selectedMood !== "None"
      ? selectedMood.charAt(0).toUpperCase() + selectedMood.slice(1)
      : "None";

  return (
    <Box
      sx={{
        minHeight: "calc(100vh - 80px)",
        py: { xs: 6, md: 8 },
        backgroundImage: gradients.aurora,
      }}
    >
      <Container maxWidth="lg">
        <Button
          onClick={() => navigate("/home")}
          startIcon={<ArrowBackIcon />}
          sx={{
            mb: 3,
            color: "text.secondary",
            fontWeight: 700,
            borderRadius: 999,
            "&:hover": { background: tokens.primarySoft, color: "primary.main" },
          }}
        >
          Analyze another mood
        </Button>

        {/* Mood banner */}
        <Box
          sx={{
            position: "relative",
            overflow: "hidden",
            p: { xs: 4, md: 6 },
            borderRadius: 5,
            background: `linear-gradient(135deg, ${moodVisual.color}20 0%, ${tokens.surface} 100%)`,
            border: `1px solid ${tokens.border}`,
            mb: 4,
            textAlign: "center",
            boxShadow: shadows.lg,
          }}
        >
          {/* mood glow */}
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              top: -80,
              left: "50%",
              transform: "translateX(-50%)",
              width: 360,
              height: 360,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${moodVisual.color} 0%, transparent 65%)`,
              opacity: 0.25,
              filter: "blur(40px)",
              pointerEvents: "none",
            }}
          />
          <Box
            sx={{
              fontSize: { xs: 64, md: 88 },
              lineHeight: 1,
              mb: 1,
              filter: `drop-shadow(0 8px 24px ${moodVisual.color}55)`,
              position: "relative",
              animation: "bob 4s ease-in-out infinite",
              "@keyframes bob": {
                "0%, 100%": { transform: "translateY(0)" },
                "50%": { transform: "translateY(-8px)" },
              },
            }}
          >
            {moodVisual.emoji}
          </Box>
          <Typography
            variant="overline"
            sx={{
              fontWeight: 800,
              letterSpacing: "0.25em",
              color: "text.secondary",
              fontSize: 11,
            }}
          >
            Detected Mood:{" "}
            <Box component="span" sx={{ color: moodVisual.color }}>
              {moodTitle}
            </Box>
          </Typography>
          <Typography
            variant="h2"
            sx={{
              mt: 1.5,
              fontWeight: 900,
              fontSize: { xs: 48, md: 72 },
              letterSpacing: "-0.03em",
              textTransform: "capitalize",
              background: `linear-gradient(135deg, ${moodVisual.color} 0%, ${tokens.accent} 100%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              lineHeight: 1,
            }}
          >
            {moodTitle}
          </Typography>
          <Typography sx={{ color: "text.secondary", mt: 1, maxWidth: 480, mx: "auto" }}>
            Mood-matched tracks pulled live from Deezer. Pick a different mood
            or region below to remix the playlist.
          </Typography>
        </Box>

        {/* Filters */}
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          sx={{
            mb: 4,
            p: 2,
            background: "background.paper",
            border: `1px solid ${tokens.border}`,
            borderRadius: 4,
            alignItems: "center",
          }}
        >
          <FormControl sx={{ minWidth: 220, flex: 1, width: "100%" }} size="medium">
            <InputLabel id="mood-label">
              <Stack direction="row" spacing={0.5} alignItems="center">
                <MoodIcon fontSize="small" /> <span>Sort by mood</span>
              </Stack>
            </InputLabel>
            <Select
              labelId="mood-label"
              label="Sort by mood"
              value={selectedMood}
              onChange={handleMoodChange}
            >
              <MenuItem value="None" disabled>
                None
              </MenuItem>
              {MOODS.map((m) => (
                <MenuItem key={m} value={m}>
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 220, flex: 1, width: "100%" }} size="medium">
            <InputLabel id="market-label">
              <Stack direction="row" spacing={0.5} alignItems="center">
                <PublicIcon fontSize="small" /> <span>Sort by region</span>
              </Stack>
            </InputLabel>
            <Select
              labelId="market-label"
              label="Sort by region"
              value={selectedMarket}
              onChange={handleMarketChange}
            >
              {MARKETS.map((m) => (
                <MenuItem key={m.code || "global"} value={m.code}>
                  {m.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            onClick={() => refetch(selectedMood, selectedMarket)}
            disabled={loading}
            startIcon={<RefreshIcon />}
            variant="outlined"
            sx={{
              borderRadius: 999,
              py: 1.25,
              px: 3,
              borderColor: tokens.border,
              color: "text.primary",
              minWidth: { xs: "100%", md: "auto" },
              "&:hover": { background: tokens.primarySoft, borderColor: "primary.main" },
            }}
          >
            Shuffle
          </Button>
        </Stack>

        {/* Loading */}
        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Track grid */}
        {!loading && tracks.length === 0 ? (
          <Box
            sx={{
              p: 6,
              textAlign: "center",
              border: `1px dashed ${tokens.border}`,
              borderRadius: 4,
            }}
          >
            <MusicNoteIcon sx={{ fontSize: 56, color: "text.secondary", mb: 1 }} />
            <Typography sx={{ fontWeight: 800, fontSize: 18, mb: 0.5 }}>
              No recommendations yet
            </Typography>
            <Typography sx={{ color: "text.secondary" }}>
              Pick a mood or region above, or try detecting a new one from the
              Home screen.
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={2.5}>
            {tracks.map((track, i) => (
              <Grid item xs={12} sm={6} md={4} key={`${track.external_url || track.name}-${i}`}>
                <TrackCard track={track} />
              </Grid>
            ))}
          </Grid>
        )}
      </Container>
    </Box>
  );
}

function TrackCard({ track }) {
  return (
    <Box
      sx={{
        background: "background.paper",
        borderRadius: 4,
        border: `1px solid ${tokens.border}`,
        overflow: "hidden",
        transition: "transform .3s, box-shadow .3s",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: shadows.md,
          borderColor: "primary.main",
        },
      }}
    >
      <Box
        sx={{
          position: "relative",
          aspectRatio: "1 / 1",
          background: gradients.primarySoft,
          overflow: "hidden",
        }}
      >
        {track.image_url ? (
          <Box
            component="img"
            src={track.image_url}
            alt={`${track.name} cover`}
            sx={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <Box
            sx={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MusicNoteIcon sx={{ fontSize: 56, color: "primary.main", opacity: 0.6 }} />
          </Box>
        )}
        {track.popularity > 60 && (
          <Chip
            label="Popular"
            size="small"
            sx={{
              position: "absolute",
              top: 12,
              right: 12,
              fontWeight: 800,
              color: "#fff",
              background: gradients.primary,
              border: 0,
            }}
          />
        )}
      </Box>
      <Box sx={{ p: 2.5, display: "flex", flexDirection: "column", flexGrow: 1 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 16, lineHeight: 1.25, mb: 0.5 }} noWrap title={track.name}>
          {track.name}
        </Typography>
        <Typography sx={{ color: "text.secondary", fontSize: 13.5 }} noWrap title={track.artist}>
          {track.artist}
        </Typography>

        {track.preview_url && (
          <audio
            src={track.preview_url}
            controls
            style={{ width: "100%", marginTop: 12, height: 36 }}
          />
        )}

        <Button
          component="a"
          href={track.external_url}
          target="_blank"
          rel="noreferrer"
          endIcon={<OpenInNewIcon />}
          variant="contained"
          color="primary"
          sx={{
            mt: 2,
            borderRadius: 999,
            py: 1,
            fontWeight: 700,
          }}
        >
          Listen on Deezer
        </Button>
      </Box>
    </Box>
  );
}
