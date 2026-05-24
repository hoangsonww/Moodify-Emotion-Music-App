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
import {
  CANONICAL_EMOTIONS,
  sendMoodFeedback,
} from "../services/feedback";

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

  // Color cues match the rest of the app: warm primary on light, soft
  // panel on dark. Sticking to neutral tones so it doesn't compete with
  // the hero detected-mood text.
  const panelBg = isDarkMode
    ? "rgba(255,255,255,0.04)"
    : "rgba(255,77,77,0.04)";
  const border = isDarkMode
    ? "1px solid rgba(255,255,255,0.08)"
    : "1px solid rgba(255,77,77,0.18)";
  const textColor = isDarkMode ? "#eaeaea" : "#1a1a1a";
  const subText = isDarkMode ? "#bbbbbb" : "#555555";

  if (stage === "done") {
    return (
      <Box
        sx={{
          background: panelBg,
          border,
          borderRadius: "12px",
          px: 2,
          py: 1.25,
          mt: 1.5,
        }}
      >
        <Typography
          sx={{
            fontFamily: "Poppins",
            fontSize: 13,
            color: subText,
            display: "flex",
            alignItems: "center",
            gap: 0.75,
          }}
        >
          <CheckCircleOutlineIcon sx={{ fontSize: 16, color: "#22c55e" }} />
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
        border,
        borderRadius: "12px",
        px: 2,
        py: 1.25,
        mt: 1.5,
      }}
    >
      {stage === "ask" && (
        <Stack
          direction={{ xs: "column", sm: "row" }}
          alignItems={{ xs: "stretch", sm: "center" }}
          spacing={1}
        >
          <Typography
            sx={{
              fontFamily: "Poppins",
              fontSize: 13.5,
              color: textColor,
              flex: 1,
            }}
          >
            Was that right?
          </Typography>
          <Stack
            direction="row"
            spacing={0.75}
            sx={{ flexShrink: 0, justifyContent: { xs: "flex-end", sm: "flex-start" } }}
          >
            <Button
              size="small"
              variant="contained"
              startIcon={<CheckCircleOutlineIcon />}
              onClick={onConfirm}
              disabled={busy}
              sx={{
                textTransform: "none",
                fontFamily: "Poppins",
                fontWeight: 600,
                borderRadius: "8px",
                background: "#22c55e",
                "&:hover": { background: "#16a34a" },
              }}
            >
              Yes
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<CancelOutlinedIcon />}
              onClick={() => setStage("choose")}
              disabled={busy}
              sx={{
                textTransform: "none",
                fontFamily: "Poppins",
                fontWeight: 600,
                borderRadius: "8px",
                borderColor: isDarkMode
                  ? "rgba(255,255,255,0.2)"
                  : "rgba(0,0,0,0.2)",
                color: textColor,
              }}
            >
              No, it was…
            </Button>
            <Tooltip title="Skip">
              <IconButton
                size="small"
                onClick={() => setStage("done")}
                sx={{ color: subText }}
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
              color: subText,
              mb: 0.75,
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
                  fontWeight: 500,
                  background: isDarkMode
                    ? "rgba(255,255,255,0.08)"
                    : "rgba(0,0,0,0.04)",
                  color: textColor,
                  "&:hover": {
                    background: isDarkMode
                      ? "rgba(255,255,255,0.14)"
                      : "rgba(255,77,77,0.16)",
                  },
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
                color: subText,
                borderColor: isDarkMode
                  ? "rgba(255,255,255,0.2)"
                  : "rgba(0,0,0,0.2)",
              }}
            />
          </Stack>
        </Box>
      )}
    </Box>
  );
}
