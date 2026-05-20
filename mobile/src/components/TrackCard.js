import React from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing } from '../../theme';

/** A single recommended track; tapping opens it in Spotify. */
export default function TrackCard({ track, onPlay }) {
  const open = () => {
    if (onPlay) onPlay(track);
    if (track.external_url) Linking.openURL(track.external_url).catch(() => {});
  };
  return (
    <Pressable
      onPress={open}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {track.image_url ? (
        <Image source={{ uri: track.image_url }} style={styles.art} />
      ) : (
        <View style={[styles.art, styles.artFallback]}>
          <Ionicons name="musical-note" size={22} color={colors.textMuted} />
        </View>
      )}
      <View style={styles.meta}>
        <Text style={styles.name} numberOfLines={1}>
          {track.name || 'Unknown track'}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {track.artist || 'Unknown artist'}
        </Text>
      </View>
      <View style={styles.openBadge}>
        <Ionicons name="play" size={14} color={colors.text} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.85 },
  art: { width: 54, height: 54, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  artFallback: { alignItems: 'center', justifyContent: 'center' },
  meta: { flex: 1, marginHorizontal: spacing.md },
  name: { color: colors.text, fontSize: 15, fontWeight: '700' },
  artist: { color: colors.textMuted, fontSize: 13, marginTop: 3 },
  openBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
