import { createTheme } from '@mui/material/styles';

const theme = createTheme({
    palette: {
        primary: {
            main: '#ff4d4d', // Orange-ish primary color
        },
        secondary: {
            main: '#ffffff', // White secondary color
        },
    },
    typography: {
        h4: {
            fontWeight: 600,
        },
    },
});

export default theme;
