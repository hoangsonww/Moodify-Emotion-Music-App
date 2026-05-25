import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';

import Screen from '../components/Screen';
import TextField from '../components/TextField';
import AppButton from '../components/AppButton';
import FaceCapture from '../components/FaceCapture';
import { useToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { tapLight, tapMedium, error as hapticError } from '../util/haptics';
import {
  analyzeFace,
  analyzeSpeech,
  analyzeText,
  getProfile,
  saveMood,
  saveRecommendations,
} from '../services/emotion';
import {
  colors,
  gradient,
  moodPaletteFor,
  radius,
  shadows,
  spacing,
  typography,
} from '../../theme';

const MODES = [
  {
    key: 'text',
    label: 'Text',
    icon: 'create-outline',
    blurb: 'Write a few words about your day.',
  },
  {
    key: 'speech',
    label: 'Voice',
    icon: 'mic-outline',
    blurb: 'Record a short voice clip.',
  },
  {
    key: 'face',
    label: 'Face',
    icon: 'happy-outline',
    blurb: 'Snap a photo of your expression.',
  },
];

const TAB_BAR_BOTTOM = 110;

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Late night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
}

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState('text');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [profileId, setProfileId] = useState(null);
  const [moodHistory, setMoodHistory] = useState([]);

  const recordingRef = useRef(null);
  const pulse = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 460, useNativeDriver: true }).start();
  }, [fade]);

  useEffect(() => {
    if (!recording) {
      pulse.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [recording, pulse]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getProfile()
        .then((p) => {
          if (!active) return;
          setProfileId(p.id);
          setMoodHistory(Array.isArray(p.mood_history) ? p.mood_history : []);
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }, []),
  );

  const goToResults = useCallback(
    (data, inputType = null) => {
      const emotion = data.emotion;
      const recommendations = data.recommendations || [];
      if (profileId) {
        saveMood(profileId, emotion).catch(() => {});
        if (recommendations.length) saveRecommendations(profileId, recommendations).catch(() => {});
      }
      navigation.navigate('Results', {
        emotion,
        recommendations,
        degraded: !!data.degraded,
        history: moodHistory,
        profileId,
        // Threaded for the mood-correction widget on the results
        // screen. null means "no real model run" (fallback / shortcut)
        // and the widget skips itself.
        inputType,
      });
    },
    [navigation, profileId, moodHistory],
  );

  const runAnalysis = useCallback(
    async (task, inputType) => {
      setBusy(true);
      try {
        goToResults(await task(), inputType);
      } catch (e) {
        goToResults({ emotion: 'calm', recommendations: [], degraded: true }, null);
      } finally {
        setBusy(false);
      }
    },
    [goToResults],
  );

  const onAnalyzeText = () => {
    if (!text.trim()) {
      toast.show({ type: 'warning', title: 'Say something', message: 'Type a few words about how you feel.' });
      return;
    }
    runAnalysis(() => analyzeText(text.trim()), 'text');
  };

  const startRecording = async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        hapticError();
        toast.show({ type: 'error', title: 'Microphone needed', message: 'Enable mic access to use voice mood.' });
        return;
      }
      tapMedium();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = rec;
      setRecording(true);
    } catch (e) {
      hapticError();
      toast.show({ type: 'error', title: 'Recording error', message: 'Could not start recording.' });
    }
  };

  const stopRecording = async () => {
    const rec = recordingRef.current;
    recordingRef.current = null;
    setRecording(false);
    if (!rec) return;
    tapMedium();
    try {
      await rec.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = rec.getURI();
      if (uri) runAnalysis(() => analyzeSpeech(uri), 'speech');
    } catch (e) {
      hapticError();
      toast.show({ type: 'error', title: 'Recording error', message: 'Could not save the recording.' });
    }
  };

  const lastMood = moodHistory.length > 0 ? moodHistory[moodHistory.length - 1] : null;
  const lastPalette = lastMood ? moodPaletteFor(lastMood) : null;
  const recentChips = moodHistory.slice(-6).reverse();

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] });

  return (
    <Screen padded={false} moodTint={lastPalette}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fade }}>
          <Text style={styles.greet}>
            {greeting()}
            {user?.username ? `, ${user.username}` : ''} 👋
          </Text>
          <Text style={styles.heading}>How are you{'\n'}feeling today?</Text>
          <Text style={styles.sub}>Share your mood and we'll tune the music to it.</Text>

          {lastMood ? (
            <Pressable
              onPress={() => {
                tapLight();
                navigation.navigate('Results', {
                  emotion: lastMood,
                  recommendations: [],
                  history: moodHistory,
                  profileId,
                });
              }}
              style={({ pressed }) => [styles.lastMood, pressed && { opacity: 0.85 }]}
            >
              <LinearGradient
                colors={lastPalette.colors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.lastMoodTint}
              />
              <Text style={styles.lastMoodEmoji}>{lastPalette.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.lastMoodKicker}>YOUR LAST MOOD</Text>
                <Text style={styles.lastMoodLabel}>{lastPalette.label}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.text} />
            </Pressable>
          ) : null}

          <Text style={styles.sectionKicker}>Choose how to share</Text>
          <View style={styles.modeList}>
            {MODES.map((m) => {
              const active = mode === m.key;
              return (
                <Pressable
                  key={m.key}
                  onPress={() => {
                    tapLight();
                    setMode(m.key);
                  }}
                  style={({ pressed }) => [
                    styles.modeCard,
                    active && styles.modeCardActive,
                    pressed && { transform: [{ scale: 0.98 }] },
                  ]}
                >
                  <View style={[styles.modeIconWrap, active && styles.modeIconWrapActive]}>
                    {active ? (
                      <LinearGradient
                        colors={gradient.colors}
                        start={gradient.start}
                        end={gradient.end}
                        style={StyleSheet.absoluteFillObject}
                      />
                    ) : null}
                    <Ionicons name={m.icon} size={22} color={active ? '#fff' : colors.text} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modeLabel}>{m.label}</Text>
                    <Text style={styles.modeBlurb}>{m.blurb}</Text>
                  </View>
                  {active ? (
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                  ) : (
                    <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
                  )}
                </Pressable>
              );
            })}
          </View>

          {mode === 'text' && (
            <View style={[styles.panel, shadows.md]}>
              <TextField
                label="Tell us about your day"
                value={text}
                onChangeText={setText}
                placeholder="e.g. I feel calm and a little nostalgic..."
                multiline
              />
              <AppButton title="Analyze my mood" icon="sparkles" onPress={onAnalyzeText} />
            </View>
          )}

          {mode === 'speech' && (
            <View style={[styles.panel, styles.center, shadows.md]}>
              <View style={styles.micStage}>
                {recording ? (
                  <>
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        styles.micRing,
                        { opacity: ringOpacity, transform: [{ scale: ringScale }] },
                      ]}
                    />
                    <Pressable onPress={stopRecording} style={[styles.mic, styles.micRecording]}>
                      <Ionicons name="stop" size={42} color="#fff" />
                    </Pressable>
                  </>
                ) : (
                  <Pressable onPress={startRecording}>
                    <LinearGradient
                      colors={gradient.colors}
                      start={gradient.start}
                      end={gradient.end}
                      style={[styles.mic, shadows.glow]}
                    >
                      <Ionicons name="mic" size={46} color="#fff" />
                    </LinearGradient>
                  </Pressable>
                )}
              </View>
              <Text style={styles.hint}>
                {recording ? 'Recording — tap to stop & analyze' : 'Tap to record your voice'}
              </Text>
            </View>
          )}

          {mode === 'face' && (
            <View style={[styles.panel, styles.center, shadows.md]}>
              <FaceCapture
                onCapture={(uri) => runAnalysis(() => analyzeFace(uri), 'facial')}
                onError={(msg) =>
                  toast.show({ type: 'error', title: 'Camera error', message: msg })
                }
              />
            </View>
          )}

          {recentChips.length ? (
            <View style={styles.recentWrap}>
              <Text style={styles.sectionKicker}>Recent moods</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                {recentChips.map((m, i) => {
                  const p = moodPaletteFor(m);
                  return (
                    <View key={`${m}-${i}`} style={styles.recentChip}>
                      <Text style={styles.recentEmoji}>{p.emoji}</Text>
                      <Text style={styles.recentLabel}>{p.label}</Text>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
        </Animated.View>
      </ScrollView>

      {busy && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.overlayText}>Reading your mood…</Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingTop: spacing.xl + spacing.md,
    paddingBottom: TAB_BAR_BOTTOM,
  },
  greet: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  heading: { ...typography.h1, color: colors.text, marginTop: 4 },
  sub: { color: colors.textMuted, fontSize: 14, marginTop: spacing.sm, marginBottom: spacing.lg },
  lastMood: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.md,
    overflow: 'hidden',
  },
  lastMoodTint: { ...StyleSheet.absoluteFillObject, opacity: 0.15 },
  lastMoodEmoji: { fontSize: 30 },
  lastMoodKicker: { ...typography.micro, color: colors.textMuted },
  lastMoodLabel: { ...typography.h3, color: colors.text, marginTop: 2 },
  sectionKicker: { ...typography.micro, color: colors.textMuted, marginBottom: spacing.sm },
  modeList: { gap: spacing.sm, marginBottom: spacing.lg },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  modeCardActive: { borderColor: colors.primary, backgroundColor: colors.surfaceAlt },
  modeIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  modeIconWrapActive: { backgroundColor: 'transparent' },
  modeLabel: { color: colors.text, fontSize: 15, fontWeight: '800' },
  modeBlurb: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  center: { alignItems: 'center', paddingVertical: spacing.xl },
  hint: { color: colors.textMuted, fontSize: 14, marginTop: spacing.lg, textAlign: 'center' },
  micStage: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.danger,
  },
  mic: {
    width: 132,
    height: 132,
    borderRadius: 66,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micRecording: { backgroundColor: colors.danger, shadowColor: colors.danger },
  recentWrap: { marginTop: spacing.xl },
  chipsRow: { gap: spacing.sm, paddingRight: spacing.md },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    gap: 6,
  },
  recentEmoji: { fontSize: 14 },
  recentLabel: { color: colors.text, fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayText: { color: colors.text, marginTop: spacing.md, fontSize: 15, fontWeight: '800' },
});
