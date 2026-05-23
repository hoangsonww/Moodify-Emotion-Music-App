// Bottom tab navigator with a custom pill-shaped tab bar.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import HomeScreen from '../screens/HomeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { select } from '../util/haptics';
import { colors, gradient, radius, shadows, spacing } from '../../theme';

const Tab = createBottomTabNavigator();

const ICONS = {
  Home: { active: 'sparkles', inactive: 'sparkles-outline' },
  Profile: { active: 'person', inactive: 'person-outline' },
  Settings: { active: 'settings', inactive: 'settings-outline' },
};

function CustomTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.host, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]} pointerEvents="box-none">
      <View style={[styles.bar, shadows.md]}>
        <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.barInner}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const focused = state.index === index;
            const icon = ICONS[route.name] || { active: 'ellipse', inactive: 'ellipse-outline' };

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                select();
                navigation.navigate(route.name, route.params);
              }
            };

            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel || route.name}
                style={styles.tabBtn}
              >
                {focused ? (
                  <LinearGradient
                    colors={gradient.colors}
                    start={gradient.start}
                    end={gradient.end}
                    style={styles.tabActive}
                  >
                    <Ionicons name={icon.active} size={18} color="#fff" />
                    <Text style={styles.tabActiveLabel}>{route.name}</Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.tabInactive}>
                    <Ionicons name={icon.inactive} size={22} color={colors.textMuted} />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export default function TabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
  },
  bar: {
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: 'rgba(20, 20, 28, 0.7)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  barInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  tabBtn: { flex: 1, alignItems: 'center' },
  tabActive: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    gap: 6,
  },
  tabActiveLabel: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 0.2 },
  tabInactive: { paddingVertical: 11, paddingHorizontal: 14 },
});
