import { Box, Button, TextField } from "@mui/material";

const TextInput = () => {
  return (
    <Box sx={{ display: "flex", flexDirection: "column" }}>
      <TextField
        id="text-input"
        label={"Enter Text\u00a0\u00a0"}
        variant="outlined"
        fullWidth
      />
      <Button variant="contained" color="primary">
        Submit
      </Button>
    </Box>
  );
};

export default TextInput;
