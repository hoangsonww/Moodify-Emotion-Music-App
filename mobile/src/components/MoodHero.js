// Mood-tinted hero with an animated halo. Sits at the top of the Results
// screen and on the Profile dashboard when a current mood is known.

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, moodPaletteFor, radius, shadows, spacing, typography } from '../../theme';

export default function MoodHero({ emotion, degraded, caption, style, compact }) {
  const palette = moodPaletteFor(emotion);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.1] });

  return (
    <LinearGradient
      colors={palette.colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.card,
        compact && styles.compact,
        { shadowColor: palette.tint },
        shadows.glow,
        style,
      ]}
    >
      <View style={styles.haloWrap} pointerEvents="none">
        <Animated.View
          style={[
            styles.halo,
            { backgroundColor: palette.tint, opacity: haloOpacity, transform: [{ scale: haloScale }] },
          ]}
        />
      </View>
      <Text style={[styles.emoji, compact && styles.emojiCompact]}>{palette.emoji}</Text>
      <Text style={styles.kicker}>{compact ? 'CURRENT MOOD' : 'DETECTED MOOD'}</Text>
      <Text style={[styles.mood, compact && styles.moodCompact]} numberOfLines={1}>
        {palette.label}
      </Text>
      {degraded ? (
        <Text style={styles.degraded}>
          We weren't fully certain — here's our best guess.
        </Text>
      ) : caption ? (
        <Text style={styles.caption}>{caption}</Text>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    overflow: 'hidden',
  },
  compact: { padding: spacing.lg },
  haloWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: { width: 220, height: 220, borderRadius: 110 },
  emoji: { fontSize: 64 },
  emojiCompact: { fontSize: 42 },
  kicker: {
    ...typography.micro,
    color: 'rgba(255,255,255,0.85)',
    marginTop: spacing.md,
  },
  mood: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.4,
    textTransform: 'capitalize',
    marginTop: 2,
  },
  moodCompact: { fontSize: 24 },
  degraded: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  caption: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
