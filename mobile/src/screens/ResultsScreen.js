import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import Screen from '../components/Screen';
import AppButton from '../components/AppButton';
import TrackCard from '../components/TrackCard';
import { getRecommendations } from '../services/emotion';
import { colors, radius, spacing } from '../../theme';

const EMOJI = {
  joy: '😊', happy: '😊', sadness: '😢', sad: '😢', anger: '😠', angry: '😠',
  love: '🥰', fear: '😨', fearful: '😨', neutral: '😐', surprised: '😲',
  surprise: '😲', calm: '😌', disgust: '🤢', excited: '🤩',
};

export default function ResultsScreen({ route, navigation }) {
  const { emotion = 'neutral', recommendations = [], degraded = false } = route.params || {};
  const [recs, setRecs] = useState(recommendations);
  const [loading, setLoading] = useState(false);

  const shuffle = async () => {
    setLoading(true);
    try {
      const data = await getRecommendations(emotion);
      setRecs(data.recommendations || []);
    } catch (e) {
      // keep the current recommendations on failure
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen padded={false}>
      <FlatList
        data={recs}
        keyExtractor={(item, index) => `${item.external_url || item.name || 'track'}-${index}`}
        renderItem={({ item }) => <TrackCard track={item} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <View style={styles.moodCard}>
              <Text style={styles.emoji}>{EMOJI[String(emotion).toLowerCase()] || '🎧'}</Text>
              <Text style={styles.moodLabel}>Detected mood</Text>
              <Text style={styles.mood}>{emotion}</Text>
              {degraded ? (
                <Text style={styles.degraded}>
                  We weren't fully certain — here's our best guess.
                </Text>
              ) : null}
            </View>
            <Text style={styles.section}>Recommended for you</Text>
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            No recommendations came back. Try shuffling or analyzing again.
          </Text>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <AppButton
              title="Shuffle recommendations"
              variant="ghost"
              onPress={shuffle}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg },
  moodCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  emoji: { fontSize: 56 },
  moodLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing.sm,
  },
  mood: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    textTransform: 'capitalize',
    marginTop: 2,
  },
  degraded: { color: colors.textMuted, fontSize: 13, marginTop: spacing.sm, textAlign: 'center' },
  section: { color: colors.text, fontSize: 17, fontWeight: '800', marginBottom: spacing.md },
  empty: { color: colors.textMuted, fontSize: 14, textAlign: 'center', marginVertical: spacing.lg },
  footer: { marginTop: spacing.lg },
});
