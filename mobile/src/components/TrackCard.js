import React, { useRef, useState } from 'react';
import {
  Animated,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import TrackPlayer from './TrackPlayer';
import { sendTrackFeedback } from '../services/feedback';
import { tapLight } from '../util/haptics';
import { colors, gradient, radius, shadows, spacing } from '../../theme';

/**
 * Recommended track card.
 *
 * Tapping the card opens the track in Deezer's web player and fires an
 * `open_deezer` feedback signal (soft positive). Two inline buttons
 * (👍 / 👎) capture the explicit like / unlike signals; a tap on the
 * active vote toggles it off locally so the user can correct an
 * accidental tap (no server-side undo signal exists, so the posterior
 * mass stays applied -- the toggle is a UI hint only).
 *
 * `contextEmotion` is the mood that produced the surrounding
 * recommendation list and is sent alongside every track signal so the
 * bandit can learn per-mood preferences.
 *
 * Optional `rank` renders a numeric badge for ordered lists.
 */
export default function TrackCard({ track, onPlay, rank, contextEmotion = null }) {
  const scale = useRef(new Animated.Value(1)).current;
  const [vote, setVote] = useState(null); // null | 'like' | 'unlike'

  const open = () => {
    tapLight();
    if (onPlay) onPlay(track);
    // Fire the open-in-Deezer signal before navigating away -- the
    // request is best-effort and won't block the Linking call.
    sendTrackFeedback({ track, signal: 'open_deezer', contextEmotion });
    if (track.external_url) Linking.openURL(track.external_url).catch(() => {});
  };

  const onVote = (signal) => {
    tapLight();
    if (vote === signal) {
      setVote(null);
      return;
    }
    setVote(signal);
    sendTrackFeedback({ track, signal, contextEmotion });
  };

  const animateTo = (v) =>
    Animated.spring(scale, { toValue: v, useNativeDriver: true, friction: 6 }).start();

  const likeColor = vote === 'like' ? colors.success : colors.textMuted;
  const unlikeColor = vote === 'unlike' ? colors.danger : colors.textMuted;

  return (
    <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
      <View style={styles.row}>
        <Pressable
          onPress={open}
          onPressIn={() => animateTo(0.98)}
          onPressOut={() => animateTo(1)}
          style={styles.openTarget}
          accessibilityLabel={`Open ${track.name || 'track'} in Deezer`}
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
        </Pressable>
        <View style={styles.actions}>
          <Pressable
            onPress={() => onVote('like')}
            hitSlop={6}
            accessibilityLabel={vote === 'like' ? 'Remove like' : 'Like track'}
            style={({ pressed }) => [styles.voteBtn, pressed && { opacity: 0.6 }]}
          >
            <Ionicons
              name={vote === 'like' ? 'thumbs-up' : 'thumbs-up-outline'}
              size={18}
              color={likeColor}
            />
          </Pressable>
          <Pressable
            onPress={() => onVote('unlike')}
            hitSlop={6}
            accessibilityLabel={
              vote === 'unlike' ? 'Remove dislike' : 'Dislike track'
            }
            style={({ pressed }) => [styles.voteBtn, pressed && { opacity: 0.6 }]}
          >
            <Ionicons
              name={vote === 'unlike' ? 'thumbs-down' : 'thumbs-down-outline'}
              size={18}
              color={unlikeColor}
            />
          </Pressable>
          <Pressable
            onPress={open}
            hitSlop={6}
            accessibilityLabel="Open in Deezer"
            style={({ pressed }) => [styles.openBadge, pressed && { opacity: 0.7 }]}
          >
            {/* Was a play icon -- moved to the inline preview player
                below. The badge now signals "open externally". */}
            <Ionicons name="open-outline" size={14} color={colors.text} />
          </Pressable>
        </View>
      </View>
      {track.preview_url ? (
        <TrackPlayer src={track.preview_url} onPlay={() => onPlay && onPlay(track)} />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 10,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  openTarget: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
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
  actions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  voteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
});
