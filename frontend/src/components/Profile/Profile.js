import React, { useEffect, useState, useContext, useMemo } from "react";
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  AccountCircle,
  AutoAwesome,
  Delete,
  Edit,
  Email,
  HistoryToggleOff,
  Key,
  LibraryMusic,
  Logout,
  MoodOutlined,
  MusicNote,
  OpenInNew,
  PlaylistRemove,
  RestartAlt,
  Settings,
  Visibility,
  VisibilityOff,
} from "@mui/icons-material";
import axios from "axios";
import { useNavigate } from "react-router-dom";

import { DarkModeContext } from "../../context/DarkModeContext";
import { useToast } from "../Toast";
import { API_URL, MODAL_API_URL } from "../../config";
import { logout as clearAuthTokens } from "../../services/auth";

const CACHE_KEY = "userProfileCache";

const timeout = (ms) =>
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Request timed out")), ms),
  );

// Mood-key → emoji for the chip leading icon.
const MOOD_EMOJI = {
  joy: "😊",
  happy: "😊",
  happiness: "😊",
  sadness: "😢",
  sad: "😢",
  anger: "😠",
  angry: "😠",
  love: "🥰",
  fear: "😨",
  fearful: "😨",
  neutral: "😌",
  surprised: "😲",
  surprise: "😲",
  calm: "😌",
  disgust: "😖",
  excited: "🤩",
  bored: "😐",
  tired: "😴",
  relaxed: "😎",
  stressed: "😣",
  anxious: "😟",
  depressed: "😔",
  lonely: "😞",
  energetic: "⚡",
  nostalgic: "🥹",
  hopeful: "🌅",
  proud: "🦁",
  content: "😊",
  amused: "😄",
};
const moodEmoji = (mood) => MOOD_EMOJI[(mood || "").toLowerCase()] || "🎧";

