// Post-sign-up "set up a passkey?" prompt.
//
// Shown right after a successful registration (Register.js). Deliberately a
// styled in-app modal -- never a browser confirm()/alert() -- so it matches
// the Moodify look. Runs the WebAuthn enrollment ceremony inline using the
// access token held in Register's state (tokens aren't persisted to
// localStorage until the user finishes or skips this step).

import React, { useContext, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  IconButton,
  TextField,
  Typography,
} from "@mui/material";
import {
  BoltOutlined,
  Close,
  Fingerprint,
  GppGoodOutlined,
  PhonelinkLock,
} from "@mui/icons-material";

import { DarkModeContext } from "../../context/DarkModeContext";
import { useToast } from "../Toast";
import { registerPasskey, PasskeyError } from "../../services/passkeys";

const PERKS = [
  {
    icon: <BoltOutlined />,
    title: "Faster sign-in",
    body: "Unlock with Face ID, your fingerprint, or screen lock — no password to type.",
  },
  {
    icon: <GppGoodOutlined />,
    title: "Phishing-resistant",
    body: "Your passkey only works on Moodify and never leaves your device.",
  },
  {
    icon: <PhonelinkLock />,
    title: "Works across devices",
    body: "Syncs with your iCloud Keychain or Google Password Manager.",
  },
];

const PasskeyPromptModal = ({ open, accessToken, onSkip, onCreated }) => {
  const { isDarkMode } = useContext(DarkModeContext);
  const toast = useToast();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const styles = getStyles(isDarkMode);

  const handleCreate = async () => {
    setBusy(true);
    try {
      const passkey = await registerPasskey({
        name: name.trim() || undefined,
        accessToken,
      });
      toast.success("Passkey created — you can now sign in with it.");
      onCreated(passkey);
    } catch (error) {
      // A dismissed OS prompt isn't a failure worth a scary error.
      if (error instanceof PasskeyError && error.code === "cancelled") {
        toast.info("No problem — you can add a passkey anytime from Account.");
      } else {
        toast.error(
          (error instanceof PasskeyError && error.message) ||
            "Couldn't create a passkey. You can try again later from Account.",
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onSkip}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: styles.paper }}
    >
      {/* Brand hero */}
      <Box sx={styles.hero}>
        {!busy && (
          <IconButton
            onClick={onSkip}
            aria-label="Close"
            size="small"
            sx={styles.heroClose}
          >
            <Close fontSize="small" />
          </IconButton>
        )}
        <Box sx={styles.heroMark}>
          <Fingerprint sx={{ color: "#fff", fontSize: 34 }} />
        </Box>
        <Typography sx={styles.heroTitle}>Set up a passkey</Typography>
        <Typography sx={styles.heroSub}>
          A safer, faster way to sign in to Moodify.
        </Typography>
      </Box>

      <Box sx={styles.body}>
        <Box sx={styles.perks}>
          {PERKS.map((perk) => (
            <Box key={perk.title} sx={styles.perk}>
              <Box sx={styles.perkIcon}>{perk.icon}</Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={styles.perkTitle}>{perk.title}</Typography>
                <Typography sx={styles.perkBody}>{perk.body}</Typography>
              </Box>
            </Box>
          ))}
        </Box>

        <TextField
          label={"Name this passkey\u00a0\u00a0"}
          placeholder="e.g. My iPhone"
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          size="small"
          disabled={busy}
          inputProps={{ maxLength: 60 }}
          sx={styles.field}
          // notched + shrink kept in lockstep so the outline's legend gap is
          // always cut. The field carries a placeholder, which floats the
          // label up; without forcing notched the outline draws a solid line
          // straight through the floated label text.
          InputProps={{ notched: true, style: styles.inputText }}
          InputLabelProps={{ shrink: true, style: styles.inputLabel }}
        />

        <Button
          fullWidth
          onClick={handleCreate}
          disabled={busy}
          startIcon={!busy && <Fingerprint />}
          sx={styles.cta}
        >
          {busy ? (
            <CircularProgress size={22} sx={{ color: "#fff" }} />
          ) : (
            "Create passkey"
          )}
        </Button>
        <Button fullWidth onClick={onSkip} disabled={busy} sx={styles.skip}>
          Maybe later
        </Button>
      </Box>
    </Dialog>
  );
};

