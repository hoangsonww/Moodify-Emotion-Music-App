import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { error as hapticError, success as hapticSuccess } from '../util/haptics';
import { colors, gradient, radius, shadows, spacing, typography } from '../../theme';

const REGISTER_GRADIENT = ['#ec4899', '#a855f7', '#8b5cf6'];

function gradePassword(pw) {
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  return Math.min(score, 4);
}

const STRENGTH_LABELS = ['Too short', 'Weak', 'Okay', 'Strong', 'Excellent'];
const STRENGTH_COLORS = [colors.danger, colors.danger, colors.warning, colors.success, colors.success];

function checkRules(pw) {
  return [
    { key: 'len', label: '8+ chars', met: pw.length >= 8 },
    { key: 'case', label: 'Aa', met: /[A-Z]/.test(pw) && /[a-z]/.test(pw) },
    { key: 'num', label: '0-9', met: /\d/.test(pw) },
    { key: 'sym', label: '!@#', met: /[^A-Za-z0-9]/.test(pw) },
  ];
}

export default function RegisterScreen({ navigation }) {
  const { register, signIn } = useAuth();
  const toast = useToast();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
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
          Animated.timing(val, { toValue: 1, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(val, { toValue: 0, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      );

    pulse(halo, 2400).start();
    pulse(orbA, 5600).start();
    pulse(orbB, 6900, 350).start();
  }, [fade, slide, halo, orbA, orbB]);

  const strength = useMemo(() => gradePassword(password), [password]);
  const rules = useMemo(() => checkRules(password), [password]);
  const match = password.length > 0 && confirm.length > 0 && password === confirm;
  const mismatch = confirm.length > 0 && password !== confirm;

  const onRegister = async () => {
    if (!username.trim() || !email.trim() || !password) {
      toast.show({ type: 'warning', title: 'Missing info', message: 'Fill in every field to continue.' });
      return;
    }
    if (password.length < 8) {
      toast.show({ type: 'warning', title: 'Weak password', message: 'Use at least 8 characters.' });
      return;
    }
    if (password !== confirm) {
      toast.show({ type: 'warning', title: 'Passwords differ', message: 'Re-enter both passwords.' });
      return;
    }
    setLoading(true);
    try {
      await register(username.trim(), email.trim(), password);
      await signIn(username.trim(), password);
      hapticSuccess();
    } catch (e) {
      hapticError();
      const status = e?.response?.status;
      const msg =
        status === 409
          ? 'That username is already taken.'
          : status === 400
            ? e?.response?.data?.error || 'Please check your details.'
            : 'Could not create your account. Please try again.';
      toast.show({ type: 'error', title: 'Registration failed', message: msg });
    } finally {
      setLoading(false);
    }
  };

  const haloScale = halo.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.18] });
  const haloOpacity = halo.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0.9] });
  const orbATranslate = orbA.interpolate({ inputRange: [0, 1], outputRange: [0, -26] });
  const orbAOpacity = orbA.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.6] });
  const orbBTranslate = orbB.interpolate({ inputRange: [0, 1], outputRange: [0, 24] });
  const orbBOpacity = orbB.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.5] });

  return (
    <Screen padded={false}>
      <Animated.View
        pointerEvents="none"
        style={[styles.orb, styles.orbTopRight, { opacity: orbAOpacity, transform: [{ translateY: orbATranslate }] }]}
      >
        <LinearGradient colors={['#ec4899', 'transparent']} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[styles.orb, styles.orbBottomLeft, { opacity: orbBOpacity, transform: [{ translateY: orbBTranslate }] }]}
      >
        <LinearGradient colors={['#8b5cf6', 'transparent']} style={StyleSheet.absoluteFill} />
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
          <Animated.View style={[styles.inner, { opacity: fade, transform: [{ translateY: slide }] }]}>
            <View style={styles.hero}>
              <View style={styles.markWrap}>
                <Animated.View
                  pointerEvents="none"
                  style={[styles.markHalo, { opacity: haloOpacity, transform: [{ scale: haloScale }] }]}
                >
                  <LinearGradient colors={REGISTER_GRADIENT} style={StyleSheet.absoluteFill} />
                </Animated.View>
                <LinearGradient
                  colors={REGISTER_GRADIENT}
                  start={gradient.start}
                  end={gradient.end}
                  style={[styles.mark, shadows.glow]}
                >
                  <Ionicons name="sparkles" size={36} color="#fff" />
                </LinearGradient>
              </View>
              <Text style={styles.kicker}>JOIN MOODIFY</Text>
              <Text style={styles.title}>Create your account</Text>
              <Text style={styles.subtitle}>
                Three modes. One vibe-tuned soundtrack. All free.
              </Text>
            </View>

            <GradientBorder
              style={[styles.card, shadows.md]}
              colors={REGISTER_GRADIENT}
              borderWidth={1.5}
            >
              <View style={styles.cardInner}>
                <View style={styles.sectionHead}>
                  <View style={[styles.sectionTile, { backgroundColor: colors.primarySoft }]}>
                    <Ionicons name="person-circle-outline" size={16} color={colors.primary} />
                  </View>
                  <Text style={styles.sectionTitle}>Your identity</Text>
                </View>
                <TextField
                  label="Username"
                  value={username}
                  onChangeText={setUsername}
                  placeholder="pick a username"
                  returnKeyType="next"
                  leftIcon="at-outline"
                  iconTint={colors.primary}
                  iconTintSoft={colors.primarySoft}
                />
                <TextField
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  returnKeyType="next"
                  leftIcon="mail-outline"
                  iconTint={colors.accent}
                  iconTintSoft={colors.accentSoft}
                />

                <View style={styles.divider} />

                <View style={styles.sectionHead}>
                  <View style={[styles.sectionTile, { backgroundColor: colors.accentSoft }]}>
                    <Ionicons name="shield-checkmark-outline" size={16} color={colors.accent} />
                  </View>
                  <Text style={styles.sectionTitle}>Secure your account</Text>
                </View>
                <TextField
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="at least 8 characters"
                  secureTextEntry
                  returnKeyType="next"
                  leftIcon="lock-closed-outline"
                  iconTint={colors.accent}
                  iconTintSoft={colors.accentSoft}
                />

                {password.length > 0 ? (
                  <View style={styles.strengthWrap}>
                    <View style={styles.strengthBar}>
                      {[0, 1, 2, 3].map((i) => (
                        <View
                          key={i}
                          style={[
                            styles.strengthSeg,
                            { backgroundColor: i < strength ? STRENGTH_COLORS[strength] : colors.surfaceAlt },
                          ]}
                        />
                      ))}
                    </View>
                    <View style={styles.strengthMeta}>
                      <Text style={[styles.strengthLabel, { color: STRENGTH_COLORS[strength] }]}>
                        {STRENGTH_LABELS[strength]}
                      </Text>
                    </View>
                    <View style={styles.ruleRow}>
                      {rules.map((r) => (
                        <View
                          key={r.key}
                          style={[
                            styles.ruleChip,
                            r.met && { backgroundColor: colors.successSoft, borderColor: colors.success },
                          ]}
                        >
                          <Ionicons
                            name={r.met ? 'checkmark-circle' : 'ellipse-outline'}
                            size={12}
                            color={r.met ? colors.success : colors.textMuted}
                          />
                          <Text
                            style={[
                              styles.ruleLabel,
                              { color: r.met ? colors.success : colors.textMuted },
                            ]}
                          >
                            {r.label}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}

                <TextField
                  label="Confirm password"
                  value={confirm}
                  onChangeText={setConfirm}
                  placeholder="re-enter your password"
                  secureTextEntry
                  returnKeyType="done"
                  onSubmitEditing={onRegister}
                  leftIcon="lock-closed-outline"
                  iconTint={colors.accent}
                  iconTintSoft={colors.accentSoft}
                />
                {match ? (
                  <View style={styles.matchRow}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                    <Text style={[styles.matchLabel, { color: colors.success }]}>
                      Passwords match
                    </Text>
                  </View>
                ) : mismatch ? (
                  <View style={styles.matchRow}>
                    <Ionicons name="close-circle" size={14} color={colors.danger} />
                    <Text style={[styles.matchLabel, { color: colors.danger }]}>
                      Passwords don't match yet
                    </Text>
                  </View>
                ) : null}

                <AppButton
                  title="Create account"
                  icon="arrow-forward"
                  iconPosition="right"
                  onPress={onRegister}
                  loading={loading}
                  style={{ marginTop: spacing.md }}
                />
                <Text style={styles.legal}>
                  By creating an account you agree to our terms and privacy policy.
                </Text>
              </View>
            </GradientBorder>

            <Pressable
              onPress={() => navigation.navigate('Login')}
              style={styles.linkRow}
              hitSlop={8}
            >
              <Text style={styles.linkMuted}>Already have an account? </Text>
              <Text style={styles.link}>Sign in</Text>
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
    paddingTop: spacing.xxl + spacing.md,
    paddingBottom: spacing.xl,
  },
  inner: { width: '100%' },
  orb: {
    position: 'absolute',
    width: 340,
    height: 340,
    borderRadius: 170,
    overflow: 'hidden',
  },
  orbTopRight: { top: -120, right: -120 },
  orbBottomLeft: { bottom: -140, left: -140 },
  hero: { alignItems: 'center', marginBottom: spacing.lg },
  markWrap: {
    width: 116,
    height: 116,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  markHalo: {
    position: 'absolute',
    width: 116,
    height: 116,
    borderRadius: 58,
    overflow: 'hidden',
  },
  mark: {
    width: 80,
    height: 80,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: { ...typography.micro, color: colors.accent, marginBottom: spacing.xs },
  title: { ...typography.h1, color: colors.text, textAlign: 'center' },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: spacing.sm,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  card: {},
  cardInner: { padding: spacing.lg },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTile: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { ...typography.h3, color: colors.text },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  strengthWrap: { marginTop: -spacing.sm, marginBottom: spacing.md },
  strengthBar: { flexDirection: 'row', gap: 4 },
  strengthSeg: { flex: 1, height: 5, borderRadius: 3 },
  strengthMeta: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6 },
  strengthLabel: { fontSize: 12, fontWeight: '800' },
  ruleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  ruleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ruleLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  matchLabel: { fontSize: 12, fontWeight: '700' },
  legal: {
    color: colors.textFaint,
    fontSize: 11,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 16,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  linkMuted: { color: colors.textMuted, fontSize: 14 },
  link: { color: colors.primary, fontSize: 14, fontWeight: '800' },
});
