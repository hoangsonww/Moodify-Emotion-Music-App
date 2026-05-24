import React, { useState, useContext, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Avatar,
  Box,
  Button,
  Card,
  CircularProgress,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  Album,
  AllInclusive,
  ArrowBack,
  ArrowDownward,
  AutoAwesome,
  Bedtime,
  Category,
  Clear,
  Favorite,
  FavoriteBorder,
  FlashOn,
  Forest,
  GraphicEq,
  HeadphonesOutlined,
  Language,
  LocalBar,
  LocalFireDepartment,
  MusicNote,
  OpenInNew,
  Park,
  Person,
  Piano,
  Public,
  Refresh,
  Search,
  Shuffle,
  Sort,
  Stars,
  TextFields,
  Waves,
  WbSunny,
  Whatshot,
} from "@mui/icons-material";
import axios from "axios";

import { DarkModeContext } from "../context/DarkModeContext";
import TrackPlayer from "../components/TrackPlayer";
import { API_URL, MODAL_API_URL } from "../config";
import { logTrackOpen } from "../services/listening";

// User-facing genre catalog. The token sent to the recommender goes
// straight into a Deezer search keyword, so each entry maps a friendly
// label + an evocative icon to a query token Deezer recognises well.
// Tints are used for the leading icon tile in the genre menu.
const GENRES = [
  { key: "", label: "Any genre", icon: AllInclusive, tint: "#9aa" },
  { key: "pop", label: "Pop", icon: Whatshot, tint: "#ff4d4d" },
  { key: "hip-hop", label: "Hip-Hop", icon: GraphicEq, tint: "#a855f7" },
  { key: "rock", label: "Rock", icon: MusicNote, tint: "#f97316" },
  { key: "indie", label: "Indie", icon: Album, tint: "#22d3ee" },
  { key: "r&b", label: "R&B", icon: Favorite, tint: "#ec4899" },
  { key: "electronic", label: "Electronic", icon: FlashOn, tint: "#3b82f6" },
  { key: "edm", label: "EDM", icon: GraphicEq, tint: "#0ea5e9" },
  { key: "lofi", label: "Lo-fi", icon: Bedtime, tint: "#8b5cf6" },
  { key: "jazz", label: "Jazz", icon: LocalBar, tint: "#d97706" },
  { key: "classical", label: "Classical", icon: Piano, tint: "#6b7280" },
  { key: "country", label: "Country", icon: Park, tint: "#a3a04a" },
  { key: "latin", label: "Latin", icon: Public, tint: "#f59e0b" },
  { key: "k-pop", label: "K-Pop", icon: Stars, tint: "#f472b6" },
  { key: "metal", label: "Metal", icon: LocalFireDepartment, tint: "#ef4444" },
  { key: "folk", label: "Folk", icon: Forest, tint: "#16a34a" },
  { key: "soul", label: "Soul", icon: FavoriteBorder, tint: "#c026d3" },
  { key: "blues", label: "Blues", icon: Waves, tint: "#2563eb" },
  { key: "reggae", label: "Reggae", icon: WbSunny, tint: "#facc15" },
];

// ---------- mood palette ----------
// Per-mood gradient + emoji + label. Falls back to the brand gradient
// and a 🎧 glyph for moods we don't have an explicit entry for.
const MOOD_PALETTE = {
  joy: {
    emoji: "😊",
    label: "Joyful",
    colors: ["#f59e0b", "#f472b6", "#ec4899"],
  },
  happy: {
    emoji: "😊",
    label: "Happy",
    colors: ["#f59e0b", "#f472b6", "#ec4899"],
  },
  love: {
    emoji: "🥰",
    label: "In love",
    colors: ["#ec4899", "#f472b6", "#fb7185"],
  },
  excited: {
    emoji: "🤩",
    label: "Excited",
    colors: ["#f97316", "#ec4899", "#a855f7"],
  },
  surprise: {
    emoji: "😲",
    label: "Surprised",
    colors: ["#06b6d4", "#22d3ee", "#a855f7"],
  },
  surprised: {
    emoji: "😲",
    label: "Surprised",
    colors: ["#06b6d4", "#22d3ee", "#a855f7"],
  },
  calm: {
    emoji: "😌",
    label: "Calm",
    colors: ["#10b981", "#22d3ee", "#3b82f6"],
  },
  neutral: {
    emoji: "😐",
    label: "Neutral",
    colors: ["#475569", "#64748b", "#94a3b8"],
  },
  sad: { emoji: "😢", label: "Sad", colors: ["#1e3a8a", "#3b82f6", "#60a5fa"] },
  sadness: {
    emoji: "😢",
    label: "Sad",
    colors: ["#1e3a8a", "#3b82f6", "#60a5fa"],
  },
  fear: {
    emoji: "😨",
    label: "Anxious",
    colors: ["#4c1d95", "#7c3aed", "#a855f7"],
  },
  fearful: {
    emoji: "😨",
    label: "Anxious",
    colors: ["#4c1d95", "#7c3aed", "#a855f7"],
  },
  anger: {
    emoji: "😠",
    label: "Angry",
    colors: ["#9f1239", "#e11d48", "#f43f5e"],
  },
  angry: {
    emoji: "😠",
    label: "Angry",
    colors: ["#9f1239", "#e11d48", "#f43f5e"],
  },
  disgust: {
    emoji: "😖",
    label: "Disgust",
    colors: ["#365314", "#65a30d", "#a3e635"],
  },
};
const paletteFor = (mood) =>
  MOOD_PALETTE[String(mood || "").toLowerCase()] || {
    emoji: "🎧",
    label: String(mood || "Mood"),
    colors: ["#ff4d4d", "#ff7a59", "#ec4899"],
  };

