import React, { useState, useRef, useCallback } from 'react';
import {Box, Button, Typography, Paper, TextField, Modal, CircularProgress} from '@mui/material';
import Webcam from 'react-webcam';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Recorder from 'recorder-js';

const HomePage = () => {
  const [activeTab, setActiveTab] = useState('text');
  const [inputValue, setInputValue] = useState('');
  const [file, setFile] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const webcamRef = useRef(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const audioContextRef = useRef(null);
  const recorderRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setFile(null);
    setInputValue('');
    setShowModal(false);
    setCapturedImage(null);
    setAudioBlob(null);
  };

  const handleFileUpload = async (e) => {
    const uploadedFile = e.target.files[0];
    if (uploadedFile && uploadedFile.size > 10 * 1024 * 1024) {
      alert('File size must be under 10MB');
      return;
    }

    setFile(uploadedFile);

    const formData = new FormData();
    formData.append('file', uploadedFile);

    const token = localStorage.getItem('token');

    if (!token) {
      alert('User is not authenticated. Please log in.');
      return;
    }

    setIsLoading(true); // Start loading indicator

    try {
      if (activeTab === 'text') {
        const textContent = await uploadedFile.text();
        const response = await axios.post('http://127.0.0.1:8000/api/text_emotion/', { text: textContent }, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });

        navigate('/results', { state: { emotion: response.data.emotion, recommendations: response.data.recommendations } });
      } else if (activeTab === 'face') {
        const response = await axios.post('http://127.0.0.1:8000/api/facial_emotion/', formData, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        navigate('/results', { state: { emotion: response.data.emotion, recommendations: response.data.recommendations } });
      } else if (activeTab === 'speech') {
        const response = await axios.post('http://127.0.0.1:8000/api/speech_emotion/', formData, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        navigate('/results', { state: { emotion: response.data.emotion, recommendations: response.data.recommendations } });
      }
    } catch (error) {
      console.error(`Error uploading ${activeTab} file:`, error);
      alert(`Failed to upload the ${activeTab} file. Please try again.`);
    } finally {
      handleModalClose();
      setIsLoading(false); // Stop loading indicator
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

  const confirmImage = async () => {
    try {
      const base64Response = await fetch(capturedImage);
      const blob = await base64Response.blob();

      setIsLoading(true);

      if (blob.size === 0) {
        alert('Captured image is invalid. Please try again.');
        return;
      }

      const formData = new FormData();
      formData.append('file', blob, 'captured_image.jpg');

      const token = localStorage.getItem('token');

      if (!token) {
        alert('User is not authenticated. Please log in.');
        return;
      }

      const response = await axios.post('http://127.0.0.1:8000/api/facial_emotion/', formData, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      navigate('/results', { state: { emotion: response.data.emotion, recommendations: response.data.recommendations } });
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload the image. Please try again.');
    } finally {
      handleModalClose();
      setIsLoading(false);
    }
  };

  const handleTextSubmit = async () => {
    if (!inputValue.trim()) {
      alert("Please enter some text.");
      return;
    }

    try {
      const response = await axios.post('http://127.0.0.1:8000/api/text_emotion/', { text: inputValue.trim() }, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      setIsLoading(true);

      navigate('/results', { state: { emotion: response.data.emotion, recommendations: response.data.recommendations } });
    } catch (error) {
      console.error('Error processing text:', error);
      alert('Failed to process the text. Please try again.');
    } finally {
      setIsLoading(false);
    }

    setInputValue('');
    handleModalClose();
  };

  const startRecording = async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recorderRef.current = new Recorder(audioContextRef.current, {
      numChannels: 1,
    });

    recorderRef.current.init(stream);
    recorderRef.current.start().then(() => setIsRecording(true));
  };

  const stopRecording = () => {
    recorderRef.current.stop().then(({ blob }) => {
      const wavBlob = new Blob([blob], { type: 'audio/wav' });
      setAudioBlob(wavBlob);
      setIsRecording(false);
    });
  };

  const handleAudioUpload = async () => {
    if (!audioBlob) {
      alert('No audio recorded.');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'recorded_audio.wav');

      const token = localStorage.getItem('token');

      setIsLoading(true);

      if (!token) {
        alert('User is not authenticated. Please log in.');
        return;
      }

      const response = await axios.post('http://127.0.0.1:8000/api/speech_emotion/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`,
        },
      });

      navigate('/results', { state: { emotion: response.data.emotion, recommendations: response.data.recommendations } });
    } catch (error) {
      console.error('Error uploading audio:', error);
      alert('Failed to upload the audio. Please try again.');
    } finally {
      handleModalClose();
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      {isLoading && (
          <Box sx={styles.loadingOverlay}>
            <CircularProgress sx={{ color: '#ff4d4d' }} />
            <Typography variant="h6" style={{ marginTop: '10px', color: 'white', font: 'inherit' }}>
              Processing, please wait...
            </Typography>
          </Box>
      )}
      <Paper elevation={4} style={styles.formContainer}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <Button
              onClick={() => handleTabChange('text')}
              sx={{ ...styles.tabButton, borderRadius: '12px 0 0 12px', backgroundColor: activeTab === 'text' ? '#ff4d4d' : 'white', color: activeTab === 'text' ? 'white' : 'black' }}
          >
            Text
          </Button>
          <Button
              onClick={() => handleTabChange('face')}
              sx={{ ...styles.tabButton, borderRadius: '0', backgroundColor: activeTab === 'face' ? '#ff4d4d' : 'white', color: activeTab === 'face' ? 'white' : 'black' }}
          >
            Face
          </Button>
          <Button
              onClick={() => handleTabChange('speech')}
              sx={{ ...styles.tabButton, borderRadius: '0 12px 12px 0', backgroundColor: activeTab === 'speech' ? '#ff4d4d' : 'white', color: activeTab === 'speech' ? 'white' : 'black' }}
          >
            Speech
          </Button>
        </Box>
        <Typography variant="h6" align="center" style={{ marginBottom: '20px', fontFamily: 'Poppins', fontSize: '16px' }}>
          Choose an input mode ({activeTab})
        </Typography>

        <Button
            onClick={() => setShowModal(true)}
            style={styles.captureButton}
        >
          {activeTab === 'text' ? 'Add Text' : activeTab === 'face' ? 'Capture Image' : 'Record Audio'}
        </Button>

        <Typography variant="h6" align="center" style={{ marginTop: '20px', fontFamily: 'Poppins', fontSize: '16px' }}>
          OR
        </Typography>

        <input
            accept={activeTab === 'text' ? '.txt' : activeTab === 'speech' ? '.wav, .mp4' : 'image/*'}
            style={{ display: 'none' }}
            id="upload-file"
            type="file"
            onChange={handleFileUpload}
        />
        <label htmlFor="upload-file">
          <Button variant="contained" color="secondary" component="span" style={styles.uploadButton}>
            Upload {activeTab === 'text' ? 'Text File' : activeTab === 'speech' ? 'Audio File' : 'Image'}
          </Button>
        </label>

        {/* Custom message for audio file requirements */}
        {activeTab === 'speech' && (
            <Typography variant="body2" align="center" style={{ marginTop: '10px', fontFamily: 'Poppins', color: '#777' }}>
              Acceptable formats: .wav, .mp4
            </Typography>
        )}

        {/* Custom message for image file requirements */}
        {activeTab === 'face' && (
            <Typography variant="body2" align="center" style={{ marginTop: '10px', fontFamily: 'Poppins', color: '#777' }}>
              Acceptable formats: .jpg, .jpeg, .png, .webp
            </Typography>
        )}

        {/* Custom message for text file requirements */}
        {activeTab === 'text' && (
            <Typography variant="body2" align="center" style={{ marginTop: '10px', fontFamily: 'Poppins', color: '#777' }}>
              Acceptable formats: .txt
            </Typography>
        )}

        {/* Modal for Speech Input */}
        {activeTab === 'speech' && (
            <Modal open={showModal} onClose={handleModalClose}>
              <Box sx={styles.modal}>
                <Typography variant="h6">Record Your Audio</Typography>
                <Box sx={{ mt: 2 }}>
                  <Button onClick={startRecording} variant="contained" color="primary" disabled={isRecording}>
                    Start Recording
                  </Button>
                  <Button onClick={stopRecording} variant="contained" color="secondary" disabled={!isRecording}>
                    Stop Recording
                  </Button>
                </Box>
                {audioBlob && (
                    <audio controls src={URL.createObjectURL(audioBlob)} style={{ marginTop: '20px', width: '100%' }} />
                )}
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <Button onClick={handleAudioUpload} variant="contained" color="success">Upload Audio</Button>
                  <Button onClick={handleModalClose} variant="contained" color="error">Close</Button>
                </Box>
              </Box>
            </Modal>
        )}

        {/* Existing Text and Face Modals */}
        {activeTab === 'text' && (
            <Modal open={showModal} onClose={handleModalClose}>
              <Box sx={styles.modal}>
                <Typography variant="h6" style={{ marginBottom: '10px' }}>Enter Your Text</Typography>
                <TextField
                    fullWidth
                    multiline
                    rows={4}
                    variant="outlined"
                    placeholder="Enter your text..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                />
                <Box mt={2}>
                  <Button onClick={handleTextSubmit} variant="contained" color="primary" style={{ marginRight: '10px' }}>Send Text</Button>
                  <Button onClick={handleModalClose} variant="contained" color="error">Close</Button>
                </Box>
              </Box>
            </Modal>
        )}

        {activeTab === 'face' && (
            <Modal open={showModal} onClose={handleModalClose}>
              <Box sx={styles.modal}>
                {!capturedImage ? (
                    <>
                      <Webcam
                          audio={false}
                          ref={webcamRef}
                          screenshotFormat="image/jpeg"
                          style={styles.webcam}
                      />
                      <Button onClick={captureImage} variant="contained" color="error" style={{ marginTop: '20px' }}>Capture</Button>
                    </>
                ) : (
                    <>
                      <img src={capturedImage} alt="Captured" style={styles.capturedImage} />
                      <Box mt={2}>
                        <Button onClick={confirmImage} variant="contained" color="primary" style={{ marginRight: '10px' }}>Confirm</Button>
                        <Button onClick={retakeImage} variant="contained" color="secondary">Retake</Button>
                      </Box>
                    </>
                )}
                <Button onClick={handleModalClose} variant="contained" color="error" style={{ marginTop: '20px' }}>Close</Button>
              </Box>
            </Modal>
        )}
      </Paper>
    </div>
  );
};

const styles = {
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
    flexDirection: 'column',
  },
  container: {
    height: '99vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    fontFamily: 'Poppins',
  },
  formContainer: {
    padding: '20px',
    borderRadius: '12px',
    width: '500px',
    boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.1)',
    backgroundColor: 'white',
  },
  tabButton: {
    flex: 1,
    padding: '10px 15px',
    textTransform: 'none',
    transition: 'all 0.3s ease',
    fontFamily: 'Poppins',
    '&:hover': {
      backgroundColor: '#ff4d4d',
      color: 'white',
    },
  },
  captureButton: {
    margin: '20px auto',
    width: '100px',
    height: '100px',
    borderRadius: '50%',
    backgroundColor: 'red',
    color: 'white',
    fontSize: '14px',
    padding: '10px',
    textTransform: 'uppercase',
    transition: 'all 0.3s ease',
    boxShadow: '0px 4px 15px rgba(255, 0, 0, 0.4)',
    fontFamily: 'Poppins',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    '&:hover': {
      backgroundColor: '#ff1a1a',
    },
  },
  uploadButton: {
    textAlign: 'center',
    display: 'block',
    margin: '10px auto',
    padding: '8px 20px',
    backgroundColor: '#ff4d4d',
    color: 'white',
    textTransform: 'uppercase',
    transition: 'all 0.3s ease',
    borderRadius: '20px',
    boxShadow: '0px 4px 10px rgba(255, 0, 0, 0.4)',
    fontFamily: 'Poppins',
    '&:hover': {
      backgroundColor: '#ff1a1a',
    },
  },
  modal: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 500,
    bgcolor: 'white',
    boxShadow: 24,
    p: 4,
    borderRadius: '12px',
    textAlign: 'center',
  },
  webcam: {
    width: '100%',
    height: 'auto',
    borderRadius: '10px',
  },
  capturedImage: {
    width: '100%',
    height: 'auto',
    borderRadius: '10px',
  }
};

export default HomePage;
