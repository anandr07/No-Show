import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { useGame } from '@/context/GameContext';

const PLAYER_OPTIONS = [3, 4, 5, 6] as const;

export default function OnlineSetupScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { joinOnlineGame, isOnlineLoading, onlineError } = useGame();

  const [desiredPlayers, setDesiredPlayers] = useState<number>(4);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const webTop = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const webBottom = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  const handleStartMatchmaking = async () => {
    if (!user) {
      router.push('/login');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStatusMessage('Searching for players...');

    await joinOnlineGame({
      desiredPlayers,
      userId: user.id,
      displayName: user.email ?? 'You',
    });

    if (!onlineError) {
      router.replace('/game');
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0A1628', '#0D1F3C', '#091424']}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, { paddingTop: webTop + 12 }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="chevron-back" size={26} color={Colors.textSecondary} />
        </Pressable>
        <Text style={styles.headerTitle}>Online Multiplayer</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={[styles.content, { paddingBottom: webBottom + 24 }]}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Players</Text>
          <Text style={styles.sectionSubtitle}>Choose how many players you want in the match.</Text>

          <View style={styles.optionRow}>
            {PLAYER_OPTIONS.map((opt) => {
              const selected = desiredPlayers === opt;
              return (
                <Pressable
                  key={opt}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setDesiredPlayers(opt);
                  }}
                  style={({ pressed }) => [
                    styles.optionChip,
                    selected && styles.optionChipSelected,
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Text style={[styles.optionChipText, selected && styles.optionChipTextSelected]}>
                    {opt} players
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.infoText}>
              If not enough players join within 60 seconds, open slots will be filled with smart bots.
            </Text>
          </View>

          {statusMessage && (
            <Text style={styles.statusText}>{statusMessage}</Text>
          )}

          {onlineError && (
            <Text style={styles.errorText}>{onlineError}</Text>
          )}

          <Pressable
            onPress={handleStartMatchmaking}
            disabled={isOnlineLoading}
            style={({ pressed }) => [
              styles.primaryBtn,
              (pressed || isOnlineLoading) && { opacity: 0.9 },
            ]}
          >
            <LinearGradient
              colors={[Colors.gold, Colors.goldDark]}
              style={styles.primaryBtnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="planet-outline" size={18} color="#0A1628" />
              <Text style={styles.primaryBtnText}>
                {isOnlineLoading ? 'Matching...' : 'Find Match'}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 22,
    color: Colors.text,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 14,
  },
  sectionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: Colors.text,
  },
  sectionSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textMuted,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
  },
  optionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceHigh,
  },
  optionChipSelected: {
    borderColor: Colors.gold,
    backgroundColor: 'rgba(212,175,55,0.12)',
  },
  optionChipText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  optionChipTextSelected: {
    color: Colors.gold,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceHigh,
  },
  infoText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
    flex: 1,
    lineHeight: 18,
  },
  statusText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  errorText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.red,
  },
  primaryBtn: {
    marginTop: 6,
    borderRadius: 14,
    overflow: 'hidden',
  },
  primaryBtnGradient: {
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: '#0A1628',
  },
});

