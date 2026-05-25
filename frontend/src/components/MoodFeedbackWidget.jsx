// "Was this right?" widget shown under every detected mood.
//
// Three actions:
//   * ✓ Yes      -- POST { predicted=actual } (confirms; does NOT bump the
//                   calibration counter but still lands in the event log).
//   * ✗ No       -- opens a chip strip with the canonical emotions; the
//                   first tap fires the correction.
//   * Skip       -- collapses the widget without sending anything.
//
// Anonymous callers see nothing (the feedback API requires a JWT and the
// per-user calibration map / bandit have nowhere to land their signal).
//
// Once any tap fires, the widget switches into a "Thanks!" terminal
// state for the rest of the page render -- repeated voting would just
// pollute the log without any extra signal value.

import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import CloseIcon from "@mui/icons-material/Close";

import { isAuthenticated } from "../services/auth";
import { CANONICAL_EMOTIONS, sendMoodFeedback } from "../services/feedback";

const EMOTION_LABEL = {
  joy: "Joy",
  love: "Love",
  sadness: "Sadness",
  anger: "Anger",
  fear: "Fear",
  neutral: "Neutral",
};

/**
 * @param {object} props
 * @param {string} props.predicted    -- the label the model returned.
 * @param {string} [props.inputType]  -- "text" | "speech" | "facial".
 *                                       Defaults to "text".
 * @param {number} [props.confidence] -- optional softmax probability.
 * @param {string} [props.sessionId]  -- optional correlation id.
 * @param {boolean} [props.isDarkMode]
 * @param {function} [props.onCorrected] -- called with the corrected label
 *                                          when the user supplies one;
 *                                          consumers may want to re-issue
 *                                          recommendations against it.
 */
