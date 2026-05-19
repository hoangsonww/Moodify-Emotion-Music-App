import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';

import Screen from '../components/Screen';
import TextField from '../components/TextField';
import AppButton from '../components/AppButton';
import FaceCapture from '../components/FaceCapture';
import {
  analyzeFace,
  analyzeSpeech,
  analyzeText,
  getProfile,
  saveMood,
  saveRecommendations,
} from '../services/emotion';
import { colors, gradient, radius, spacing } from '../../theme';

const MODES = [
  { key: 'text', label: 'Text', icon: 'create-outline' },
  { key: 'speech', label: 'Voice', icon: 'mic-outline' },
  { key: 'face', label: 'Face', icon: 'happy-outline' },
];

export default function HomeScreen({ navigation }) {
  const [mode, setMode] = useState('text');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [profileId, setProfileId] = useState(null);

  const recordingRef = useRef(null);

  useEffect(() => {
    getProfile()
      .then((p) => setProfileId(p.id))
      .catch(() => {});
  }, []);

  const goToResults = useCallback(
    (data) => {
      const emotion = data.emotion;
      const recommendations = data.recommendations || [];
      if (profileId) {
        saveMood(profileId, emotion).catch(() => {});
        if (recommendations.length) saveRecommendations(profileId, recommendations).catch(() => {});
      }
      navigation.navigate('Results', { emotion, recommendations, degraded: !!data.degraded });
    },
    [navigation, profileId],
  );

  const runAnalysis = useCallback(
    async (task) => {
      setBusy(true);
      try {
        // The inference helpers never throw -- they fall back internally,
        // so a usable result always comes back and no error is surfaced.
        goToResults(await task());
      } catch (e) {
        goToResults({ emotion: 'calm', recommendations: [], degraded: true });
      } finally {
        setBusy(false);
      }
    },
    [goToResults],
  );

  const onAnalyzeText = () => {
    if (!text.trim()) {
      Alert.alert('Say something', 'Type a few words about how you feel.');
      return;
    }
    runAnalysis(() => analyzeText(text.trim()));
  };

  const startRecording = async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Microphone needed', 'Enable microphone access to use voice mood.');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = rec;
      setRecording(true);
    } catch (e) {
      Alert.alert('Recording error', 'Could not start recording.');
    }
  };

  const stopRecording = async () => {
    const rec = recordingRef.current;
    recordingRef.current = null;
    setRecording(false);
    if (!rec) return;
    try {
      await rec.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = rec.getURI();
      if (uri) runAnalysis(() => analyzeSpeech(uri));
    } catch (e) {
      Alert.alert('Recording error', 'Could not save the recording.');
    }
  };

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>How are you{'\n'}feeling today?</Text>
        <Text style={styles.sub}>Share your mood and we'll tune the music to it.</Text>

        <View style={styles.tabs}>
          {MODES.map((m) => {
            const active = mode === m.key;
            const body = (
              <>
                <Ionicons name={m.icon} size={19} color={active ? '#fff' : colors.textMuted} />
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{m.label}</Text>
              </>
            );
            return (
              <Pressable key={m.key} onPress={() => setMode(m.key)} style={styles.tabWrap}>
                {active ? (
                  <LinearGradient
                    colors={gradient.colors}
                    start={gradient.start}
                    end={gradient.end}
                    style={styles.tab}
                  >
                    {body}
                  </LinearGradient>
                ) : (
                  <View style={styles.tab}>{body}</View>
                )}
              </Pressable>
            );
          })}
        </View>

        {mode === 'text' && (
          <View style={styles.panel}>
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
          <View style={[styles.panel, styles.center]}>
            {recording ? (
              <Pressable onPress={stopRecording} style={[styles.mic, styles.micRecording]}>
                <Ionicons name="stop" size={42} color="#fff" />
              </Pressable>
            ) : (
              <Pressable onPress={startRecording}>
                <LinearGradient
                  colors={gradient.colors}
                  start={gradient.start}
                  end={gradient.end}
                  style={styles.mic}
                >
                  <Ionicons name="mic" size={46} color="#fff" />
                </LinearGradient>
              </Pressable>
            )}
            <Text style={styles.hint}>
              {recording ? 'Recording — tap to stop & analyze' : 'Tap to record your voice'}
            </Text>
          </View>
        )}

        {mode === 'face' && (
          <View style={[styles.panel, styles.center]}>
            <FaceCapture onCapture={(uri) => runAnalysis(() => analyzeFace(uri))} />
          </View>
        )}
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
  content: { padding: spacing.lg },
  heading: { color: colors.text, fontSize: 28, fontWeight: '900', lineHeight: 34 },
  sub: { color: colors.textMuted, fontSize: 14, marginTop: spacing.sm, marginBottom: spacing.lg },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 5,
    marginBottom: spacing.lg,
  },
  tabWrap: { flex: 1 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: radius.sm,
    gap: 7,
  },
  tabLabel: { color: colors.textMuted, fontWeight: '700', fontSize: 14 },
  tabLabelActive: { color: '#fff' },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  center: { alignItems: 'center', paddingVertical: spacing.xl },
  hint: { color: colors.textMuted, fontSize: 14, marginTop: spacing.lg, textAlign: 'center' },
  mic: {
    width: 132,
    height: 132,
    borderRadius: 66,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  micRecording: { backgroundColor: colors.danger, shadowColor: colors.danger },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13,13,18,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayText: { color: colors.text, marginTop: spacing.md, fontSize: 15, fontWeight: '700' },
});
