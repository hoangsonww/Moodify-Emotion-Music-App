import React from "react";
import { Button } from "@mui/material";

const SpeechInput = () => {
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    console.log("Speech Input File:", file);
  };

  return (
    <>
      <input
        accept="audio/*"
        style={{ display: "none" }}
        id="raised-button-file"
        multiple
        type="file"
        onChange={handleFileUpload}
      />
      <label htmlFor="raised-button-file">
        <Button variant="contained" component="span">
          Upload Audio
        </Button>
      </label>
    </>
  );
};

export default SpeechInput;
