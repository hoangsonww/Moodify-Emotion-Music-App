import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useContext,
} from "react";
import {
  Box,
  Button,
  Typography,
  Paper,
  TextField,
  Modal,
  CircularProgress,
} from "@mui/material";
import Webcam from "react-webcam";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { DarkModeContext } from "../context/DarkModeContext";

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
  const [isLoading, setIsLoading] = useState(false);
  const [userData, setUserData] = useState(null);

  const token = localStorage.getItem("token");
  const { isDarkMode } = useContext(DarkModeContext);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await axios.get(
          "https://moodify-emotion-music-app.onrender.com/users/user/profile/",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

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
          `https://moodify-emotion-music-app.onrender.com/users/mood_history/${userData.id}/`,
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
          `https://moodify-emotion-music-app.onrender.com/users/recommendations/${userData.id}/`,
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
        "https://moodify-emotion-music-app.onrender.com/users/user/profile/",
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
    if (uploadedFile && uploadedFile.size > 10 * 1024 * 1024) {
      console.log("File size must be under 10MB");
      return;
    }

    setFile(uploadedFile);

    const formData = new FormData();
    formData.append("file", uploadedFile);

    if (!token) {
      console.log("User is not authenticated. Please log in.");
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
            "https://moodify-emotion-music-app.onrender.com/api/text_emotion/",
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
          axios.post(
            "https://moodify-emotion-music-app.onrender.com/api/facial_emotion/",
            formData,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          ),
          timeout(60000),
        ]);
      } else if (activeTab === "speech") {
        response = await Promise.race([
          axios.post(
            "https://moodify-emotion-music-app.onrender.com/api/speech_emotion/",
            formData,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          ),
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
          "https://moodify-emotion-music-app.onrender.com/api/music_recommendation/",
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
        axios.post(
          "https://moodify-emotion-music-app.onrender.com/api/facial_emotion/",
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        ),
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
          "https://moodify-emotion-music-app.onrender.com/api/music_recommendation/",
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
    if (!inputValue.trim()) {
      console.log("Please enter some text.");
      return;
    }

    setIsLoading(true);

    try {
      // Race the text submission request against a 1-minute timeout
      const response = await Promise.race([
        axios.post(
          "https://moodify-emotion-music-app.onrender.com/api/text_emotion/",
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
          "https://moodify-emotion-music-app.onrender.com/api/music_recommendation/",
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
      alert("Could not access the microphone. Please try again.");
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
        axios.post(
          "https://moodify-emotion-music-app.onrender.com/api/speech_emotion/",
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
              Authorization: `Bearer ${token}`,
            },
          },
        ),
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
          "https://moodify-emotion-music-app.onrender.com/api/music_recommendation/",
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

  return (
    <div
      style={{
        ...styles.container,
        backgroundColor: isDarkMode ? "#121212" : "#f5f5f5", // Dark mode background
        color: isDarkMode ? "#ffffff" : "#000000", // Dark mode text color
      }}
    >
      {isLoading && (
        <Box sx={styles.loadingOverlay}>
          <CircularProgress sx={{ color: "#ff4d4d" }} />
          <Typography
            variant="h6"
            style={{ marginTop: "10px", color: "white", font: "inherit" }}
          >
            {loadingText}
          </Typography>
          <Typography
            variant="h6"
            style={{
              marginTop: "10px",
              color: "white",
              font: "inherit",
              textAlign: "center",
              fontSize: "14px",
              padding: "0 2rem",
            }}
          >
            Note that our servers might be slow or experience downtime due to
            high traffic, or they may spin down after periods of inactivity. It
            may take up to 2 minutes to process during these times. We
            appreciate your patience, and apologize for any inconvenience.
          </Typography>
        </Box>
      )}
      <Paper
        elevation={4}
        style={{
          ...styles.formContainer,
          backgroundColor: isDarkMode ? "#1f1f1f" : "white", // Dark mode container background
          color: isDarkMode ? "#ffffff" : "#000000", // Dark mode text color
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
          <Button
            onClick={() => handleTabChange("text")}
            sx={{
              ...styles.tabButton,
              borderRadius: "12px 0 0 12px",
              backgroundColor:
                activeTab === "text"
                  ? "#ff4d4d"
                  : isDarkMode
                    ? "#333"
                    : "white",
              color:
                activeTab === "text"
                  ? "white"
                  : isDarkMode
                    ? "#ffffff"
                    : "black",
            }}
          >
            Text
          </Button>
          <Button
            onClick={() => handleTabChange("face")}
            sx={{
              ...styles.tabButton,
              borderRadius: "0",
              backgroundColor:
                activeTab === "face"
                  ? "#ff4d4d"
                  : isDarkMode
                    ? "#333"
                    : "white",
              color:
                activeTab === "face"
                  ? "white"
                  : isDarkMode
                    ? "#ffffff"
                    : "black",
            }}
          >
            Face
          </Button>
          <Button
            onClick={() => handleTabChange("speech")}
            sx={{
              ...styles.tabButton,
              borderRadius: "0 12px 12px 0",
              backgroundColor:
                activeTab === "speech"
                  ? "#ff4d4d"
                  : isDarkMode
                    ? "#333"
                    : "white",
              color:
                activeTab === "speech"
                  ? "white"
                  : isDarkMode
                    ? "#ffffff"
                    : "black",
            }}
          >
            Speech
          </Button>
        </Box>
        <Typography
          variant="h6"
          align="center"
          style={{
            marginBottom: "20px",
            fontFamily: "Poppins",
            fontSize: "16px",
            color: isDarkMode ? "#fff" : "#000",
          }}
        >
          Choose an input mode ({activeTab})
        </Typography>

        <Button onClick={() => setShowModal(true)} style={styles.captureButton}>
          {activeTab === "text"
            ? "Add Text"
            : activeTab === "face"
              ? "Capture Image"
              : "Record Audio"}
        </Button>

        <Typography
          variant="h6"
          align="center"
          style={{
            marginTop: "20px",
            fontFamily: "Poppins",
            fontSize: "16px",
            color: isDarkMode ? "#fff" : "#000",
          }}
        >
          OR
        </Typography>

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
        <label htmlFor="upload-file">
          <Button
            variant="contained"
            color="secondary"
            component="span"
            style={styles.uploadButton}
          >
            Upload{" "}
            {activeTab === "text"
              ? "Text File"
              : activeTab === "speech"
                ? "Audio File"
                : "Image"}
          </Button>
        </label>

        {/* Custom message for audio file requirements */}
        {activeTab === "speech" && (
          <Typography
            variant="body2"
            align="center"
            style={{
              marginTop: "10px",
              fontFamily: "Poppins",
              color: isDarkMode ? "#999" : "#777",
            }}
          >
            Acceptable formats: .wav, .mp4
          </Typography>
        )}

        {/* Custom message for image file requirements */}
        {activeTab === "face" && (
          <Typography
            variant="body2"
            align="center"
            style={{
              marginTop: "10px",
              fontFamily: "Poppins",
              color: isDarkMode ? "#999" : "#777",
            }}
          >
            Acceptable formats: .jpg, .jpeg, .png, .webp
          </Typography>
        )}

        {/* Custom message for text file requirements */}
        {activeTab === "text" && (
          <Typography
            variant="body2"
            align="center"
            style={{
              marginTop: "10px",
              fontFamily: "Poppins",
              color: isDarkMode ? "#999" : "#777",
            }}
          >
            Acceptable formats: .txt
          </Typography>
        )}

        {/* Modal for Speech Input */}
        {activeTab === "speech" && (
          <Modal open={showModal} onClose={handleModalClose}>
            <Box
              sx={{
                ...styles.modal,
                width: { xs: "90%", sm: "80%", md: "60%", lg: "40%" }, // Responsive width
                maxWidth: "600px",
                padding: { xs: "16px", sm: "24px", md: "32px" }, // Responsive padding
                margin: "auto",
                backgroundColor: isDarkMode ? "#1f1f1f" : "white", // Dark mode modal background
                color: isDarkMode ? "#ffffff" : "#000000", // Dark mode text color
              }}
            >
              <Typography
                variant="h6"
                sx={{
                  font: "inherit",
                  fontSize: { xs: "14px", sm: "16px", md: "18px" }, // Responsive font size
                  textAlign: "center",
                  color: isDarkMode ? "#ffffff" : "#000000",
                }}
              >
                Record Your Audio
              </Typography>

              <Box
                sx={{
                  mt: 2,
                  display: "flex",
                  flexDirection: { xs: "column", sm: "row" }, // Stack buttons vertically on small screens
                  justifyContent: "center",
                  gap: { xs: "10px", sm: "20px" }, // Spacing between buttons
                }}
              >
                <Button
                  onClick={startRecording}
                  variant="contained"
                  color="primary"
                  disabled={isRecording}
                  sx={{
                    width: { xs: "100%", sm: "auto" }, // Full width on small screens
                    font: "inherit",
                  }}
                >
                  Start Recording
                </Button>
                <Button
                  onClick={stopRecording}
                  variant="contained"
                  color="secondary"
                  disabled={!isRecording}
                  sx={{
                    width: { xs: "100%", sm: "auto" }, // Full width on small screens
                    font: "inherit",
                  }}
                >
                  Stop Recording
                </Button>
              </Box>

              {/* Animated "Recording..." message */}
              {isShowingRecordingDots && (
                <Typography
                  variant="body2"
                  sx={{
                    textAlign: "center",
                    mt: 2,
                    font: "inherit",
                  }}
                >
                  Recording{dotAnimation}
                </Typography>
              )}

              {/* Spacer */}
              <div style={{ height: "20px" }} />

              {audioBlob && (
                <>
                  <Typography
                    variant="h6"
                    sx={{
                      marginTop: "10px",
                      font: "inherit",
                      textAlign: "center",
                      color: isDarkMode ? "#ffffff" : "#000000",
                    }}
                  >
                    Review your recording
                  </Typography>

                  <audio
                    controls
                    src={audioUrl}
                    style={{
                      marginTop: "20px",
                      width: "100%", // Full width for responsiveness
                    }}
                  />
                </>
              )}

              <Box
                sx={{
                  display: "flex",
                  flexDirection: { xs: "column", sm: "row" }, // Stack buttons vertically on small screens
                  justifyContent: "center",
                  mt: 2,
                  gap: { xs: "10px", sm: "20px" }, // Spacing between buttons
                }}
              >
                <Button
                  onClick={handleAudioUpload}
                  variant="contained"
                  color="success"
                  sx={{
                    width: { xs: "100%", sm: "auto" }, // Full width on small screens
                    font: "inherit",
                  }}
                >
                  Upload Audio
                </Button>
                <Button
                  onClick={handleModalClose}
                  variant="contained"
                  color="error"
                  sx={{
                    width: { xs: "100%", sm: "auto" },
                    font: "inherit",
                  }}
                >
                  Close
                </Button>
              </Box>
            </Box>
          </Modal>
        )}

        {/* Text and Face Modal Logic */}
        {activeTab === "text" && (
          <Modal open={showModal} onClose={handleModalClose}>
            <Box
              sx={{
                ...styles.modal,
                width: { xs: "90%", sm: "80%", md: "60%", lg: "40%" },
                maxWidth: "600px",
                padding: { xs: "16px", sm: "24px", md: "32px" },
                margin: "auto",
                backgroundColor: isDarkMode ? "#1f1f1f" : "white", // Dark mode modal background
                color: isDarkMode ? "#ffffff" : "#000000", // Dark mode text color
              }}
            >
              <Typography
                variant="h6"
                sx={{
                  marginBottom: "10px",
                  font: "inherit",
                  textAlign: "center",
                  color: isDarkMode ? "#ffffff" : "#000000",
                }}
              >
                Enter Your Text
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={4}
                variant="outlined"
                placeholder="Tell us how you're feeling..."
                value={inputValue}
                inputProps={{
                  style: {
                    padding: "8px 12px",
                    fontFamily: "Poppins",
                    fontSize: "16px",
                    color: isDarkMode ? "#ffffff" : "#000000", // Dark mode input text color
                  },
                }}
                InputProps={{
                  style: {
                    fontFamily: "Poppins",
                    fontSize: "16px",
                    padding: "0",
                    boxShadow: "none",
                    color: isDarkMode ? "#ffffff" : "#000000", // Dark mode input text color
                  },
                }}
                InputLabelProps={{
                  style: {
                    fontFamily: "Poppins",
                    color: isDarkMode ? "#ffffff" : "#000000", // Dark mode label color
                  },
                }}
                onChange={(e) => setInputValue(e.target.value)}
              />
              <Box
                mt={2}
                sx={{
                  display: "flex",
                  flexDirection: { xs: "column", sm: "row" },
                  justifyContent: "center",
                  gap: { xs: "10px", sm: "10px" },
                  alignItems: "center",
                }}
              >
                <Button
                  onClick={handleTextSubmit}
                  variant="contained"
                  sx={{
                    width: { xs: "100%", sm: "auto" },
                    marginRight: { sm: "10px" },
                    font: "inherit",
                    backgroundColor: "#ff1a1a",
                  }}
                >
                  Send Text
                </Button>
                <Button
                  onClick={handleModalClose}
                  variant="contained"
                  color="error"
                  sx={{
                    width: { xs: "100%", sm: "auto" },
                    font: "inherit",
                    backgroundColor: "white",
                    color: "red",
                    "&:hover": {
                      backgroundColor: "#ff1a1a",
                      color: "white",
                    },
                  }}
                >
                  Close
                </Button>
              </Box>
            </Box>
          </Modal>
        )}

        {activeTab === "face" && (
          <Modal open={showModal} onClose={handleModalClose}>
            <Box
              sx={{
                ...styles.modal,
                width: { xs: "90%", sm: "80%", md: "60%", lg: "40%" },
                maxWidth: "600px",
                padding: { xs: "16px", sm: "24px", md: "32px" },
                margin: "auto",
                backgroundColor: isDarkMode ? "#1f1f1f" : "white", // Dark mode modal background
                color: isDarkMode ? "#ffffff" : "#000000", // Dark mode text color
              }}
            >
              {!capturedImage ? (
                <>
                  <Typography
                    variant="h6"
                    sx={{
                      marginBottom: "10px",
                      font: "inherit",
                      textAlign: "center",
                      color: isDarkMode ? "#ffffff" : "#000000",
                    }}
                  >
                    Image Capture
                  </Typography>
                  <Box
                    sx={{
                      width: { xs: "100%", sm: "80%", md: "100%" },
                      maxWidth: "100%",
                      margin: "auto",
                    }}
                  >
                    <Webcam
                      audio={false}
                      ref={webcamRef}
                      screenshotFormat="image/jpeg"
                      style={{ width: "100%", borderRadius: "8px" }}
                    />
                  </Box>
                  <Button
                    onClick={captureImage}
                    variant="contained"
                    color="error"
                    sx={{
                      marginTop: "20px",
                      width: { xs: "100%", sm: "auto" }, // Full width on small screens
                      backgroundColor: "#ff1a1a",
                      font: "inherit",
                      marginRight: { md: "10px", lg: "10px" },
                    }}
                  >
                    Capture
                  </Button>
                </>
              ) : (
                <>
                  <Box
                    sx={{
                      width: "100%",
                      textAlign: "center",
                      display: "flex",
                      justifyContent: "center",
                    }}
                  >
                    <img
                      src={capturedImage}
                      alt="Captured"
                      style={{
                        width: "100%",
                        maxWidth: "400px", // Ensure it doesn't exceed this width
                        borderRadius: "8px",
                      }}
                    />
                  </Box>
                  <Box
                    mt={2}
                    sx={{
                      display: "flex",
                      flexDirection: { xs: "column", sm: "row" }, // Stack buttons vertically on smaller screens
                      justifyContent: "center",
                      gap: { xs: "10px", sm: "10px" }, // Spacing between buttons
                      alignItems: "center",
                    }}
                  >
                    <Button
                      onClick={confirmImage}
                      variant="contained"
                      color="primary"
                      sx={{
                        width: { xs: "100%", sm: "auto" }, // Full width on small screens
                        font: "inherit",
                      }}
                    >
                      Confirm
                    </Button>
                    <Button
                      onClick={retakeImage}
                      variant="contained"
                      color="secondary"
                      sx={{
                        width: { xs: "100%", sm: "auto" }, // Full width on small screens
                        font: "inherit",
                        marginRight: { md: "10px", lg: "10px" },
                      }}
                    >
                      Retake
                    </Button>
                  </Box>
                </>
              )}
              <Button
                onClick={handleModalClose}
                variant="contained"
                color="error"
                sx={{
                  marginTop: "20px",
                  width: { xs: "100%", sm: "auto" }, // Full width on small screens
                  font: "inherit",
                  backgroundColor: "white",
                  color: "#ff1a1a",
                  "&:hover": {
                    backgroundColor: "#ff1a1a",
                    color: "white",
                  },
                }}
              >
                Close
              </Button>
            </Box>
          </Modal>
        )}
      </Paper>
    </div>
  );
};

const styles = {
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2000,
    flexDirection: "column",
  },
  container: {
    height: "99vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    fontFamily: "Poppins",
    transition: "background-color 0.3s ease",
  },
  formContainer: {
    padding: "20px",
    borderRadius: "12px",
    width: "500px",
    boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.1)",
    backgroundColor: "white",
    transition: "background-color 0.3s ease",
  },
  tabButton: {
    flex: 1,
    padding: "10px 15px",
    textTransform: "none",
    transition: "all 0.3s ease",
    fontFamily: "Poppins",
    "&:hover": {
      backgroundColor: "#ff4d4d",
      color: "white",
    },
  },
  captureButton: {
    margin: "20px auto",
    width: "100px",
    height: "100px",
    borderRadius: "50%",
    backgroundColor: "#ff4d4d",
    color: "white",
    fontSize: "14px",
    padding: "10px",
    textTransform: "uppercase",
    transition: "all 0.3s ease",
    boxShadow: "0px 4px 15px rgba(255, 0, 0, 0.4)",
    fontFamily: "Poppins",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    "&:hover": {
      backgroundColor: "#ff1a1a",
    },
  },
  uploadButton: {
    textAlign: "center",
    display: "block",
    margin: "10px auto",
    padding: "8px 20px",
    backgroundColor: "#ff4d4d",
    color: "white",
    textTransform: "uppercase",
    transition: "all 0.3s ease",
    borderRadius: "20px",
    boxShadow: "0px 4px 10px rgba(255, 0, 0, 0.4)",
    fontFamily: "Poppins",
    "&:hover": {
      backgroundColor: "#ff1a1a",
    },
  },
  modal: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: 500,
    bgcolor: "white",
    boxShadow: 24,
    p: 4,
    borderRadius: "12px",
    textAlign: "center",
  },
  webcam: {
    width: "100%",
    height: "auto",
    borderRadius: "10px",
  },
  capturedImage: {
    width: "100%",
    height: "auto",
    borderRadius: "10px",
  },
};

export default HomePage;
