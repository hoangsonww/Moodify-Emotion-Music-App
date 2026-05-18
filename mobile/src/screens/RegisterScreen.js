import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';

import Screen from '../components/Screen';
import TextField from '../components/TextField';
import AppButton from '../components/AppButton';
import { useAuth } from '../context/AuthContext';
import { spacing } from '../../theme';

export default function RegisterScreen({ navigation }) {
  const { register, signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const onRegister = async () => {
    if (!username.trim() || !email.trim() || !password) {
      Alert.alert('Missing info', 'Please fill in every field.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Weak password', 'Use at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Passwords differ', 'The two passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await register(username.trim(), email.trim(), password);
      await signIn(username.trim(), password);
    } catch (e) {
      const status = e?.response?.status;
      const msg =
        status === 409
          ? 'That username is already taken.'
          : status === 400
            ? e?.response?.data?.error || 'Please check your details.'
            : 'Could not create your account. Please try again.';
      Alert.alert('Registration failed', msg);
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
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <TextField label="Username" value={username} onChangeText={setUsername} placeholder="pick a username" />
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="at least 8 characters"
            secureTextEntry
          />
          <TextField
            label="Confirm password"
            value={confirm}
            onChangeText={setConfirm}
            placeholder="re-enter your password"
            secureTextEntry
          />
          <AppButton
            title="Create account"
            onPress={onRegister}
            loading={loading}
            style={{ marginTop: spacing.sm }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingVertical: spacing.lg, justifyContent: 'center', flexGrow: 1 },
});
