// Full-screen container with the app background, standard padding, and
// support for a transparent gradient background tint when a mood is known.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, spacing } from '../../theme';

export default function Screen({
  children,
  style,
  padded = true,
  edges = ['top', 'bottom'],
  moodTint, // { tint: '#color' } optional ambient glow
}) {
  return (
    <View style={styles.root}>
      {moodTint?.tint ? (
        <LinearGradient
          pointerEvents="none"
          colors={[`${moodTint.tint}33`, 'transparent']}
          style={styles.tint}
        />
      ) : null}
      <SafeAreaView style={styles.safe} edges={edges}>
        <View style={[padded && styles.padded, styles.flex, style]}>{children}</View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  flex: { flex: 1 },
  padded: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  tint: { ...StyleSheet.absoluteFillObject, height: 380 },
});
