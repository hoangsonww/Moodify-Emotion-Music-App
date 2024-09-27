import React, { useState } from 'react';
import { Box, Button, Modal, Typography } from '@mui/material';
import FacialInput from './MoodInput/FacialInput';
import SpeechInput from './MoodInput/SpeechInput';
import TextInput from './MoodInput/TextInput';

const modalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 400,
  bgcolor: 'white',
  boxShadow: 24,
  p: 4,
  borderRadius: '10px',
  fontFamily: 'Poppins'
};

const ModalComponent = ({ open, handleClose }) => {
  const [inputType, setInputType] = useState('');

  const renderContent = () => {
    switch (inputType) {
      case 'facial':
        return <FacialInput />;
      case 'speech':
        return <SpeechInput />;
      case 'text':
        return <TextInput />;
      default:
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Button variant="contained" color="primary" onClick={() => setInputType('facial')}>
                Upload/Record Facial Expression
              </Button>
              <Button variant="contained" color="primary" onClick={() => setInputType('speech')}>
                Upload/Record Speech
              </Button>
              <Button variant="contained" color="primary" onClick={() => setInputType('text')}>
                Enter Text
              </Button>
            </Box>
        );
    }
  };

  return (
      <Modal open={open} onClose={handleClose}>
        <Box sx={modalStyle}>
          <Typography variant="h6" align="center" gutterBottom>
            Choose Input Method
          </Typography>
          {renderContent()}
          <Button sx={{ mt: 2 }} color="secondary" onClick={() => setInputType('')}>
            Back
          </Button>
        </Box>
      </Modal>
  );
};

export default ModalComponent;
