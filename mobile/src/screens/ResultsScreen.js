import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import Screen from '../components/Screen';
import AppButton from '../components/AppButton';
import TrackCard from '../components/TrackCard';
import { getRecommendations } from '../services/emotion';
import { colors, gradient, radius, spacing } from '../../theme';

const EMOJI = {
  joy: '😊', happy: '😊', sadness: '😢', sad: '😢', anger: '😠', angry: '😠',
  love: '🥰', fear: '😨', fearful: '😨', neutral: '😌', surprised: '😲',
  surprise: '😲', calm: '😌', disgust: '😖', excited: '🤩',
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
      // keep the current list on failure
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
        showsVerticalScrollIndicator={false}
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
                <Text style={styles.degraded}>We weren't fully certain — here's our best guess.</Text>
              ) : null}
            </LinearGradient>

            <View style={styles.sectionRow}>
              <Text style={styles.section}>Recommended for you</Text>
              <Text style={styles.count}>{recs.length} tracks</Text>
            </View>
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
              icon="shuffle"
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
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  section: { color: colors.text, fontSize: 18, fontWeight: '800' },
  count: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  empty: { color: colors.textMuted, fontSize: 14, textAlign: 'center', marginVertical: spacing.lg },
  footer: { marginTop: spacing.lg },
});