// ---------- sort options ----------
const SORTS = [
  {
    key: "recommended",
    label: "Recommended",
    icon: <AutoAwesome fontSize="small" />,
  },
  {
    key: "popular",
    label: "Most popular",
    icon: <LocalFireDepartment fontSize="small" />,
  },
  { key: "title", label: "Title (A–Z)", icon: <TextFields fontSize="small" /> },
  { key: "artist", label: "Artist (A–Z)", icon: <Person fontSize="small" /> },
];

function sortTracks(tracks, key) {
  const list = Array.isArray(tracks) ? [...tracks] : [];
  if (key === "popular") {
    list.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  } else if (key === "title") {
    list.sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || "")),
    );
  } else if (key === "artist") {
    list.sort((a, b) =>
      String(a.artist || "").localeCompare(String(b.artist || "")),
    );
  }
  return list;
}

const PAGE = 12;

const ResultsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isDarkMode } = useContext(DarkModeContext);

  const { emotion: incomingEmotion, recommendations: incomingTracks } =
    location.state || { emotion: "neutral", recommendations: [] };

  const [selectedMood, setSelectedMood] = useState(
    incomingEmotion || "neutral",
  );
  const [tracks, setTracks] = useState(incomingTracks || []);
  const [selectedMarket, setSelectedMarket] = useState("");
  const [moodHistory, setMoodHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState("recommended");
  const [visible, setVisible] = useState(PAGE);
  const [query, setQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("");
  const [profileId, setProfileId] = useState(null);

  const [sortAnchor, setSortAnchor] = useState(null);
  const [marketAnchor, setMarketAnchor] = useState(null);
  const [moodAnchor, setMoodAnchor] = useState(null);
  const [genreAnchor, setGenreAnchor] = useState(null);

  // Reset the load-more counter every time the user narrows the list, so
  // a fresh query doesn't dump a tiny filtered set inside a 12-row window.
  useEffect(() => {
    setVisible(PAGE);
  }, [query]);

  const palette = useMemo(() => paletteFor(selectedMood), [selectedMood]);
  const filteredTracks = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tracks;
    return tracks.filter((t) => {
      const name = String(t.name || "").toLowerCase();
      const artist = String(t.artist || "").toLowerCase();
      const album = String(t.album || "").toLowerCase();
      return name.includes(q) || artist.includes(q) || album.includes(q);
    });
  }, [tracks, query]);
  // Even before the Modal recommender redeploys with the new `genre`
  // query bias, we partition the visible list client-side so the
  // dropdown gives instant feedback: tracks whose title / album / artist
  // mentions the genre keyword surface to the top.
  const genreBiased = useMemo(() => {
    const g = String(selectedGenre || "")
      .trim()
      .toLowerCase();
    if (!g) return filteredTracks;
    const matches = [];
    const rest = [];
    for (const t of filteredTracks) {
      const haystack = [t.name, t.artist, t.album]
        .map((s) => String(s || "").toLowerCase())
        .join(" ");
      if (haystack.includes(g)) matches.push(t);
      else rest.push(t);
    }
    return [...matches, ...rest];
  }, [filteredTracks, selectedGenre]);
  const sortedTracks = useMemo(
    () => sortTracks(genreBiased, sortKey),
    [genreBiased, sortKey],
  );
  const shownTracks = sortedTracks.slice(0, visible);

  // Personalise the initial list with the user's mood history.
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const profile = await axios.get(`${API_URL}/users/user/profile/`);
        const history = Array.isArray(profile.data?.mood_history)
          ? profile.data.mood_history
          : [];
        if (cancelled) return;
        setMoodHistory(history);
        if (profile.data?.id) setProfileId(profile.data.id);
        if (history.length === 0) return;
        setLoading(true);
        const res = await axios.post(`${MODAL_API_URL}/music_recommendation`, {
          emotion: String(selectedMood || "neutral").toLowerCase(),
          history: history.slice(-50),
          genre: selectedGenre || undefined,
        });
        if (!cancelled) {
          setTracks(res.data.recommendations || []);
          setVisible(PAGE);
        }
      } catch (err) {
        console.error("Error personalising recommendations:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refetch = async (overrides = {}) => {
    setLoading(true);
    try {
      const res = await axios.post(`${MODAL_API_URL}/music_recommendation`, {
        emotion: String(
          overrides.mood ?? selectedMood ?? "neutral",
        ).toLowerCase(),
        market: (overrides.market ?? selectedMarket) || undefined,
        history: moodHistory.slice(-50),
        genre: (overrides.genre ?? selectedGenre) || undefined,
      });
      setTracks(res.data.recommendations || []);
      setVisible(PAGE);
    } catch (err) {
      console.error("Error fetching recommendations:", err);
    } finally {
      setLoading(false);
    }
  };

  const onMoodPick = (mood) => {
    setMoodAnchor(null);
    setSelectedMood(mood);
    refetch({ mood });
  };
  const onMarketPick = (market) => {
    setMarketAnchor(null);
    setSelectedMarket(market);
    refetch({ market });
  };
  const onGenrePick = (genre) => {
    setGenreAnchor(null);
    setSelectedGenre(genre);
    refetch({ genre });
  };
  const onTrackOpen = (track) => {
    if (profileId) logTrackOpen(profileId, track);
  };
  const onSortPick = (key) => {
    setSortAnchor(null);
    setSortKey(key);
    setVisible(PAGE);
  };
  // The Modal recommender is deterministic per (emotion, market, history)
  // tuple, so re-calling it returns the same ordered list -- a "shuffle"
  // round-trip looks like a no-op. Do a Fisher-Yates pass on whatever's
  // already on screen instead. Forces sortKey back to "recommended" so
  // the user actually sees the new order (popular/title/artist sorts
  // would otherwise overwrite the shuffled array).
  const onShuffle = () => {
    setTracks((prev) => {
      const arr = Array.isArray(prev) ? [...prev] : [];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    });
    setSortKey("recommended");
    setVisible(PAGE);
  };
  const onLoadMore = () =>
    setVisible((v) => Math.min(v + PAGE, sortedTracks.length));

  const sortLabel =
    SORTS.find((s) => s.key === sortKey)?.label || "Recommended";
  const marketLabel = MARKETS[selectedMarket] || "Global";
  const activeGenre = GENRES.find((g) => g.key === selectedGenre) || GENRES[0];
  const genreLabel = activeGenre.label;
  const GenreIcon = activeGenre.icon || Category;

  const styles = getStyles(isDarkMode, palette);

  return (
    <Box sx={styles.page}>
      {/* Hero ------------------------------------------------------------- */}
      <Box sx={styles.heroWrap}>
        <Box sx={styles.heroBg} />
        <Box sx={styles.heroContent}>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <IconButton
              onClick={() => navigate("/home")}
              sx={styles.backBtn}
              aria-label="Back to home"
            >
              <ArrowBack sx={{ color: "#fff" }} />
            </IconButton>
            <Typography sx={styles.kicker}>YOUR VIBE</Typography>
          </Stack>

          <Stack
            direction="row"
            spacing={3}
            alignItems="center"
            flexWrap="wrap"
          >
            <Box sx={styles.emojiTile}>
              <Typography sx={{ fontSize: 56, lineHeight: 1 }}>
                {palette.emoji}
              </Typography>
            </Box>
            <Box sx={{ flex: 1, minWidth: 200 }}>
              <Typography sx={styles.heroEyebrow}>DETECTED MOOD</Typography>
              <Typography sx={styles.heroTitle}>{palette.label}</Typography>
              <Typography sx={styles.heroSub}>
                {sortedTracks.length > 0
                  ? `${sortedTracks.length} tracks tuned to how you feel`
                  : "Pick a mood or shuffle for a fresh playlist"}
              </Typography>
            </Box>
          </Stack>
        </Box>
      </Box>

      {/* Controls --------------------------------------------------------- */}
      <Box sx={styles.controlsWrap}>
        <Paper elevation={0} sx={styles.controlsPaper(isDarkMode)}>
          <TextField
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search track, artist or album…"
            fullWidth
            variant="outlined"
            size="small"
            disabled={loading}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search
                    sx={{
                      color: isDarkMode ? "#9aa" : "#777",
                      fontSize: 20,
                    }}
                  />
                </InputAdornment>
              ),
              endAdornment: query ? (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    aria-label="Clear search"
                    onClick={() => setQuery("")}
                  >
                    <Clear
                      sx={{
                        fontSize: 18,
                        color: isDarkMode ? "#bbb" : "#777",
                      }}
                    />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
            sx={styles.searchField(isDarkMode)}
          />
          <Stack
            direction="row"
            spacing={1.25}
            flexWrap="wrap"
            useFlexGap
            sx={{ mt: 1.5 }}
          >
            <Pill
              icon={<Sort fontSize="small" />}
              label={sortLabel}
              onClick={(e) => setSortAnchor(e.currentTarget)}
              isDark={isDarkMode}
              disabled={loading}
            />
            <Pill
              icon={<Language fontSize="small" />}
              label={marketLabel}
              onClick={(e) => setMarketAnchor(e.currentTarget)}
              isDark={isDarkMode}
              disabled={loading}
            />
            <Pill
              icon={<MusicNote fontSize="small" />}
              label={`Mood: ${palette.label}`}
              onClick={(e) => setMoodAnchor(e.currentTarget)}
              isDark={isDarkMode}
              disabled={loading}
            />
            <Pill
              icon={
                <GenreIcon
                  fontSize="small"
                  sx={{ color: activeGenre.tint || "#ff4d4d" }}
                />
              }
              label={genreLabel}
              onClick={(e) => setGenreAnchor(e.currentTarget)}
              disabled={loading}
              isDark={isDarkMode}
            />
            <Button
              startIcon={
                loading ? (
                  <CircularProgress size={16} sx={{ color: "#fff" }} />
                ) : (
                  <Shuffle />
                )
              }
              onClick={onShuffle}
              disabled={loading}
              sx={styles.shuffleBtn}
            >
              {loading ? "Shuffling…" : "Shuffle"}
            </Button>
          </Stack>
        </Paper>
      </Box>

      {/* Menus ------------------------------------------------------------ */}
      <Menu
        anchorEl={sortAnchor}
        open={Boolean(sortAnchor)}
        onClose={() => setSortAnchor(null)}
        slotProps={{ paper: { sx: styles.menuPaper } }}
      >
        {SORTS.map((s) => (
          <MenuItem
            key={s.key}
            selected={sortKey === s.key}
            onClick={() => onSortPick(s.key)}
            sx={styles.menuItem}
          >
            <Box sx={styles.menuIcon}>{s.icon}</Box>
            {s.label}
          </MenuItem>
        ))}
      </Menu>

      <Menu
        anchorEl={marketAnchor}
        open={Boolean(marketAnchor)}
        onClose={() => setMarketAnchor(null)}
        slotProps={{ paper: { sx: { ...styles.menuPaper, maxHeight: 360 } } }}
      >
        <MenuItem
          selected={selectedMarket === ""}
          onClick={() => onMarketPick("")}
          sx={styles.menuItem}
        >
          <Box sx={styles.menuIcon}>
            <Language fontSize="small" />
          </Box>
          Global
        </MenuItem>
        {Object.entries(MARKETS).map(([code, name]) => (
          <MenuItem
            key={code}
            selected={selectedMarket === code}
            onClick={() => onMarketPick(code)}
            sx={styles.menuItem}
          >
            {name}
          </MenuItem>
        ))}
      </Menu>

      <Menu
        anchorEl={moodAnchor}
        open={Boolean(moodAnchor)}
        onClose={() => setMoodAnchor(null)}
        slotProps={{ paper: { sx: { ...styles.menuPaper, maxHeight: 360 } } }}
      >
        {Object.keys(emotionToGenre).map((mood) => {
          const p = paletteFor(mood);
          return (
            <MenuItem
              key={mood}
              selected={
                String(selectedMood).toLowerCase() === mood.toLowerCase()
              }
              onClick={() => onMoodPick(mood)}
              sx={styles.menuItem}
            >
              <Box sx={styles.menuIcon}>
                <span aria-hidden style={{ fontSize: 16 }}>
                  {p.emoji}
                </span>
              </Box>
              {p.label}
            </MenuItem>
          );
        })}
      </Menu>

      <Menu
        anchorEl={genreAnchor}
        open={Boolean(genreAnchor)}
        onClose={() => setGenreAnchor(null)}
        slotProps={{ paper: { sx: { ...styles.menuPaper, maxHeight: 360 } } }}
      >
        {GENRES.map((g) => {
          const Icon = g.icon || Category;
          return (
            <MenuItem
              key={g.key || "any"}
              selected={selectedGenre === g.key}
              onClick={() => onGenrePick(g.key)}
              sx={styles.menuItem}
            >
              <Box sx={{ ...styles.menuIcon, color: g.tint || "#ff4d4d" }}>
                <Icon fontSize="small" />
              </Box>
              {g.label}
            </MenuItem>
          );
        })}
      </Menu>

      {/* Tracks ----------------------------------------------------------- */}
      <Box sx={styles.listWrap}>
        <Stack
          direction="row"
          alignItems="baseline"
          justifyContent="space-between"
          sx={{ mb: 1.5 }}
        >
          <Typography sx={styles.sectionTitle}>
            {loading && shownTracks.length === 0
              ? "Finding your tracks…"
              : query.trim()
                ? `${sortedTracks.length} match${sortedTracks.length === 1 ? "" : "es"} for "${query.trim()}"`
                : `${sortedTracks.length} tracks for you`}
          </Typography>
          {sortedTracks.length > 0 && (
            <Typography sx={styles.sectionMeta}>
              Showing {shownTracks.length} of {sortedTracks.length}
            </Typography>
          )}
        </Stack>

        {loading && shownTracks.length === 0 ? (
          <Stack spacing={1.5}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton
                key={i}
                variant="rounded"
                height={88}
                sx={{ borderRadius: "14px" }}
              />
            ))}
          </Stack>
        ) : sortedTracks.length === 0 ? (
          <EmptyResults isDark={isDarkMode} onShuffle={onShuffle} />
        ) : (
          <Stack spacing={1.25}>
            {shownTracks.map((track, i) => (
              <TrackRow
                key={`${track.external_url || track.name}-${i}`}
                track={track}
                rank={sortKey === "popular" ? i + 1 : null}
                isDark={isDarkMode}
                palette={palette}
                onTrackOpen={onTrackOpen}
              />
            ))}
          </Stack>
        )}

        {sortedTracks.length > shownTracks.length && (
          <Box sx={{ textAlign: "center", mt: 2.5 }}>
            <Button
              onClick={onLoadMore}
              startIcon={<ArrowDownward />}
              sx={styles.loadMoreBtn}
            >
              Load more ({sortedTracks.length - shownTracks.length} left)
            </Button>
          </Box>
        )}

        {sortedTracks.length > 0 && (
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            sx={{ mt: 4 }}
          >
            <Button
              fullWidth
              startIcon={<Refresh />}
              onClick={onShuffle}
              disabled={loading}
              sx={styles.ghostBtn}
            >
              Shuffle recommendations
            </Button>
            <Button
              fullWidth
              startIcon={<AutoAwesome />}
              onClick={() => navigate("/home")}
              sx={styles.ctaBtn}
            >
              Analyze another mood
            </Button>
          </Stack>
        )}
      </Box>
    </Box>
  );
};

