import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Localization from 'expo-localization';

import Screen from '../components/Screen';
import AppButton from '../components/AppButton';
import TrackCard from '../components/TrackCard';
import OptionSheet from '../components/OptionSheet';
import MoodHero from '../components/MoodHero';
import MoodFeedbackWidget from '../components/MoodFeedbackWidget';
import EmptyState from '../components/EmptyState';
import { SkeletonRow } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import { tapLight } from '../util/haptics';
import { getRecommendations, saveListening } from '../services/emotion';
import { colors, moodPaletteFor, radius, spacing, typography } from '../../theme';

const SORTS = [
  { key: 'recommended', label: 'Recommended', icon: 'sparkles-outline' },
  { key: 'popular', label: 'Most popular', icon: 'flame-outline' },
  { key: 'title', label: 'Title (A–Z)', icon: 'text-outline' },
  { key: 'artist', label: 'Artist (A–Z)', icon: 'person-outline' },
];

const MARKETS = [
  { key: '', label: 'Global', icon: 'earth-outline' },
  { key: 'US', label: 'United States' },
  { key: 'GB', label: 'United Kingdom' },
  { key: 'CA', label: 'Canada' },
  { key: 'AU', label: 'Australia' },
  { key: 'IN', label: 'India' },
  { key: 'IE', label: 'Ireland' },
  { key: 'DE', label: 'Germany' },
  { key: 'FR', label: 'France' },
  { key: 'ES', label: 'Spain' },
  { key: 'IT', label: 'Italy' },
  { key: 'NL', label: 'Netherlands' },
  { key: 'SE', label: 'Sweden' },
  { key: 'BR', label: 'Brazil' },
  { key: 'MX', label: 'Mexico' },
  { key: 'JP', label: 'Japan' },
  { key: 'KR', label: 'South Korea' },
];

const PAGE = 12;

function sortTracks(tracks, key) {
  const list = [...tracks];
  if (key === 'popular') {
    list.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  } else if (key === 'title') {
    list.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  } else if (key === 'artist') {
    list.sort((a, b) => String(a.artist || '').localeCompare(String(b.artist || '')));
  }
  return list;
}

function deviceMarket() {
  try {
    const region = Localization.getLocales?.()?.[0]?.regionCode;
    return MARKETS.some((m) => m.key === region) ? region : '';
  } catch (e) {
    return '';
  }
}

