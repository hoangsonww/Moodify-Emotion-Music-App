import React from "react";

const RecommendationsPage = () => {
  return (
    <div style={{ padding: "20px", fontFamily: "Poppins" }}>
      <h1>Music Recommendations</h1>

      <p>Here are some music recommendations based on your mood:</p>

      <div
        style={{ display: "flex", justifyContent: "center", marginTop: "20px" }}
      >
        <div
          style={{
            width: "300px",
            padding: "20px",
            border: "1px solid #ccc",
            borderRadius: "5px",
            margin: "10px",
          }}
        >
          <h3>Track 1</h3>
          <p>Artist: Artist 1</p>
          <audio controls style={{ width: "100%" }}>
            <source src="track1.mp3" type="audio/mpeg" />
            Your browser does not support the audio element.
          </audio>
          <a href="https://open.spotify.com" target="_blank" rel="noreferrer">
            Listen on Spotify
          </a>
        </div>

        <div
          style={{
            width: "300px",
            padding: "20px",
            border: "1px solid #ccc",
            borderRadius: "5px",
            margin: "10px",
          }}
        >
          <h3>Track 2</h3>
          <p>Artist: Artist 2</p>
          <audio controls style={{ width: "100%" }}>
            <source src="track2.mp3" type="audio/mpeg" />
            Your browser does not support the audio element.
          </audio>
          <a href="https://open.spotify.com" target="_blank" rel="noreferrer">
            Listen on Spotify
          </a>
        </div>

        <div
          style={{
            width: "300px",
            padding: "20px",
            border: "1px solid #ccc",
            borderRadius: "5px",
            margin: "10px",
          }}
        >
          <h3>Track 3</h3>
          <p>Artist: Artist 3</p>
          <audio controls style={{ width: "100%" }}>
            <source src="track3.mp3" type="audio/mpeg" />
            Your browser does not support the audio element.
          </audio>
          <a href="https://open.spotify.com" target="_blank" rel="noreferrer">
            Listen on Spotify
          </a>
        </div>
      </div>
    </div>
  );
};

export default RecommendationsPage;
