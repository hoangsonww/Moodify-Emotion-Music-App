// Account management actions: edit email, change password, clear history,
// delete account.

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

import Screen from '../components/Screen';
import AppButton from '../components/AppButton';
import TextField from '../components/TextField';
import SectionHeader from '../components/SectionHeader';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { error as hapticError, success as hapticSuccess, tapLight } from '../util/haptics';
import { getProfile, clearHistory } from '../services/emotion';
import { colors, radius, shadows, spacing, typography } from '../../theme';

const TAB_BAR_BOTTOM = 110;

export default function SettingsScreen() {
  const { signOut, updateProfile, changePassword, deleteAccount } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState(null);
  const [emailValue, setEmailValue] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const refresh = useCallback(async () => {
    try {
      const data = await getProfile();
      setProfile(data);
      setEmailValue(data?.email || '');
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const confirmDestructive = (title, message, onConfirm) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: 'destructive', onPress: onConfirm },
    ]);

  const onSaveEmail = async () => {
    const next = emailValue.trim();
    if (!next) {
      toast.show({ type: 'warning', title: 'Missing email', message: 'Enter a valid email.' });
      return;
    }
    setBusy(true);
    try {
      await updateProfile({ email: next });
      hapticSuccess();
      toast.show({ type: 'success', title: 'Saved', message: 'Email updated.' });
      setEditor(null);
      await refresh();
    } catch {
      hapticError();
      toast.show({ type: 'error', title: 'Update failed', message: 'Could not update email.' });
    } finally {
      setBusy(false);
    }
  };

  const onSavePassword = async () => {
    if (password.length < 8) {
      toast.show({ type: 'warning', title: 'Weak password', message: 'Use at least 8 characters.' });
      return;
    }
    if (password !== confirm) {
      toast.show({ type: 'warning', title: 'Passwords differ', message: 'Re-enter both passwords.' });
      return;
    }
    setBusy(true);
    try {
      await changePassword(password);
      hapticSuccess();
      toast.show({ type: 'success', title: 'Password updated', message: 'Sign in with your new password.' });
    } catch {
      hapticError();
      toast.show({ type: 'error', title: 'Update failed', message: 'Could not change your password.' });
    } finally {
      setBusy(false);
      setEditor(null);
      setPassword('');
      setConfirm('');
    }
  };

  const onClear = (kind, label) =>
    confirmDestructive(`Clear ${label}?`, 'This cannot be undone.', async () => {
      setBusy(true);
      try {
        await clearHistory(profile?.id, kind);
        hapticSuccess();
        toast.show({ type: 'success', title: 'Cleared', message: `Your ${label} is now empty.` });
        await refresh();
      } catch {
        hapticError();
        toast.show({ type: 'error', title: 'Action failed', message: `Could not clear your ${label}.` });
      } finally {
        setBusy(false);
      }
    });

  const onDeleteAccount = () =>
    confirmDestructive(
      'Delete your account?',
      'This permanently removes your account, mood history, and saved tracks.',
      async () => {
        setBusy(true);
        try {
          await deleteAccount();
          hapticSuccess();
        } catch {
          hapticError();
          toast.show({ type: 'error', title: 'Delete failed', message: 'Could not delete your account.' });
        } finally {
          setBusy(false);
        }
      },
    );

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Tune your account, data and session.</Text>

        <SectionHeader title="Account" />
        <View style={[styles.group, shadows.sm]}>
          <Row
            icon="mail-outline"
            tint={colors.primary}
            tintSoft={colors.primarySoft}
            label="Email"
            value={profile?.email || 'Not set'}
            onPress={() => { tapLight(); setEditor('email'); }}
          />
          <Row
            icon="key-outline"
            tint={colors.accent}
            tintSoft={colors.accentSoft}
            label="Password"
            value="••••••••"
            onPress={() => { tapLight(); setEditor('password'); }}
          />
        </View>

        <SectionHeader title="Your data" />
        <View style={[styles.group, shadows.sm]}>
          <Row
            icon="happy-outline"
            tint={colors.primary}
            tintSoft={colors.primarySoft}
            label="Clear mood history"
            value={`${(profile?.mood_history || []).length} entries`}
            onPress={() => onClear('mood_history', 'mood history')}
          />
          <Row
            icon="musical-notes-outline"
            tint={colors.accent}
            tintSoft={colors.accentSoft}
            label="Clear saved recommendations"
            value={`${(profile?.recommendations || []).length} tracks`}
            onPress={() => onClear('recommendations', 'saved recommendations')}
          />
          <Row
            icon="play-circle-outline"
            tint={colors.success}
            tintSoft={colors.successSoft}
            label="Clear listening history"
            value={`${(profile?.listening_history || []).length} entries`}
            onPress={() => onClear('listening_history', 'listening history')}
          />
        </View>

        <SectionHeader title="Danger zone" />
        <View style={styles.dangerWrap}>
          <AppButton
            title="Delete account"
            icon="trash-outline"
            variant="danger"
            onPress={onDeleteAccount}
          />
          <AppButton
            title="Log out"
            icon="log-out-outline"
            variant="ghost"
            onPress={() => { tapLight(); signOut(); }}
            style={{ marginTop: spacing.sm }}
          />
        </View>
      </ScrollView>

      <Modal visible={editor !== null} transparent animationType="slide" onRequestClose={() => setEditor(null)}>
        <Pressable style={styles.backdrop} onPress={() => setEditor(null)}>
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
          <Pressable style={[styles.sheet, shadows.md]} onPress={() => {}}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>
              {editor === 'email' ? 'Update email' : 'Change password'}
            </Text>
            {editor === 'email' ? (
              <>
                <TextField
                  label="Email"
                  value={emailValue}
                  onChangeText={setEmailValue}
                  placeholder="you@example.com"
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <AppButton title="Save" icon="checkmark" onPress={onSaveEmail} loading={busy} />
              </>
            ) : (
              <>
                <TextField
                  label="New password"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="at least 8 characters"
                  secureTextEntry
                />
                <TextField
                  label="Confirm new password"
                  value={confirm}
                  onChangeText={setConfirm}
                  placeholder="re-enter password"
                  secureTextEntry
                />
                <AppButton title="Update password" icon="key" onPress={onSavePassword} loading={busy} />
              </>
            )}
            <AppButton
              title="Cancel"
              variant="ghost"
              onPress={() => {
                setEditor(null);
                setPassword('');
                setConfirm('');
              }}
              style={{ marginTop: spacing.sm }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function Row({ icon, tint, tintSoft, label, value, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={[styles.rowIcon, { backgroundColor: tintSoft }]}>
        <Ionicons name={icon} size={16} color={tint} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingTop: spacing.xl, paddingBottom: TAB_BAR_BOTTOM },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.h1, color: colors.text },
  subtitle: { color: colors.textMuted, fontSize: 14, marginTop: spacing.xs },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowPressed: { opacity: 0.7 },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  rowLabel: { color: colors.text, fontSize: 15, fontWeight: '800' },
  rowValue: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  dangerWrap: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.dangerSoft,
    padding: spacing.md,
  },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.borderHi,
    marginBottom: spacing.md,
  },
  sheetTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
});