const ProfilePage = () => {
  const [userData, setUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadingText, setLoadingText] = useState("Loading...");

  // Settings dialogs
  const [emailOpen, setEmailOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [emailValue, setEmailValue] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  const navigate = useNavigate();
  const toast = useToast();
  const token = localStorage.getItem("token");
  const { isDarkMode } = useContext(DarkModeContext);
  const styles = useMemo(() => getStyles(isDarkMode), [isDarkMode]);

  // ------------ data fetch ------------
  useEffect(() => {
    if (!token) {
      toast.warning("You are not signed in — sending you to login.");
      navigate("/login");
      return;
    }
    fetchUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUserData = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_URL}/users/user/profile/`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 60000,
      });
      setUserData(response.data);
      localStorage.removeItem(CACHE_KEY);
      localStorage.setItem(CACHE_KEY, JSON.stringify(response.data));
      setError("");
    } catch (err) {
      console.error("Error fetching user data:", err);
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        setUserData(JSON.parse(cached));
        toast.info("Showing cached profile — couldn't reach the server.");
      } else {
        setError(
          "Failed to fetch profile data. Our servers might be down. Please try again later.",
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ------------ mood -> recommendation ------------
  const handleMoodClick = async (mood) => {
    if (!userData) return;
    try {
      setLoadingText(`Fetching recommendations for "${mood}"...`);
      setIsLoading(true);
      const response = await Promise.race([
        axios.post(
          `${MODAL_API_URL}/music_recommendation`,
          {
            emotion: mood.toLowerCase(),
            history: (userData?.mood_history || []).slice(-50),
          },
          { headers: { Authorization: `Bearer ${token}` } },
        ),
        timeout(60000),
      ]);
      const { emotion, recommendations } = response.data;
      navigate("/results", { state: { emotion, recommendations } });
    } catch (err) {
      console.error("Error fetching recommendations:", err);
      toast.error("Failed to fetch recommendations. Please try again later.");
    } finally {
      setIsLoading(false);
      setLoadingText("Loading...");
    }
  };

  // ------------ settings actions ------------
  const userId = userData?.id;
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  const onSaveEmail = async () => {
    const next = emailValue.trim();
    if (!next) {
      toast.warning("Enter a valid email.");
      return;
    }
    setBusy(true);
    try {
      await axios.put(
        `${API_URL}/users/user/profile/update/`,
        { email: next },
        authHeaders,
      );
      toast.success("Email updated.");
      setEmailOpen(false);
      fetchUserData();
    } catch {
      toast.error("Could not update your email.");
    } finally {
      setBusy(false);
    }
  };

  const onChangePassword = async () => {
    if (password.length < 8) {
      toast.warning("Use at least 8 characters.");
      return;
    }
    if (password !== confirmPw) {
      toast.warning("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      await axios.post(`${API_URL}/users/reset-password/`, {
        username: userData?.username,
        new_password: password,
      });
      toast.success("Password updated — sign in with your new password.");
      setPwOpen(false);
      setPassword("");
      setConfirmPw("");
      // Clear local tokens; AUTH_EVENT will bounce gated pages to login.
      clearAuthTokens();
      navigate("/login");
    } catch {
      toast.error("Could not update your password.");
    } finally {
      setBusy(false);
    }
  };

  const onDeleteAccount = async () => {
    setBusy(true);
    try {
      await axios.delete(
        `${API_URL}/users/user/profile/delete/`,
        authHeaders,
      );
      toast.success("Account deleted.");
      clearAuthTokens();
      setDeleteOpen(false);
      navigate("/");
    } catch {
      toast.error("Could not delete your account.");
    } finally {
      setBusy(false);
    }
  };

  const onClearList = async (kind) => {
    if (!userId) return;
    const labels = {
      mood_history: "mood history",
      listening_history: "listening history",
      recommendations: "saved recommendations",
    };
    const label = labels[kind];
    if (
      !window.confirm(`Clear your ${label}? This can't be undone.`)
    ) {
      return;
    }

    setBusy(true);
    try {
      if (kind === "recommendations") {
        await axios.delete(
          `${API_URL}/users/recommendations/${userId}/`,
          authHeaders,
        );
      } else {
        // Per-entry delete loop (no bulk endpoint for moods / listening).
        const items = userData?.[kind] || [];
        const entryKey = kind === "mood_history" ? "mood" : "track";
        for (const item of items) {
          try {
            await axios.delete(`${API_URL}/users/${kind}/${userId}/`, {
              ...authHeaders,
              data: { [entryKey]: item },
            });
          } catch {
            /* keep going */
          }
        }
      }
      toast.success(`Cleared your ${label}.`);
      fetchUserData();
    } catch {
      toast.error(`Couldn't clear your ${label}.`);
    } finally {
      setBusy(false);
    }
  };

  const onSignOut = () => {
    clearAuthTokens();
    toast.info("Signed out.");
    navigate("/login");
  };

  // ------------ derived ------------
  const moods = userData?.mood_history || [];
  const recs = userData?.recommendations || [];
  const listening = userData?.listening_history || [];

  // ------------ render ------------
  return (
    <Box sx={styles.container}>
      {/* Full-screen loading overlay */}
      {isLoading && (
        <Box sx={styles.loadingOverlay}>
          <CircularProgress sx={{ color: "#ff4d4d" }} />
          <Typography variant="h6" sx={styles.loadingTitle}>
            {loadingText}
          </Typography>
          <Typography sx={styles.loadingNote}>
            Our servers may be cold for a few seconds after idle. Thanks for
            your patience.
          </Typography>
        </Box>
      )}

      {!isLoading && error && (
        <Box sx={styles.errorWrap}>
          <Paper elevation={4} sx={styles.errorCard}>
            <Typography variant="h6" color="error" sx={styles.errorText}>
              {error}
            </Typography>
            <Button
              variant="contained"
              onClick={fetchUserData}
              sx={styles.ctaSm}
              startIcon={<RestartAlt />}
            >
              Try again
            </Button>
          </Paper>
        </Box>
      )}

      {!isLoading && !error && userData && (
        <Box sx={styles.shell}>
          {/* ---------- HERO ---------- */}
          <Paper elevation={6} sx={styles.heroCard}>
            <Box sx={styles.heroBlobA} />
            <Box sx={styles.heroBlobB} />

            <Box sx={styles.heroBody}>
              <Avatar sx={styles.avatar}>
                {(userData.username || "U").charAt(0).toUpperCase()}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="overline" sx={styles.heroKicker}>
                  Your profile
                </Typography>
                <Typography variant="h5" sx={styles.heroTitle}>
                  Welcome, {userData.username}!
                </Typography>
                <Typography sx={styles.heroSub}>
                  Your moods, your music, your history — all in one place.
                </Typography>
              </Box>
            </Box>

            <Box sx={styles.statsRow}>
              <Stat
                icon={<MoodOutlined />}
                label="Moods logged"
                value={moods.length}
                tint="#ff4d4d"
              />
              <Stat
                icon={<LibraryMusic />}
                label="Saved tracks"
                value={recs.length}
                tint="#ff7a59"
              />
              <Stat
                icon={<HistoryToggleOff />}
                label="Listened"
                value={listening.length}
                tint="#ffb04d"
              />
            </Box>
          </Paper>

          {/* ---------- IDENTITY ---------- */}
          <Paper elevation={3} sx={styles.section}>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
              <Box sx={styles.sectionIcon}>
                <AccountCircle />
              </Box>
              <Typography variant="h6" sx={styles.sectionTitle}>
                Account
              </Typography>
            </Stack>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              alignItems={{ xs: "stretch", sm: "center" }}
              justifyContent="space-between"
            >
              <Box>
                <Typography sx={styles.idLine}>
                  Your Username: {userData.username}
                </Typography>
                <Typography sx={styles.idLine}>
                  Your Email: {userData.email}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                <Button
                  startIcon={<Edit />}
                  variant="outlined"
                  sx={styles.smallBtn}
                  onClick={() => {
                    setEmailValue(userData.email || "");
                    setEmailOpen(true);
                  }}
                >
                  Edit email
                </Button>
                <Button
                  startIcon={<Key />}
                  variant="outlined"
                  sx={styles.smallBtn}
                  onClick={() => setPwOpen(true)}
                >
                  Change password
                </Button>
              </Stack>
            </Stack>
          </Paper>

          {/* ---------- MOOD HISTORY ---------- */}
          <Paper elevation={3} sx={styles.section}>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
              <Box sx={styles.sectionIcon}>
                <MoodOutlined />
              </Box>
              <SectionTitle
                text="Your mood history"
                hint="Tap any mood to remix recommendations from it."
                action={
                  moods.length > 0 && (
                    <Button
                      startIcon={<PlaylistRemove />}
                      size="small"
                      sx={styles.linkBtn}
                      onClick={() => onClearList("mood_history")}
                      disabled={busy}
                    >
                      Clear all
                    </Button>
                  )
                }
              />
            </Stack>
            {moods.length === 0 ? (
              <EmptyState
                icon={<MoodOutlined sx={{ fontSize: 48 }} />}
                title="No moods yet"
                body="Analyse a mood from the Home page and it'll show up here."
              />
            ) : (
              <Box sx={styles.chipsWrap}>
                {moods.map((mood, i) => (
                  <Chip
                    key={`${mood}-${i}`}
                    label={
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span aria-hidden>{moodEmoji(mood)}</span>
                        <span>{mood}</span>
                      </span>
                    }
                    onClick={() => handleMoodClick(mood)}
                    sx={styles.moodChip}
                  />
                ))}
              </Box>
            )}
          </Paper>

          {/* ---------- SAVED TRACKS ---------- */}
          <Paper elevation={3} sx={styles.section}>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
              <Box sx={styles.sectionIcon}>
                <LibraryMusic />
              </Box>
              <SectionTitle
                text="Your saved recommendations"
                hint="Tracks you got after analysing a mood."
                action={
                  recs.length > 0 && (
                    <Button
                      startIcon={<PlaylistRemove />}
                      size="small"
                      sx={styles.linkBtn}
                      onClick={() => onClearList("recommendations")}
                      disabled={busy}
                    >
                      Clear all
                    </Button>
                  )
                }
              />
            </Stack>
            {recs.length === 0 ? (
              <EmptyState
                icon={<MusicNote sx={{ fontSize: 48 }} />}
                title="No saved tracks yet"
                body="Every Results page automatically saves its tracks here."
              />
            ) : (
              <Stack spacing={1.5}>
                {recs.map((rec, i) => (
                  <TrackRow key={`${rec.external_url || rec.name}-${i}`} rec={rec} isDark={isDarkMode} />
                ))}
              </Stack>
            )}
          </Paper>

          {/* ---------- LISTENING HISTORY ---------- */}
          <Paper elevation={3} sx={styles.section}>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
              <Box sx={styles.sectionIcon}>
                <HistoryToggleOff />
              </Box>
              <SectionTitle
                text="Tracks you've opened"
                hint="Stored as plain strings, freshest at the bottom."
                action={
                  listening.length > 0 && (
                    <Button
                      startIcon={<PlaylistRemove />}
                      size="small"
                      sx={styles.linkBtn}
                      onClick={() => onClearList("listening_history")}
                      disabled={busy}
                    >
                      Clear all
                    </Button>
                  )
                }
              />
            </Stack>
            {listening.length === 0 ? (
              <EmptyState
                icon={<HistoryToggleOff sx={{ fontSize: 48 }} />}
                title="Nothing here yet"
                body="Open a track from your Results page and we'll log it."
              />
            ) : (
              <Stack spacing={1}>
                {listening
                  .slice()
                  .reverse()
                  .map((entry, i) => (
                    <Paper
                      key={`${entry}-${i}`}
                      elevation={0}
                      sx={styles.listenRow}
                    >
                      <AutoAwesome sx={{ color: "#ff4d4d", fontSize: 18 }} />
                      <Typography sx={styles.listenText}>{entry}</Typography>
                    </Paper>
                  ))}
              </Stack>
            )}
          </Paper>

          {/* ---------- SETTINGS ---------- */}
          <Paper elevation={3} sx={styles.section}>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
              <Box sx={styles.sectionIcon}>
                <Settings />
              </Box>
              <Typography variant="h6" sx={styles.sectionTitle}>
                Settings
              </Typography>
            </Stack>
            <Stack spacing={1.5}>
              <SettingRow
                icon={<Email />}
                title="Update email"
                sub={userData.email || "Not set"}
                onClick={() => {
                  setEmailValue(userData.email || "");
                  setEmailOpen(true);
                }}
              />
              <SettingRow
                icon={<Key />}
                title="Change password"
                sub="Pick something memorable (8+ chars)."
                onClick={() => setPwOpen(true)}
              />
              <SettingRow
                icon={<Logout />}
                title="Sign out"
                sub="End this session on this device."
                onClick={onSignOut}
              />
              <SettingRow
                icon={<Delete />}
                title="Delete account"
                sub="Permanently remove your account + all history."
                danger
                onClick={() => setDeleteOpen(true)}
              />
            </Stack>
          </Paper>
        </Box>
      )}

      {/* ---------- DIALOGS ---------- */}
      <Dialog
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        PaperProps={{ sx: styles.dialog }}
      >
        <DialogTitle sx={styles.dialogTitle}>Update email</DialogTitle>
        <DialogContent>
          <DialogContentText sx={styles.dialogText}>
            We'll only use this to send you account-related messages.
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            label="Email"
            type="email"
            value={emailValue}
            onChange={(e) => setEmailValue(e.target.value)}
            sx={{ mt: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Email sx={{ color: isDarkMode ? "#bbb" : "#666" }} />
                </InputAdornment>
              ),
              style: styles.inputText,
            }}
            InputLabelProps={{ style: styles.inputLabel }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setEmailOpen(false)} sx={styles.ghostBtn}>
            Cancel
          </Button>
          <Button onClick={onSaveEmail} disabled={busy} sx={styles.ctaSm}>
            {busy ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={pwOpen}
        onClose={() => setPwOpen(false)}
        PaperProps={{ sx: styles.dialog }}
      >
        <DialogTitle sx={styles.dialogTitle}>Change password</DialogTitle>
        <DialogContent>
          <DialogContentText sx={styles.dialogText}>
            Use at least 8 characters. You'll be signed out after.
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            label="New password"
            type={showPw ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            sx={{ mt: 1, mb: 2 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Key sx={{ color: isDarkMode ? "#bbb" : "#666" }} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPw((p) => !p)}>
                    {showPw ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
              style: styles.inputText,
            }}
            InputLabelProps={{ style: styles.inputLabel }}
          />
          <TextField
            fullWidth
            label="Confirm password"
            type={showPw ? "text" : "password"}
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Key sx={{ color: isDarkMode ? "#bbb" : "#666" }} />
                </InputAdornment>
              ),
              style: styles.inputText,
            }}
            InputLabelProps={{ style: styles.inputLabel }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setPwOpen(false)} sx={styles.ghostBtn}>
            Cancel
          </Button>
          <Button onClick={onChangePassword} disabled={busy} sx={styles.ctaSm}>
            {busy ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : "Update"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        PaperProps={{ sx: styles.dialog }}
      >
        <DialogTitle sx={{ ...styles.dialogTitle, color: "#ff4d4d" }}>
          Delete account
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={styles.dialogText}>
            This permanently removes your account, mood history, listening
            history, and saved tracks. This can't be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteOpen(false)} sx={styles.ghostBtn}>
            Keep my account
          </Button>
          <Button onClick={onDeleteAccount} disabled={busy} sx={styles.dangerBtn}>
            {busy ? (
              <CircularProgress size={18} sx={{ color: "#fff" }} />
            ) : (
              "Delete forever"
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// ---------- small subcomponents ----------

function Stat({ icon, label, value, tint }) {
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        background: "rgba(255,255,255,0.08)",
        backdropFilter: "blur(6px)",
        borderRadius: "14px",
        border: "1px solid rgba(255,255,255,0.18)",
        p: 1.75,
        display: "flex",
        alignItems: "center",
        gap: 1.5,
      }}
    >
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: "10px",
          background: tint,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 22, fontWeight: 800, lineHeight: 1, color: "#fff" }}>
          {value}
        </Typography>
        <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.85)", mt: 0.25 }}>
          {label}
        </Typography>
      </Box>
    </Box>
  );
}

