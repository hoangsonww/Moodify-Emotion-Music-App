import React from "react";
import { Button } from "@mui/material";

const FacialInput = () => {
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    console.log("Facial Input File:", file);
  };

  return (
    <>
      <input
        accept="video/*,image/*"
        style={{ display: "none" }}
        id="raised-button-file"
        multiple
        type="file"
        onChange={handleFileUpload}
      />
      <label htmlFor="raised-button-file">
        <Button variant="contained" component="span">
          Upload Video/Image
        </Button>
      </label>
    </>
  );
};

export default FacialInput;
