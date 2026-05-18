import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import Screen from '../components/Screen';
import TextField from '../components/TextField';
import AppButton from '../components/AppButton';
import { useAuth } from '../context/AuthContext';
import { colors, spacing } from '../../theme';

export default function LoginScreen({ navigation }) {
  const { signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    if (!username.trim() || !password) {
      Alert.alert('Missing info', 'Enter your username and password.');
      return;
    }
    setLoading(true);
    try {
      await signIn(username.trim(), password);
      // On success the navigator swaps to the app stack automatically.
    } catch (e) {
      const msg =
        e?.response?.status === 401
          ? 'Invalid username or password.'
          : 'Could not sign in. Please check your connection and try again.';
      Alert.alert('Login failed', msg);
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
        <View style={styles.header}>
          <Text style={styles.logo}>Moodify</Text>
          <Text style={styles.tagline}>Music that matches your mood.</Text>
        </View>

        <TextField
          label="Username"
          value={username}
          onChangeText={setUsername}
          placeholder="your username"
          returnKeyType="next"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="your password"
          secureTextEntry
          returnKeyType="done"
          onSubmitEditing={onLogin}
        />

        <AppButton title="Sign in" onPress={onLogin} loading={loading} style={styles.button} />

        <Pressable onPress={() => navigation.navigate('Register')} style={styles.linkRow}>
          <Text style={styles.linkMuted}>New here? </Text>
          <Text style={styles.link}>Create an account</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: spacing.xl },
  logo: { color: colors.primary, fontSize: 40, fontWeight: '900', letterSpacing: 0.5 },
  tagline: { color: colors.textMuted, fontSize: 15, marginTop: spacing.xs },
  button: { marginTop: spacing.sm },
  linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg },
  linkMuted: { color: colors.textMuted, fontSize: 14 },
  link: { color: colors.primary, fontSize: 14, fontWeight: '700' },
});
