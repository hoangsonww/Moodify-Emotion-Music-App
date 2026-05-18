import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Audio } from 'expo-av';

import Screen from '../components/Screen';
import TextField from '../components/TextField';
import AppButton from '../components/AppButton';
import {
  analyzeFace,
  analyzeSpeech,
  analyzeText,
  getProfile,
  saveMood,
  saveRecommendations,
} from '../services/emotion';
import { colors, radius, spacing } from '../../theme';

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

  const [camPermission, requestCamPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const recordingRef = useRef(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => navigation.navigate('Profile')} hitSlop={12}>
          <Ionicons name="person-circle-outline" size={28} color={colors.text} />
        </Pressable>
      ),
    });
  }, [navigation]);

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
        if (recommendations.length) {
          saveRecommendations(profileId, recommendations).catch(() => {});
        }
      }
      navigation.navigate('Results', { emotion, recommendations, degraded: !!data.degraded });
    },
    [navigation, profileId],
  );

  const runAnalysis = useCallback(
    async (task) => {
      setBusy(true);
      try {
        goToResults(await task());
      } catch (e) {
        Alert.alert('Analysis failed', 'We could not read your mood. Please try again.');
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

  const capture = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.6, skipProcessing: true });
      runAnalysis(() => analyzeFace(photo.uri));
    } catch (e) {
      Alert.alert('Camera error', 'Could not capture a photo.');
    }
  };

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>How are you feeling?</Text>
        <Text style={styles.sub}>Pick a way to share your mood and we'll find the music.</Text>

        <View style={styles.tabs}>
          {MODES.map((m) => {
            const active = mode === m.key;
            return (
              <Pressable
                key={m.key}
                onPress={() => setMode(m.key)}
                style={[styles.tab, active && styles.tabActive]}
              >
                <Ionicons
                  name={m.icon}
                  size={20}
                  color={active ? '#fff' : colors.textMuted}
                />
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{m.label}</Text>
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
              numberOfLines={4}
              style={{ marginBottom: spacing.md }}
            />
            <AppButton title="Analyze my mood" onPress={onAnalyzeText} />
          </View>
        )}

        {mode === 'speech' && (
          <View style={[styles.panel, styles.center]}>
            <Pressable
              onPress={recording ? stopRecording : startRecording}
              style={[styles.micButton, recording && styles.micButtonActive]}
            >
              <Ionicons name={recording ? 'stop' : 'mic'} size={44} color="#fff" />
            </Pressable>
            <Text style={styles.hint}>
              {recording ? 'Recording... tap to stop & analyze' : 'Tap to record your voice'}
            </Text>
          </View>
        )}

        {mode === 'face' && (
          <View style={[styles.panel, styles.center]}>
            {!camPermission ? (
              <ActivityIndicator color={colors.primary} />
            ) : !camPermission.granted ? (
              <>
                <Text style={styles.hint}>Camera access is needed for face mood.</Text>
                <AppButton
                  title="Grant camera access"
                  variant="ghost"
                  onPress={requestCamPermission}
                  style={{ marginTop: spacing.md }}
                />
              </>
            ) : (
              <>
                <View style={styles.cameraWrap}>
                  <CameraView ref={cameraRef} facing="front" style={styles.camera} />
                </View>
                <AppButton
                  title="Capture & analyze"
                  onPress={capture}
                  style={{ marginTop: spacing.md, alignSelf: 'stretch' }}
                />
              </>
            )}
          </View>
        )}
      </ScrollView>

      {busy && (
        <View style={styles.overlay} pointerEvents="auto">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.overlayText}>Reading your mood...</Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg },
  heading: { color: colors.text, fontSize: 24, fontWeight: '800' },
  sub: { color: colors.textMuted, fontSize: 14, marginTop: spacing.xs, marginBottom: spacing.lg },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.xs,
    marginBottom: spacing.lg,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    gap: 6,
  },
  tabActive: { backgroundColor: colors.primary },
  tabLabel: { color: colors.textMuted, fontWeight: '700', fontSize: 14 },
  tabLabelActive: { color: '#fff' },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  center: { alignItems: 'center' },
  hint: { color: colors.textMuted, fontSize: 14, marginTop: spacing.md, textAlign: 'center' },
  micButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonActive: { backgroundColor: colors.danger },
  cameraWrap: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  camera: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,15,20,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayText: { color: colors.text, marginTop: spacing.md, fontSize: 15, fontWeight: '600' },
});
