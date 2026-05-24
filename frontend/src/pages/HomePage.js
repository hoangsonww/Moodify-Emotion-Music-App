import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useContext,
} from "react";
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Modal,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  ArrowForward,
  AutoAwesome,
  CameraAlt,
  Check,
  Close,
  CloudUpload,
  FaceRetouchingNatural,
  FiberManualRecord,
  History,
  Insights,
  KeyboardArrowRight,
  LibraryMusic,
  Lightbulb,
  Mic,
  MicNone,
  MoodOutlined,
  Refresh,
  Send,
  Stop,
  TextFields,
  Whatshot,
} from "@mui/icons-material";
import Webcam from "react-webcam";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { DarkModeContext } from "../context/DarkModeContext";
import { useToast } from "../components/Toast";
import { API_URL, MODAL_API_URL } from "../config";

// ---------- shared mood palette (same colors as Results page) ----------
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
  surprise: {
    emoji: "😲",
    label: "Surprised",
    colors: ["#06b6d4", "#22d3ee", "#a855f7"],
  },
};
const paletteFor = (m) =>
  MOOD_PALETTE[String(m || "").toLowerCase()] || {
    emoji: "🎧",
    label: String(m || "Mood"),
    colors: ["#ff4d4d", "#ff7a59", "#ec4899"],
  };

const QUICK_MOODS = [
  "happy",
  "calm",
  "sad",
  "excited",
  "love",
  "anger",
  "neutral",
];

const MODE_CARDS = [
  {
    key: "text",
    label: "Text",
    blurb: "Write a few words about your day.",
    icon: TextFields,
    colors: ["#34d399", "#10b981"],
  },
  {
    key: "speech",
    label: "Voice",
    blurb: "Record a short voice clip.",
    icon: MicNone,
    colors: ["#8b5cf6", "#d946ef"],
  },
  {
    key: "face",
    label: "Face",
    blurb: "Snap a photo of your expression.",
    icon: FaceRetouchingNatural,
    colors: ["#ec4899", "#f472b6"],
  },
];

const STEPS = [
  {
    icon: Insights,
    title: "Share a moment",
    body: "Pick a mode - type, talk, or smile - and we'll read your vibe.",
  },
  {
    icon: AutoAwesome,
    title: "Detect the mood",
    body: "Three self-trained models converge on a single emotion label.",
  },
  {
    icon: LibraryMusic,
    title: "Tune the music",
    body: "We pull a market-aware Deezer playlist that matches the read.",
  },
];

const greetingFor = (date = new Date()) => {
  const h = date.getHours();
  if (h < 5) return "Late night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
};