function SectionTitle({ text, hint, action }) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      justifyContent="space-between"
      alignItems={{ xs: "flex-start", sm: "center" }}
      spacing={1}
      sx={{ mb: 2 }}
    >
      <Box>
        <Typography sx={{ fontFamily: "Poppins", fontWeight: 800, fontSize: 17 }}>
          {text}
        </Typography>
        {hint && (
          <Typography
            sx={{ fontFamily: "Poppins", fontSize: 13, color: "text.secondary", mt: 0.25 }}
          >
            {hint}
          </Typography>
        )}
      </Box>
      {action}
    </Stack>
  );
}

function EmptyState({ icon, title, body }) {
  return (
    <Box
      sx={{
        textAlign: "center",
        py: 5,
        px: 3,
        borderRadius: "14px",
        border: "1px dashed rgba(255,77,77,0.4)",
        background: "rgba(255,77,77,0.04)",
      }}
    >
      <Box sx={{ color: "#ff4d4d", mb: 1 }}>{icon}</Box>
      <Typography sx={{ fontFamily: "Poppins", fontWeight: 700, mb: 0.5 }}>
        {title}
      </Typography>
      <Typography sx={{ fontFamily: "Poppins", fontSize: 13, color: "text.secondary" }}>
        {body}
      </Typography>
    </Box>
  );
}

