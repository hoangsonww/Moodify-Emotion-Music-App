import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Webcam from "react-webcam";
import axios from "axios";
import { useNavigate } from "react-router-dom";

import KeyboardIcon from "@mui/icons-material/Keyboard";
import MicIcon from "@mui/icons-material/Mic";
import StopIcon from "@mui/icons-material/Stop";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import FaceRetouchingNaturalIcon from "@mui/icons-material/FaceRetouchingNatural";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import RefreshIcon from "@mui/icons-material/Refresh";

import { API_URL, MODAL_API_URL } from "../config";
import { gradients, shadows, tokens } from "../theme";

// Mode metadata. Labels are EXACT and load-bearing -- tests assert these
// button names and the "Choose an input mode (X)" prompt below.
const MODES = [
  {
    key: "text",
    label: "Text",
    icon: KeyboardIcon,
    accent: "#8b5cf6",
    accentSoft: "rgba(139, 92, 246, 0.18)",
    description: "Type a few words about how you feel.",
  },
  {
    key: "face",
    label: "Face",
    icon: FaceRetouchingNaturalIcon,
    accent: "#ec4899",
    accentSoft: "rgba(236, 72, 153, 0.18)",
    description: "Snap a selfie — we read your expression.",
  },
  {
    key: "speech",
    label: "Speech",
    icon: MicIcon,
    accent: "#22d3ee",
    accentSoft: "rgba(34, 211, 238, 0.18)",
    description: "Record your voice — tone tells the rest.",
  },
];