const HomePage = () => {
  const [activeTab, setActiveTab] = useState("text");
  const [inputValue, setInputValue] = useState("");
  // eslint-disable-next-line no-unused-vars
  const [file, setFile] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const webcamRef = useRef(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [userData, setUserData] = useState(null);

  const token = localStorage.getItem("token");
  const { isDarkMode } = useContext(DarkModeContext);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await axios.get(`${API_URL}/users/user/profile/`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const userProfile = response.data;
        const userId = userProfile.id;

        if (!userId) {
          console.error("MongoDB User ID is missing:", userProfile);
          return;
        }

        setUserData({ ...userProfile, id: userId });
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };

    if (token) {
      fetchUserData();
    } else {
      console.error("No token available.");
    }
  }, [token]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setFile(null);
    setInputValue("");
    setShowModal(false);
    setCapturedImage(null);
    setAudioBlob(null);
  };

  const saveToHistory = async (mood, recommendations) => {
    try {
      // Check if userData is available and has a valid id
      if (!userData || !userData.id) {
        console.error("User data or user ID is not available.");
        return;
      }

      // Save mood history
      if (mood) {
        await axios.post(
          `${API_URL}/users/mood_history/${userData.id}/`,
          { mood },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          },
        );
      }

      // Save recommendations history
      if (recommendations && recommendations.length > 0) {
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
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          },
        );
      }

      // Refresh user data to reflect the updated history
      const updatedUserData = await axios.get(
        `${API_URL}/users/user/profile/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      setUserData(updatedUserData.data);
    } catch (error) {
      console.error("Error saving history:", error);
    }
  };

  const handleFileUpload = async (e) => {
    const uploadedFile = e.target.files[0];
    // Guard against a cancelled file-picker dialog: without this the
    // empty file is still POSTed to /facial_emotion or /speech_emotion
    // and the Modal service falls back to a random emotion, navigating
    // the user to a Results page they never asked for.
    if (!uploadedFile) {
      e.target.value = "";
      return;
    }
    if (uploadedFile.size > 10 * 1024 * 1024) {
      toast.warning("File must be under 10 MB.");
      e.target.value = "";
      return;
    }

    setFile(uploadedFile);

    const formData = new FormData();
    formData.append("file", uploadedFile);

    if (!token) {
      toast.error("Please sign in first.");
      return;
    }

    setIsLoading(true);

    try {
      let response;

      // Race the file upload request against a 1-minute timeout
      if (activeTab === "text") {
        const textContent = await uploadedFile.text();
        response = await Promise.race([
          axios.post(
            `${MODAL_API_URL}/text_emotion`,
            { text: textContent },
            {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
            },
          ),
          timeout(60000), // Timeout set to 1 minute
        ]);
      } else if (activeTab === "face") {
        response = await Promise.race([
          axios.post(`${MODAL_API_URL}/facial_emotion`, formData, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          timeout(60000),
        ]);
      } else if (activeTab === "speech") {
        response = await Promise.race([
          axios.post(`${MODAL_API_URL}/speech_emotion`, formData, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          timeout(60000),
        ]);
      }

      const { emotion, recommendations } = response.data;

      // Save both mood and recommendations to history
      await saveToHistory(emotion, recommendations);

      navigate("/results", { state: { emotion, recommendations } });
    } catch (error) {
      console.error(
        `Error uploading ${activeTab} file or request timed out:`,
        error,
      );

      // Fallback to a random mood in case of an error
      const randomMood = getRandomMood();
      const newMood = moodMap[randomMood];
      console.log(`Fallback to random mood: ${randomMood} -> ${newMood}`);

      try {
        // Call the API with the randomly selected mood
        const response = await axios.post(
          `${MODAL_API_URL}/music_recommendation`,
          {
            emotion: newMood.toLowerCase(),
          },
        );

        const newRecommendations = response.data.recommendations || [];

        // Navigate to the results page with the fallback mood and recommendations
        navigate("/results", {
          state: { emotion: randomMood, recommendations: newRecommendations },
        });
      } catch (recommendationError) {
        console.error("Error fetching recommendations:", recommendationError);

        // In case of failure, navigate with the fallback mood and empty recommendations
        navigate("/results", {
          state: { emotion: randomMood, recommendations: [] },
        });
      }
    } finally {
      handleModalClose();
      setIsLoading(false);
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
    setCapturedImage(null);
    setAudioBlob(null);
  };

  const captureImage = useCallback(() => {
    const imageSrc = webcamRef.current.getScreenshot();
    setCapturedImage(imageSrc);
  }, [webcamRef]);

  const retakeImage = () => {
    setCapturedImage(null);
  };

  const timeout = (ms) => {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error("Request timed out"));
      }, ms);
    });
  };

  const confirmImage = async () => {
    try {
      const base64Response = await fetch(capturedImage);
      const blob = await base64Response.blob();

      setIsLoading(true);

      if (blob.size === 0) {
        console.log("Captured image is invalid.");
        return;
      }

      const formData = new FormData();
      formData.append("file", blob, "captured_image.jpg");

      if (!token) {
        console.log("User is not authenticated. Please log in.");
        setIsLoading(false);
        return;
      }

      // Race between the API request and a timeout of 1 minute (60000 ms)
      const response = await Promise.race([
        axios.post(`${MODAL_API_URL}/facial_emotion`, formData, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }),
        timeout(60000), // Timeout set to 1 minute
      ]);

      const { emotion, recommendations } = response.data;

      // Save both mood and recommendations to history
      await saveToHistory(emotion, recommendations);

      navigate("/results", { state: { emotion, recommendations } });
    } catch (error) {
      console.error("Error or timeout occurred:", error);

      // Fallback to a random mood in case of an error or timeout
      const randomMood = getRandomMood();
      const newMood = moodMap[randomMood];
      console.log(`Fallback to random mood: ${randomMood} -> ${newMood}`);

      try {
        // Call the API with the randomly selected mood
        const response = await axios.post(
          `${MODAL_API_URL}/music_recommendation`,
          {
            emotion: newMood.toLowerCase(),
          },
        );

        const newRecommendations = response.data.recommendations || [];

        // Navigate to the results page with the fallback mood and recommendations
        navigate("/results", {
          state: { emotion: randomMood, recommendations: newRecommendations },
        });
      } catch (recommendationError) {
        console.error("Error fetching recommendations:", recommendationError);

        // In case of failure, navigate with the fallback mood and empty recommendations
        navigate("/results", {
          state: { emotion: randomMood, recommendations: [] },
        });
      }
    } finally {
      handleModalClose();
      setIsLoading(false);
    }
  };

  const handleTextSubmit = async () => {
    if (!inputValue || !inputValue.trim()) {
      toast.warning("Type a few words about how you feel first.");
      return;
    }

    setIsLoading(true);

    try {
      // Race the text submission request against a 1-minute timeout
      const response = await Promise.race([
        axios.post(
          `${MODAL_API_URL}/text_emotion`,
          { text: inputValue.trim() },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          },
        ),
        timeout(60000), // Timeout set to 1 minute
      ]);

      const { emotion, recommendations } = response.data;

      // Save both mood and recommendations to history
      await saveToHistory(emotion, recommendations);

      // Navigate to the results page with the response data
      navigate("/results", { state: { emotion, recommendations } });
    } catch (error) {
      console.error("Error processing text or request timed out:", error);

      // Fallback to a random mood in case of an error
      const randomMood = getRandomMood();
      const newMood = moodMap[randomMood];
      console.log(`Fallback to random mood: ${randomMood} -> ${newMood}`);

      try {
        // Call the API with the randomly selected mood
        const response = await axios.post(
          `${MODAL_API_URL}/music_recommendation`,
          {
            emotion: newMood.toLowerCase(),
          },
        );

        const newRecommendations = response.data.recommendations || [];

        // Navigate to the results page with the fallback mood and recommendations
        navigate("/results", {
          state: { emotion: randomMood, recommendations: newRecommendations },
        });
      } catch (recommendationError) {
        console.error("Error fetching recommendations:", recommendationError);

        // In case of failure, navigate with the fallback mood and empty recommendations
        navigate("/results", {
          state: { emotion: randomMood, recommendations: [] },
        });
      }
    } finally {
      setIsLoading(false);
      setInputValue("");
      handleModalClose();
    }
  };

  const [audioUrl, setAudioUrl] = useState(null);
  const mediaRecorderRef = useRef(null);

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl); // Clean up the blob URL when the component unmounts
      }
    };
  }, [audioUrl]);

  const [isShowingRecordingDots, setIsShowingRecordingDots] = useState(false);
  const [dotAnimation, setDotAnimation] = useState("");
  const [micStream, setMicStream] = useState(null);
  const [isRecordingReady, setIsRecordingReady] = useState(false);

  // Animated "Recording..." effect (adds dots at regular intervals)
  useEffect(() => {
    if (isShowingRecordingDots) {
      const interval = setInterval(() => {
        setDotAnimation((prev) => (prev.length < 3 ? prev + "." : ""));
      }, 500); // Update every 500ms
      return () => clearInterval(interval);
    }
  }, [isShowingRecordingDots]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      let chunks = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const wavBlob = new Blob(chunks, { type: "audio/wav" });
        const newAudioUrl = URL.createObjectURL(wavBlob);
        if (audioUrl) {
          URL.revokeObjectURL(audioUrl); // Clean up old object URL
        }
        setAudioBlob(wavBlob);
        setAudioUrl(newAudioUrl);
        setIsRecordingReady(true);
        console.log(isRecordingReady);
      };

      mediaRecorder.start();
      setMicStream(stream); // Store the stream to stop the mic later
      setIsRecording(true);
      setIsShowingRecordingDots(true);
      setIsRecordingReady(false);
      mediaRecorderRef.current = mediaRecorder;
    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast.error("Could not access the microphone. Please try again.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setIsShowingRecordingDots(false);

    // Stop the microphone stream
    if (micStream) {
      micStream.getTracks().forEach((track) => track.stop());
      setMicStream(null); // Clear the stream
    }
  };

  const moodMap = {
    joy: "hip-hop",
    happy: "happy",
    sadness: "sad",
    anger: "metal",
    love: "romance",
    fear: "sad",
    neutral: "pop",
    calm: "chill",
    disgust: "blues",
    surprised: "party",
    surprise: "party",
    excited: "party",
    bored: "pop",
    tired: "chill",
    relaxed: "chill",
    stressed: "chill",
    anxious: "chill",
    depressed: "sad",
    lonely: "sad",
    energetic: "hip-hop",
    nostalgic: "pop",
    confused: "pop",
    frustrated: "metal",
    hopeful: "romance",
    proud: "hip-hop",
    guilty: "blues",
    jealous: "pop",
    ashamed: "blues",
    disappointed: "pop",
    content: "chill",
    insecure: "pop",
    embarrassed: "blues",
    overwhelmed: "chill",
    amused: "party",
  };

  const getRandomMood = () => {
    const moods = Object.keys(moodMap);
    const randomIndex = Math.floor(Math.random() * moods.length);
    return moods[randomIndex];
  };

  const handleAudioUpload = async () => {
    if (!audioBlob) {
      console.log("No audio blob available for upload.");
      return;
    }

    console.log("Uploading audio...");
    setIsLoading(true);

    const formData = new FormData();
    formData.append("file", audioBlob, "recorded_audio.wav");

    if (!token) {
      console.log("User is not authenticated. Please log in.");
      setIsLoading(false);
      return;
    }

    try {
      // Race the audio upload request against a 1-minute timeout
      const response = await Promise.race([
        axios.post(`${MODAL_API_URL}/speech_emotion`, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${token}`,
          },
        }),
        timeout(60000), // Timeout set to 1 minute
      ]);

      const { emotion, recommendations } = response.data;
      navigate("/results", { state: { emotion, recommendations } });
    } catch (error) {
      console.error("Error uploading audio or request timed out:", error);

      // Fallback to a random mood in case of an error or timeout
      const randomMood = getRandomMood();
      const newMood = moodMap[randomMood];
      console.log(`Fallback to random mood: ${randomMood} -> ${newMood}`);

      try {
        // Call the API with the randomly selected mood
        const response = await axios.post(
          `${MODAL_API_URL}/music_recommendation`,
          {
            emotion: newMood.toLowerCase(),
          },
        );

        const newRecommendations = response.data.recommendations || [];

        // Navigate to the results page with the fallback mood and recommendations
        navigate("/results", {
          state: { emotion: randomMood, recommendations: newRecommendations },
        });
      } catch (recommendationError) {
        console.error(
          "Error fetching fallback recommendations:",
          recommendationError,
        );

        // In case of failure, navigate with the fallback mood and empty recommendations
        navigate("/results", {
          state: { emotion: randomMood, recommendations: [] },
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const [dotCount, setDotCount] = useState(0); // State to track number of dots

  useEffect(() => {
    // Create an interval that updates the dot count every 500ms
    const intervalId = setInterval(() => {
      setDotCount((prevCount) => (prevCount + 1) % 4);
    }, 500);

    // Clean up the interval when the component unmounts
    return () => clearInterval(intervalId);
  }, []);

  const loadingText = `Processing, please wait${".".repeat(dotCount)}`;

  const handleQuickMood = async (mood) => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const res = await axios.post(`${MODAL_API_URL}/music_recommendation`, {
        emotion: String(mood).toLowerCase(),
      });
      const recommendations = res.data?.recommendations || [];
      if (token) {
        await saveToHistory(mood, recommendations);
      }
      navigate("/results", { state: { emotion: mood, recommendations } });
    } catch (err) {
      toast.error("Could not fetch recommendations. Try again in a moment.");
    } finally {
      setIsLoading(false);
    }
  };

  const username = userData?.username || "";
  const recentMoods = Array.isArray(userData?.mood_history)
    ? userData.mood_history.slice(-6).reverse()
    : [];
  const recommendationsCount = Array.isArray(userData?.recommendations)
    ? userData.recommendations.length
    : 0;
  const listeningCount = Array.isArray(userData?.listening_history)
    ? userData.listening_history.length
    : 0;
  const moodsLoggedCount = Array.isArray(userData?.mood_history)
    ? userData.mood_history.length
    : 0;
  const activeMode =
    MODE_CARDS.find((m) => m.key === activeTab) || MODE_CARDS[0];
  const ActiveIcon = activeMode.icon;

  const ctaLabel =
    activeTab === "text"
      ? "Add Text"
      : activeTab === "face"
        ? "Capture Image"
        : "Record Audio";
  const uploadLabel =
    activeTab === "text"
      ? "Upload Text File"
      : activeTab === "speech"
        ? "Upload Audio File"
        : "Upload Image";
  const formatsHint =
    activeTab === "text"
      ? "Accepts .txt"
      : activeTab === "speech"
        ? "Accepts .wav, .mp4"
        : "Accepts .jpg, .jpeg, .png, .webp";

  return (
    <Box
      sx={{
        ...styles.page,
        background: isDarkMode
          ? "radial-gradient(60% 50% at 15% -5%, rgba(255,77,77,0.18) 0%, transparent 60%), radial-gradient(60% 50% at 100% 100%, rgba(236,72,153,0.12) 0%, transparent 60%), #0b0b11"
          : "radial-gradient(60% 50% at 15% -5%, rgba(255,77,77,0.18) 0%, transparent 55%), radial-gradient(50% 50% at 100% 100%, rgba(255,122,89,0.18) 0%, transparent 55%), #fdf6f4",
        color: isDarkMode ? "#ffffff" : "#1a1a1a",
      }}
    >
      {isLoading && (
        <Box sx={styles.loadingOverlay}>
          <CircularProgress sx={{ color: "#ff4d4d" }} />
          <Typography
            sx={{
              mt: 1.5,
              color: "#fff",
              fontFamily: "Poppins",
              fontWeight: 800,
              fontSize: 16,
            }}
          >
            {loadingText}
          </Typography>
          <Typography
            sx={{
              mt: 1,
              color: "rgba(255,255,255,0.85)",
              fontFamily: "Poppins",
              textAlign: "center",
              fontSize: 13,
              px: 3,
              maxWidth: 480,
            }}
          >
            Our servers may spin down after periods of inactivity - first calls
            can take up to 2 minutes. Thanks for hanging in.
          </Typography>
        </Box>
      )}

      <Box sx={styles.shell}>
        {/* ---------- HERO ---------- */}
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={3}
          alignItems={{ xs: "stretch", md: "flex-end" }}
          justifyContent="space-between"
          sx={{ mb: { xs: 3, md: 4 } }}
        >
          <Box>
            <Typography sx={styles.kicker}>
              <Lightbulb sx={{ fontSize: 14, mr: 0.5, color: "#ff7a59" }} />
              {greetingFor()}
              {username ? `, ${username}` : ""}
            </Typography>
            <Typography sx={styles.heroTitle(isDarkMode)}>
              How are you feeling{" "}
              <Box component="span" sx={styles.heroAccent}>
                today?
              </Box>
            </Typography>
            <Typography sx={styles.heroSub(isDarkMode)}>
              Share your vibe through text, voice or a selfie - we'll tune the
              music to it.
            </Typography>
          </Box>

          <Stack
            direction="row"
            spacing={1.25}
            sx={{ flexShrink: 0, alignItems: "stretch" }}
            useFlexGap
            flexWrap="wrap"
          >
            <StatBubble
              icon={<MoodOutlined sx={{ fontSize: 18 }} />}
              label="Moods"
              value={moodsLoggedCount}
              tint="#ff4d4d"
              isDark={isDarkMode}
            />
            <StatBubble
              icon={<LibraryMusic sx={{ fontSize: 18 }} />}
              label="Saved"
              value={recommendationsCount}
              tint="#ff7a59"
              isDark={isDarkMode}
            />
            <StatBubble
              icon={<History sx={{ fontSize: 18 }} />}
              label="Listened"
              value={listeningCount}
              tint="#ec4899"
              isDark={isDarkMode}
            />
          </Stack>
        </Stack>

        {/* ---------- MAIN CAPTURE CARD ---------- */}
        <Paper elevation={0} sx={styles.captureCard(isDarkMode)}>
          <Typography sx={styles.cardEyebrow(isDarkMode)}>
            CHOOSE HOW TO SHARE
          </Typography>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            sx={{ mb: 3 }}
          >
            {MODE_CARDS.map((m) => {
              const Icon = m.icon;
              const active = activeTab === m.key;
              return (
                <Paper
                  key={m.key}
                  onClick={() => handleTabChange(m.key)}
                  elevation={0}
                  sx={styles.modeTile(isDarkMode, active, m.colors)}
                >
                  <Box sx={styles.modeIcon(active, m.colors)}>
                    <Icon sx={{ color: "#fff", fontSize: 22 }} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={styles.modeLabel(isDarkMode)}>
                      {m.label}
                    </Typography>
                    <Typography sx={styles.modeBlurb(isDarkMode)}>
                      {m.blurb}
                    </Typography>
                  </Box>
                  <KeyboardArrowRight
                    sx={{
                      color: active
                        ? m.colors[1]
                        : isDarkMode
                          ? "#555"
                          : "#bbb",
                    }}
                  />
                </Paper>
              );
            })}
          </Stack>

          <Box
            sx={{
              ...styles.actionZone(isDarkMode),
              background: `linear-gradient(135deg, ${activeMode.colors[0]}15, ${activeMode.colors[1]}10)`,
            }}
          >
            <Box sx={styles.actionInner}>
              <Box sx={styles.actionIcon(activeMode.colors)}>
                <ActiveIcon sx={{ color: "#fff", fontSize: 28 }} />
              </Box>
              <Typography sx={styles.actionTitle(isDarkMode)}>
                {activeMode.label} mode ready
              </Typography>
              <Typography sx={styles.actionHint(isDarkMode)}>
                {activeMode.blurb} {formatsHint}
              </Typography>

              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                sx={{ width: "100%", mt: 2.5 }}
              >
                <Button
                  fullWidth
                  endIcon={<ArrowForward />}
                  onClick={() => setShowModal(true)}
                  sx={styles.primaryCta(activeMode.colors)}
                >
                  {ctaLabel}
                </Button>

                <input
                  accept={
                    activeTab === "text"
                      ? ".txt"
                      : activeTab === "speech"
                        ? ".wav, .mp4"
                        : "image/*"
                  }
                  style={{ display: "none" }}
                  id="upload-file"
                  type="file"
                  onChange={handleFileUpload}
                />
                <Button
                  fullWidth
                  component="label"
                  htmlFor="upload-file"
                  startIcon={<CloudUpload />}
                  sx={styles.ghostCta(isDarkMode)}
                >
                  {uploadLabel}
                </Button>
              </Stack>
            </Box>
          </Box>
        </Paper>

        {/* ---------- QUICK MOOD CHIPS ---------- */}
        <Box sx={{ mb: 4 }}>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ mb: 1.5 }}
          >
            <Whatshot sx={{ fontSize: 16, color: "#ff7a59" }} />
            <Typography sx={styles.sectionLabel(isDarkMode)}>
              QUICK PICK A MOOD
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {QUICK_MOODS.map((mood) => {
              const p = paletteFor(mood);
              return (
                <Chip
                  key={mood}
                  clickable
                  onClick={() => handleQuickMood(mood)}
                  disabled={isLoading}
                  label={
                    <Stack
                      direction="row"
                      spacing={0.5}
                      alignItems="center"
                      sx={{ fontFamily: "Poppins", fontWeight: 700 }}
                    >
                      <span aria-hidden style={{ fontSize: 14 }}>
                        {p.emoji}
                      </span>
                      <Box component="span">{p.label}</Box>
                    </Stack>
                  }
                  sx={styles.moodChip(isDarkMode, p.colors)}
                />
              );
            })}
          </Stack>
        </Box>

        {/* ---------- RECENT MOODS ---------- */}
        {recentMoods.length > 0 && (
          <Box sx={{ mb: 4 }}>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ mb: 1.5 }}
            >
              <History sx={{ fontSize: 16, color: "#ff4d4d" }} />
              <Typography sx={styles.sectionLabel(isDarkMode)}>
                YOUR RECENT MOODS
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {recentMoods.map((mood, i) => {
                const p = paletteFor(mood);
                return (
                  <Tooltip key={`${mood}-${i}`} title={`Re-explore ${p.label}`}>
                    <Chip
                      clickable
                      onClick={() => handleQuickMood(mood)}
                      disabled={isLoading}
                      avatar={
                        <Avatar
                          sx={{
                            background: `linear-gradient(135deg, ${p.colors[0]}, ${p.colors[2]})`,
                            fontSize: 14,
                          }}
                        >
                          {p.emoji}
                        </Avatar>
                      }
                      label={p.label}
                      sx={styles.historyChip(isDarkMode)}
                    />
                  </Tooltip>
                );
              })}
            </Stack>
          </Box>
        )}

        {/* ---------- HOW IT WORKS ---------- */}
        <Box>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ mb: 1.5 }}
          >
            <Insights sx={{ fontSize: 16, color: "#8b5cf6" }} />
            <Typography sx={styles.sectionLabel(isDarkMode)}>
              HOW IT WORKS
            </Typography>
          </Stack>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            sx={{ mb: 2 }}
          >
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <Paper key={i} elevation={0} sx={styles.stepCard(isDarkMode)}>
                  <Box sx={styles.stepIndex(isDarkMode)}>{i + 1}</Box>
                  <Icon sx={{ fontSize: 28, color: "#ff4d4d", mb: 0.5 }} />
                  <Typography sx={styles.stepTitle(isDarkMode)}>
                    {s.title}
                  </Typography>
                  <Typography sx={styles.stepBody(isDarkMode)}>
                    {s.body}
                  </Typography>
                </Paper>
              );
            })}
          </Stack>
        </Box>
      </Box>
      {/* ---------- ACCEPTABLE FORMATS HIDDEN HINT (kept for a11y) ---------- */}
      <Box component="span" sx={{ display: "none" }}>
        {formatsHint}
      </Box>

      {/* ---------- VOICE MODAL ---------- */}
      {activeTab === "speech" && (
        <Modal
          open={showModal}
          onClose={handleModalClose}
          slotProps={{ backdrop: { sx: styles.modalBackdrop } }}
        >
          <Box sx={styles.modalShell(isDarkMode)}>
            <ModalHeader
              colors={["#8b5cf6", "#d946ef"]}
              icon={<Mic sx={{ color: "#fff", fontSize: 26 }} />}
              eyebrow="VOICE MODE"
              title="Record your audio"
              subtitle="Speak naturally for a few seconds - we'll read the tone, pace and energy of your voice."
              onClose={handleModalClose}
            />
            <Box sx={styles.modalBody(isDarkMode)}>
              {/* Mic stage --------------------------------------------- */}
              <Stack alignItems="center" sx={{ py: 1.5 }}>
                <Box sx={styles.micStage}>
                  {isRecording && <Box sx={styles.micPulseRing} />}
                  <Box
                    sx={{
                      ...styles.micOrb,
                      background: isRecording
                        ? "linear-gradient(135deg, #ff4d4d 0%, #ec4899 100%)"
                        : "linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)",
                      boxShadow: isRecording
                        ? "0 12px 32px rgba(236,72,153,0.45)"
                        : "0 12px 32px rgba(139,92,246,0.45)",
                    }}
                  >
                    {isRecording ? (
                      <FiberManualRecord sx={{ color: "#fff", fontSize: 44 }} />
                    ) : (
                      <Mic sx={{ color: "#fff", fontSize: 44 }} />
                    )}
                  </Box>
                </Box>
                <Typography
                  sx={{
                    fontFamily: "Poppins",
                    fontWeight: 800,
                    fontSize: 14,
                    letterSpacing: 0.6,
                    color: isRecording
                      ? "#ec4899"
                      : isDarkMode
                        ? "#a4a4b3"
                        : "#6f6f7a",
                    mt: 1.5,
                    textTransform: "uppercase",
                  }}
                >
                  {isRecording
                    ? `Recording${dotAnimation}`
                    : audioBlob
                      ? "Take a listen below"
                      : "Tap start to begin"}
                </Typography>
              </Stack>

              {/* Primary action --------------------------------------- */}
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.25}
                sx={{ mt: 2 }}
              >
                {!isRecording ? (
                  <Button
                    fullWidth
                    onClick={startRecording}
                    startIcon={<Mic />}
                    sx={styles.modalCta(["#8b5cf6", "#d946ef"])}
                  >
                    Start recording
                  </Button>
                ) : (
                  <Button
                    fullWidth
                    onClick={stopRecording}
                    startIcon={<Stop />}
                    sx={styles.modalCta(["#ff4d4d", "#ec4899"])}
                  >
                    Stop recording
                  </Button>
                )}
                <Button
                  fullWidth
                  onClick={handleModalClose}
                  sx={styles.modalGhost(isDarkMode)}
                >
                  Cancel
                </Button>
              </Stack>

              {/* Review playback -------------------------------------- */}
              {audioBlob && (
                <Box sx={styles.reviewBox(isDarkMode)}>
                  <Typography sx={styles.reviewLabel(isDarkMode)}>
                    PREVIEW
                  </Typography>
                  <audio
                    controls
                    src={audioUrl}
                    style={{ width: "100%", marginTop: 8 }}
                  />
                  <Button
                    fullWidth
                    onClick={handleAudioUpload}
                    startIcon={<ArrowForward />}
                    sx={{
                      ...styles.modalCta(["#34d399", "#10b981"]),
                      mt: 1.5,
                    }}
                  >
                    Analyze this clip
                  </Button>
                </Box>
              )}
            </Box>
          </Box>
        </Modal>
      )}

      {/* ---------- TEXT MODAL ---------- */}
      {activeTab === "text" && (
        <Modal
          open={showModal}
          onClose={handleModalClose}
          slotProps={{ backdrop: { sx: styles.modalBackdrop } }}
        >
          <Box sx={styles.modalShell(isDarkMode)}>
            <ModalHeader
              colors={["#34d399", "#10b981"]}
              icon={<TextFields sx={{ color: "#fff", fontSize: 26 }} />}
              eyebrow="TEXT MODE"
              title="Enter your text"
              subtitle="Type a few sentences about your day. The model reads tone, sentiment and intensity from what you write."
              onClose={handleModalClose}
            />
            <Box sx={styles.modalBody(isDarkMode)}>
              <TextField
                fullWidth
                multiline
                rows={5}
                autoFocus
                variant="outlined"
                placeholder="e.g. I feel calm and a little nostalgic…"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                inputProps={{ maxLength: 1000 }}
                sx={styles.textArea(isDarkMode)}
              />
              <Typography sx={styles.charCounter(isDarkMode)}>
                {inputValue.length} / 1000
              </Typography>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.25}
                sx={{ mt: 2 }}
              >
                <Button
                  fullWidth
                  onClick={handleTextSubmit}
                  startIcon={<Send />}
                  disabled={!inputValue.trim()}
                  sx={styles.modalCta(["#34d399", "#10b981"])}
                >
                  Analyze my mood
                </Button>
                <Button
                  fullWidth
                  onClick={handleModalClose}
                  sx={styles.modalGhost(isDarkMode)}
                >
                  Cancel
                </Button>
              </Stack>
            </Box>
          </Box>
        </Modal>
      )}

      {/* ---------- FACE MODAL ---------- */}
      {activeTab === "face" && (
        <Modal
          open={showModal}
          onClose={handleModalClose}
          slotProps={{ backdrop: { sx: styles.modalBackdrop } }}
        >
          <Box sx={styles.modalShell(isDarkMode)}>
            <ModalHeader
              colors={["#ec4899", "#f472b6"]}
              icon={<CameraAlt sx={{ color: "#fff", fontSize: 26 }} />}
              eyebrow="FACE MODE"
              title={capturedImage ? "Looking good?" : "Smile at the camera"}
              subtitle={
                capturedImage
                  ? "Confirm to send this photo or retake if you blinked."
                  : "Position your face inside the ring. We only send one photo - no continuous capture."
              }
              onClose={handleModalClose}
            />
            <Box sx={styles.modalBody(isDarkMode)}>
              {!capturedImage ? (
                <>
                  <Box sx={styles.webcamFrame(isDarkMode)}>
                    <Webcam
                      audio={false}
                      ref={webcamRef}
                      screenshotFormat="image/jpeg"
                      style={{
                        width: "100%",
                        display: "block",
                        borderRadius: 14,
                      }}
                    />
                    <Box sx={styles.webcamRing} />
                  </Box>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.25}
                    sx={{ mt: 2 }}
                  >
                    <Button
                      fullWidth
                      onClick={captureImage}
                      startIcon={<CameraAlt />}
                      sx={styles.modalCta(["#ec4899", "#f472b6"])}
                    >
                      Capture photo
                    </Button>
                    <Button
                      fullWidth
                      onClick={handleModalClose}
                      sx={styles.modalGhost(isDarkMode)}
                    >
                      Cancel
                    </Button>
                  </Stack>
                </>
              ) : (
                <>
                  <Box sx={styles.webcamFrame(isDarkMode)}>
                    <Box
                      component="img"
                      src={capturedImage}
                      alt="Captured"
                      sx={{
                        width: "100%",
                        display: "block",
                        borderRadius: "14px",
                      }}
                    />
                  </Box>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.25}
                    sx={{ mt: 2 }}
                  >
                    <Button
                      fullWidth
                      onClick={confirmImage}
                      startIcon={<Check />}
                      sx={styles.modalCta(["#34d399", "#10b981"])}
                    >
                      Use this photo
                    </Button>
                    <Button
                      fullWidth
                      onClick={retakeImage}
                      startIcon={<Refresh />}
                      sx={styles.modalGhost(isDarkMode)}
                    >
                      Retake
                    </Button>
                  </Stack>
                </>
              )}
            </Box>
          </Box>
        </Modal>
      )}
    </Box>
  );
};

