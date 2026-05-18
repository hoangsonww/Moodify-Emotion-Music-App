import React from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing } from '../../theme';

/** A single recommended track; tapping opens it in Spotify. */
export default function TrackCard({ track }) {
  const open = () => {
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
          <Ionicons name="musical-notes" size={22} color={colors.textMuted} />
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
      <Ionicons name="open-outline" size={20} color={colors.textMuted} />
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
  },
  pressed: { opacity: 0.8 },
  art: { width: 52, height: 52, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt },
  artFallback: { alignItems: 'center', justifyContent: 'center' },
  meta: { flex: 1, marginHorizontal: spacing.md },
  name: { color: colors.text, fontSize: 15, fontWeight: '700' },
  artist: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
});
