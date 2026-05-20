import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Localization from 'expo-localization';

import Screen from '../components/Screen';
import AppButton from '../components/AppButton';
import TrackCard from '../components/TrackCard';
import OptionSheet from '../components/OptionSheet';
import { getRecommendations, saveListening } from '../services/emotion';
import { colors, gradient, radius, spacing } from '../../theme';

const EMOJI = {
  joy: '😊', happy: '😊', sadness: '😢', sad: '😢', anger: '😠', angry: '😠',
  love: '🥰', fear: '😨', fearful: '😨', neutral: '😌', surprised: '😲',
  surprise: '😲', calm: '😌', disgust: '😖', excited: '🤩',
};

const SORTS = [
  { key: 'recommended', label: 'Recommended' },
  { key: 'popular', label: 'Most popular' },
  { key: 'newest', label: 'Newest releases' },
  { key: 'title', label: 'Title (A–Z)' },
  { key: 'artist', label: 'Artist (A–Z)' },
];

const MARKETS = [
  { key: '', label: 'Global' },
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

/** 'recommended' keeps the curated order; the rest sort by track metadata. */
function sortTracks(tracks, key) {
  const list = [...tracks];
  if (key === 'popular') {
    list.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  } else if (key === 'newest') {
    list.sort((a, b) =>
      String(b.release_date || '').localeCompare(String(a.release_date || '')),
    );
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
    emotion = 'neutral',
    recommendations = [],
    degraded = false,
    history = [],
    profileId = null,
  } = route.params || {};

  const onPlay = (track) => {
    if (profileId) saveListening(profileId, track).catch(() => {});
  };

  const [tracks, setTracks] = useState(recommendations);
  const [sortKey, setSortKey] = useState('recommended');
  const [market, setMarket] = useState(deviceMarket);
  const [visible, setVisible] = useState(PAGE);
  const [loading, setLoading] = useState(false);
  const [sheet, setSheet] = useState(null); // 'sort' | 'market' | null

  const loadFor = async (mkt) => {
    setLoading(true);
    const data = await getRecommendations(emotion, mkt, history);
    setTracks(data.recommendations || []);
    setVisible(PAGE);
    setLoading(false);
  };

  // Re-fetch on mount when we can do better than the initial list: a
  // recognised device region scopes results, and a non-empty mood history
  // lets the recommender blend in the user's recurring mood.
  useEffect(() => {
    if (market || history.length) loadFor(market);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sorted = useMemo(() => sortTracks(tracks, sortKey), [tracks, sortKey]);
  const shown = sorted.slice(0, visible);

  const sortLabel = SORTS.find((s) => s.key === sortKey)?.label || 'Recommended';
  const marketLabel = MARKETS.find((m) => m.key === market)?.label || 'Global';

  return (
    <Screen padded={false}>
      <FlatList
        data={shown}
        keyExtractor={(item, index) => `${item.external_url || item.name || 'track'}-${index}`}
        renderItem={({ item }) => <TrackCard track={item} onPlay={onPlay} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        onEndReachedThreshold={0.5}
        onEndReached={() => setVisible((v) => Math.min(v + PAGE, sorted.length))}
        ListHeaderComponent={
          <View>
            <LinearGradient
              colors={gradient.colors}
              start={gradient.start}
              end={gradient.end}
              style={styles.moodCard}
            >
              <Text style={styles.emoji}>{EMOJI[String(emotion).toLowerCase()] || '🎧'}</Text>
              <Text style={styles.moodLabel}>DETECTED MOOD</Text>
              <Text style={styles.mood}>{emotion}</Text>
              {degraded ? (
                <Text style={styles.degraded}>
                  We weren't fully certain — here's our best guess.
                </Text>
              ) : null}
            </LinearGradient>

            <View style={styles.controls}>
              <ControlPill icon="swap-vertical" label={sortLabel} onPress={() => setSheet('sort')} />
              <ControlPill icon="earth" label={marketLabel} onPress={() => setSheet('market')} />
            </View>

            <Text style={styles.section}>
              {loading ? 'Finding your tracks…' : `${sorted.length} tracks for you`}
            </Text>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
          ) : (
            <Text style={styles.empty}>No tracks found — try shuffling or another mood.</Text>
          )
        }
        ListFooterComponent={
          <View style={styles.footer}>
            {shown.length < sorted.length ? (
              <Text style={styles.more}>
                Showing {shown.length} of {sorted.length} — scroll for more
              </Text>
            ) : null}
            <AppButton
              title="Shuffle recommendations"
              icon="shuffle"
              variant="ghost"
              onPress={() => loadFor(market)}
              loading={loading}
            />
            <AppButton
              title="Analyze another mood"
              onPress={() => navigation.navigate('Home')}
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
  list: { padding: spacing.lg },
  moodCard: {
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  emoji: { fontSize: 64 },
  moodLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: spacing.md,
  },
  mood: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '900',
    textTransform: 'capitalize',
    marginTop: 2,
  },
  degraded: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
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
  section: { color: colors.text, fontSize: 17, fontWeight: '800', marginBottom: spacing.md },
  empty: { color: colors.textMuted, fontSize: 14, textAlign: 'center', marginVertical: spacing.lg },
  footer: { marginTop: spacing.lg },
  more: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
});