// Each style is either a plain sx object or a function taking
// (isDarkMode, ...) so the dark/light split + per-mood gradient can stay
// out of the JSX above.
const styles = {
  loadingOverlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    backdropFilter: "blur(6px)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2000,
    flexDirection: "column",
  },
  page: {
    minHeight: "100vh",
    fontFamily: "Poppins",
    transition: "background 0.3s ease",
    pb: 6,
  },
  shell: {
    maxWidth: 1180,
    mx: "auto",
    px: { xs: 2.5, sm: 3.5, md: 5 },
    pt: { xs: 3, md: 5 },
  },
  kicker: {
    fontFamily: "Poppins",
    fontWeight: 800,
    letterSpacing: 1.6,
    fontSize: 11,
    color: "#ff7a59",
    textTransform: "uppercase",
    display: "inline-flex",
    alignItems: "center",
    mb: 1,
  },
  heroTitle: (isDark) => ({
    fontFamily: "Poppins",
    fontWeight: 900,
    fontSize: { xs: 36, sm: 44, md: 52 },
    letterSpacing: -1.3,
    lineHeight: 1.05,
    color: isDark ? "#f6f6f8" : "#1a1a1a",
    mb: 1,
  }),
  heroAccent: {
    background:
      "linear-gradient(135deg, #ff4d4d 0%, #ff7a59 50%, #ec4899 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  heroSub: (isDark) => ({
    fontFamily: "Poppins",
    fontSize: { xs: 14, sm: 15 },
    color: isDark ? "#b8b8c2" : "#5a5a66",
    maxWidth: 520,
    mt: 0.5,
  }),
  sectionLabel: (isDark) => ({
    fontFamily: "Poppins",
    fontWeight: 800,
    letterSpacing: 1.8,
    fontSize: 11,
    color: isDark ? "#8e8e9c" : "#7a7a86",
    textTransform: "uppercase",
  }),

  captureCard: (isDark) => ({
    position: "relative",
    borderRadius: "24px",
    p: { xs: 2.5, sm: 3.5 },
    mb: 4,
    background: isDark ? "#161620" : "#ffffff",
    border: isDark ? "1px solid #2a2a36" : "1px solid #f3e8e3",
    boxShadow: isDark
      ? "0 24px 60px rgba(0,0,0,0.5)"
      : "0 24px 60px rgba(255,77,77,0.08)",
  }),
  cardEyebrow: (isDark) => ({
    fontFamily: "Poppins",
    fontWeight: 800,
    letterSpacing: 1.8,
    fontSize: 11,
    color: isDark ? "#8e8e9c" : "#7a7a86",
    textTransform: "uppercase",
    mb: 1.5,
  }),
  modeTile: (isDark, active, colors) => ({
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: 1.5,
    p: 1.75,
    cursor: "pointer",
    borderRadius: "16px",
    background: active
      ? isDark
        ? "#1f1f2c"
        : "#fff7f4"
      : isDark
        ? "#1a1a26"
        : "#fafafa",
    border: active
      ? `1.5px solid ${colors[1]}`
      : `1px solid ${isDark ? "#2a2a36" : "#eee8e5"}`,
    transition: "all .15s ease",
    "&:hover": {
      transform: "translateY(-2px)",
      boxShadow: `0 12px 26px ${colors[0]}28`,
      border: `1.5px solid ${colors[1]}`,
    },
  }),
  modeIcon: (active, colors) => ({
    width: 44,
    height: 44,
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 100%)`,
    boxShadow: active ? `0 8px 18px ${colors[0]}44` : "none",
    flexShrink: 0,
    transition: "box-shadow .15s ease",
  }),
  modeLabel: (isDark) => ({
    fontFamily: "Poppins",
    fontWeight: 800,
    fontSize: 15,
    color: isDark ? "#f6f6f8" : "#1a1a1a",
  }),
  modeBlurb: (isDark) => ({
    fontFamily: "Poppins",
    fontSize: 12.5,
    color: isDark ? "#9a9aab" : "#7a7a86",
    mt: 0.25,
  }),

  actionZone: (isDark) => ({
    borderRadius: "18px",
    border: isDark
      ? "1px dashed rgba(255,255,255,0.12)"
      : "1px dashed rgba(255,77,77,0.18)",
    px: { xs: 2, sm: 3 },
    py: { xs: 3, sm: 4 },
    textAlign: "center",
  }),
  actionInner: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 0.5,
  },
  actionIcon: (colors) => ({
    width: 64,
    height: 64,
    borderRadius: "18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 100%)`,
    boxShadow: `0 14px 28px ${colors[0]}55`,
    mb: 1.5,
  }),
  actionTitle: (isDark) => ({
    fontFamily: "Poppins",
    fontWeight: 800,
    fontSize: 18,
    color: isDark ? "#f6f6f8" : "#1a1a1a",
  }),
  actionHint: (isDark) => ({
    fontFamily: "Poppins",
    fontSize: 13,
    color: isDark ? "#a4a4b3" : "#6f6f7a",
    maxWidth: 480,
    mt: 0.5,
  }),
  primaryCta: (colors) => ({
    fontFamily: "Poppins",
    fontWeight: 800,
    textTransform: "none",
    color: "#fff",
    background: `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 100%)`,
    borderRadius: "999px",
    py: 1.4,
    fontSize: 14.5,
    boxShadow: `0 12px 26px ${colors[0]}55`,
    transition: "transform .15s ease, filter .15s ease, box-shadow .2s ease",
    "&:hover": {
      filter: "brightness(1.06)",
      transform: "translateY(-1px)",
      boxShadow: `0 16px 30px ${colors[0]}66`,
      background: `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 100%)`,
    },
  }),
  ghostCta: (isDark) => ({
    fontFamily: "Poppins",
    fontWeight: 700,
    textTransform: "none",
    color: isDark ? "#f6f6f8" : "#1a1a1a",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.12)"}`,
    borderRadius: "999px",
    py: 1.3,
    fontSize: 13.5,
    transition: "all .15s ease",
    "&:hover": {
      background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
      borderColor: "#ff4d4d",
      color: "#ff4d4d",
    },
  }),

  moodChip: (isDark, colors) => ({
    fontFamily: "Poppins",
    fontWeight: 700,
    fontSize: 13,
    color: isDark ? "#f6f6f8" : "#1a1a1a",
    background: isDark ? "#1a1a26" : "#ffffff",
    border: `1px solid ${isDark ? "#2a2a36" : "#eee8e5"}`,
    transition: "all .15s ease",
    "&:hover": {
      background: `linear-gradient(135deg, ${colors[0]}26, ${colors[2]}26)`,
      borderColor: colors[1],
      transform: "translateY(-1px)",
      boxShadow: `0 10px 20px ${colors[0]}22`,
    },
    "& .MuiChip-label": { px: 1.5, py: 0.5 },
  }),
  historyChip: (isDark) => ({
    fontFamily: "Poppins",
    fontWeight: 700,
    fontSize: 13,
    color: isDark ? "#f6f6f8" : "#1a1a1a",
    background: isDark ? "#1a1a26" : "#ffffff",
    border: `1px solid ${isDark ? "#2a2a36" : "#eee8e5"}`,
    "&:hover": {
      transform: "translateY(-1px)",
      boxShadow: "0 8px 18px rgba(255,77,77,0.18)",
      borderColor: "rgba(255,77,77,0.4)",
    },
  }),

  stepCard: (isDark) => ({
    flex: 1,
    position: "relative",
    p: 2.25,
    borderRadius: "18px",
    background: isDark ? "#161620" : "#ffffff",
    border: isDark ? "1px solid #2a2a36" : "1px solid #f3e8e3",
    boxShadow: isDark
      ? "0 12px 30px rgba(0,0,0,0.35)"
      : "0 12px 30px rgba(255,77,77,0.06)",
    transition: "transform .15s ease",
    "&:hover": { transform: "translateY(-2px)" },
  }),
  stepIndex: (isDark) => ({
    position: "absolute",
    top: 14,
    right: 14,
    fontFamily: "Poppins",
    fontWeight: 900,
    fontSize: 14,
    color: isDark ? "#3a3a48" : "#f5d7d2",
    letterSpacing: 1,
  }),
  stepTitle: (isDark) => ({
    fontFamily: "Poppins",
    fontWeight: 800,
    fontSize: 16,
    color: isDark ? "#f6f6f8" : "#1a1a1a",
    mt: 0.5,
  }),
  stepBody: (isDark) => ({
    fontFamily: "Poppins",
    fontSize: 13,
    color: isDark ? "#a4a4b3" : "#6f6f7a",
    mt: 0.5,
    lineHeight: 1.5,
  }),

  // ---- modal chrome ----
  modalBackdrop: {
    backgroundColor: "rgba(11,11,17,0.72)",
    backdropFilter: "blur(10px)",
  },
  modalShell: (isDark) => ({
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: { xs: "92%", sm: "min(560px, 92%)" },
    maxHeight: "90vh",
    // Flex column so the gradient header stays pinned and the body
    // scrolls; combined with `overflow: hidden` this clips the gradient
    // header's top corners to the shell's border-radius so no sliver of
    // the white shell background shows in the top-left / top-right.
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderRadius: "22px",
    background: isDark ? "#161620" : "#ffffff",
    // No border in light mode -- the 1px hairline rendered as a thin
    // white halo over the gradient header against the blurred backdrop.
    // The shadow alone gives enough card definition.
    border: isDark ? "1px solid #2a2a36" : "none",
    boxShadow: isDark
      ? "0 32px 80px rgba(0,0,0,0.6)"
      : "0 32px 80px rgba(255,77,77,0.16)",
    outline: "none",
    // MUI Modal sets tabIndex={-1} on the focus-trapped child; some
    // browsers (Webkit) paint a default outline ring on that. Defeat
    // every focus variant so no ring shows around the card.
    "&:focus, &:focus-visible, &:focus-within": { outline: "none" },
  }),
  modalHeader: (colors) => ({
    position: "relative",
    flexShrink: 0,
    px: { xs: 2.5, sm: 3 },
    pt: { xs: 2.5, sm: 3 },
    pb: { xs: 2, sm: 2.5 },
    background: `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 100%)`,
    color: "#fff",
    // Top corners are clipped by the parent `modalShell` (overflow:
    // hidden + borderRadius 22). Keeping the same radius here too
    // prevents a sub-pixel sliver of the shell background from peeking
    // out at the corners.
    borderTopLeftRadius: "22px",
    borderTopRightRadius: "22px",
    "&::after": {
      content: '""',
      position: "absolute",
      inset: 0,
      background:
        "radial-gradient(70% 70% at 0% 0%, rgba(255,255,255,0.22) 0%, transparent 60%)",
      pointerEvents: "none",
    },
  }),
  modalHeaderIcon: (colors) => ({
    width: 52,
    height: 52,
    borderRadius: "16px",
    background: "rgba(255,255,255,0.22)",
    backdropFilter: "blur(6px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.3)",
    flexShrink: 0,
    position: "relative",
    zIndex: 1,
    // colors arg unused but kept for parity with mode-specific overrides
    border: `1px solid ${colors[0]}00`,
  }),
  modalCloseBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    color: "#fff",
    background: "rgba(255,255,255,0.18)",
    backdropFilter: "blur(6px)",
    zIndex: 2,
    "&:hover": { background: "rgba(255,255,255,0.3)" },
  },
  modalEyebrow: {
    fontFamily: "Poppins",
    fontWeight: 800,
    fontSize: 10,
    letterSpacing: 2,
    color: "rgba(255,255,255,0.85)",
    textTransform: "uppercase",
    position: "relative",
    zIndex: 1,
  },
  modalTitle: {
    fontFamily: "Poppins",
    fontWeight: 900,
    fontSize: { xs: 22, sm: 26 },
    letterSpacing: -0.6,
    lineHeight: 1.1,
    color: "#fff",
    mt: 0.5,
    position: "relative",
    zIndex: 1,
  },
  modalSubtitle: {
    fontFamily: "Poppins",
    fontSize: 13.5,
    color: "rgba(255,255,255,0.92)",
    mt: 0.75,
    maxWidth: 440,
    position: "relative",
    zIndex: 1,
  },
  modalBody: (isDark) => ({
    px: { xs: 2.5, sm: 3 },
    py: { xs: 2.5, sm: 3 },
    color: isDark ? "#f6f6f8" : "#1a1a1a",
    // Header is pinned (`flexShrink: 0`); the body takes the remaining
    // height inside the shell and scrolls when content exceeds it.
    flexGrow: 1,
    overflowY: "auto",
    minHeight: 0,
  }),
  modalCta: (colors) => ({
    fontFamily: "Poppins",
    fontWeight: 800,
    textTransform: "none",
    color: "#fff",
    background: `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 100%)`,
    borderRadius: "999px",
    py: 1.3,
    fontSize: 14.5,
    boxShadow: `0 12px 24px ${colors[0]}55`,
    transition: "transform .15s ease, filter .15s ease, box-shadow .2s ease",
    "&:hover": {
      filter: "brightness(1.06)",
      transform: "translateY(-1px)",
      boxShadow: `0 14px 28px ${colors[0]}66`,
      background: `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 100%)`,
    },
    "&.Mui-disabled": {
      background: `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 100%)`,
      color: "#fff",
      opacity: 0.55,
      boxShadow: "none",
    },
  }),
  modalGhost: (isDark) => ({
    fontFamily: "Poppins",
    fontWeight: 700,
    textTransform: "none",
    color: isDark ? "#f6f6f8" : "#1a1a1a",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.12)"}`,
    borderRadius: "999px",
    py: 1.2,
    fontSize: 13.5,
    transition: "all .15s ease",
    "&:hover": {
      background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
      borderColor: "#ff4d4d",
      color: "#ff4d4d",
    },
  }),

  // ---- voice modal ----
  micStage: {
    position: "relative",
    width: 160,
    height: 160,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  micPulseRing: {
    position: "absolute",
    inset: 0,
    borderRadius: "50%",
    background: "rgba(236,72,153,0.35)",
    animation: "moodifyMicPulse 1.4s ease-out infinite",
    "@keyframes moodifyMicPulse": {
      "0%": { transform: "scale(0.9)", opacity: 0.6 },
      "100%": { transform: "scale(1.45)", opacity: 0 },
    },
  },
  micOrb: {
    width: 116,
    height: 116,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background .2s ease, box-shadow .2s ease",
  },
  reviewBox: (isDark) => ({
    mt: 2.5,
    p: 2,
    borderRadius: "14px",
    background: isDark ? "#1a1a25" : "#fafafa",
    border: isDark ? "1px solid #2a2a36" : "1px solid #eee8e5",
  }),
  reviewLabel: (isDark) => ({
    fontFamily: "Poppins",
    fontWeight: 800,
    fontSize: 11,
    letterSpacing: 1.6,
    color: isDark ? "#8e8e9c" : "#7a7a86",
  }),

  // ---- text modal ----
  textArea: (isDark) => ({
    "& .MuiOutlinedInput-root": {
      fontFamily: "Poppins",
      fontSize: 15,
      borderRadius: "14px",
      background: isDark ? "#1a1a25" : "#fafafa",
      color: isDark ? "#f6f6f8" : "#1a1a1a",
      "& fieldset": {
        borderColor: isDark ? "#2c2c3a" : "#eee8e5",
      },
      "&:hover fieldset": {
        borderColor: isDark ? "#3a3a4c" : "#f0d6d2",
      },
      "&.Mui-focused fieldset": {
        borderColor: "#34d399",
        borderWidth: 1.5,
      },
    },
    "& .MuiOutlinedInput-input::placeholder": {
      color: isDark ? "#6f6f7a" : "#aaa",
      opacity: 1,
    },
  }),
  charCounter: (isDark) => ({
    fontFamily: "Poppins",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.6,
    color: isDark ? "#7a7a86" : "#999",
    textAlign: "right",
    mt: 0.5,
  }),

  // ---- face modal ----
  webcamFrame: (isDark) => ({
    position: "relative",
    width: "100%",
    borderRadius: "16px",
    overflow: "hidden",
    background: isDark ? "#1a1a25" : "#fafafa",
    border: isDark ? "1px solid #2a2a36" : "1px solid #eee8e5",
    boxShadow: isDark
      ? "0 14px 32px rgba(0,0,0,0.4)"
      : "0 14px 32px rgba(255,77,77,0.08)",
  }),
  webcamRing: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "55%",
    aspectRatio: "1",
    borderRadius: "50%",
    border: "2px solid rgba(255,255,255,0.55)",
    boxShadow: "0 0 0 9999px rgba(0,0,0,0.18)",
    pointerEvents: "none",
  },

  // ---- legacy keys (kept for backwards compat with any external ref) ----
  modal: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: 500,
    bgcolor: "white",
    boxShadow: 24,
    p: 4,
    borderRadius: "16px",
    textAlign: "center",
  },
};

