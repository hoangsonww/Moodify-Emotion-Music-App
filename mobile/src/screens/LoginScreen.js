import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import Screen from '../components/Screen';
import TextField from '../components/TextField';
import AppButton from '../components/AppButton';
import GradientBorder from '../components/GradientBorder';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { success as hapticSuccess, error as hapticError } from '../util/haptics';
import { colors, gradient, radius, shadows, spacing, typography } from '../../theme';

const FEATURES = [
  { icon: 'mic-outline', tint: colors.primary, tintSoft: colors.primarySoft, label: 'Voice' },
  { icon: 'happy-outline', tint: colors.accent, tintSoft: colors.accentSoft, label: 'Face' },
  { icon: 'create-outline', tint: colors.success, tintSoft: colors.successSoft, label: 'Text' },
];

export default function LoginScreen({ navigation }) {
  const { signIn } = useAuth();
  const toast = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(28)).current;
  const halo = useRef(new Animated.Value(0)).current;
  const orbA = useRef(new Animated.Value(0)).current;
  const orbB = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 520, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, useNativeDriver: true, friction: 8, tension: 60 }),
    ]).start();

    const pulse = (val, duration, delay = 0) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: 1,
            duration,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0,
            duration,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      );

    pulse(halo, 2400).start();
    pulse(orbA, 5400).start();
    pulse(orbB, 6800, 400).start();
  }, [fade, slide, halo, orbA, orbB]);

  const onLogin = async () => {
    if (!username.trim() || !password) {
      toast.show({ type: 'warning', title: 'Almost there', message: 'Enter your username and password.' });
      return;
    }
    setLoading(true);
    try {
      await signIn(username.trim(), password);
      hapticSuccess();
    } catch (e) {
      hapticError();
      const msg =
        e?.response?.status === 401
          ? 'Invalid username or password.'
          : 'Could not sign in. Check your connection and try again.';
      toast.show({ type: 'error', title: 'Login failed', message: msg });
    } finally {
      setLoading(false);
    }
  };

  const haloScale = halo.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.18] });
  const haloOpacity = halo.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.85] });
  const orbATranslate = orbA.interpolate({ inputRange: [0, 1], outputRange: [0, -28] });
  const orbAOpacity = orbA.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.6] });
  const orbBTranslate = orbB.interpolate({ inputRange: [0, 1], outputRange: [0, 22] });
  const orbBOpacity = orbB.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.5] });

  return (
    <Screen padded={false}>
      <Animated.View
        pointerEvents="none"
        style={[styles.orb, styles.orbTopLeft, { opacity: orbAOpacity, transform: [{ translateY: orbATranslate }] }]}
      >
        <LinearGradient
          colors={['#8b5cf6', 'transparent']}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[styles.orb, styles.orbBottomRight, { opacity: orbBOpacity, transform: [{ translateY: orbBTranslate }] }]}
      >
        <LinearGradient
          colors={['#ec4899', 'transparent']}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[styles.inner, { opacity: fade, transform: [{ translateY: slide }] }]}
          >
            <View style={styles.hero}>
              <View style={styles.markWrap}>
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.markHalo,
                    { opacity: haloOpacity, transform: [{ scale: haloScale }] },
                  ]}
                >
                  <LinearGradient
                    colors={gradient.colors}
                    start={gradient.start}
                    end={gradient.end}
                    style={StyleSheet.absoluteFill}
                  />
                </Animated.View>
                <LinearGradient
                  colors={gradient.colors}
                  start={gradient.start}
                  end={gradient.end}
                  style={[styles.mark, shadows.glow]}
                >
                  <Ionicons name="musical-notes" size={38} color="#fff" />
                </LinearGradient>
              </View>
              <Text style={styles.kicker}>MOODIFY</Text>
              <Text style={styles.logo}>Welcome back</Text>
              <Text style={styles.tagline}>
                Sign in and pick up where your mood left off.
              </Text>

              <View style={styles.featureRow}>
                {FEATURES.map((f) => (
                  <View key={f.label} style={styles.feature}>
                    <View style={[styles.featureIcon, { backgroundColor: f.tintSoft }]}>
                      <Ionicons name={f.icon} size={16} color={f.tint} />
                    </View>
                    <Text style={styles.featureLabel}>{f.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            <GradientBorder style={[styles.card, shadows.md]} borderWidth={1.5}>
              <View style={styles.cardInner}>
                <Text style={styles.cardTitle}>Sign in</Text>
                <Text style={styles.cardSub}>
                  Use your Moodify credentials to continue.
                </Text>

                <TextField
                  label="Username"
                  value={username}
                  onChangeText={setUsername}
                  placeholder="your username"
                  returnKeyType="next"
                  leftIcon="person-outline"
                  iconTint={colors.primary}
                  iconTintSoft={colors.primarySoft}
                />
                <TextField
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="your password"
                  secureTextEntry
                  returnKeyType="done"
                  onSubmitEditing={onLogin}
                  leftIcon="lock-closed-outline"
                  iconTint={colors.accent}
                  iconTintSoft={colors.accentSoft}
                />

                <Pressable
                  onPress={() => navigation.navigate('ForgotPassword')}
                  style={styles.forgotRow}
                  hitSlop={8}
                >
                  <Text style={styles.link}>Forgot password?</Text>
                </Pressable>

                <AppButton
                  title="Sign in"
                  icon="arrow-forward"
                  iconPosition="right"
                  onPress={onLogin}
                  loading={loading}
                  style={styles.cta}
                />
              </View>
            </GradientBorder>

            <Pressable onPress={() => navigation.navigate('Register')} style={styles.linkRow}>
              <Text style={styles.linkMuted}>New to Moodify? </Text>
              <Text style={styles.link}>Create an account</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.primary} style={styles.linkArrow} />
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    justifyContent: 'center',
  },
  inner: { width: '100%' },
  orb: {
    position: 'absolute',
    width: 360,
    height: 360,
    borderRadius: 180,
    overflow: 'hidden',
  },
  orbTopLeft: { top: -120, left: -120 },
  orbBottomRight: { bottom: -140, right: -140 },
  hero: { alignItems: 'center', marginBottom: spacing.xl },
  markWrap: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  markHalo: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
  },
  mark: {
    width: 84,
    height: 84,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    ...typography.micro,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  logo: { ...typography.display, color: colors.text, textAlign: 'center' },
  tagline: {
    color: colors.textMuted,
    fontSize: 15,
    marginTop: spacing.sm,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  featureRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  feature: { alignItems: 'center', gap: 6 },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  card: {},
  cardInner: {
    padding: spacing.lg,
  },
  cardTitle: { ...typography.h2, color: colors.text },
  cardSub: { color: colors.textMuted, fontSize: 14, marginTop: 4, marginBottom: spacing.lg },
  cta: { marginTop: spacing.sm },
  forgotRow: { alignSelf: 'flex-end', marginTop: -spacing.sm, marginBottom: spacing.md },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  linkMuted: { color: colors.textMuted, fontSize: 14 },
  link: { color: colors.primary, fontSize: 14, fontWeight: '800' },
  linkArrow: { marginLeft: 4 },
});
