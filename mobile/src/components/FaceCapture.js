import React, { useRef } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';

import AppButton from './AppButton';
import { colors, radius, spacing } from '../../theme';

/** Front-camera capture for facial mood. The camera hook lives here so it
 *  is only mounted while the user is on the Face tab. */
export default function FaceCapture({ onCapture }) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  const capture = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.6,
        skipProcessing: true,
      });
      onCapture(photo.uri);
    } catch (e) {
      Alert.alert('Camera error', 'Could not capture a photo.');
    }
  };

  if (!permission) {
    return <ActivityIndicator color={colors.primary} />;
  }

  if (!permission.granted) {
    return (
      <>
        <Ionicons name="camera-outline" size={40} color={colors.textMuted} />
        <Text style={styles.hint}>Camera access is needed for face mood.</Text>
        <AppButton
          title="Grant camera access"
          variant="ghost"
          onPress={requestPermission}
          style={styles.fullWidth}
        />
      </>
    );
  }

  return (
    <>
      <View style={styles.cameraWrap}>
        <CameraView ref={cameraRef} facing="front" style={styles.camera} />
      </View>
      <AppButton title="Capture & analyze" icon="camera" onPress={capture} style={styles.fullWidth} />
    </>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.textMuted, fontSize: 14, marginTop: spacing.md, textAlign: 'center' },
  fullWidth: { marginTop: spacing.md, alignSelf: 'stretch' },
  cameraWrap: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  camera: { flex: 1 },
});
