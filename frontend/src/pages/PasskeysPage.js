import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  AddRounded,
  ArrowBackIosNew,
  CloudDoneOutlined,
  DeleteOutline,
  EditOutlined,
  Fingerprint,
  KeyRounded,
  LaptopMacOutlined,
  RestartAlt,
  SmartphoneOutlined,
  UsbOutlined,
  VpnKeyOutlined,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";

import { DarkModeContext } from "../context/DarkModeContext";
import { useToast } from "../components/Toast";
import {
  deletePasskey,
  isPasskeySupported,
  listPasskeys,
  PasskeyError,
  registerPasskey,
  renamePasskey,
} from "../services/passkeys";

const PASSKEY_NAME_MAX = 60;

// ---- formatting helpers ----
function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function timeAgo(iso) {
  if (!iso) return "Never used";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Never used";
  const sec = Math.round((Date.now() - then) / 1000);
  if (sec < 60) return "Just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min${min === 1 ? "" : "s"} ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} day${day === 1 ? "" : "s"} ago`;
  const mon = Math.round(day / 30);
  if (mon < 12) return `${mon} month${mon === 1 ? "" : "s"} ago`;
  return `${Math.round(mon / 12)} year${mon < 24 ? "" : "s"} ago`;
}

// Map the stored transports/device-type into a friendly label + icon.
function describeDevice(pk) {
  const t = pk.transports || [];
  if (t.includes("internal")) {
    return { label: "This device", Icon: LaptopMacOutlined };
  }
  if (t.includes("hybrid")) {
    return { label: "Phone or tablet", Icon: SmartphoneOutlined };
  }
  if (t.some((x) => ["usb", "nfc", "ble"].includes(x))) {
    return { label: "Security key", Icon: UsbOutlined };
  }
  return {
    label: pk.backed_up ? "Synced passkey" : "Passkey",
    Icon: KeyRounded,
  };
}

