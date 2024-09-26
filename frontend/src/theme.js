import { createTheme } from '@mui/material/styles';

const theme = createTheme({
    palette: {
        primary: {
            main: '#1976d2', // Blue primary color
        },
        secondary: {
            main: '#d32f2f', // Reddish secondary color
        },
    },
    typography: {
        h4: {
            fontWeight: 600,
        },
    },
});

export default theme;
