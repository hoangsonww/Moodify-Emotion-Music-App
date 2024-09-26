import React from 'react';
import { Modal, Box, Button } from '@mui/material';

const style = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 400,
  bgcolor: 'white',
  boxShadow: 24,
  p: 4,
  borderRadius: 2,
};

const InputModal = ({ open, handleClose, handleOption }) => {
  return (
    <Modal open={open} onClose={handleClose}>
      <Box sx={style}>
        <h2>Select Input Method</h2>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => handleOption('facial')}
          sx={{ mb: 2 }}
        >
          Use Webcam / Upload Video
        </Button>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => handleOption('speech')}
          sx={{ mb: 2 }}
        >
          Record Speech / Upload Audio
        </Button>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => handleOption('text')}
        >
          Enter Text
        </Button>
      </Box>
    </Modal>
  );
};

export default InputModal;