const PasskeysPage = () => {
  const { isDarkMode } = useContext(DarkModeContext);
  const navigate = useNavigate();
  const toast = useToast();
  const styles = useMemo(() => getStyles(isDarkMode), [isDarkMode]);
  const supported = useMemo(() => isPasskeySupported(), []);

  const [passkeys, setPasskeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // dialogs
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const fetchPasskeys = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listPasskeys();
      setPasskeys(list);
      setError("");
    } catch (err) {
      console.error("Failed to load passkeys:", err);
      setError("Couldn't load your passkeys. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPasskeys();
  }, [fetchPasskeys]);

  // ---- actions ----
  const handleAdd = async () => {
    setBusy(true);
    try {
      await registerPasskey({ name: addName.trim() || undefined });
      toast.success("Passkey added.");
      setAddOpen(false);
      setAddName("");
      fetchPasskeys();
    } catch (err) {
      if (err instanceof PasskeyError && err.code === "cancelled") {
        toast.info("Passkey setup cancelled.");
      } else if (
        err instanceof PasskeyError &&
        err.code === "already_registered"
      ) {
        toast.warning("This device already has a passkey for your account.");
      } else {
        toast.error(
          (err instanceof PasskeyError && err.message) ||
            "Couldn't add a passkey. Please try again.",
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async () => {
    const next = renameValue.trim();
    if (!next) {
      toast.warning("Enter a name for this passkey.");
      return;
    }
    setBusy(true);
    try {
      await renamePasskey(renameTarget.id, next);
      toast.success("Passkey renamed.");
      setRenameTarget(null);
      fetchPasskeys();
    } catch {
      toast.error("Couldn't rename this passkey.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await deletePasskey(deleteTarget.id);
      toast.success("Passkey removed.");
      setDeleteTarget(null);
      fetchPasskeys();
    } catch {
      toast.error("Couldn't remove this passkey.");
    } finally {
      setBusy(false);
    }
  };

  const openAdd = () => {
    setAddName("");
    setAddOpen(true);
  };

  return (
    <Box sx={styles.container}>
      <Box sx={styles.shell}>
        {/* ---------- HERO ---------- */}
        <Paper elevation={6} sx={styles.heroCard}>
          <Box sx={styles.heroBlobA} />
          <Box sx={styles.heroBlobB} />
          <Box sx={styles.heroTopRow}>
            <Button
              onClick={() => navigate("/profile")}
              startIcon={<ArrowBackIosNew sx={{ fontSize: 14 }} />}
              sx={styles.backBtn}
            >
              Profile
            </Button>
          </Box>
          <Box sx={styles.heroBody}>
            <Box sx={styles.heroMark}>
              <Fingerprint sx={{ color: "#fff", fontSize: 40 }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="overline" sx={styles.heroKicker}>
                Security
              </Typography>
              <Typography variant="h5" sx={styles.heroTitle}>
                Your passkeys
              </Typography>
              <Typography sx={styles.heroSub}>
                Sign in with Face ID, a fingerprint, or your screen lock — no
                password required.
              </Typography>
            </Box>
          </Box>
          <Box sx={styles.heroActionRow}>
            <Chip
              label={`${passkeys.length} passkey${passkeys.length === 1 ? "" : "s"}`}
              sx={styles.countChip}
            />
            {supported && (
              <Button
                onClick={openAdd}
                startIcon={<AddRounded />}
                sx={styles.addBtn}
              >
                Add a passkey
              </Button>
            )}
          </Box>
        </Paper>

        {/* ---------- UNSUPPORTED NOTICE ---------- */}
        {!supported && (
          <Paper elevation={0} sx={styles.notice}>
            <VpnKeyOutlined sx={{ color: "#ff4d4d" }} />
            <Typography sx={styles.noticeText}>
              This browser doesn't support adding passkeys. You can still rename
              or remove existing ones here, and add new passkeys from a
              supported browser (recent Chrome, Safari, or Edge).
            </Typography>
          </Paper>
        )}

        {/* ---------- LIST ---------- */}
        <Paper elevation={3} sx={styles.section}>
          <Stack
            direction="row"
            alignItems="center"
            spacing={1.5}
            sx={{ mb: 2 }}
          >
            <Box sx={styles.sectionIcon}>
              <KeyRounded />
            </Box>
            <Box>
              <Typography sx={styles.sectionTitle}>
                Registered passkeys
              </Typography>
              <Typography sx={styles.sectionHint}>
                Each passkey is tied to a device or password manager.
              </Typography>
            </Box>
          </Stack>

          {loading ? (
            <Box sx={styles.center}>
              <CircularProgress sx={{ color: "#ff4d4d" }} />
            </Box>
          ) : error ? (
            <Box sx={styles.center}>
              <Typography
                sx={{ color: "#ff4d4d", mb: 2, fontFamily: "Poppins" }}
              >
                {error}
              </Typography>
              <Button
                onClick={fetchPasskeys}
                startIcon={<RestartAlt />}
                sx={styles.cta}
              >
                Try again
              </Button>
            </Box>
          ) : passkeys.length === 0 ? (
            <Box sx={styles.empty}>
              <Box sx={styles.emptyIcon}>
                <Fingerprint sx={{ fontSize: 52 }} />
              </Box>
              <Typography sx={styles.emptyTitle}>No passkeys yet</Typography>
              <Typography sx={styles.emptyBody}>
                Add a passkey to sign in without typing your password. Your
                password keeps working too.
              </Typography>
              {supported && (
                <Button
                  onClick={openAdd}
                  startIcon={<AddRounded />}
                  sx={styles.cta}
                >
                  Add your first passkey
                </Button>
              )}
            </Box>
          ) : (
            <Stack spacing={1.5}>
              {passkeys.map((pk) => {
                const { label, Icon } = describeDevice(pk);
                return (
                  <Paper key={pk.id} elevation={0} sx={styles.row}>
                    <Box sx={styles.rowIcon}>
                      <Icon sx={{ fontSize: 26 }} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        flexWrap="wrap"
                        sx={{ mb: 0.25 }}
                      >
                        <Typography noWrap title={pk.name} sx={styles.rowName}>
                          {pk.name}
                        </Typography>
                        {pk.backed_up && (
                          <Chip
                            size="small"
                            icon={<CloudDoneOutlined sx={{ fontSize: 14 }} />}
                            label="Synced"
                            sx={styles.syncedChip}
                          />
                        )}
                      </Stack>
                      <Typography sx={styles.rowMeta}>
                        {label} · Added {formatDate(pk.created_at)}
                      </Typography>
                      <Typography sx={styles.rowMetaDim}>
                        Last used: {timeAgo(pk.last_used_at)}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
                      <Tooltip title="Rename">
                        <IconButton
                          onClick={() => {
                            setRenameTarget(pk);
                            setRenameValue(pk.name);
                          }}
                          sx={styles.iconAction}
                          aria-label={`Rename ${pk.name}`}
                        >
                          <EditOutlined fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Remove">
                        <IconButton
                          onClick={() => setDeleteTarget(pk)}
                          sx={styles.iconDanger}
                          aria-label={`Remove ${pk.name}`}
                        >
                          <DeleteOutline fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </Paper>
      </Box>

      {/* ---------- ADD DIALOG ---------- */}
      <Dialog
        open={addOpen}
        onClose={busy ? undefined : () => setAddOpen(false)}
        PaperProps={{ sx: styles.dialog }}
      >
        <DialogTitle sx={styles.dialogTitle}>Add a passkey</DialogTitle>
        <DialogContent>
          <DialogContentText sx={styles.dialogText}>
            Your device will ask you to confirm with Face ID, your fingerprint,
            or screen lock. Give this passkey a name so you can recognize it
            later.
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            label="Passkey name (optional)"
            placeholder="e.g. My MacBook"
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !busy) {
                e.preventDefault();
                handleAdd();
              }
            }}
            inputProps={{ maxLength: PASSKEY_NAME_MAX }}
            disabled={busy}
            sx={{ mt: 1 }}
            // notched + shrink kept in lockstep so the outline's legend gap is
            // always cut -- the placeholder floats the label, and without
            // notched the border draws straight through the floated label.
            InputProps={{ notched: true, style: styles.inputText }}
            InputLabelProps={{ shrink: true, style: styles.inputLabel }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setAddOpen(false)}
            disabled={busy}
            sx={styles.ghostBtn}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={busy}
            startIcon={!busy && <Fingerprint />}
            sx={styles.cta}
          >
            {busy ? (
              <CircularProgress size={18} sx={{ color: "#fff" }} />
            ) : (
              "Create passkey"
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ---------- RENAME DIALOG ---------- */}
      <Dialog
        open={Boolean(renameTarget)}
        onClose={busy ? undefined : () => setRenameTarget(null)}
        PaperProps={{ sx: styles.dialog }}
      >
        <DialogTitle sx={styles.dialogTitle}>Rename passkey</DialogTitle>
        <DialogContent>
          <DialogContentText sx={styles.dialogText}>
            Choose a name that helps you tell this passkey apart from your
            others.
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            label="Passkey name"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !busy) {
                e.preventDefault();
                handleRename();
              }
            }}
            inputProps={{ maxLength: PASSKEY_NAME_MAX }}
            disabled={busy}
            sx={{ mt: 1 }}
            // notched + shrink kept in lockstep so the outline's legend gap is
            // always cut and the border never strikes through the label.
            InputProps={{ notched: true, style: styles.inputText }}
            InputLabelProps={{ shrink: true, style: styles.inputLabel }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setRenameTarget(null)}
            disabled={busy}
            sx={styles.ghostBtn}
          >
            Cancel
          </Button>
          <Button onClick={handleRename} disabled={busy} sx={styles.cta}>
            {busy ? (
              <CircularProgress size={18} sx={{ color: "#fff" }} />
            ) : (
              "Save"
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ---------- DELETE DIALOG ---------- */}
      <Dialog
        open={Boolean(deleteTarget)}
        onClose={busy ? undefined : () => setDeleteTarget(null)}
        PaperProps={{ sx: styles.dialog }}
      >
        <DialogTitle sx={{ ...styles.dialogTitle, color: "#ff4d4d" }}>
          Remove passkey
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={styles.dialogText}>
            Remove <strong>{deleteTarget?.name}</strong>? You won't be able to
            sign in with this passkey anymore. You can always add it again
            later, and your password still works.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setDeleteTarget(null)}
            disabled={busy}
            sx={styles.ghostBtn}
          >
            Keep it
          </Button>
          <Button onClick={handleDelete} disabled={busy} sx={styles.dangerBtn}>
            {busy ? (
              <CircularProgress size={18} sx={{ color: "#fff" }} />
            ) : (
              "Remove passkey"
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

const getStyles = (isDark) => ({
  container: {
    minHeight: "calc(100vh - 80px)",
    padding: { xs: "16px", sm: "32px" },
    backgroundColor: isDark ? "#121212" : "#f7f5f4",
    backgroundImage:
      "radial-gradient(60% 50% at 20% 0%, rgba(255,77,77,0.10) 0%, transparent 60%), radial-gradient(50% 50% at 85% 100%, rgba(255,77,77,0.06) 0%, transparent 60%)",
    color: isDark ? "#ffffff" : "#000000",
    fontFamily: "Poppins",
    transition: "background-color 0.3s ease, color 0.3s ease",
  },
  shell: {
    maxWidth: 760,
    mx: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 3,
  },
  heroCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: "20px",
    padding: { xs: "22px", sm: "30px" },
    color: "#fff",
    background:
      "linear-gradient(135deg, #ff4d4d 0%, #ff7a59 65%, #ffa46d 100%)",
    boxShadow: "0 20px 50px rgba(255,77,77,0.35)",
  },
  heroBlobA: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: "50%",
    top: -90,
    left: -60,
    background:
      "radial-gradient(circle, rgba(255,255,255,0.33) 0%, transparent 60%)",
    pointerEvents: "none",
  },
  heroBlobB: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: "50%",
    bottom: -110,
    right: -80,
    background:
      "radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 60%)",
    pointerEvents: "none",
  },
  heroTopRow: { position: "relative", mb: 1 },
  backBtn: {
    fontFamily: "Poppins",
    fontWeight: 700,
    fontSize: 13,
    textTransform: "none",
    color: "#fff",
    background: "rgba(255,255,255,0.16)",
    borderRadius: "999px",
    px: 1.5,
    "&:hover": { background: "rgba(255,255,255,0.28)" },
  },
  heroBody: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: 2.5,
    flexWrap: "wrap",
  },
  heroMark: {
    width: 76,
    height: 76,
    borderRadius: "20px",
    background: "rgba(255,255,255,0.2)",
    backdropFilter: "blur(6px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "2px solid rgba(255,255,255,0.4)",
    boxShadow: "0 12px 28px rgba(0,0,0,0.18)",
    flexShrink: 0,
  },
  heroKicker: {
    fontFamily: "Poppins",
    fontWeight: 800,
    fontSize: 12,
    letterSpacing: "0.2em",
    opacity: 0.85,
  },
  heroTitle: {
    fontFamily: "Poppins",
    fontWeight: 900,
    fontSize: 28,
    mt: 0.25,
    lineHeight: 1.1,
    letterSpacing: "-0.02em",
  },
  heroSub: { fontFamily: "Poppins", fontSize: 14, opacity: 0.94, mt: 0.75 },
  heroActionRow: {
    position: "relative",
    mt: 2.5,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 1.5,
    flexWrap: "wrap",
  },
  countChip: {
    fontFamily: "Poppins",
    fontWeight: 700,
    color: "#fff",
    background: "rgba(255,255,255,0.18)",
    border: "1px solid rgba(255,255,255,0.3)",
  },
  addBtn: {
    fontFamily: "Poppins",
    fontWeight: 800,
    fontSize: 14,
    textTransform: "none",
    color: "#ff4d4d",
    background: "#fff",
    borderRadius: "999px",
    px: 2.25,
    py: 0.85,
    boxShadow: "0 10px 22px rgba(0,0,0,0.18)",
    "&:hover": { background: "#fff", transform: "translateY(-1px)" },
  },
  notice: {
    display: "flex",
    alignItems: "center",
    gap: 1.5,
    p: 2,
    borderRadius: "14px",
    border: "1px solid rgba(255,77,77,0.4)",
    background: isDark ? "rgba(255,77,77,0.08)" : "rgba(255,77,77,0.05)",
  },
  noticeText: {
    fontFamily: "Poppins",
    fontSize: 13.5,
    color: isDark ? "#ddd" : "#555",
  },
  section: {
    position: "relative",
    borderRadius: "18px",
    padding: { xs: 2.5, sm: 3 },
    background: isDark ? "#1f1f1f" : "#ffffff",
    border: isDark ? "1px solid #2a2a2a" : "1px solid #f0e8e6",
    boxShadow: isDark
      ? "0 12px 30px rgba(0,0,0,0.35)"
      : "0 12px 30px rgba(255,77,77,0.06)",
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: "10px",
    background:
      "linear-gradient(135deg, rgba(255,77,77,0.18), rgba(255,122,89,0.18))",
    color: "#ff4d4d",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  sectionTitle: {
    fontFamily: "Poppins",
    fontWeight: 800,
    fontSize: 17,
    color: isDark ? "#fff" : "#1a1a1a",
  },
  sectionHint: {
    fontFamily: "Poppins",
    fontSize: 13,
    color: isDark ? "#bbb" : "#666",
  },
  center: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    py: 5,
  },
  empty: {
    textAlign: "center",
    py: 4,
    px: 2,
    borderRadius: "14px",
    border: "1px dashed rgba(255,77,77,0.4)",
    background: "rgba(255,77,77,0.04)",
  },
  emptyIcon: { color: "#ff4d4d", mb: 1 },
  emptyTitle: {
    fontFamily: "Poppins",
    fontWeight: 800,
    fontSize: 17,
    mb: 0.5,
    color: isDark ? "#fff" : "#1a1a1a",
  },
  emptyBody: {
    fontFamily: "Poppins",
    fontSize: 13.5,
    color: isDark ? "#bbb" : "#666",
    maxWidth: 380,
    mx: "auto",
    mb: 2.5,
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 1.75,
    padding: 1.75,
    borderRadius: "16px",
    border: `1px solid ${isDark ? "#2a2a2a" : "#eeeeee"}`,
    background: isDark ? "#191919" : "#fff",
    transition:
      "transform .2s ease, box-shadow .2s ease, border-color .15s ease",
    "&:hover": {
      transform: "translateY(-2px)",
      boxShadow: "0 14px 30px rgba(255,77,77,0.16)",
      borderColor: "rgba(255,77,77,0.4)",
    },
  },
  rowIcon: {
    width: 52,
    height: 52,
    borderRadius: "14px",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    background: "linear-gradient(135deg, #ff4d4d 0%, #ff7a59 100%)",
    boxShadow: "0 8px 18px rgba(255,77,77,0.3)",
  },
  rowName: {
    fontFamily: "Poppins",
    fontWeight: 800,
    fontSize: 15.5,
    color: isDark ? "#fff" : "#1a1a1a",
    maxWidth: { xs: 150, sm: 320 },
  },
  syncedChip: {
    height: 22,
    fontFamily: "Poppins",
    fontWeight: 700,
    fontSize: 11,
    color: "#2e7d32",
    background: isDark ? "rgba(76,175,80,0.16)" : "rgba(76,175,80,0.12)",
    border: "1px solid rgba(76,175,80,0.4)",
    "& .MuiChip-icon": { color: "#2e7d32" },
  },
  rowMeta: {
    fontFamily: "Poppins",
    fontSize: 13,
    color: isDark ? "#bbb" : "#666",
  },
  rowMetaDim: {
    fontFamily: "Poppins",
    fontSize: 12,
    color: isDark ? "#888" : "#999",
    mt: 0.25,
  },
  iconAction: {
    color: isDark ? "#ccc" : "#666",
    border: `1px solid ${isDark ? "#333" : "#eee"}`,
    "&:hover": { color: "#ff4d4d", borderColor: "rgba(255,77,77,0.5)" },
  },
  iconDanger: {
    color: "#ff4d4d",
    border: `1px solid ${isDark ? "rgba(255,77,77,0.35)" : "rgba(255,77,77,0.3)"}`,
    "&:hover": {
      background: "rgba(255,77,77,0.08)",
      borderColor: "#ff4d4d",
    },
  },
  cta: {
    borderRadius: "999px",
    fontFamily: "Poppins",
    fontWeight: 700,
    textTransform: "none",
    color: "#fff",
    background: "linear-gradient(135deg, #ff4d4d 0%, #ff6b6b 100%)",
    boxShadow: "0 8px 18px rgba(255,77,77,0.3)",
    px: 2.25,
    "&:hover": {
      background: "linear-gradient(135deg, #ff5e5e 0%, #ff7d7d 100%)",
    },
    "&.Mui-disabled": { color: "#fff", opacity: 0.8 },
  },
  ghostBtn: {
    fontFamily: "Poppins",
    fontWeight: 700,
    textTransform: "none",
    color: isDark ? "#ccc" : "#555",
    backgroundColor: "transparent",
    "&:hover": {
      backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
      color: isDark ? "#fff" : "#333",
      boxShadow: "none",
    },
  },
  dangerBtn: {
    borderRadius: "999px",
    fontFamily: "Poppins",
    fontWeight: 700,
    textTransform: "none",
    color: "#fff",
    background: "linear-gradient(135deg, #ff4d4d 0%, #c0392b 100%)",
    boxShadow: "0 10px 22px rgba(255,77,77,0.4)",
    px: 2,
    "&:hover": {
      background: "linear-gradient(135deg, #ff5e5e 0%, #d43f2e 100%)",
    },
    "&.Mui-disabled": { color: "#fff", opacity: 0.8 },
  },
  dialog: {
    borderRadius: "18px",
    background: isDark ? "#1f1f1f" : "#ffffff",
    color: isDark ? "#fff" : "#000",
    padding: 1,
    maxWidth: 460,
  },
  dialogTitle: {
    fontFamily: "Poppins",
    fontWeight: 800,
    color: isDark ? "#fff" : "#1a1a1a",
  },
  dialogText: {
    fontFamily: "Poppins",
    fontSize: 14,
    color: isDark ? "#bbb" : "#555",
    mb: 1,
  },
  inputText: {
    fontFamily: "Poppins",
    fontSize: 15,
    color: isDark ? "#fff" : "#000",
  },
  inputLabel: { fontFamily: "Poppins", color: isDark ? "#cccccc" : "#666" },
});

export default PasskeysPage;
