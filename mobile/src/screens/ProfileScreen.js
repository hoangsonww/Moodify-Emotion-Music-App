import React, { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Animated,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import Screen from '../components/Screen';
import AppButton from '../components/AppButton';
import StatCard from '../components/StatCard';
import SectionHeader from '../components/SectionHeader';
import EmptyState from '../components/EmptyState';
import { useAuth } from '../context/AuthContext';
import { tapLight } from '../util/haptics';
import { uniqRecent } from '../util/dedupe';
import { getProfile } from '../services/emotion';
import { colors, gradient, moodPaletteFor, radius, shadows, spacing, typography } from '../../theme';

const TAB_BAR_BOTTOM = 110;

export default function ProfileScreen({ navigation }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    try {
      setProfile(await getProfile());
    } catch (e) {
      // leave profile null -> fallback values are shown
    } finally {
      setLoading(false);
      setRefreshing(false);
      Animated.timing(fade, { toValue: 1, duration: 360, useNativeDriver: true }).start();
    }
  }, [fade]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const moodsAll = profile?.mood_history || [];
  // Deduped, newest-first. Caps at 15 distinct moods so the chip row
  // doesn't grow unbounded for a power user.
  const moods = uniqRecent(moodsAll).slice(0, 15);
  const username = profile?.username || user?.username || 'You';
  const tracksAll = profile?.listening_history || [];
  // Same dedupe for the listening history -- the row shows the
  // 15 most-recent distinct tracks, newest first.
  const recentTracks = uniqRecent(tracksAll).slice(0, 15);

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.primary}
          />
        }
      >
        <Animated.View style={{ opacity: fade }}>
          <View style={[styles.card, shadows.md]}>
            <LinearGradient
              colors={gradient.colors}
              start={gradient.start}
              end={gradient.end}
              style={styles.avatarRing}
            >
              <View style={styles.avatarInner}>
                <Text style={styles.avatarText}>{username.charAt(0).toUpperCase()}</Text>
              </View>
            </LinearGradient>
            <Text style={styles.name}>{username}</Text>
            {profile?.email ? <Text style={styles.email}>{profile.email}</Text> : null}
            <View style={styles.cardActions}>
              <AppButton
                title="Settings"
                icon="settings-outline"
                variant="ghost"
                size="sm"
                onPress={() => navigation.navigate('Settings')}
                style={{ flex: 1 }}
              />
            </View>
          </View>

          <View style={styles.stats}>
            <StatCard
              icon="happy"
              label="Moods logged"
              value={moodsAll.length}
              tint={colors.primary}
              tintSoft={colors.primarySoft}
            />
            <StatCard
              icon="musical-notes"
              label="Saved tracks"
              value={(profile?.recommendations || []).length}
              tint={colors.accent}
              tintSoft={colors.accentSoft}
            />
            <StatCard
              icon="play-circle"
              label="Listened"
              value={tracksAll.length}
              tint={colors.success}
              tintSoft={colors.successSoft}
            />
          </View>

          <SectionHeader title="Recent moods" subtitle="Tap a mood to fetch new tracks." />
          {moods.length ? (
            <View style={styles.chips}>
              {moods.map((mood, index) => {
                const palette = moodPaletteFor(mood);
                return (
                  <Pressable
                    key={`${mood}-${index}`}
                    onPress={() => {
                      tapLight();
                      navigation.navigate('Results', {
                        emotion: mood,
                        recommendations: [],
                        history: moodsAll,
                        profileId: profile?.id || null,
                      });
                    }}
                    style={({ pressed }) => [styles.moodChip, pressed && { opacity: 0.7 }]}
                  >
                    <LinearGradient
                      pointerEvents="none"
                      colors={palette.colors}
                      style={styles.moodChipTint}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    />
                    <Text style={styles.moodChipEmoji}>{palette.emoji}</Text>
                    <Text style={styles.moodChipText}>{palette.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <EmptyState
              icon="happy-outline"
              title="No moods yet"
              message="Analyze your first mood from the Home tab to start your history."
            />
          )}

          <SectionHeader title="Recent tracks" subtitle="Recently opened from your results." />
          {tracksAll.length ? (
            <View style={styles.trackList}>
              {recentTracks.map((track, index) => (
                <Pressable
                  key={`${track}-${index}`}
                  onPress={() => openInPlayer(track)}
                  style={({ pressed }) => [styles.trackRow, pressed && { opacity: 0.7 }]}
                >
                  <View style={styles.trackIcon}>
                    <Ionicons name="musical-note" size={16} color={colors.primary} />
                  </View>
                  <Text style={styles.trackText} numberOfLines={1}>
                    {track}
                  </Text>
                  <Ionicons name="open-outline" size={16} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          ) : (
            <EmptyState
              icon="musical-notes-outline"
              title="No tracks played"
              message="Open a recommendation from the Results screen and it will show up here."
            />
          )}
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}

function openInPlayer(entry) {
  tapLight();
  const url = `https://www.deezer.com/search/${encodeURIComponent(entry)}`;
  Linking.openURL(url).catch(() => {});
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingTop: spacing.xl, paddingBottom: TAB_BAR_BOTTOM },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
  },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarInner: {
    flex: 1,
    alignSelf: 'stretch',
    borderRadius: 45,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.text, fontSize: 38, fontWeight: '900' },
  name: { ...typography.h2, color: colors.text },
  email: { color: colors.textMuted, fontSize: 14, marginTop: 4 },
  cardActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, alignSelf: 'stretch' },
  stats: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  moodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    gap: 6,
    overflow: 'hidden',
  },
  moodChipTint: { ...StyleSheet.absoluteFillObject, opacity: 0.18 },
  moodChipEmoji: { fontSize: 14 },
  moodChipText: { color: colors.text, fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },
  trackList: { gap: spacing.xs },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    gap: spacing.md,
  },
  trackIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '700' },
});
