// Account management actions: edit email, change password, clear history,
// delete account. Everything here calls a deployed backend endpoint --
// nothing is local-only.

import React, { useCallback, useEffect, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';

import Screen from '../components/Screen';
import AppButton from '../components/AppButton';
import TextField from '../components/TextField';
import { useAuth } from '../context/AuthContext';
import { getProfile, clearHistory } from '../services/emotion';
import { colors, radius, spacing } from '../../theme';

export default function SettingsScreen({ navigation }) {
  const { signOut, updateProfile, changePassword, deleteAccount } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState(null); // 'email' | 'password' | null
  const [emailValue, setEmailValue] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const refresh = useCallback(async () => {
    try {
      const data = await getProfile();
      setProfile(data);
      setEmailValue(data?.email || '');
    } catch {
      // leave profile null; the screen still renders the action buttons
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const confirmDestructive = (title, message, onConfirm) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: 'destructive', onPress: onConfirm },
    ]);

  const onSaveEmail = async () => {
    const next = emailValue.trim();
    if (!next) {
      Alert.alert('Missing email', 'Enter a valid email address.');
      return;
    }
    setBusy(true);
    try {
      await updateProfile({ email: next });
      Alert.alert('Saved', 'Your email has been updated.');
      setEditor(null);
      await refresh();
    } catch {
      Alert.alert('Update failed', 'Could not update your email. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const onSavePassword = async () => {
    if (password.length < 8) {
      Alert.alert('Weak password', 'Use at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Passwords do not match', 'Re-enter both passwords.');
      return;
    }
    setBusy(true);
    try {
      // changePassword clears tokens, so the auth context will route us
      // back to the login screen automatically.
      await changePassword(password);
      Alert.alert('Password updated', 'Sign in with your new password.');
    } catch {
      Alert.alert('Update failed', 'Could not change your password. Try again.');
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
        Alert.alert('Cleared', `Your ${label} is now empty.`);
        await refresh();
      } catch {
        Alert.alert('Action failed', `Could not clear your ${label}.`);
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
        } catch {
          Alert.alert('Delete failed', 'Could not delete your account.');
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
        <Section title="Account">
          <Row
            icon="mail-outline"
            label="Email"
            value={profile?.email || 'Not set'}
            onPress={() => setEditor('email')}
          />
          <Row
            icon="key-outline"
            label="Password"
            value="••••••••"
            onPress={() => setEditor('password')}
          />
        </Section>

        <Section title="Data">
          <Row
            icon="happy-outline"
            label="Clear mood history"
            value={`${(profile?.mood_history || []).length} entries`}
            onPress={() => onClear('mood_history', 'mood history')}
          />
          <Row
            icon="musical-notes-outline"
            label="Clear saved recommendations"
            value={`${(profile?.recommendations || []).length} tracks`}
            onPress={() => onClear('recommendations', 'saved recommendations')}
          />
          <Row
            icon="play-circle-outline"
            label="Clear listening history"
            value={`${(profile?.listening_history || []).length} entries`}
            onPress={() => onClear('listening_history', 'listening history')}
          />
        </Section>

        <Section title="Danger zone">
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
            onPress={signOut}
            style={{ marginTop: spacing.sm }}
          />
        </Section>
      </ScrollView>

      <Modal visible={editor !== null} transparent animationType="slide" onRequestClose={() => setEditor(null)}>
        <Pressable style={styles.backdrop} onPress={() => setEditor(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
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
                <AppButton title="Save" onPress={onSaveEmail} loading={busy} />
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
                <AppButton title="Update password" onPress={onSavePassword} loading={busy} />
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ icon, label, value, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <Ionicons name={icon} size={20} color={colors.textMuted} />
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
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  section: { marginBottom: spacing.xl },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  rowPressed: { opacity: 0.7 },
  rowText: { flex: 1 },
  rowLabel: { color: colors.text, fontSize: 15, fontWeight: '700' },
  rowValue: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  sheetTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
});
