// Inline 30-second Deezer preview player for a TrackCard.
//
// Counterpart to frontend/src/components/TrackPlayer.js -- same UX
// (one global active player; starting a new one pauses the previous),
// implemented natively with expo-av.
//
// Lifecycle:
//   * Loads the Sound lazily on first tap (no preload -- 60 tracks in
//     a list would otherwise eat memory + bandwidth).
//   * Polls progress via setOnPlaybackStatusUpdate.
//   * Unloads on unmount so a backgrounded list doesn't leak Sounds.

import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';

import { tapLight } from '../util/haptics';
import { colors, radius, spacing } from '../../theme';

// Module-level "currently playing" handle. When a new player starts it
// pauses the old one -- simpler than wiring a pub/sub bus and matches
// the web version's behaviour (only one preview audible at a time).
let activePauser = null;

function fmt(ms) {
  if (!ms || ms < 0) return '0:00';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? '0' : ''}${r}`;
}

export default function TrackPlayer({ src, onPlay, tint = colors.primary }) {
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const soundRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => () => {
    mountedRef.current = false;
    // Drop the global ref if we owned it, then unload.
    if (activePauser && activePauser.sound === soundRef.current) {
      activePauser = null;
    }
    if (soundRef.current) {
      soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
  }, []);

  const onStatus = (status) => {
    if (!mountedRef.current) return;
    if (!status.isLoaded) return;
    setPosition(status.positionMillis || 0);
    if (status.durationMillis) setDuration(status.durationMillis);
    setPlaying(!!status.isPlaying);
    if (status.didJustFinish) {
      setPlaying(false);
      setPosition(0);
      // Rewind so the next tap starts from 0.
      soundRef.current?.setPositionAsync(0).catch(() => {});
    }
  };

  const ensureLoaded = async () => {
    if (soundRef.current) return soundRef.current;
    const { sound } = await Audio.Sound.createAsync(
      { uri: src },
      { shouldPlay: false, progressUpdateIntervalMillis: 250 },
      onStatus,
    );
    soundRef.current = sound;
    return sound;
  };

  const pauseGlobal = async () => {
    if (activePauser && activePauser.sound !== soundRef.current) {
      try {
        await activePauser.pause();
      } catch {
        // ignore -- the other player may have unmounted between calls
      }
    }
  };

  const toggle = async () => {
    if (!src || busy) return;
    tapLight();
    setBusy(true);
    try {
      const sound = await ensureLoaded();
      const status = await sound.getStatusAsync();
      if (status.isLoaded && status.isPlaying) {
        await sound.pauseAsync();
      } else {
        await pauseGlobal();
        activePauser = {
          sound,
          pause: async () => {
            try {
              await sound.pauseAsync();
            } catch {}
            if (mountedRef.current) setPlaying(false);
          },
        };
        await sound.playAsync();
        if (onPlay) onPlay();
      }
    } catch {
      // Network blip / dead preview URL: surface nothing -- the user
      // can still tap Open-in-Deezer for the full track.
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  };

  const pct = duration > 0 ? Math.min(1, position / duration) : 0;

  if (!src) return null;

  return (
    <View style={styles.row}>
      <Pressable
        onPress={toggle}
        accessibilityLabel={playing ? 'Pause preview' : 'Play preview'}
        hitSlop={6}
        style={({ pressed }) => [
          styles.btn,
          { backgroundColor: tint },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Ionicons name={playing ? 'pause' : 'play'} size={14} color="#fff" />
      </Pressable>
      <View style={styles.barWrap}>
        <View style={styles.barBg} />
        <View style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: tint }]} />
      </View>
      <Text style={styles.time}>
        {fmt(position)} / {fmt(duration || 30000)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  btn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barWrap: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  barBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surfaceHi,
  },
  barFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 2,
  },
  time: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    minWidth: 64,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
});