export default function MoodFeedbackWidget({
  predicted,
  inputType = "text",
  confidence = null,
  sessionId = null,
  isDarkMode = false,
  onCorrected = () => {},
}) {
  const [stage, setStage] = useState("ask"); // ask | choose | done
  const [busy, setBusy] = useState(false);

  // Re-arm the prompt whenever the predicted label changes -- a fresh
  // detection (or a user-driven mood switch on the results page) is a
  // brand-new chance to give feedback.
  useEffect(() => {
    setStage("ask");
    setBusy(false);
  }, [predicted, sessionId]);

  // Authentication gate: the feedback endpoint requires a JWT. Anonymous
  // users would just get a 401, so don't even show the prompt.
  if (!isAuthenticated()) return null;
  if (!predicted) return null;

  const onConfirm = async () => {
    if (busy) return;
    setBusy(true);
    await sendMoodFeedback({
      predicted,
      actual: predicted,
      inputType,
      confidence,
      sessionId,
    });
    setBusy(false);
    setStage("done");
  };

  const onPickCorrection = async (actual) => {
    if (busy) return;
    setBusy(true);
    const ok = await sendMoodFeedback({
      predicted,
      actual,
      inputType,
      confidence,
      sessionId,
    });
    setBusy(false);
    setStage("done");
    if (ok) onCorrected(actual);
  };

  // Frosted-glass panel so the widget stays legible against any mood
  // gradient backdrop. Solid-ish surface + subtle shadow gives it
  // visual weight; text colors stay high-contrast regardless of the
  // hero color sitting behind the panel.
  const panelBg = isDarkMode ? "rgba(20,20,28,0.92)" : "rgba(255,255,255,0.96)";
  const border = isDarkMode
    ? "1px solid rgba(255,255,255,0.1)"
    : "1px solid rgba(0,0,0,0.06)";
  const textColor = isDarkMode ? "#f1f1f4" : "#1a1a1a";
  const subText = isDarkMode ? "#aaaab4" : "#555555";
  const shadow = isDarkMode
    ? "0 8px 24px rgba(0,0,0,0.45)"
    : "0 8px 24px rgba(0,0,0,0.12)";

  const noBg = isDarkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)";
  const noBgHover = isDarkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.09)";

  if (stage === "done") {
    return (
      <Box
        sx={{
          background: panelBg,
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          border,
          borderRadius: "14px",
          px: 2,
          py: 1.5,
          mt: 2,
          boxShadow: shadow,
        }}
      >
        <Typography
          sx={{
            fontFamily: "Poppins",
            fontSize: 13.5,
            fontWeight: 500,
            color: subText,
            display: "flex",
            alignItems: "center",
            gap: 0.75,
          }}
        >
          <CheckCircleOutlineIcon sx={{ fontSize: 18, color: "#22c55e" }} />
          Thanks — we'll tune your detections.
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      data-testid="mood-feedback-widget"
      sx={{
        background: panelBg,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        border,
        borderRadius: "14px",
        px: 2,
        py: 1.5,
        mt: 2,
        boxShadow: shadow,
      }}
    >
      {stage === "ask" && (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          alignItems={{ xs: "stretch", sm: "center" }}
          spacing={{ xs: 1.25, sm: 1.5 }}
        >
          <Typography
            sx={{
              fontFamily: "Poppins",
              fontSize: 14,
              fontWeight: 600,
              color: textColor,
              flex: 1,
              letterSpacing: "-0.005em",
            }}
          >
            Was that right?
          </Typography>
          <Stack
            direction="row"
            spacing={0.75}
            alignItems="center"
            sx={{
              flexShrink: 0,
              justifyContent: { xs: "flex-end", sm: "flex-start" },
            }}
          >
            <Button
              size="small"
              variant="contained"
              disableElevation
              startIcon={<CheckCircleOutlineIcon />}
              onClick={onConfirm}
              disabled={busy}
              sx={{
                textTransform: "none",
                fontFamily: "Poppins",
                fontWeight: 700,
                fontSize: 13,
                borderRadius: "10px",
                px: 1.75,
                py: 0.6,
                background: "#22c55e",
                color: "#fff",
                boxShadow: "0 2px 6px rgba(34,197,94,0.35)",
                "&:hover": {
                  background: "#16a34a",
                  boxShadow: "0 3px 10px rgba(34,197,94,0.45)",
                },
              }}
            >
              Yes
            </Button>
            <Button
              size="small"
              variant="text"
              startIcon={<CancelOutlinedIcon />}
              onClick={() => setStage("choose")}
              disabled={busy}
              sx={{
                textTransform: "none",
                fontFamily: "Poppins",
                fontWeight: 700,
                fontSize: 13,
                borderRadius: "10px",
                px: 1.75,
                py: 0.6,
                color: textColor,
                background: noBg,
                "&:hover": { background: noBgHover },
              }}
            >
              No, it was…
            </Button>
            <Tooltip title="Skip">
              <IconButton
                size="small"
                onClick={() => setStage("done")}
                sx={{
                  color: subText,
                  width: 30,
                  height: 30,
                  "&:hover": { background: noBg },
                }}
                aria-label="Skip feedback"
              >
                <CloseIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      )}

      {stage === "choose" && (
        <Box>
          <Typography
            sx={{
              fontFamily: "Poppins",
              fontSize: 13,
              fontWeight: 500,
              color: subText,
              mb: 1,
            }}
          >
            Pick what you actually felt:
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={0.75}>
            {CANONICAL_EMOTIONS.filter((e) => e !== predicted).map((label) => (
              <Chip
                key={label}
                label={EMOTION_LABEL[label] || label}
                onClick={() => onPickCorrection(label)}
                disabled={busy}
                sx={{
                  fontFamily: "Poppins",
                  fontWeight: 600,
                  fontSize: 13,
                  height: 30,
                  background: noBg,
                  color: textColor,
                  "&:hover": { background: noBgHover },
                }}
              />
            ))}
            <Chip
              label="Cancel"
              variant="outlined"
              onClick={() => setStage("ask")}
              disabled={busy}
              sx={{
                fontFamily: "Poppins",
                fontWeight: 600,
                fontSize: 13,
                height: 30,
                color: subText,
                borderColor: isDarkMode
                  ? "rgba(255,255,255,0.18)"
                  : "rgba(0,0,0,0.14)",
              }}
            />
          </Stack>
        </Box>
      )}
    </Box>
  );
}