// ---------- sub-components ----------

function Pill({ icon, label, onClick, isDark, disabled }) {
  return (
    <Button
      onClick={onClick}
      startIcon={icon}
      disabled={disabled}
      sx={{
        fontFamily: "Poppins",
        fontWeight: 700,
        textTransform: "none",
        borderRadius: "999px",
        px: 2,
        py: 0.85,
        // Always solid bg so the pill doesn't ghost-out over the hero
        // gradient or the page background - both states are opaque.
        backgroundColor: isDark ? "#23232f" : "#ffffff",
        color: isDark ? "#f6f6f8" : "#1a1a1a",
        border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"}`,
        boxShadow: isDark
          ? "0 6px 16px rgba(0,0,0,0.35)"
          : "0 4px 14px rgba(0,0,0,0.08)",
        transition:
          "transform .12s ease, box-shadow .15s ease, border-color .15s ease",
        "&:hover": {
          backgroundColor: isDark ? "#2c2c3a" : "#fff7f5",
          borderColor: "#ff4d4d",
          boxShadow: isDark
            ? "0 10px 22px rgba(0,0,0,0.45)"
            : "0 8px 22px rgba(255,77,77,0.18)",
          transform: "translateY(-1px)",
        },
        "&:active": { transform: "translateY(0)" },
        "&.Mui-disabled": {
          backgroundColor: isDark ? "#1a1a25" : "#f5f5f7",
          color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)",
          borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
          boxShadow: "none",
          cursor: "not-allowed",
          pointerEvents: "auto", // keep tooltip / cursor; clicks are still blocked
        },
      }}
    >
      {label}
    </Button>
  );
}

