import React, { useEffect, useRef, useState } from "react";
import { Box, IconButton, Slider, Stack, Typography } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";

// A single global event bus so that starting one TrackPlayer pauses every
// other one currently playing on the page. Using a plain EventTarget keeps
// the API tiny and avoids dragging in a context provider.
const audioBus = new EventTarget();
const BUS_EVENT = "moodify-audio-play";

let _idSeed = 0;
const nextId = () => ++_idSeed;

const fmt = (s) => {
  if (!Number.isFinite(s) || s <= 0) return "0:00";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
};

/**
 * Inline mini-player for a 30-second Deezer preview.
 *
 * Props
 *   src       string — preview URL
 *   gradient  string[] — 2-3 stop colors used on the play button + progress
 *   isDark    bool
 *   dense     bool — slightly smaller layout for the Profile track list
 */
export default function TrackPlayer({
  src,
  gradient,
  isDark,
  dense = false,
  onPlay,
}) {
  const audioRef = useRef(null);
  const idRef = useRef(nextId());

  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [ready, setReady] = useState(false);

  // Lazily construct the Audio object so SSR / tests don't choke.
  useEffect(() => {
    const a = new Audio();
    a.preload = "metadata";
    a.crossOrigin = "anonymous";
    a.src = src;
    audioRef.current = a;

    const onTime = () => setPosition(a.currentTime);
    const onLoaded = () => {
      setDuration(a.duration || 30);
      setReady(true);
    };
    const onEnd = () => {
      setPlaying(false);
      setPosition(0);
    };
    const onError = () => {
      setReady(false);
      setPlaying(false);
    };

    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onLoaded);
    a.addEventListener("ended", onEnd);
    a.addEventListener("error", onError);

    const onOther = (e) => {
      if (e.detail !== idRef.current) {
        a.pause();
        setPlaying(false);
      }
    };
    audioBus.addEventListener(BUS_EVENT, onOther);

    return () => {
      a.pause();
      a.src = "";
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onLoaded);
      a.removeEventListener("ended", onEnd);
      a.removeEventListener("error", onError);
      audioBus.removeEventListener(BUS_EVENT, onOther);
    };
  }, [src]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
    } else {
      audioBus.dispatchEvent(
        new CustomEvent(BUS_EVENT, { detail: idRef.current }),
      );
      const p = a.play();
      if (p && typeof p.then === "function") {
        p.then(() => {
          setPlaying(true);
          if (typeof onPlay === "function") {
            try {
              onPlay();
            } catch {
              // analytics-only — never let it crash playback
            }
          }
        }).catch(() => setPlaying(false));
      } else {
        setPlaying(true);
        if (typeof onPlay === "function") {
          try {
            onPlay();
          } catch {
            /* noop */
          }
        }
      }
    }
  };

  const onSeek = (_, val) => {
    const a = audioRef.current;
    if (!a) return;
    const v = Array.isArray(val) ? val[0] : val;
    a.currentTime = v;
    setPosition(v);
  };

  const [g1, g2, g3] = gradient || ["#ff4d4d", "#ff7a59", "#ec4899"];
  const playBg = `linear-gradient(135deg, ${g1} 0%, ${g3} 100%)`;
  const sliderColor = g2 || g3;
  const max = duration > 0 ? duration : 30;
  const trackColor = isDark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.08)";

  return (
    <Stack
      direction="row"
      spacing={1.25}
      alignItems="center"
      sx={{
        width: "100%",
        py: dense ? 0.25 : 0.5,
      }}
    >
      <IconButton
        onClick={toggle}
        disabled={!ready && !playing}
        aria-label={playing ? "Pause preview" : "Play preview"}
        sx={{
          width: dense ? 34 : 38,
          height: dense ? 34 : 38,
          background: playBg,
          color: "#fff",
          flexShrink: 0,
          boxShadow: `0 6px 14px ${g1}55`,
          transition: "transform .15s ease, filter .15s ease",
          "&:hover": {
            background: playBg,
            filter: "brightness(1.08)",
            transform: "scale(1.04)",
          },
          "&.Mui-disabled": {
            background: playBg,
            opacity: 0.55,
            color: "#fff",
          },
        }}
      >
        {playing ? (
          <PauseIcon fontSize={dense ? "small" : "medium"} />
        ) : (
          <PlayArrowIcon fontSize={dense ? "small" : "medium"} />
        )}
      </IconButton>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Slider
          value={Math.min(position, max)}
          min={0}
          max={max}
          step={0.1}
          onChange={onSeek}
          aria-label="Track position"
          sx={{
            color: sliderColor,
            height: 4,
            py: "10px !important",
            "& .MuiSlider-rail": {
              opacity: 1,
              backgroundColor: trackColor,
            },
            "& .MuiSlider-track": {
              border: "none",
              background: `linear-gradient(90deg, ${g1}, ${g3})`,
            },
            "& .MuiSlider-thumb": {
              width: dense ? 10 : 12,
              height: dense ? 10 : 12,
              background: "#fff",
              border: `2px solid ${sliderColor}`,
              boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
              "&:hover, &.Mui-focusVisible": {
                boxShadow: `0 0 0 6px ${sliderColor}33`,
              },
              "&.Mui-active": { width: 14, height: 14 },
            },
          }}
        />
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ mt: -0.5 }}
        >
          <Typography
            sx={{
              fontFamily: "Poppins",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.4,
              color: isDark ? "#9aa" : "#888",
            }}
          >
            {fmt(position)}
          </Typography>
          <Stack direction="row" alignItems="center" spacing={0.4}>
            <VolumeUpIcon
              sx={{ fontSize: 12, color: isDark ? "#666" : "#aaa" }}
            />
            <Typography
              sx={{
                fontFamily: "Poppins",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.4,
                color: isDark ? "#9aa" : "#888",
              }}
            >
              {fmt(max - position)}
            </Typography>
          </Stack>
        </Stack>
      </Box>
    </Stack>
  );
}