function ModalHeader({ colors, icon, eyebrow, title, subtitle, onClose }) {
  return (
    <Box sx={styles.modalHeader(colors)}>
      <IconButton
        onClick={onClose}
        sx={styles.modalCloseBtn}
        aria-label="Close"
      >
        <Close sx={{ fontSize: 18 }} />
      </IconButton>
      <Stack direction="row" spacing={2} alignItems="center">
        <Box sx={styles.modalHeaderIcon(colors)}>{icon}</Box>
        <Box>
          <Typography sx={styles.modalEyebrow}>{eyebrow}</Typography>
          <Typography sx={styles.modalTitle}>{title}</Typography>
        </Box>
      </Stack>
      {subtitle && (
        <Typography sx={styles.modalSubtitle}>{subtitle}</Typography>
      )}
    </Box>
  );
}

function StatBubble({ icon, label, value, tint, isDark }) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1}
      sx={{
        px: 1.5,
        py: 0.85,
        borderRadius: "14px",
        background: isDark ? "#161620" : "#ffffff",
        border: isDark ? "1px solid #2a2a36" : "1px solid #f3e8e3",
        boxShadow: isDark
          ? "0 10px 26px rgba(0,0,0,0.3)"
          : "0 8px 22px rgba(255,77,77,0.06)",
        minWidth: 110,
      }}
    >
      <Box
        sx={{
          width: 30,
          height: 30,
          borderRadius: "10px",
          background: `${tint}22`,
          color: tint,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography
          sx={{
            fontFamily: "Poppins",
            fontWeight: 900,
            fontSize: 16,
            lineHeight: 1,
            color: isDark ? "#f6f6f8" : "#1a1a1a",
          }}
        >
          {value}
        </Typography>
        <Typography
          sx={{
            fontFamily: "Poppins",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.6,
            color: isDark ? "#888896" : "#8a8a96",
            textTransform: "uppercase",
            mt: 0.25,
          }}
        >
          {label}
        </Typography>
      </Box>
    </Stack>
  );
}

export default HomePage;
