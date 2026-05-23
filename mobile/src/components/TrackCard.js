import React, { useRef } from 'react';
import { Animated, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { tapLight } from '../util/haptics';
import { colors, gradient, radius, shadows, spacing } from '../../theme';

/** Recommended track card; tapping opens it in Deezer's web player.
 *  Optional `rank` renders a numeric badge for ordered lists. */
export default function TrackCard({ track, onPlay, rank }) {
  const scale = useRef(new Animated.Value(1)).current;

  const open = () => {
    tapLight();
    if (onPlay) onPlay(track);
    if (track.external_url) Linking.openURL(track.external_url).catch(() => {});
  };

  const animateTo = (v) =>
    Animated.spring(scale, { toValue: v, useNativeDriver: true, friction: 6 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={open}
        onPressIn={() => animateTo(0.98)}
        onPressOut={() => animateTo(1)}
        style={styles.card}
      >
        <View style={styles.artWrap}>
          {track.image_url ? (
            <Image source={{ uri: track.image_url }} style={styles.art} />
          ) : (
            <LinearGradient
              colors={gradient.colors}
              start={gradient.start}
              end={gradient.end}
              style={[styles.art, styles.artFallback]}
            >
              <Ionicons name="musical-note" size={22} color="#fff" />
            </LinearGradient>
          )}
          {rank ? (
            <View style={styles.rank}>
              <Text style={styles.rankText}>{rank}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.meta}>
          <Text style={styles.name} numberOfLines={1}>
            {track.name || 'Unknown track'}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {track.artist || 'Unknown artist'}
          </Text>
          {typeof track.popularity === 'number' && track.popularity > 0 ? (
            <View style={styles.popRow}>
              <Ionicons name="flame" size={10} color={colors.accent} />
              <Text style={styles.popText}>{track.popularity}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.openBadge}>
          <Ionicons name="play" size={14} color={colors.text} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 10,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  artWrap: { position: 'relative' },
  art: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  artFallback: { alignItems: 'center', justifyContent: 'center' },
  rank: {
    position: 'absolute',
    top: -6,
    left: -6,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 5,
    borderRadius: 11,
    backgroundColor: colors.bg,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: { color: colors.text, fontSize: 11, fontWeight: '800' },
  meta: { flex: 1, marginHorizontal: spacing.md },
  name: { color: colors.text, fontSize: 15, fontWeight: '800' },
  artist: { color: colors.textMuted, fontSize: 13, marginTop: 3 },
  popRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  popText: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  openBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