function TrackRow({ track, rank, isDark, palette, onTrackOpen }) {
  const pop = track.popularity || 0;
  const reportOpen = () => {
    if (onTrackOpen) onTrackOpen(track);
  };
  return (
    <Card
      sx={{
        position: "relative",
        display: "flex",
        flexDirection: { xs: "column", sm: "row" },
        alignItems: { xs: "stretch", sm: "center" },
        gap: 1.5,
        p: 1.5,
        borderRadius: "18px",
        background: isDark ? "#1f1f1f" : "#ffffff",
        border: isDark ? "1px solid #2a2a2a" : "1px solid #f0e8e6",
        boxShadow: isDark
          ? "0 8px 24px rgba(0,0,0,0.3)"
          : "0 4px 18px rgba(255,77,77,0.05)",
        transition:
          "transform .15s ease, box-shadow .2s ease, border-color .15s ease",
        "&:hover": {
          transform: "translateY(-2px)",
          borderColor: "rgba(255,77,77,0.4)",
          boxShadow: isDark
            ? "0 14px 32px rgba(0,0,0,0.5)"
            : "0 12px 32px rgba(255,77,77,0.16)",
        },
      }}
    >
      {rank ? (
        <Box
          sx={{
            position: "absolute",
            top: 10,
            left: 10,
            background: `linear-gradient(135deg, ${palette.colors[0]}, ${palette.colors[2]})`,
            color: "#fff",
            fontFamily: "Poppins",
            fontWeight: 800,
            fontSize: 11,
            px: 0.9,
            py: 0.25,
            borderRadius: "8px",
            letterSpacing: 0.4,
            zIndex: 1,
          }}
        >
          #{rank}
        </Box>
      ) : null}

      {/* Art tile ------------------------------------------------------- */}
      <Box sx={{ position: "relative", flexShrink: 0 }}>
        <Avatar
          src={track.image_url}
          alt={track.name}
          variant="rounded"
          sx={{
            width: { xs: "100%", sm: 76 },
            height: { xs: 140, sm: 76 },
            borderRadius: "14px",
            background: `linear-gradient(135deg, ${palette.colors[0]}, ${palette.colors[2]})`,
            "& img": { objectFit: "cover" },
          }}
        >
          <MusicNote sx={{ color: "#fff", fontSize: 32 }} />
        </Avatar>
        {pop > 0 && (
          <Box
            sx={{
              position: "absolute",
              bottom: 6,
              right: 6,
              display: "flex",
              alignItems: "center",
              gap: 0.4,
              background: "rgba(0,0,0,0.55)",
              color: "#fff",
              fontFamily: "Poppins",
              fontWeight: 700,
              fontSize: 10,
              px: 0.75,
              py: 0.25,
              borderRadius: "6px",
              backdropFilter: "blur(4px)",
            }}
          >
            <Whatshot sx={{ fontSize: 12, color: "#ff7a59" }} />
            {pop}
          </Box>
        )}
      </Box>

      {/* Meta + player -------------------------------------------------- */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack
          direction="row"
          spacing={1}
          alignItems="flex-start"
          justifyContent="space-between"
          sx={{ mb: 0.5 }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              title={track.name}
              sx={{
                fontFamily: "Poppins",
                fontWeight: 800,
                fontSize: 15,
                color: isDark ? "#fff" : "#1a1a1a",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {track.name || "Untitled"}
            </Typography>
            <Typography
              title={track.artist}
              sx={{
                fontFamily: "Poppins",
                fontSize: 13,
                color: isDark ? "#bbb" : "#666",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {track.artist || "Unknown artist"}
            </Typography>
          </Box>
          <Button
            component="a"
            href={track.external_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={reportOpen}
            startIcon={<HeadphonesOutlined sx={{ fontSize: 16 }} />}
            endIcon={<OpenInNew sx={{ fontSize: 14 }} />}
            sx={{
              fontFamily: "Poppins",
              fontWeight: 700,
              textTransform: "none",
              borderRadius: "999px",
              px: 1.5,
              py: 0.5,
              fontSize: 12.5,
              color: "#fff",
              background: "linear-gradient(135deg, #ff4d4d 0%, #ff7a59 100%)",
              boxShadow: "0 6px 14px rgba(255,77,77,0.32)",
              flexShrink: 0,
              transition: "transform .15s ease, filter .15s ease",
              "&:hover": {
                background: "linear-gradient(135deg, #ff5e5e 0%, #ff8a6b 100%)",
                filter: "brightness(1.05)",
                transform: "translateY(-1px)",
              },
            }}
          >
            Open in Deezer
          </Button>
        </Stack>

        {track.preview_url ? (
          <TrackPlayer
            src={track.preview_url}
            gradient={palette.colors}
            onPlay={reportOpen}
            isDark={isDark}
          />
        ) : (
          <Typography
            sx={{
              fontFamily: "Poppins",
              fontSize: 11,
              color: isDark ? "#666" : "#aaa",
              fontStyle: "italic",
              mt: 0.5,
            }}
          >
            No preview - open on Deezer to listen
          </Typography>
        )}
      </Box>
    </Card>
  );
}

function EmptyResults({ isDark, onShuffle }) {
  return (
    <Paper
      elevation={0}
      sx={{
        py: 6,
        px: 3,
        textAlign: "center",
        borderRadius: "16px",
        background: isDark ? "#1f1f1f" : "#ffffff",
        border: isDark ? "1px solid #2a2a2a" : "1px dashed #f0d6d2",
      }}
    >
      <MusicNote sx={{ fontSize: 48, color: "#ff4d4d", opacity: 0.7 }} />
      <Typography
        sx={{
          fontFamily: "Poppins",
          fontWeight: 800,
          fontSize: 18,
          mt: 1,
          color: isDark ? "#fff" : "#1a1a1a",
        }}
      >
        No tracks yet
      </Typography>
      <Typography
        sx={{
          fontFamily: "Poppins",
          fontSize: 13,
          color: isDark ? "#bbb" : "#666",
          mt: 0.5,
          mb: 2,
        }}
      >
        Try shuffling or switching to a different mood.
      </Typography>
      <Button
        startIcon={<Shuffle />}
        onClick={onShuffle}
        sx={{
          fontFamily: "Poppins",
          fontWeight: 700,
          textTransform: "none",
          color: "#fff",
          background: "linear-gradient(135deg, #ff4d4d 0%, #ff7a59 100%)",
          borderRadius: "999px",
          px: 3,
          "&:hover": {
            background: "linear-gradient(135deg, #ff5e5e 0%, #ff8a6b 100%)",
          },
        }}
      >
        Shuffle
      </Button>
    </Paper>
  );
}

// ---------- mood + market data (kept from old file) ----------
const emotionToGenre = {
  joy: "hip-hop",
  happy: "happy",
  sadness: "sad",
  sad: "sad",
  anger: "metal",
  angry: "metal",
  love: "romance",
  fear: "sad",
  fearful: "sad",
  neutral: "pop",
  calm: "chill",
  disgust: "blues",
  surprised: "party",
  surprise: "party",
  excited: "party",
};

const MARKETS = {
  US: "United States",
  GB: "United Kingdom",
  CA: "Canada",
  AU: "Australia",
  IN: "India",
  IE: "Ireland",
  DE: "Germany",
  FR: "France",
  ES: "Spain",
  IT: "Italy",
  NL: "Netherlands",
  SE: "Sweden",
  BR: "Brazil",
  MX: "Mexico",
  JP: "Japan",
  KR: "South Korea",
  ZA: "South Africa",
  AR: "Argentina",
  CO: "Colombia",
  CL: "Chile",
  PE: "Peru",
  EG: "Egypt",
  TR: "Turkey",
  RU: "Russia",
  PL: "Poland",
  PT: "Portugal",
  CH: "Switzerland",
  AT: "Austria",
  BE: "Belgium",
  DK: "Denmark",
  NO: "Norway",
  FI: "Finland",
  GR: "Greece",
  CZ: "Czech Republic",
  HU: "Hungary",
  RO: "Romania",
  IL: "Israel",
  AE: "United Arab Emirates",
  SA: "Saudi Arabia",
  TH: "Thailand",
  VN: "Vietnam",
  ID: "Indonesia",
  MY: "Malaysia",
  PH: "Philippines",
  SG: "Singapore",
  HK: "Hong Kong",
  TW: "Taiwan",
  NZ: "New Zealand",
  NG: "Nigeria",
  KE: "Kenya",
  MA: "Morocco",
};

// ---------- styles ----------
const getStyles = (isDark, palette) => ({
  page: {
    minHeight: "100vh",
    background: isDark ? "#0b0b11" : "#fdf6f4",
    pb: 6,
    fontFamily: "Poppins",
  },
  heroWrap: {
    position: "relative",
    overflow: "hidden",
    pt: { xs: 2.5, sm: 3.5 },
    pb: { xs: 5, sm: 7 },
    px: { xs: 2, sm: 4 },
  },
  heroBg: {
    position: "absolute",
    inset: 0,
    background: `linear-gradient(135deg, ${palette.colors[0]} 0%, ${palette.colors[1]} 50%, ${palette.colors[2]} 100%)`,
    opacity: isDark ? 0.92 : 0.95,
    "&::after": {
      content: '""',
      position: "absolute",
      inset: 0,
      background:
        "radial-gradient(60% 60% at 80% 0%, rgba(255,255,255,0.18) 0%, transparent 70%), radial-gradient(50% 50% at 0% 100%, rgba(0,0,0,0.18) 0%, transparent 70%)",
    },
  },
  heroContent: {
    position: "relative",
    zIndex: 1,
    maxWidth: 1100,
    mx: "auto",
  },
  backBtn: {
    backgroundColor: "rgba(255,255,255,0.18)",
    backdropFilter: "blur(8px)",
    "&:hover": { backgroundColor: "rgba(255,255,255,0.28)" },
  },
  kicker: {
    color: "rgba(255,255,255,0.9)",
    fontFamily: "Poppins",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 2,
  },
  emojiTile: {
    width: 96,
    height: 96,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "24px",
    background: "rgba(255,255,255,0.22)",
    backdropFilter: "blur(12px)",
    boxShadow:
      "inset 0 0 0 1px rgba(255,255,255,0.3), 0 10px 30px rgba(0,0,0,0.18)",
  },
  heroEyebrow: {
    color: "rgba(255,255,255,0.85)",
    fontFamily: "Poppins",
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: 2,
    mb: 0.5,
  },
  heroTitle: {
    color: "#fff",
    fontFamily: "Poppins",
    fontWeight: 900,
    fontSize: { xs: 36, sm: 48 },
    letterSpacing: -1.2,
    lineHeight: 1.05,
  },
  heroSub: {
    color: "rgba(255,255,255,0.92)",
    fontFamily: "Poppins",
    fontSize: 14,
    mt: 0.75,
  },
  controlsWrap: {
    maxWidth: 1100,
    mx: "auto",
    px: { xs: 2, sm: 4 },
    // Pull the search + pills card up to overlap the bottom of the hero
    // gradient. The hero has extra bottom padding so the mood label still
    // has breathing room above this card.
    mt: { xs: -4, sm: -5 },
    mb: { xs: 3, sm: 4 },
    position: "relative",
    zIndex: 2,
  },
  controlsPaper: (isDark) => ({
    p: { xs: 1.5, sm: 1.75 },
    borderRadius: "18px",
    background: isDark ? "#161620" : "#ffffff",
    border: isDark ? "1px solid #2a2a36" : "1px solid #f3e8e3",
    boxShadow: isDark
      ? "0 18px 44px rgba(0,0,0,0.45)"
      : "0 18px 40px rgba(255,77,77,0.10)",
  }),
  searchField: (isDark) => ({
    "& .MuiOutlinedInput-root": {
      fontFamily: "Poppins",
      fontWeight: 600,
      borderRadius: "12px",
      background: isDark ? "#1f1f2c" : "#fafafa",
      color: isDark ? "#f6f6f8" : "#1a1a1a",
      transition: "background .15s ease, border-color .15s ease",
      "& fieldset": {
        borderColor: isDark ? "#2c2c3a" : "#eee8e5",
      },
      "&:hover fieldset": {
        borderColor: isDark ? "#3a3a4c" : "#f0d6d2",
      },
      "&.Mui-focused fieldset": {
        borderColor: "#ff4d4d",
        borderWidth: 1.5,
      },
    },
    "& .MuiOutlinedInput-input::placeholder": {
      color: isDark ? "#6f6f7a" : "#aaa",
      opacity: 1,
    },
  }),
  shuffleBtn: {
    fontFamily: "Poppins",
    fontWeight: 800,
    textTransform: "none",
    borderRadius: "999px",
    px: 2.75,
    py: 0.95,
    color: "#fff",
    background: "linear-gradient(135deg, #ff4d4d 0%, #ff7a59 100%)",
    boxShadow: "0 6px 18px rgba(255,77,77,0.35)",
    transition: "filter .15s ease, box-shadow .2s ease, transform .15s ease",
    "&:hover": {
      background: "linear-gradient(135deg, #ff5e5e 0%, #ff8a6b 100%)",
      filter: "brightness(1.05)",
      transform: "translateY(-1px)",
      boxShadow: "0 10px 24px rgba(255,77,77,0.45)",
    },
    // Keep the gradient + white text when loading; the only signal is a
    // slight opacity drop + the spinner that replaces the icon.
    "&.Mui-disabled": {
      background: "linear-gradient(135deg, #ff4d4d 0%, #ff7a59 100%)",
      color: "#fff",
      opacity: 0.78,
      boxShadow: "0 6px 18px rgba(255,77,77,0.35)",
    },
  },
  menuPaper: {
    borderRadius: "14px",
    border: isDark ? "1px solid #2a2a2a" : "1px solid #f0e8e6",
    backgroundColor: isDark ? "#1a1a25" : "#ffffff",
    boxShadow: "0 16px 40px rgba(0,0,0,0.24)",
    mt: 0.5,
    minWidth: 220,
  },
  menuItem: {
    fontFamily: "Poppins",
    fontSize: 14,
    fontWeight: 600,
    color: isDark ? "#f6f6f8" : "#1a1a1a",
    py: 1,
    "&.Mui-selected": {
      backgroundColor: isDark ? "rgba(255,77,77,0.16)" : "rgba(255,77,77,0.08)",
      "&:hover": {
        backgroundColor: isDark
          ? "rgba(255,77,77,0.22)"
          : "rgba(255,77,77,0.12)",
      },
    },
  },
  menuIcon: {
    width: 24,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    mr: 1.25,
    color: "#ff4d4d",
  },
  listWrap: {
    maxWidth: 1100,
    mx: "auto",
    px: { xs: 2, sm: 4 },
  },
  sectionTitle: {
    fontFamily: "Poppins",
    fontWeight: 800,
    fontSize: 18,
    color: isDark ? "#fff" : "#1a1a1a",
  },
  sectionMeta: {
    fontFamily: "Poppins",
    fontSize: 12,
    color: isDark ? "#888" : "#999",
  },
  loadMoreBtn: {
    fontFamily: "Poppins",
    fontWeight: 700,
    textTransform: "none",
    color: "#ff4d4d",
    borderRadius: "999px",
    px: 2.5,
    border: "1px solid rgba(255,77,77,0.3)",
    "&:hover": {
      background: "rgba(255,77,77,0.06)",
      border: "1px solid #ff4d4d",
    },
  },
  ghostBtn: {
    fontFamily: "Poppins",
    fontWeight: 700,
    textTransform: "none",
    color: isDark ? "#fff" : "#1a1a1a",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.12)"}`,
    borderRadius: "999px",
    py: 1.25,
    "&:hover": {
      background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
    },
  },
  ctaBtn: {
    fontFamily: "Poppins",
    fontWeight: 800,
    textTransform: "none",
    color: "#fff",
    background: "linear-gradient(135deg, #ff4d4d 0%, #ff7a59 100%)",
    borderRadius: "999px",
    py: 1.25,
    boxShadow: "0 8px 20px rgba(255,77,77,0.32)",
    "&:hover": {
      background: "linear-gradient(135deg, #ff5e5e 0%, #ff8a6b 100%)",
    },
  },
});

export default ResultsPage;
