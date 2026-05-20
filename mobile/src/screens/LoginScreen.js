import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import Screen from '../components/Screen';
import TextField from '../components/TextField';
import AppButton from '../components/AppButton';
import { useAuth } from '../context/AuthContext';
import { colors, gradient, radius, spacing } from '../../theme';

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
    } catch (e) {
      const msg =
        e?.response?.status === 401
          ? 'Invalid username or password.'
          : 'Could not sign in. Check your connection and try again.';
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
        <View style={styles.hero}>
          <LinearGradient
            colors={gradient.colors}
            start={gradient.start}
            end={gradient.end}
            style={styles.mark}
          >
            <Ionicons name="musical-notes" size={36} color="#fff" />
          </LinearGradient>
          <Text style={styles.logo}>Moodify</Text>
          <Text style={styles.tagline}>Music that matches your mood</Text>
        </View>

        <View style={styles.form}>
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
          <AppButton title="Sign in" onPress={onLogin} loading={loading} style={styles.cta} />
          <Pressable
            onPress={() => navigation.navigate('ForgotPassword')}
            style={styles.forgotRow}
            hitSlop={8}
          >
            <Text style={styles.link}>Forgot password?</Text>
          </Pressable>
        </View>

        <Pressable onPress={() => navigation.navigate('Register')} style={styles.linkRow}>
          <Text style={styles.linkMuted}>New to Moodify? </Text>
          <Text style={styles.link}>Create an account</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: 'center' },
  hero: { alignItems: 'center', marginBottom: spacing.xl },
  mark: {
    width: 84,
    height: 84,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    shadowColor: colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  logo: { color: colors.text, fontSize: 38, fontWeight: '900', letterSpacing: 0.5 },
  tagline: { color: colors.textMuted, fontSize: 15, marginTop: spacing.xs },
  form: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  cta: { marginTop: spacing.sm },
  forgotRow: { alignItems: 'center', marginTop: spacing.md },
  linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
  linkMuted: { color: colors.textMuted, fontSize: 14 },
  link: { color: colors.primary, fontSize: 14, fontWeight: '800' },
});
