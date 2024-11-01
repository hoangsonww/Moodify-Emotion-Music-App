import React, { useState, useContext } from "react";
import { useLocation } from "react-router-dom";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Paper,
  Button,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  CircularProgress,
} from "@mui/material";
import axios from "axios";
import { DarkModeContext } from "../context/DarkModeContext";

const ResultsPage = () => {
  const location = useLocation();
  const { emotion, recommendations } = location.state || {
    emotion: "None",
    recommendations: [],
  };
  const [loading, setLoading] = useState(false);
  const [selectedMood, setSelectedMood] = useState(emotion || "None");
  const [displayRecommendations, setDisplayRecommendations] = useState(
    recommendations || [],
  );
  const [selectedMarket, setSelectedMarket] = useState("");

  // Use DarkModeContext for dark mode state
  const { isDarkMode } = useContext(DarkModeContext);

  // Function to handle market change
  const handleMarketChange = async (event) => {
    const newMarket = event.target.value;
    setSelectedMarket(newMarket);
    setLoading(true);

    try {
      const response = await axios.post(
        "https://moodify-emotion-music-app.onrender.com/api/music_recommendation/",
        {
          emotion: selectedMood.toLowerCase(), // Keep the current mood
          market: newMarket || undefined, // Pass market if selected, else undefined
        },
      );

      const newRecommendations = response.data.recommendations || [];
      setDisplayRecommendations(newRecommendations);
    } catch (error) {
      console.error("Error fetching recommendations:", error);
    } finally {
      setLoading(false);
    }
  };

  // Function to handle mood change
  const handleMoodChange = async (event) => {
    const newMood = event.target.value;
    setSelectedMood(newMood);
    setLoading(true);

    try {
      const response = await axios.post(
        "https://moodify-emotion-music-app.onrender.com/api/music_recommendation/",
        {
          emotion: newMood.toLowerCase(),
          market: selectedMarket || undefined, // Pass market if selected, else undefined
        },
      );

      const newRecommendations = response.data.recommendations || [];
      setDisplayRecommendations(newRecommendations);
    } catch (error) {
      console.error("Error fetching recommendations:", error);
    } finally {
      setLoading(false);
    }
  };

  const marketToLanguage = {
    AD: "Andorra",
    AE: "United Arab Emirates",
    AG: "Antigua and Barbuda",
    AL: "Albania",
    AM: "Armenia",
    AO: "Angola",
    AR: "Argentina",
    AT: "Austria",
    AU: "Australia",
    AZ: "Azerbaijan",
    BA: "Bosnia and Herzegovina",
    BB: "Barbados",
    BD: "Bangladesh",
    BE: "Belgium",
    BF: "Burkina Faso",
    BG: "Bulgaria",
    BH: "Bahrain",
    BI: "Burundi",
    BJ: "Benin",
    BN: "Brunei",
    BO: "Bolivia",
    BR: "Brazil",
    BS: "Bahamas",
    BT: "Bhutan",
    BW: "Botswana",
    BY: "Belarus",
    BZ: "Belize",
    CA: "Canada",
    CD: "Democratic Republic of the Congo",
    CG: "Republic of the Congo",
    CH: "Switzerland",
    CI: "Ivory Coast",
    CL: "Chile",
    CM: "Cameroon",
    CO: "Colombia",
    CR: "Costa Rica",
    CV: "Cape Verde",
    CW: "Curaçao",
    CY: "Cyprus",
    CZ: "Czech Republic",
    DE: "Germany",
    DJ: "Djibouti",
    DK: "Denmark",
    DM: "Dominica",
    DO: "Dominican Republic",
    DZ: "Algeria",
    EC: "Ecuador",
    EE: "Estonia",
    EG: "Egypt",
    ES: "Spain",
    ET: "Ethiopia",
    FI: "Finland",
    FJ: "Fiji",
    FM: "Micronesia",
    FR: "France",
    GA: "Gabon",
    GB: "United Kingdom",
    GD: "Grenada",
    GE: "Georgia",
    GH: "Ghana",
    GM: "Gambia",
    GN: "Guinea",
    GQ: "Equatorial Guinea",
    GR: "Greece",
    GT: "Guatemala",
    GW: "Guinea-Bissau",
    GY: "Guyana",
    HK: "Hong Kong",
    HN: "Honduras",
    HR: "Croatia",
    HT: "Haiti",
    HU: "Hungary",
    ID: "Indonesia",
    IE: "Ireland",
    IL: "Israel",
    IN: "India",
    IQ: "Iraq",
    IS: "Iceland",
    IT: "Italy",
    JM: "Jamaica",
    JO: "Jordan",
    JP: "Japan",
    KE: "Kenya",
    KG: "Kyrgyzstan",
    KH: "Cambodia",
    KI: "Kiribati",
    KM: "Comoros",
    KN: "Saint Kitts and Nevis",
    KR: "South Korea",
    KW: "Kuwait",
    KZ: "Kazakhstan",
    LA: "Laos",
    LB: "Lebanon",
    LC: "Saint Lucia",
    LI: "Liechtenstein",
    LK: "Sri Lanka",
    LR: "Liberia",
    LS: "Lesotho",
    LT: "Lithuania",
    LU: "Luxembourg",
    LV: "Latvia",
    LY: "Libya",
    MA: "Morocco",
    MC: "Monaco",
    MD: "Moldova",
    ME: "Montenegro",
    MG: "Madagascar",
    MH: "Marshall Islands",
    MK: "North Macedonia",
    ML: "Mali",
    MN: "Mongolia",
    MO: "Macao",
    MR: "Mauritania",
    MT: "Malta",
    MU: "Mauritius",
    MV: "Maldives",
    MW: "Malawi",
    MX: "Mexico",
    MY: "Malaysia",
    MZ: "Mozambique",
    NA: "Namibia",
    NE: "Niger",
    NG: "Nigeria",
    NI: "Nicaragua",
    NL: "Netherlands",
    NO: "Norway",
    NP: "Nepal",
    NR: "Nauru",
    NZ: "New Zealand",
    OM: "Oman",
    PA: "Panama",
    PE: "Peru",
    PG: "Papua New Guinea",
    PH: "Philippines",
    PK: "Pakistan",
    PL: "Poland",
    PR: "Puerto Rico",
    PS: "Palestine",
    PT: "Portugal",
    PW: "Palau",
    PY: "Paraguay",
    QA: "Qatar",
    RO: "Romania",
    RS: "Serbia",
    RW: "Rwanda",
    SA: "Saudi Arabia",
    SB: "Solomon Islands",
    SC: "Seychelles",
    SE: "Sweden",
    SG: "Singapore",
    SI: "Slovenia",
    SK: "Slovakia",
    SL: "Sierra Leone",
    SM: "San Marino",
    SN: "Senegal",
    SR: "Suriname",
    ST: "São Tomé and Príncipe",
    SV: "El Salvador",
    SZ: "Eswatini",
    TD: "Chad",
    TG: "Togo",
    TH: "Thailand",
    TJ: "Tajikistan",
    TL: "Timor-Leste",
    TN: "Tunisia",
    TO: "Tonga",
    TR: "Turkey",
    TT: "Trinidad and Tobago",
    TV: "Tuvalu",
    TW: "Taiwan",
    TZ: "Tanzania",
    UA: "Ukraine",
    UG: "Uganda",
    US: "United States",
    UY: "Uruguay",
    UZ: "Uzbekistan",
    VC: "Saint Vincent and the Grenadines",
    VE: "Venezuela",
    VN: "Vietnam",
    VU: "Vanuatu",
    WS: "Samoa",
    XK: "Kosovo",
    ZA: "South Africa",
    ZM: "Zambia",
    ZW: "Zimbabwe",
  };

  const styles = getStyles(isDarkMode); // Dynamically get styles based on dark mode

  return (
    <div style={styles.container}>
      <Typography variant="h5" style={styles.emotionText}>
        <strong>
          Detected Mood:{" "}
          <span style={styles.emotion}>
            {selectedMood.charAt(0).toUpperCase() + selectedMood.slice(1)}
          </span>
        </strong>
      </Typography>

      <Typography
        variant="body2"
        style={{
          color: isDarkMode ? "#cccccc" : "#999",
          marginBottom: "20px",
          textAlign: "center",
          font: "inherit",
          fontSize: "14px",
        }}
      >
        Or select a mood from the dropdown below to get recommendations based on
        that mood:
      </Typography>

      {/* Dropdown to select mood */}
      <FormControl
        fullWidth
        style={{ marginBottom: "20px", maxWidth: "300px" }}
      >
        <InputLabel
          sx={{
            fontFamily: "Poppins",
            color: isDarkMode ? "#ffffff" : "#000000", // Label color change based on dark mode
          }}
        >
          Select Mood
        </InputLabel>
        <Select
          value={selectedMood}
          onChange={handleMoodChange}
          variant={"outlined"}
          label="Select Mood"
          sx={{
            fontFamily: "Poppins",
            color: isDarkMode ? "#ffffff" : "#000000", // Dropdown text color based on dark mode
            ".MuiOutlinedInput-notchedOutline": {
              fontFamily: "Poppins",
              borderColor: isDarkMode ? "#ffffff" : "#000000", // Border color
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              fontFamily: "Poppins",
              borderColor: isDarkMode ? "#ffffff" : "#000000", // Border color when focused
            },
            ".MuiSvgIcon-root": {
              fontFamily: "Poppins",
              color: isDarkMode ? "#ffffff" : "#000000", // Arrow icon color
            },
          }}
        >
          {Object.keys(emotionToGenre).map((mood, index) => (
            <MenuItem
              key={index}
              value={mood}
              style={{ fontFamily: "Poppins" }}
            >
              {mood.charAt(0).toUpperCase() + mood.slice(1)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Explanation text for recommendations */}
      <Typography
        variant="body2"
        style={{
          color: isDarkMode ? "#cccccc" : "#999",
          textAlign: "center",
          font: "inherit",
          fontSize: "12px",
          marginBottom: "20px",
        }}
      >
        Recommendations are based on the mood you inputted and songs recommended
        by Spotify users in the region you selected. Click on the "Listen on
        Spotify" button to listen to the song on Spotify.
      </Typography>

      <Paper elevation={4} style={styles.resultsContainer}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
            flexWrap: "wrap",
          }}
        >
          <Typography
            variant="h6"
            style={{
              fontFamily: "Poppins",
              color: isDarkMode ? "#ffffff" : "#333",
              marginBottom: "10px",
              flex: "1 1 0%", // Allows the title to take available width on the left
            }}
          >
            Your Recommendations
          </Typography>

          <FormControl
            style={{
              marginTop: "10px",
              marginBottom: "20px",
              minWidth: "150px", // Set a minimum width for the dropdown to avoid it being too small
              marginLeft: "auto", // Pushes the dropdown to the right end
              maxWidth: "300px", // Optional: If you want a maximum width for the dropdown
              flex: "0 1 auto", // Allows the dropdown to take up as much width as it needs
            }}
          >
            <InputLabel
              sx={{
                fontFamily: "Poppins",
                color: isDarkMode ? "#ffffff" : "#000000",
              }}
            >
              Select Region
            </InputLabel>
            <Select
              value={selectedMarket}
              onChange={handleMarketChange}
              variant="outlined"
              label="Select Region"
              sx={{
                fontFamily: "Poppins",
                color: isDarkMode ? "#ffffff" : "#000000",
                ".MuiOutlinedInput-notchedOutline": {
                  borderColor: isDarkMode ? "#ffffff" : "#000000",
                },
                "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                  borderColor: isDarkMode ? "#ffffff" : "#000000",
                },
                ".MuiSvgIcon-root": {
                  color: isDarkMode ? "#ffffff" : "#000000",
                },
              }}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {Object.entries(marketToLanguage).map(([code, country]) => (
                <MenuItem
                  key={code}
                  value={code}
                  sx={{ fontFamily: "Poppins" }}
                >
                  {country}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </div>

        <Box sx={styles.recommendationsList}>
          {loading && (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                marginTop: "20px",
              }}
            >
              {/* Loading Spinner */}
              <CircularProgress style={{ color: "#ff4d4d" }} />
              {/* Loading Message */}
              <Typography
                variant="body2"
                style={{
                  color: isDarkMode ? "#cccccc" : "#999",
                  marginTop: "10px",
                  textAlign: "center",
                  font: "inherit",
                  fontSize: "14px",
                }}
              >
                Loading recommendations...
              </Typography>
            </Box>
          )}
          {displayRecommendations.length > 0 ? (
            displayRecommendations.map((rec, index) => (
              <Card key={index} sx={styles.recommendationCard}>
                <Box sx={styles.cardContentContainer}>
                  {/* Left Half: Image */}
                  <Box sx={styles.imageContainer}>
                    <img
                      src={rec.image_url}
                      alt={`${rec.name} album cover`}
                      style={styles.albumImage}
                    />
                  </Box>

                  {/* Right Half: Song Details */}
                  <CardContent sx={styles.cardDetails}>
                    <Typography variant="subtitle1" style={styles.songTitle}>
                      {rec.name}
                    </Typography>
                    <Typography variant="body2" style={styles.artistName}>
                      {rec.artist}
                    </Typography>
                    {rec.preview_url && (
                      <audio controls style={styles.audioPlayer}>
                        <source src={rec.preview_url} type="audio/mpeg" />
                        Your browser does not support the audio element.
                      </audio>
                    )}
                    <Button
                      href={rec.external_url}
                      target="_blank"
                      variant="contained"
                      color="primary"
                      style={styles.spotifyButton}
                    >
                      Listen on Spotify
                    </Button>
                  </CardContent>
                </Box>
              </Card>
            ))
          ) : (
            <Typography
              variant="body2"
              style={{
                color: isDarkMode ? "#cccccc" : "#999",
                marginTop: "20px",
                textAlign: "center",
                font: "inherit",
                fontSize: "14px",
              }}
            >
              No recommendations available. Try inputting a new image, changing
              the mood, entering some texts, or recording something. If the
              error persists, it may be that our servers are down and it may
              take up to 3 minutes to restart, or it may be that Spotify's API
              is down.
            </Typography>
          )}
        </Box>
      </Paper>
    </div>
  );
};

// Define the mood to genre mapping
const emotionToGenre = {
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
  embarassed: "blues",
  overwhelmed: "chill",
  amused: "party",
};

// Dynamically get styles based on dark mode
const getStyles = (isDarkMode) => ({
  container: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: isDarkMode ? "#121212" : "#f9f9f9",
    fontFamily: "Poppins",
    padding: "20px",
    transition: "background-color 0.3s ease",
  },
  emotionText: {
    marginBottom: "15px",
    color: isDarkMode ? "#ffffff" : "#333",
    fontFamily: "Poppins",
  },
  emotion: {
    color: "#ff4d4d",
    fontWeight: "bold",
  },
  resultsContainer: {
    padding: "20px",
    borderRadius: "12px",
    width: "90%",
    maxWidth: "1000px",
    height: "650px",
    boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.1)",
    backgroundColor: isDarkMode ? "#1f1f1f" : "white",
    overflowY: "auto",
    transition: "background-color 0.3s ease",
  },
  recommendationsList: {
    display: "flex",
    flexDirection: "column",
    gap: "15px",
    padding: "10px 0",
    alignItems: "center",
  },
  recommendationCard: {
    width: "100%",
    maxWidth: "800px",
    borderRadius: "10px",
    padding: "15px",
    boxShadow: "0px 2px 10px rgba(0, 0, 0, 0.15)",
    backgroundColor: isDarkMode ? "#333333" : "#ffffff",
    display: "flex",
    font: "inherit",
    flexDirection: "row",
    gap: "10px",
    transition: "background-color 0.3s ease",
  },
  cardContentContainer: {
    display: "flex",
    flexDirection: "row",
    width: "100%",
  },
  imageContainer: {
    flex: 1,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  albumImage: {
    width: "100%",
    maxWidth: "150px",
    height: "auto",
    borderRadius: "10px",
    boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.2)",
  },
  cardDetails: {
    flex: 2,
    display: "flex",
    font: "inherit",
    flexDirection: "column",
    justifyContent: "center",
  },
  songTitle: {
    font: "inherit",
    fontSize: "1rem",
    fontWeight: "bold",
    color: isDarkMode ? "#ffffff" : "#333",
    marginBottom: "5px",
  },
  artistName: {
    font: "inherit",
    fontSize: "0.9rem",
    color: isDarkMode ? "#cccccc" : "#555",
    marginBottom: "8px",
  },
  audioPlayer: {
    width: "100%",
    marginTop: "10px",
    borderRadius: "5px",
  },
  spotifyButton: {
    marginTop: "10px",
    backgroundColor: "#1DB954",
    color: "#fff",
    textTransform: "none",
    font: "inherit",
    fontWeight: "normal",
    "&:hover": {
      backgroundColor: "#1ed760",
    },
    transition: "background-color 0.3s ease",
  },
});

export default ResultsPage;
