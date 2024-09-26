import React, { useState } from 'react';
import { Button, Box, TextField } from '@mui/material';
import InputModal from './Modal';
import { useNavigate } from 'react-router-dom';
import { analyzeText, analyzeSpeech, analyzeFacial } from '../utils/api';

const Home = () => {
  const [openModal, setOpenModal] = useState(true);
  const [inputType, setInputType] = useState('');
  const [text, setText] = useState('');
  const navigate = useNavigate();

  const handleCloseModal = () => setOpenModal(false);

  const handleOption = (type) => {
    setInputType(type);
    handleCloseModal();
  };

  const handleSubmitText = async (e) => {
    e.preventDefault();
    const response = await analyzeText(text);
    navigate('/results', { state: response.data });
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'white' }}>
      <InputModal open={openModal} handleClose={handleCloseModal} handleOption={handleOption} />
      {inputType === 'text' && (
        <form onSubmit={handleSubmitText}>
          <TextField
            label="Enter your text"
            variant="outlined"
            multiline
            rows={4}
            fullWidth
            value={text}
            onChange={(e) => setText(e.target.value)}
            sx={{ mb: 2, boxShadow: 2 }}
          />
          <Button type="submit" variant="contained" color="secondary">
            Submit
          </Button>
        </form>
      )}
      {/* Handle other input types (speech, facial) here */}
    </Box>
  );
};

export default Home;
