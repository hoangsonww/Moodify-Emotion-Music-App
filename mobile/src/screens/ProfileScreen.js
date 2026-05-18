import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import Screen from '../components/Screen';
import AppButton from '../components/AppButton';
import { useAuth } from '../context/AuthContext';
import { getProfile } from '../services/emotion';
import { colors, radius, spacing } from '../../theme';

export default function ProfileScreen() {
  const { signOut, user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setProfile(await getProfile());
    } catch (e) {
      // leave profile null -> shows the fallback state
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
  const recCount = (profile?.recommendations || []).length;
  const listenCount = (profile?.listening_history || []).length;
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
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{username.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{username}</Text>
          {profile?.email ? <Text style={styles.email}>{profile.email}</Text> : null}
        </View>

        <View style={styles.stats}>
          <Stat label="Moods logged" value={(profile?.mood_history || []).length} />
          <Stat label="Saved tracks" value={recCount} />
          <Stat label="Listened" value={listenCount} />
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

        <AppButton
          title="Log out"
          variant="danger"
          onPress={signOut}
          style={{ marginTop: spacing.xl }}
        />
      </ScrollView>
    </Screen>
  );
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
    padding: spacing.lg,
    alignItems: 'center',
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '900' },
  name: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: spacing.md },
  email: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  stats: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  statValue: { color: colors.primary, fontSize: 22, fontWeight: '900' },
  statLabel: { color: colors.textMuted, fontSize: 12, marginTop: 2, textAlign: 'center' },
  section: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
  empty: { color: colors.textMuted, fontSize: 14 },
});
