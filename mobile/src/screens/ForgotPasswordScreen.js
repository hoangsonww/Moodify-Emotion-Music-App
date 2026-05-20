// Two-step password reset, reached from the login screen.
//
// Step 1: verify the username + email pair exists (backend endpoint
//         /users/verify-username-email/).
// Step 2: submit the new password (/users/reset-password/).

import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import Screen from '../components/Screen';
import TextField from '../components/TextField';
import AppButton from '../components/AppButton';
import { useAuth } from '../context/AuthContext';
import { colors, radius, spacing } from '../../theme';

export default function ForgotPasswordScreen({ navigation }) {
  const { verifyUsernameEmail, resetPassword } = useAuth();
  const [step, setStep] = useState('verify'); // 'verify' | 'reset'
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const onVerify = async () => {
    if (!username.trim() || !email.trim()) {
      Alert.alert('Missing info', 'Enter your username and email.');
      return;
    }
    setLoading(true);
    try {
      await verifyUsernameEmail(username.trim(), email.trim());
      setStep('reset');
    } catch (e) {
      const msg =
        e?.response?.status === 404
          ? "We couldn't find that username and email combination."
          : 'Could not verify your account. Try again.';
      Alert.alert('Verification failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const onReset = async () => {
    if (password.length < 8) {
      Alert.alert('Weak password', 'Use at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Passwords do not match', 'Re-enter both passwords.');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(username.trim(), password);
      Alert.alert('Password updated', 'Sign in with your new password.', [
        { text: 'OK', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (e) {
      Alert.alert('Reset failed', 'Could not reset your password. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <Text style={styles.heading}>Reset your password</Text>
        <Text style={styles.sub}>
          {step === 'verify'
            ? 'Confirm your username and email to continue.'
            : 'Choose a new password for your account.'}
        </Text>

        <View style={styles.form}>
          {step === 'verify' ? (
            <>
              <TextField
                label="Username"
                value={username}
                onChangeText={setUsername}
                placeholder="your username"
                autoCapitalize="none"
                returnKeyType="next"
              />
              <TextField
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="done"
                onSubmitEditing={onVerify}
              />
              <AppButton title="Verify" onPress={onVerify} loading={loading} />
            </>
          ) : (
            <>
              <TextField
                label="New password"
                value={password}
                onChangeText={setPassword}
                placeholder="at least 8 characters"
                secureTextEntry
                returnKeyType="next"
              />
              <TextField
                label="Confirm new password"
                value={confirm}
                onChangeText={setConfirm}
                placeholder="re-enter password"
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={onReset}
              />
              <AppButton title="Set new password" onPress={onReset} loading={loading} />
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: 'center' },
  heading: { color: colors.text, fontSize: 26, fontWeight: '900', textAlign: 'center' },
  sub: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  form: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
});
