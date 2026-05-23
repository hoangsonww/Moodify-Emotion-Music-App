import React, { useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';

import AppButton from './AppButton';
import { tapMedium } from '../util/haptics';
import { colors, radius, spacing } from '../../theme';

/** Front-camera capture for facial mood. */
export default function FaceCapture({ onCapture, onError }) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  const capture = async () => {
    if (!cameraRef.current) return;
    tapMedium();
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.6,
        skipProcessing: true,
      });
      onCapture(photo.uri);
    } catch (e) {
      onError && onError('Could not capture a photo.');
    }
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <View style={styles.permIcon}>
          <Ionicons name="camera-outline" size={28} color={colors.primary} />
        </View>
        <Text style={styles.permTitle}>Camera access needed</Text>
        <Text style={styles.hint}>
          We'll snap a single photo to read your facial expression — nothing is uploaded.
        </Text>
        <AppButton
          title="Grant camera access"
          icon="camera-outline"
          variant="ghost"
          onPress={requestPermission}
          style={styles.fullWidth}
        />
      </View>
    );
  }

  return (
    <>
      <View style={styles.cameraWrap}>
        <CameraView ref={cameraRef} facing="front" style={styles.camera} />
        <View style={styles.frameOverlay} pointerEvents="none">
          <View style={styles.frame} />
        </View>
      </View>
      <AppButton title="Capture & analyze" icon="camera" onPress={capture} style={styles.fullWidth} />
    </>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  permIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  permTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: 4 },
  hint: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: spacing.xs,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 18,
  },
  fullWidth: { marginTop: spacing.md, alignSelf: 'stretch' },
  cameraWrap: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  camera: { flex: 1 },
  frameOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: '60%',
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
});
