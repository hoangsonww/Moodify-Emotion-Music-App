import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import Screen from '../components/Screen';
import AppButton from '../components/AppButton';
import { useAuth } from '../context/AuthContext';
import { getProfile } from '../services/emotion';
import { colors, gradient, radius, spacing } from '../../theme';

export default function ProfileScreen({ navigation }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setProfile(await getProfile());
    } catch (e) {
      // leave profile null -> fallback values are shown
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const moods = (profile?.mood_history || []).slice(-15).reverse();
  const username = profile?.username || user?.username || 'You';

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
        <View style={styles.card}>
          <LinearGradient
            colors={gradient.colors}
            start={gradient.start}
            end={gradient.end}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>{username.charAt(0).toUpperCase()}</Text>
          </LinearGradient>
          <Text style={styles.name}>{username}</Text>
          {profile?.email ? <Text style={styles.email}>{profile.email}</Text> : null}
        </View>

        <View style={styles.stats}>
          <Stat label="Moods logged" value={(profile?.mood_history || []).length} />
          <Stat label="Saved tracks" value={(profile?.recommendations || []).length} />
          <Stat label="Listened" value={(profile?.listening_history || []).length} />
        </View>

        <Text style={styles.section}>Recent moods</Text>
        {moods.length ? (
          <View style={styles.chips}>
            {moods.map((mood, index) => (
              <View key={`${mood}-${index}`} style={styles.chip}>
                <Text style={styles.chipText}>{mood}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.empty}>No moods logged yet — analyze one from the home screen.</Text>
        )}

        <Text style={styles.section}>Recent tracks</Text>
        {(profile?.listening_history || []).length ? (
          <View style={styles.chips}>
            {(profile.listening_history || [])
              .slice(-15)
              .reverse()
              .map((track, index) => (
                <Pressable
                  key={`${track}-${index}`}
                  onPress={() => openInSpotify(track)}
                  style={({ pressed }) => [
                    styles.chip,
                    styles.trackChip,
                    pressed && styles.chipPressed,
                  ]}
                >
                  <Text style={styles.chipText} numberOfLines={1}>
                    {track}
                  </Text>
                </Pressable>
              ))}
          </View>
        ) : (
          <Text style={styles.empty}>No tracks played yet — open one from the Results screen.</Text>
        )}

        <AppButton
          title="Settings"
          icon="settings-outline"
          onPress={() => navigation.navigate('Settings')}
          style={{ marginTop: spacing.xl }}
        />
      </ScrollView>
    </Screen>
  );
}

function openInSpotify(entry) {
  const url = `https://open.spotify.com/search/${encodeURIComponent(entry)}`;
  Linking.openURL(url).catch(() => {});
}

function Stat({ label, value }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 34, fontWeight: '900' },
  name: { color: colors.text, fontSize: 22, fontWeight: '900', marginTop: spacing.md },
  email: { color: colors.textMuted, fontSize: 14, marginTop: 3 },
  stats: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  statValue: { color: colors.primary, fontSize: 22, fontWeight: '900' },
  statLabel: { color: colors.textMuted, fontSize: 11, marginTop: 3, textAlign: 'center' },
  section: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  trackChip: { maxWidth: '100%' },
  chipPressed: { opacity: 0.7 },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
  empty: { color: colors.textMuted, fontSize: 14 },
});