function TrackRow({ rec, isDark }) {
  return (
    <Paper
      elevation={0}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        padding: 1.5,
        borderRadius: "14px",
        border: `1px solid ${isDark ? "#2a2a2a" : "#eeeeee"}`,
        background: isDark ? "#191919" : "#fff",
        transition: "transform .2s ease, box-shadow .2s ease",
        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: "0 14px 30px rgba(255,77,77,0.18)",
          borderColor: "rgba(255,77,77,0.4)",
        },
      }}
    >
      {rec.image_url ? (
        <Box
          component="img"
          src={rec.image_url}
          alt=""
          sx={{
            width: 60,
            height: 60,
            borderRadius: "10px",
            objectFit: "cover",
            flexShrink: 0,
            background: isDark ? "#2a2a2a" : "#f4f4f4",
          }}
        />
      ) : (
        <Box
          sx={{
            width: 60,
            height: 60,
            borderRadius: "10px",
            background: "linear-gradient(135deg, #ff4d4d, #ff7a59)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <MusicNote sx={{ color: "#fff" }} />
        </Box>
      )}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          noWrap
          sx={{ fontFamily: "Poppins", fontWeight: 700, fontSize: 15 }}
        >
          {rec.name}
        </Typography>
        <Typography
          noWrap
          sx={{ fontFamily: "Poppins", fontSize: 13, color: "text.secondary" }}
        >
          {rec.artist}
        </Typography>
        {rec.preview_url && (
          <audio
            src={rec.preview_url}
            controls
            style={{ width: "100%", height: 32, marginTop: 6 }}
          />
        )}
      </Box>
      <Tooltip title="Open in Deezer">
        <Button
          component="a"
          href={rec.external_url}
          target="_blank"
          rel="noreferrer"
          endIcon={<OpenInNew sx={{ fontSize: 16 }} />}
          sx={{
            borderRadius: "999px",
            fontFamily: "Poppins",
            fontWeight: 700,
            textTransform: "none",
            color: "#fff",
            background: "linear-gradient(135deg, #ff4d4d 0%, #ff6b6b 100%)",
            px: 2,
            py: 0.75,
            boxShadow: "0 8px 18px rgba(255,77,77,0.3)",
            flexShrink: 0,
            "&:hover": {
              background: "linear-gradient(135deg, #ff5e5e 0%, #ff7d7d 100%)",
              transform: "translateY(-1px)",
            },
          }}
        >
          Listen on Deezer
        </Button>
      </Tooltip>
    </Paper>
  );
}

