// A card with a gradient border on top of a dark surface.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, gradient as brandGradient, radius } from '../../theme';

export default function GradientBorder({
  children,
  colors: gradColors = brandGradient.colors,
  start = brandGradient.start,
  end = brandGradient.end,
  borderWidth = 1.5,
  innerBg = colors.surface,
  radius: r = radius.lg,
  style,
  contentStyle,
}) {
  return (
    <LinearGradient
      colors={gradColors}
      start={start}
      end={end}
      style={[{ borderRadius: r, padding: borderWidth }, style]}
    >
      <View
        style={[
          styles.inner,
          { backgroundColor: innerBg, borderRadius: r - borderWidth },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  inner: { overflow: 'hidden' },
});
