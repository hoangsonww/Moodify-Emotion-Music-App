// Two-step password reset, reached from the login screen.
//
// Step 1: verify the username + email pair exists (backend endpoint
//         /users/verify-username-email/).
// Step 2: submit the new password (/users/reset-password/).

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
import { error as hapticError, success as hapticSuccess } from '../util/haptics';
import { colors, gradient, radius, shadows, spacing, typography } from '../../theme';

const VERIFY_GRADIENT = ['#8b5cf6', '#6366f1', '#3b82f6'];
const RESET_GRADIENT = ['#22d3ee', '#34d399', '#a3e635'];

export default function ForgotPasswordScreen({ navigation }) {
  const { verifyUsernameEmail, resetPassword } = useAuth();
  const toast = useToast();
  const [step, setStep] = useState('verify'); // 'verify' | 'reset'
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(24)).current;
  const halo = useRef(new Animated.Value(0)).current;
  const orbA = useRef(new Animated.Value(0)).current;
  const orbB = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fade.setValue(0);
    slide.setValue(24);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, useNativeDriver: true, friction: 8 }),
    ]).start();
  }, [step]);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: step === 'reset' ? 1 : 0,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [step, progress]);

  useEffect(() => {
    const pulse = (val, duration, delay = 0) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: 1, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(val, { toValue: 0, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      );
    pulse(halo, 2400).start();
    pulse(orbA, 5400).start();
    pulse(orbB, 6800, 400).start();
  }, [halo, orbA, orbB]);

  const onVerify = async () => {
    if (!username.trim() || !email.trim()) {
      toast.show({ type: 'warning', title: 'Missing info', message: 'Enter your username and email.' });
      return;
    }
    setLoading(true);
    try {
      await verifyUsernameEmail(username.trim(), email.trim());
      hapticSuccess();
      setStep('reset');
    } catch (e) {
      hapticError();
      const msg =
        e?.response?.status === 404
          ? "Couldn't find that username and email combination."
          : 'Could not verify your account. Try again.';
      toast.show({ type: 'error', title: 'Verification failed', message: msg });
    } finally {
      setLoading(false);
    }
  };

  const onReset = async () => {
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
      await resetPassword(username.trim(), password);
      hapticSuccess();
      toast.show({ type: 'success', title: 'Password updated', message: 'Sign in with your new password.' });
      navigation.navigate('Login');
    } catch (e) {
      hapticError();
      toast.show({ type: 'error', title: 'Reset failed', message: 'Could not reset your password.' });
    } finally {
      setLoading(false);
    }
  };

  const haloScale = halo.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.06] });
  const haloOpacity = halo.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.22] });
  const orbATranslate = orbA.interpolate({ inputRange: [0, 1], outputRange: [0, -24] });
  const orbAOpacity = orbA.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.55] });
  const orbBTranslate = orbB.interpolate({ inputRange: [0, 1], outputRange: [0, 22] });
  const orbBOpacity = orbB.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.45] });
  const progressWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  const heroGradient = step === 'verify' ? VERIFY_GRADIENT : RESET_GRADIENT;
  const orbColorA = step === 'verify' ? '#6366f1' : '#22d3ee';
  const orbColorB = step === 'verify' ? '#8b5cf6' : '#34d399';

  return (
    <Screen padded={false}>
      <Animated.View
        pointerEvents="none"
        style={[styles.orb, styles.orbTopLeft, { opacity: orbAOpacity, transform: [{ translateY: orbATranslate }] }]}
      >
        <LinearGradient colors={[orbColorA, 'transparent']} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[styles.orb, styles.orbBottomRight, { opacity: orbBOpacity, transform: [{ translateY: orbBTranslate }] }]}
      >
        <LinearGradient colors={[orbColorB, 'transparent']} style={StyleSheet.absoluteFill} />
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
          <View style={styles.inner}>
            <View style={styles.hero}>
              <View style={styles.markWrap}>
                <Animated.View
                  pointerEvents="none"
                  style={[styles.markHalo, { opacity: haloOpacity, transform: [{ scale: haloScale }] }]}
                >
                  <LinearGradient colors={heroGradient} style={StyleSheet.absoluteFill} />
                </Animated.View>
                <LinearGradient
                  colors={heroGradient}
                  start={gradient.start}
                  end={gradient.end}
                  style={[styles.mark, shadows.glow]}
                >
                  <Ionicons
                    name={step === 'verify' ? 'shield-checkmark' : 'key'}
                    size={36}
                    color="#fff"
                  />
                </LinearGradient>
              </View>
              <Text style={styles.kicker}>
                {step === 'verify' ? 'STEP 1 OF 2' : 'STEP 2 OF 2'}
              </Text>
              <Text style={styles.heading}>
                {step === 'verify' ? 'Reset your password' : 'Choose a new password'}
              </Text>
              <Text style={styles.sub}>
                {step === 'verify'
                  ? "First, let's verify your account so only you can reset it."
                  : 'Pick something strong — at least 8 characters with a mix.'}
              </Text>
            </View>

            <View style={styles.stepWrap}>
              <View style={styles.stepRail}>
                <Animated.View
                  style={[styles.stepRailFill, { width: progressWidth }]}
                >
                  <LinearGradient
                    colors={heroGradient}
                    start={gradient.start}
                    end={gradient.end}
                    style={StyleSheet.absoluteFill}
                  />
                </Animated.View>
              </View>
              <View style={styles.stepRow}>
                <StepDot active number={1} done={step === 'reset'} label="Verify" gradColors={VERIFY_GRADIENT} />
                <StepDot
                  active={step === 'reset'}
                  number={2}
                  done={false}
                  label="Reset"
                  gradColors={RESET_GRADIENT}
                />
              </View>
            </View>

            <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
              <GradientBorder
                style={[styles.form, shadows.md]}
                colors={heroGradient}
                borderWidth={1.5}
              >
                <View style={styles.formInner}>
                  {step === 'verify' ? (
                    <>
                      <TextField
                        label="Username"
                        value={username}
                        onChangeText={setUsername}
                        placeholder="your username"
                        autoCapitalize="none"
                        returnKeyType="next"
                        leftIcon="person-outline"
                        iconTint={colors.primary}
                        iconTintSoft={colors.primarySoft}
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
                        leftIcon="mail-outline"
                        iconTint={colors.accent}
                        iconTintSoft={colors.accentSoft}
                      />
                      <AppButton
                        title="Verify account"
                        icon="shield-checkmark-outline"
                        onPress={onVerify}
                        loading={loading}
                      />
                    </>
                  ) : (
                    <>
                      <View style={styles.verifiedBadge}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                        <Text style={styles.verifiedText}>
                          Verified <Text style={styles.verifiedUser}>{username}</Text>
                        </Text>
                      </View>
                      <TextField
                        label="New password"
                        value={password}
                        onChangeText={setPassword}
                        placeholder="at least 8 characters"
                        secureTextEntry
                        returnKeyType="next"
                        leftIcon="lock-closed-outline"
                        iconTint={colors.success}
                        iconTintSoft={colors.successSoft}
                      />
                      <TextField
                        label="Confirm new password"
                        value={confirm}
                        onChangeText={setConfirm}
                        placeholder="re-enter password"
                        secureTextEntry
                        returnKeyType="done"
                        onSubmitEditing={onReset}
                        leftIcon="lock-closed-outline"
                        iconTint={colors.success}
                        iconTintSoft={colors.successSoft}
                      />
                      <AppButton
                        title="Set new password"
                        icon="key-outline"
                        onPress={onReset}
                        loading={loading}
                      />
                      <Pressable onPress={() => setStep('verify')} style={styles.backRow} hitSlop={8}>
                        <Ionicons name="arrow-back" size={14} color={colors.textMuted} />
                        <Text style={styles.backLabel}>Back to verification</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              </GradientBorder>
            </Animated.View>

            <Pressable
              onPress={() => navigation.navigate('Login')}
              style={styles.linkRow}
              hitSlop={8}
            >
              <Text style={styles.linkMuted}>Remembered it? </Text>
              <Text style={styles.link}>Back to sign in</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function StepDot({ active, done, number, label, gradColors }) {
  return (
    <View style={styles.stepItem}>
      {active || done ? (
        <LinearGradient
          colors={gradColors}
          start={gradient.start}
          end={gradient.end}
          style={styles.stepDot}
        >
          {done ? (
            <Ionicons name="checkmark" size={16} color="#fff" />
          ) : (
            <Text style={styles.stepTextActive}>{number}</Text>
          )}
        </LinearGradient>
      ) : (
        <View style={[styles.stepDot, styles.stepDotInactive]}>
          <Text style={styles.stepText}>{number}</Text>
        </View>
      )}
      <Text style={[styles.stepLabel, (active || done) && styles.stepLabelActive]}>{label}</Text>
    </View>
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
    width: 320,
    height: 320,
    borderRadius: 160,
    overflow: 'hidden',
  },
  orbTopLeft: { top: -120, left: -100 },
  orbBottomRight: { bottom: -140, right: -100 },
  hero: { alignItems: 'center', marginBottom: spacing.lg },
  markWrap: {
    width: 112,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  markHalo: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: 56,
    overflow: 'hidden',
  },
  mark: {
    width: 78,
    height: 78,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: { ...typography.micro, color: colors.primary, marginBottom: spacing.xs },
  heading: { ...typography.h1, color: colors.text, textAlign: 'center' },
  sub: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: spacing.sm,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  stepWrap: {
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  stepRail: {
    position: 'absolute',
    left: '20%',
    right: '20%',
    top: 16,
    height: 3,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  stepRailFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  stepRow: { flexDirection: 'row', justifyContent: 'space-around' },
  stepItem: { alignItems: 'center', gap: 6 },
  stepDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotInactive: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  stepText: { color: colors.textMuted, fontWeight: '900', fontSize: 13 },
  stepTextActive: { color: '#fff', fontWeight: '900', fontSize: 13 },
  stepLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  stepLabelActive: { color: colors.text },
  form: {},
  formInner: { padding: spacing.lg },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: colors.success,
    marginBottom: spacing.md,
  },
  verifiedText: { color: colors.success, fontSize: 12, fontWeight: '700' },
  verifiedUser: { fontWeight: '900' },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: spacing.md,
  },
  backLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  linkMuted: { color: colors.textMuted, fontSize: 14 },
  link: { color: colors.primary, fontSize: 14, fontWeight: '800' },
});