function SettingRow({ icon, title, sub, onClick, danger }) {
  return (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        padding: 2,
        borderRadius: "12px",
        cursor: "pointer",
        border: danger
          ? "1px solid rgba(255,77,77,0.45)"
          : "1px solid rgba(255,77,77,0.18)",
        background: danger ? "rgba(255,77,77,0.04)" : "transparent",
        transition: "all .2s ease",
        "&:hover": {
          background: danger
            ? "rgba(255,77,77,0.08)"
            : "rgba(255,77,77,0.05)",
          transform: "translateY(-1px)",
        },
      }}
    >
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: "10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: danger
            ? "linear-gradient(135deg, #ff4d4d, #ff7a59)"
            : "rgba(255,77,77,0.12)",
          color: danger ? "#fff" : "#ff4d4d",
        }}
      >
        {icon}
      </Box>
      <Box sx={{ flex: 1 }}>
        <Typography
          sx={{
            fontFamily: "Poppins",
            fontWeight: 700,
            fontSize: 15,
            color: danger ? "#ff4d4d" : "inherit",
          }}
        >
          {title}
        </Typography>
        <Typography
          sx={{ fontFamily: "Poppins", fontSize: 13, color: "text.secondary" }}
        >
          {sub}
        </Typography>
      </Box>
    </Paper>
  );
}