export default function ResultsScreen({ route, navigation }) {
  const {
    emotion: initialEmotion = 'neutral',
    recommendations = [],
    degraded = false,
    history = [],
    profileId = null,
    inputType = null,
  } = route.params || {};

  // Emotion is stateful so the mood-correction widget can rewrite it
  // (and re-trigger a refetch against the corrected mood) without
  // popping back to HomeScreen.
  const [emotion, setEmotion] = useState(initialEmotion);
  const palette = moodPaletteFor(emotion);
  const toast = useToast();

  const onPlay = (track) => {
    if (profileId) saveListening(profileId, track).catch(() => {});
  };

  const [tracks, setTracks] = useState(recommendations);
  const [sortKey, setSortKey] = useState('recommended');
  const [market, setMarket] = useState(deviceMarket);
  const [visible, setVisible] = useState(PAGE);
  const [loading, setLoading] = useState(false);
  const [sheet, setSheet] = useState(null);

  const loadFor = async (mkt, mood = emotion) => {
    setLoading(true);
    try {
      const data = await getRecommendations(mood, mkt, history);
      setTracks(data.recommendations || []);
      setVisible(PAGE);
    } catch (e) {
      toast.show({ type: 'error', title: 'Could not refresh', message: 'Showing the previous list.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (market || history.length || !recommendations.length) loadFor(market);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sorted = useMemo(() => sortTracks(tracks, sortKey), [tracks, sortKey]);
  const shown = sorted.slice(0, visible);

  const sortLabel = SORTS.find((s) => s.key === sortKey)?.label || 'Recommended';
  const marketLabel = MARKETS.find((m) => m.key === market)?.label || 'Global';

  return (
    <Screen padded={false} moodTint={palette}>
      <FlatList
        data={shown}
        keyExtractor={(item, index) => `${item.external_url || item.name || 'track'}-${index}`}
        renderItem={({ item, index }) => (
          <TrackCard
            track={item}
            onPlay={onPlay}
            rank={sortKey === 'popular' ? index + 1 : undefined}
            contextEmotion={emotion}
          />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        onEndReachedThreshold={0.5}
        onEndReached={() => setVisible((v) => Math.min(v + PAGE, sorted.length))}
        ListHeaderComponent={
          <View>
            <MoodHero emotion={emotion} degraded={degraded} style={styles.hero} />

            {inputType ? (
              <MoodFeedbackWidget
                predicted={String(emotion || '').toLowerCase()}
                inputType={inputType}
                onCorrected={(actual) => {
                  setEmotion(actual);
                  loadFor(market, actual);
                }}
              />
            ) : null}

            <View style={styles.controls}>
              <ControlPill icon="swap-vertical" label={sortLabel} onPress={() => { tapLight(); setSheet('sort'); }} />
              <ControlPill icon="earth" label={marketLabel} onPress={() => { tapLight(); setSheet('market'); }} />
            </View>

            <View style={styles.sectionRow}>
              <Text style={styles.section}>
                {loading ? 'Finding your tracks…' : `${sorted.length} tracks for you`}
              </Text>
              <Pressable
                onPress={() => { tapLight(); loadFor(market); }}
                hitSlop={8}
                style={({ pressed }) => [styles.shuffleBtn, pressed && { opacity: 0.6 }]}
                disabled={loading}
              >
                <Ionicons name="shuffle" size={16} color={colors.primary} />
                <Text style={styles.shuffleLabel}>Shuffle</Text>
              </Pressable>
            </View>

            {loading && tracks.length === 0
              ? [0, 1, 2, 3].map((i) => <SkeletonRow key={i} />)
              : null}
          </View>
        }
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              icon="musical-notes-outline"
              title="No tracks found"
              message="Try shuffling or analyzing a different mood."
              actionLabel="Shuffle"
              onAction={() => loadFor(market)}
            />
          )
        }
        ListFooterComponent={
          <View style={styles.footer}>
            {shown.length < sorted.length ? (
              <Text style={styles.more}>
                Showing {shown.length} of {sorted.length} — scroll for more
              </Text>
            ) : null}
            {sorted.length > 0 ? (
              <AppButton
                title="Shuffle recommendations"
                icon="shuffle"
                variant="ghost"
                onPress={() => loadFor(market)}
                loading={loading}
              />
            ) : null}
            <AppButton
              title="Analyze another mood"
              icon="sparkles"
              onPress={() => navigation.navigate('Tabs', { screen: 'Home' })}
              style={{ marginTop: spacing.sm }}
            />
          </View>
        }
      />

      <OptionSheet
        visible={sheet === 'sort'}
        title="Sort by"
        options={SORTS}
        selectedKey={sortKey}
        onSelect={(key) => {
          setSortKey(key);
          setVisible(PAGE);
        }}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'market'}
        title="Market"
        options={MARKETS}
        selectedKey={market}
        onSelect={(key) => {
          setMarket(key);
          loadFor(key);
        }}
        onClose={() => setSheet(null)}
      />
    </Screen>
  );
}

function ControlPill({ icon, label, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
    >
      <Ionicons name={icon} size={15} color={colors.textMuted} />
      <Text style={styles.pillText} numberOfLines={1}>
        {label}
      </Text>
      <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, paddingTop: spacing.xxl, paddingBottom: spacing.xl },
  hero: { marginBottom: spacing.lg },
  controls: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  pillPressed: { opacity: 0.7 },
  pillText: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '700' },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  section: { ...typography.h3, color: colors.text },
  shuffleBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  shuffleLabel: { color: colors.primary, fontSize: 13, fontWeight: '800' },
  footer: { marginTop: spacing.lg },
  more: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
});