export default function HomePage() {
  const navigate = useNavigate();

  // Active mode -- exact string ('text'|'face'|'speech') so the prompt
  // text below matches the test assertion exactly.
  const [activeTab, setActiveTab] = useState("text");

  // Per-mode state.
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [audioFile, setAudioFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [recording, setRecording] = useState(false);

  // UI state.
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [userData, setUserData] = useState(null);

  // Camera + audio refs.
  const [showCamera, setShowCamera] = useState(false);
  const webcamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunks = useRef([]);
  const micStreamRef = useRef(null);

  const token = localStorage.getItem("token");

  // ---- profile fetch (test relies on a single GET) ---------------------
  useEffect(() => {
    if (!token) return;
    axios
      .get(`${API_URL}/users/user/profile/`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        const profile = res?.data;
        if (profile?.id) setUserData({ ...profile, id: profile.id });
      })
      .catch(() => {});
  }, [token]);

  // ---- helpers ----------------------------------------------------------
  const reset = () => {
    setText("");
    setImageFile(null);
    setImagePreview(null);
    setAudioFile(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setRecording(false);
    setShowCamera(false);
    setError("");
  };

  const handleTabChange = (key) => {
    reset();
    setActiveTab(key);
  };

  const saveToHistory = async (mood, recommendations) => {
    if (!userData?.id) return;
    const auth = {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    };
    try {
      if (mood) {
        await axios.post(
          `${API_URL}/users/mood_history/${userData.id}/`,
          { mood },
          auth,
        );
      }
      if (recommendations?.length) {
        await axios.post(
          `${API_URL}/users/recommendations/${userData.id}/`,
          {
            recommendations: recommendations.map((rec) => ({
              name: rec.name,
              artist: rec.artist,
              preview_url: rec.preview_url,
              external_url: rec.external_url,
              image_url: rec.image_url,
            })),
          },
          auth,
        );
      }
    } catch {
      // Best-effort; we still navigate to /results.
    }
  };

  const goToResults = (emotion, recommendations) => {
    navigate("/results", { state: { emotion, recommendations } });
  };

  // ---- submit per mode --------------------------------------------------
  const submit = async () => {
    setError("");
    setBusy(true);
    try {
      let response;
      if (activeTab === "text") {
        if (!text.trim()) {
          setError("Type a few words about how you feel.");
          setBusy(false);
          return;
        }
        response = await axios.post(`${MODAL_API_URL}/text_emotion`, {
          text: text.trim(),
        });
      } else if (activeTab === "face") {
        if (!imageFile) {
          setError("Upload an image or capture one with the camera.");
          setBusy(false);
          return;
        }
        const formData = new FormData();
        formData.append("file", imageFile);
        response = await axios.post(
          `${MODAL_API_URL}/facial_emotion`,
          formData,
        );
      } else if (activeTab === "speech") {
        if (!audioFile) {
          setError("Upload an audio clip or record one to continue.");
          setBusy(false);
          return;
        }
        const formData = new FormData();
        formData.append("file", audioFile);
        response = await axios.post(
          `${MODAL_API_URL}/speech_emotion`,
          formData,
        );
      }

      const { emotion, recommendations } = response.data;
      await saveToHistory(emotion, recommendations);
      goToResults(emotion, recommendations);
    } catch (err) {
      setError(
        "We couldn't read your mood right now. Try again or switch input modes.",
      );
    } finally {
      setBusy(false);
    }
  };

  // ---- webcam capture ---------------------------------------------------
  const captureFromWebcam = useCallback(() => {
    if (!webcamRef.current) return;
    const dataUrl = webcamRef.current.getScreenshot();
    if (!dataUrl) return;
    fetch(dataUrl)
      .then((r) => r.blob())
      .then((blob) => {
        const file = new File([blob], "selfie.jpg", { type: "image/jpeg" });
        setImageFile(file);
        setImagePreview(dataUrl);
        setShowCamera(false);
      });
  }, []);

  // ---- audio recording --------------------------------------------------
  const startRecording = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recordedChunks.current = [];
      recorder.ondataavailable = (e) => recordedChunks.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(recordedChunks.current, { type: "audio/wav" });
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        const url = URL.createObjectURL(blob);
        const file = new File([blob], "recording.wav", { type: "audio/wav" });
        setAudioFile(file);
        setAudioUrl(url);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch {
      setError("Could not access the microphone.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    setRecording(false);
  };

  // ---- file picker handlers --------------------------------------------
  const onImagePick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setImageFile(f);
    setImagePreview(URL.createObjectURL(f));
  };
  const onAudioPick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setAudioFile(f);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(URL.createObjectURL(f));
  };

  const activeMode = MODES.find((m) => m.key === activeTab) || MODES[0];

  return (
    <Box
      sx={{
        position: "relative",
        minHeight: "calc(100vh - 80px)",
        backgroundImage: gradients.aurora,
        py: { xs: 6, md: 10 },
      }}
    >
      <Container maxWidth="md">
        {/* hero */}
        <Box sx={{ textAlign: "center", mb: 5 }}>
          <Chip
            icon={<AutoAwesomeIcon sx={{ fontSize: 16 }} />}
            label={userData?.username ? `Welcome back, ${userData.username}` : "Tell us how you feel"}
            sx={{
              mb: 2.5,
              px: 1.5,
              background: gradients.primarySoft,
              border: `1px solid ${tokens.primarySoft}`,
              color: "primary.main",
              fontWeight: 700,
              "& .MuiChip-icon": { color: "primary.main" },
            }}
          />
          <Typography
            variant="h3"
            sx={{
              fontWeight: 900,
              fontSize: { xs: 34, md: 52 },
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              mb: 1.5,
            }}
          >
            How are you{" "}
            <Box
              component="span"
              sx={{
                background: gradients.primary,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              feeling today?
            </Box>
          </Typography>
          <Typography sx={{ color: "text.secondary", fontSize: { xs: 15, md: 17 } }}>
            Choose an input mode ({activeTab}) and we'll tune the music to it.
          </Typography>
        </Box>

        {/* mode tabs */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          sx={{
            p: 1,
            mb: 3,
            background: "background.paper",
            border: `1px solid ${tokens.border}`,
            borderRadius: 999,
            maxWidth: 560,
            mx: "auto",
          }}
        >
          {MODES.map((m) => {
            const Icon = m.icon;
            const active = m.key === activeTab;
            return (
              <Button
                key={m.key}
                onClick={() => handleTabChange(m.key)}
                startIcon={<Icon sx={{ fontSize: 18 }} />}
                sx={{
                  flex: 1,
                  borderRadius: 999,
                  py: 1.25,
                  fontWeight: 800,
                  color: active ? "#fff" : "text.primary",
                  background: active
                    ? `linear-gradient(135deg, ${m.accent} 0%, #ec4899 100%)`
                    : "transparent",
                  boxShadow: active ? `0 10px 24px ${m.accentSoft}` : "none",
                  transition: "all .25s",
                  "&:hover": {
                    background: active
                      ? `linear-gradient(135deg, ${m.accent} 0%, #ec4899 100%)`
                      : m.accentSoft,
                    color: active ? "#fff" : m.accent,
                  },
                }}
              >
                {m.label}
              </Button>
            );
          })}
        </Stack>

        {/* active panel */}
        <Box
          sx={{
            p: { xs: 3, md: 4 },
            background: "background.paper",
            border: `1px solid ${tokens.border}`,
            borderRadius: 4,
            boxShadow: shadows.md,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* corner glow keyed to the active mode */}
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              top: -80,
              right: -80,
              width: 240,
              height: 240,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${activeMode.accent} 0%, transparent 70%)`,
              opacity: 0.18,
              filter: "blur(30px)",
              pointerEvents: "none",
            }}
          />

          <Typography sx={{ fontWeight: 700, fontSize: 14, color: activeMode.accent, mb: 0.5 }}>
            {activeMode.label.toUpperCase()} MODE
          </Typography>
          <Typography sx={{ fontWeight: 700, fontSize: 18, mb: 2 }}>
            {activeMode.description}
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          {/* ---- text mode ---- */}
          {activeTab === "text" && (
            <TextField
              fullWidth
              multiline
              minRows={4}
              placeholder="e.g. I feel calm and a little nostalgic..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              sx={{ mb: 2 }}
            />
          )}

          {/* ---- face mode ---- */}
          {activeTab === "face" && (
            <Box sx={{ mb: 2 }}>
              {showCamera ? (
                <Box>
                  <Box
                    sx={{
                      borderRadius: 3,
                      overflow: "hidden",
                      border: `1px solid ${tokens.border}`,
                      mb: 2,
                    }}
                  >
                    <Webcam
                      ref={webcamRef}
                      audio={false}
                      screenshotFormat="image/jpeg"
                      mirrored
                      videoConstraints={{ facingMode: "user" }}
                      style={{ width: "100%", display: "block" }}
                    />
                  </Box>
                  <Stack direction="row" spacing={1.5}>
                    <Button
                      onClick={captureFromWebcam}
                      variant="contained"
                      color="primary"
                      startIcon={<CameraAltIcon />}
                      sx={{ flex: 1, borderRadius: 999, py: 1.25 }}
                    >
                      Capture
                    </Button>
                    <Button
                      onClick={() => setShowCamera(false)}
                      variant="outlined"
                      sx={{ borderRadius: 999, py: 1.25 }}
                    >
                      Cancel
                    </Button>
                  </Stack>
                </Box>
              ) : imagePreview ? (
                <Box>
                  <Box
                    component="img"
                    src={imagePreview}
                    alt="preview"
                    sx={{
                      width: "100%",
                      maxHeight: 360,
                      objectFit: "cover",
                      borderRadius: 3,
                      mb: 2,
                      border: `1px solid ${tokens.border}`,
                    }}
                  />
                  <Stack direction="row" spacing={1.5}>
                    <Button
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview(null);
                      }}
                      variant="outlined"
                      startIcon={<RefreshIcon />}
                      sx={{ flex: 1, borderRadius: 999, py: 1.25 }}
                    >
                      Replace
                    </Button>
                  </Stack>
                </Box>
              ) : (
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.5}
                  alignItems="stretch"
                >
                  <Button
                    component="label"
                    variant="outlined"
                    startIcon={<UploadFileIcon />}
                    sx={{
                      flex: 1,
                      py: 1.75,
                      borderRadius: 3,
                      borderStyle: "dashed",
                      borderWidth: 2,
                      "&:hover": { borderStyle: "dashed", borderWidth: 2 },
                    }}
                  >
                    Upload Image
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      aria-label="Upload Image"
                      onChange={onImagePick}
                    />
                  </Button>
                  <Button
                    onClick={() => setShowCamera(true)}
                    variant="outlined"
                    startIcon={<CameraAltIcon />}
                    sx={{
                      flex: 1,
                      py: 1.75,
                      borderRadius: 3,
                      borderColor: activeMode.accent,
                      color: activeMode.accent,
                      "&:hover": {
                        borderColor: activeMode.accent,
                        background: activeMode.accentSoft,
                      },
                    }}
                  >
                    Use Camera
                  </Button>
                </Stack>
              )}
            </Box>
          )}

          {/* ---- speech mode ---- */}
          {activeTab === "speech" && (
            <Box sx={{ mb: 2 }}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                alignItems="stretch"
                sx={{ mb: audioUrl ? 2 : 0 }}
              >
                <Button
                  component="label"
                  variant="outlined"
                  startIcon={<UploadFileIcon />}
                  sx={{
                    flex: 1,
                    py: 1.75,
                    borderRadius: 3,
                    borderStyle: "dashed",
                    borderWidth: 2,
                    "&:hover": { borderStyle: "dashed", borderWidth: 2 },
                  }}
                >
                  Upload Audio
                  <input
                    type="file"
                    accept="audio/*"
                    hidden
                    aria-label="Upload Audio"
                    onChange={onAudioPick}
                  />
                </Button>
                {recording ? (
                  <Button
                    onClick={stopRecording}
                    variant="contained"
                    color="error"
                    startIcon={<StopIcon />}
                    sx={{
                      flex: 1,
                      py: 1.75,
                      borderRadius: 3,
                      animation: "pulse 1.4s ease-in-out infinite",
                      "@keyframes pulse": {
                        "0%, 100%": { boxShadow: "0 0 0 0 rgba(239,68,68,0.6)" },
                        "50%": { boxShadow: "0 0 0 14px rgba(239,68,68,0)" },
                      },
                    }}
                  >
                    Stop recording
                  </Button>
                ) : (
                  <Button
                    onClick={startRecording}
                    variant="outlined"
                    startIcon={<MicIcon />}
                    sx={{
                      flex: 1,
                      py: 1.75,
                      borderRadius: 3,
                      borderColor: activeMode.accent,
                      color: activeMode.accent,
                      "&:hover": {
                        borderColor: activeMode.accent,
                        background: activeMode.accentSoft,
                      },
                    }}
                  >
                    Record Audio
                  </Button>
                )}
              </Stack>

              {audioUrl && (
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    background: tokens.surfaceAlt,
                    border: `1px solid ${tokens.border}`,
                  }}
                >
                  <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1, color: "text.secondary" }}>
                    Preview
                  </Typography>
                  <audio src={audioUrl} controls style={{ width: "100%" }} />
                </Box>
              )}
            </Box>
          )}

          {/* submit */}
          <Button
            onClick={submit}
            variant="contained"
            color="primary"
            disabled={busy}
            endIcon={busy ? null : <ArrowForwardIcon />}
            sx={{
              mt: 1,
              width: "100%",
              py: 1.6,
              fontSize: 16,
              borderRadius: 999,
            }}
          >
            {busy ? (
              <CircularProgress size={22} sx={{ color: "#fff" }} />
            ) : (
              "Analyze my mood"
            )}
          </Button>
        </Box>
      </Container>
    </Box>
  );
}