const getStyles = (isDark) => ({
  container: {
    minHeight: "calc(100vh - 80px)",
    padding: { xs: "16px", sm: "32px" },
    backgroundColor: isDark ? "#121212" : "#f7f5f4",
    backgroundImage:
      "radial-gradient(60% 50% at 20% 0%, rgba(255,77,77,0.10) 0%, transparent 60%), radial-gradient(50% 50% at 85% 100%, rgba(255,77,77,0.06) 0%, transparent 60%)",
    color: isDark ? "#ffffff" : "#000000",
    fontFamily: "Poppins",
    transition: "background-color 0.3s ease, color 0.3s ease",
  },
  loadingOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.78)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    p: 4,
  },
  loadingTitle: {
    mt: 1.5,
    color: "#fff",
    fontFamily: "Poppins",
    fontWeight: 700,
  },
  loadingNote: {
    mt: 1.5,
    color: "rgba(255,255,255,0.7)",
    fontFamily: "Poppins",
    fontSize: 13,
    textAlign: "center",
    maxWidth: 360,
  },
  errorWrap: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "60vh",
  },
  errorCard: {
    p: 4,
    borderRadius: "18px",
    background: isDark ? "#1f1f1f" : "#ffffff",
    border: "1px solid rgba(255,77,77,0.3)",
    textAlign: "center",
    maxWidth: 480,
  },
  errorText: { fontFamily: "Poppins", mb: 2 },

  shell: { maxWidth: 960, mx: "auto", display: "flex", flexDirection: "column", gap: 3 },

  heroCard: {
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
  heroBody: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: 2.5,
    flexWrap: "wrap",
  },
  avatar: {
    width: 86,
    height: 86,
    background: "rgba(255,255,255,0.22)",
    color: "#fff",
    fontFamily: "Poppins",
    fontWeight: 800,
    fontSize: 36,
    border: "3px solid rgba(255,255,255,0.4)",
    boxShadow: "0 12px 28px rgba(0,0,0,0.18)",
  },
  heroKicker: {
    fontFamily: "Poppins",
    fontWeight: 800,
    fontSize: 12,
    letterSpacing: "0.2em",
    opacity: 0.85,
  },
  heroTitle: {
    fontFamily: "Poppins",
    fontWeight: 900,
    fontSize: 28,
    mt: 0.25,
    lineHeight: 1.1,
    letterSpacing: "-0.02em",
  },
  heroSub: {
    fontFamily: "Poppins",
    fontSize: 14,
    opacity: 0.92,
    mt: 0.75,
  },
  statsRow: {
    mt: 3,
    display: "flex",
    gap: 1.5,
    flexWrap: "wrap",
    position: "relative",
  },

  section: {
    borderRadius: "18px",
    padding: { xs: 2.5, sm: 3 },
    background: isDark ? "#1f1f1f" : "#ffffff",
    border: isDark ? "1px solid #2a2a2a" : "1px solid #f0e8e6",
    boxShadow: isDark
      ? "0 12px 30px rgba(0,0,0,0.35)"
      : "0 12px 30px rgba(255,77,77,0.06)",
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: "10px",
    background:
      "linear-gradient(135deg, rgba(255,77,77,0.18), rgba(255,122,89,0.18))",
    color: "#ff4d4d",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontFamily: "Poppins",
    fontWeight: 800,
    color: isDark ? "#fff" : "#1a1a1a",
    letterSpacing: "-0.01em",
  },
  idLine: {
    fontFamily: "Poppins",
    fontSize: 15,
    color: isDark ? "#ddd" : "#222",
    mb: 0.5,
  },

  tabs: {
    borderBottom: isDark ? "1px solid #2a2a2a" : "1px solid #f0e8e6",
    mx: { xs: -2.5, sm: -3 },
    px: { xs: 2.5, sm: 3 },
    mb: 2,
    "& .MuiTab-root.Mui-selected": { color: "#ff4d4d" },
  },
  tab: {
    fontFamily: "Poppins",
    fontWeight: 700,
    textTransform: "none",
    minHeight: 48,
    color: isDark ? "#bbb" : "#666",
  },
  tabBody: { pt: 1 },

  chipsWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: 1,
  },
  moodChip: {
    fontFamily: "Poppins",
    fontWeight: 700,
    fontSize: 13,
    height: 36,
    px: 0.5,
    borderRadius: 999,
    border: "1px solid rgba(255,77,77,0.25)",
    background: isDark ? "rgba(255,77,77,0.10)" : "rgba(255,77,77,0.08)",
    color: isDark ? "#ffb3b3" : "#ff4d4d",
    cursor: "pointer",
    transition: "all .2s ease",
    "&:hover": {
      background: "linear-gradient(135deg, #ff4d4d 0%, #ff6b6b 100%)",
      color: "#fff",
      transform: "translateY(-1px)",
      boxShadow: "0 8px 16px rgba(255,77,77,0.32)",
    },
  },

  listenRow: {
    display: "flex",
    alignItems: "center",
    gap: 1.5,
    padding: 1.5,
    borderRadius: "10px",
    background: isDark ? "rgba(255,255,255,0.03)" : "rgba(255,77,77,0.04)",
    border: isDark ? "1px solid #2a2a2a" : "1px solid #f4dedb",
  },
  listenText: {
    fontFamily: "Poppins",
    fontSize: 14,
    color: isDark ? "#eee" : "#222",
  },

  smallBtn: {
    borderRadius: "999px",
    fontFamily: "Poppins",
    fontWeight: 700,
    textTransform: "none",
    borderColor: "rgba(255,77,77,0.4)",
    color: "#ff4d4d",
    "&:hover": { borderColor: "#ff4d4d", background: "rgba(255,77,77,0.06)" },
  },
  linkBtn: {
    fontFamily: "Poppins",
    fontWeight: 700,
    textTransform: "none",
    color: "#ff4d4d",
    "&:hover": { background: "rgba(255,77,77,0.08)" },
  },
  ghostBtn: {
    fontFamily: "Poppins",
    fontWeight: 700,
    textTransform: "none",
    color: isDark ? "#ccc" : "#555",
  },
  ctaSm: {
    borderRadius: "999px",
    fontFamily: "Poppins",
    fontWeight: 700,
    textTransform: "none",
    color: "#fff",
    background: "linear-gradient(135deg, #ff4d4d 0%, #ff6b6b 100%)",
    boxShadow: "0 8px 18px rgba(255,77,77,0.3)",
    px: 2,
    "&:hover": {
      background: "linear-gradient(135deg, #ff5e5e 0%, #ff7d7d 100%)",
    },
  },
  dangerBtn: {
    borderRadius: "999px",
    fontFamily: "Poppins",
    fontWeight: 700,
    textTransform: "none",
    color: "#fff",
    background: "linear-gradient(135deg, #ff4d4d 0%, #c0392b 100%)",
    boxShadow: "0 10px 22px rgba(255,77,77,0.4)",
    "&:hover": {
      background: "linear-gradient(135deg, #ff5e5e 0%, #d43f2e 100%)",
    },
  },

  dialog: {
    borderRadius: "18px",
    background: isDark ? "#1f1f1f" : "#ffffff",
    color: isDark ? "#fff" : "#000",
    padding: 1,
    maxWidth: 460,
  },
  dialogTitle: {
    fontFamily: "Poppins",
    fontWeight: 800,
    color: isDark ? "#fff" : "#1a1a1a",
  },
  dialogText: {
    fontFamily: "Poppins",
    fontSize: 14,
    color: isDark ? "#bbb" : "#555",
    mb: 1,
  },
  inputText: {
    fontFamily: "Poppins",
    fontSize: 15,
    color: isDark ? "#fff" : "#000",
  },
  inputLabel: { fontFamily: "Poppins", color: isDark ? "#cccccc" : "#666" },
});

export default ProfilePage;
