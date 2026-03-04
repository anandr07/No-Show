import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSpring,
  FadeInDown,
  ZoomIn,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';
import { useGame } from '@/context/GameContext';

export default function ResultsScreen() {
  const insets = useSafeAreaInsets();
  const { game, resetGame, startGame, startGameVsBots, playerNames, gameMode, humanPlayerIndex } = useGame();

  const webTop = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const webBottom = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  useEffect(() => {
    if (!game) {
      router.replace('/');
    }
  }, [game]);

  if (!game) return null;

  const sorted = [...game.players].sort((a, b) => a.score - b.score);
  const winner = game.winner ?? sorted[0];

  const handlePlayAgain = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (gameMode === 'vs_bots' && game) {
      const humanPlayer = game.players[humanPlayerIndex];
      const botCount = game.players.filter(p => p.isBot).length;
      startGameVsBots(humanPlayer.name, botCount);
    } else {
      startGame(playerNames);
    }
    router.replace('/game');
  };

  const handleHome = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    resetGame();
    router.replace('/');
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0A1628', '#0D1F3C', '#091424']}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, { paddingTop: webTop + 12 }]}>
        <Pressable
          onPress={handleHome}
          hitSlop={12}
          style={({ pressed }) => [styles.homeBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="home-outline" size={22} color={Colors.textSecondary} />
        </Pressable>
        <Text style={styles.headerTitle}>Results</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: webBottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={ZoomIn.duration(500).delay(100)} style={styles.winnerSection}>
          <View style={styles.trophyContainer}>
            <Text style={styles.trophyIcon}>♛</Text>
          </View>
          <Text style={styles.winnerLabel}>Winner</Text>
          <Text style={styles.winnerName}>
            {gameMode === 'vs_bots' && !winner.isBot ? 'You Win!' : winner.name}
          </Text>
          <Text style={styles.winnerScore}>{winner.score} points</Text>
        </Animated.View>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Final Scores</Text>

        {sorted.map((player, index) => {
          const isWinner = player.id === winner.id;
          const medals = ['♛', '②', '③', '④', '⑤', '⑥'];

          return (
            <Animated.View
              key={player.id}
              entering={FadeInDown.delay(200 + index * 80).duration(400)}
              style={[
                styles.playerRow,
                isWinner && styles.playerRowWinner,
                player.eliminated && styles.playerRowEliminated,
              ]}
            >
              <View style={styles.rankBadge}>
                <Text style={[styles.rankText, isWinner && styles.rankTextWinner]}>
                  {index + 1}
                </Text>
              </View>

              <View style={styles.playerInfo}>
                <View style={styles.playerNameRow}>
                  {player.isBot && (
                    <Ionicons name="hardware-chip-outline" size={13} color={isWinner ? Colors.gold : Colors.textMuted} />
                  )}
                  <Text style={[styles.playerName, isWinner && styles.playerNameWinner]}>
                    {gameMode === 'vs_bots' && !player.isBot ? 'You' : player.name}
                  </Text>
                </View>
                {player.eliminated && (
                  <Text style={styles.eliminatedTag}>Eliminated at 99+</Text>
                )}
              </View>

              <View style={styles.scoreContainer}>
                <Text style={[styles.finalScore, isWinner && styles.finalScoreWinner]}>
                  {player.score}
                </Text>
                <Text style={styles.scoreUnit}>pts</Text>
              </View>
            </Animated.View>
          );
        })}

        <Animated.View entering={FadeInDown.delay(600)} style={styles.statsBox}>
          <Text style={styles.statsTitle}>Game Summary</Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{game.roundNumber}</Text>
              <Text style={styles.statLabel}>Rounds</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>{game.players.length}</Text>
              <Text style={styles.statLabel}>Players</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statValue}>
                {game.players.filter(p => p.eliminated).length}
              </Text>
              <Text style={styles.statLabel}>Eliminated</Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      <Animated.View
        entering={FadeInDown.delay(700)}
        style={[styles.footer, { paddingBottom: webBottom + 16 }]}
      >
        <Pressable
          onPress={handlePlayAgain}
          style={({ pressed }) => [styles.playAgainBtn, pressed && { opacity: 0.88, transform: [{ scale: 0.97 }] }]}
        >
          <LinearGradient
            colors={[Colors.gold, Colors.goldDark]}
            style={styles.playAgainGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="refresh" size={18} color="#0A1628" />
            <Text style={styles.playAgainText}>Play Again</Text>
          </LinearGradient>
        </Pressable>

        <Pressable
          onPress={handleHome}
          style={({ pressed }) => [styles.homeButton, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.homeButtonText}>Back to Home</Text>
        </Pressable>
      </Animated.View>
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
  homeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 22,
    color: Colors.text,
    letterSpacing: 0.5,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 16,
  },
  winnerSection: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  trophyContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(212,175,55,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.borderBright,
    marginBottom: 4,
  },
  trophyIcon: {
    fontSize: 32,
    color: Colors.gold,
  },
  winnerLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.textMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  winnerName: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 36,
    color: Colors.gold,
    textAlign: 'center',
  },
  winnerScore: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: Colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },
  sectionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: Colors.textMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  playerRowWinner: {
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderColor: Colors.goldDark,
  },
  playerRowEliminated: {
    opacity: 0.55,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    color: Colors.textSecondary,
  },
  rankTextWinner: {
    color: Colors.gold,
  },
  playerInfo: {
    flex: 1,
    gap: 2,
  },
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  playerName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: Colors.text,
  },
  playerNameWinner: {
    color: Colors.gold,
  },
  eliminatedTag: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.red,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  finalScore: {
    fontFamily: 'Inter_700Bold',
    fontSize: 24,
    color: Colors.text,
  },
  finalScoreWinner: {
    color: Colors.gold,
  },
  scoreUnit: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textMuted,
  },
  statsBox: {
    padding: 18,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 14,
    marginTop: 4,
  },
  statsTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    color: Colors.gold,
  },
  statLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.border,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 10,
    backgroundColor: 'rgba(10,22,40,0.95)',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  playAgainBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  playAgainGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 17,
  },
  playAgainText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    color: '#0A1628',
    letterSpacing: 0.5,
  },
  homeButton: {
    paddingVertical: 13,
    alignItems: 'center',
  },
  homeButtonText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: Colors.textMuted,
  },
});