const getStyles = (isDark) => ({
  paper: {
    borderRadius: "20px",
    overflow: "hidden",
    backgroundColor: isDark ? "#1f1f1f" : "#ffffff",
    color: isDark ? "#fff" : "#1a1a1a",
    boxShadow: isDark
      ? "0 24px 60px rgba(0,0,0,0.6)"
      : "0 24px 60px rgba(255,77,77,0.22)",
  },
  hero: {
    position: "relative",
    padding: "30px 28px 26px",
    textAlign: "center",
    color: "#fff",
    background: "linear-gradient(135deg, #ff4d4d 0%, #ff7a59 100%)",
    overflow: "hidden",
    "&::after": {
      content: '""',
      position: "absolute",
      inset: 0,
      background:
        "radial-gradient(70% 70% at 0% 0%, rgba(255,255,255,0.22) 0%, transparent 60%)",
      pointerEvents: "none",
    },
  },
  heroClose: {
    position: "absolute",
    top: 10,
    right: 10,
    color: "rgba(255,255,255,0.9)",
    background: "rgba(255,255,255,0.12)",
    "&:hover": { background: "rgba(255,255,255,0.22)" },
    zIndex: 1,
  },
  heroMark: {
    width: 64,
    height: 64,
    borderRadius: "18px",
    margin: "0 auto 14px",
    background: "rgba(255,255,255,0.2)",
    backdropFilter: "blur(6px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
    position: "relative",
    zIndex: 1,
  },
  heroTitle: {
    fontFamily: "Poppins",
    fontWeight: 800,
    fontSize: 22,
    letterSpacing: "-0.02em",
    position: "relative",
    zIndex: 1,
  },
  heroSub: {
    fontFamily: "Poppins",
    fontSize: 13.5,
    opacity: 0.94,
    mt: 0.5,
    position: "relative",
    zIndex: 1,
  },
  body: { padding: "22px 26px 26px" },
  perks: { display: "flex", flexDirection: "column", gap: 1.5, mb: 2.5 },
  perk: { display: "flex", alignItems: "flex-start", gap: 1.5 },
  perkIcon: {
    width: 38,
    height: 38,
    flexShrink: 0,
    borderRadius: "11px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#ff4d4d",
    background: "rgba(255,77,77,0.12)",
  },
  perkTitle: {
    fontFamily: "Poppins",
    fontWeight: 700,
    fontSize: 14.5,
    color: isDark ? "#fff" : "#1a1a1a",
  },
  perkBody: {
    fontFamily: "Poppins",
    fontSize: 12.5,
    lineHeight: 1.45,
    color: isDark ? "#aaa" : "#666",
  },
  field: {
    mb: 2,
    "& .MuiOutlinedInput-root": {
      borderRadius: "12px",
      "&.Mui-focused fieldset": { borderColor: "#ff4d4d" },
    },
  },
  inputText: {
    fontFamily: "Poppins",
    fontSize: 14,
    color: isDark ? "#fff" : "#1a1a1a",
  },
  inputLabel: { fontFamily: "Poppins", color: isDark ? "#bbb" : "#666" },
  cta: {
    py: 1.35,
    borderRadius: "999px",
    fontFamily: "Poppins",
    fontSize: 15,
    fontWeight: 700,
    textTransform: "none",
    color: "#fff",
    background: "linear-gradient(135deg, #ff4d4d 0%, #ff6b6b 100%)",
    boxShadow: "0 10px 24px rgba(255,77,77,0.35)",
    transition: "transform .2s ease, box-shadow .2s ease",
    "&:hover": {
      background: "linear-gradient(135deg, #ff5e5e 0%, #ff7d7d 100%)",
      boxShadow: "0 14px 30px rgba(255,77,77,0.45)",
      transform: "translateY(-1px)",
    },
    "&.Mui-disabled": { color: "#fff", opacity: 0.8 },
    mb: 1,
  },
  skip: {
    py: 1.1,
    borderRadius: "999px",
    fontFamily: "Poppins",
    fontSize: 14,
    fontWeight: 600,
    textTransform: "none",
    color: isDark ? "#bbb" : "#777",
    "&:hover": { background: "rgba(255,77,77,0.06)", color: "#ff4d4d" },
  },
});

export default PasskeyPromptModal;
