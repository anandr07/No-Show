import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
  Share,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { useRoom } from '@/context/RoomContext';
import { useGame } from '@/context/GameContext';
import { getApiBase } from '@/lib/apiBase';

const MIN_PLAYERS_TO_START = 3;
const MAX_PLAYERS = 6;

export default function RoomLobbyScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { startRoomGame } = useGame();
  const {
    roomId,
    roomCode,
    players,
    isOwner,
    setReady,
    startMatch,
    leaveRoom,
    connectLobbyWs,
    error,
    loading,
  } = useRoom();

  const webTop = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const webBottom = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;
  const hasEnteredGameRef = useRef(false);

  useEffect(() => {
    if (!user || !roomId || !roomCode) {
      return;
    }
    connectLobbyWs({
      roomId,
      roomCode,
      userId: user.id,
      onGameStarted: () => {
        hasEnteredGameRef.current = true;
        router.replace('/game');
      },
    });
  }, [roomId, roomCode, user?.id]);

  // Fallback polling: if a client misses the GAME_STARTED WS event,
  // detect when the room status becomes in_game and join the game.
  useEffect(() => {
    if (!user || !roomId) return;

    const base = getApiBase();
    if (!base) return;
    const urlBase = base.replace(/\/$/, '');

    const poll = async () => {
      if (hasEnteredGameRef.current) return;
      try {
        const res = await fetch(`${urlBase}/api/rooms/${roomId}`);
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!data || hasEnteredGameRef.current) return;
        if (data.status === 'in_game' && data.game_id) {
          const gameRes = await fetch(`${urlBase}/api/games/${data.game_id}`);
          if (!gameRes.ok) return;
          const gameData = await gameRes.json();
          hasEnteredGameRef.current = true;
          startRoomGame({
            gameId: data.game_id as string,
            state: gameData.state,
            playerNames: gameData.playerNames,
            userId: user.id,
            humanPlayerIds: gameData.humanPlayerIds,
          });
          router.replace('/game');
        }
      } catch {
        // ignore poll errors
      }
    };

    const id = setInterval(poll, 2000);
    // run once immediately
    poll();
    return () => clearInterval(id);
  }, [roomId, user?.id]);

  const readyCount = players.filter(p => p.is_owner || p.is_ready).length;
  const allReady = players.length >= MIN_PLAYERS_TO_START && readyCount === players.length;
  const canStart = isOwner && allReady;
  const myPlayer = players.find((p) => p.user_id === user?.id);
  const myReady = myPlayer?.is_ready ?? false;

  const handleShareCode = () => {
    if (!roomCode) return;
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch { /* haptics not available */ }
    Share.share({
      message: `Join my No-Show game! Room code: ${roomCode}`,
      title: 'No-Show Room',
    }).catch(() => {});
  };

  const handleReady = () => {
    if (!user || !roomId) return;
    try { Haptics.selectionAsync(); } catch { /* haptics not available */ }
    setReady({ roomId, userId: user.id, isReady: !myReady });
  };

  const handleStart = async () => {
    if (!user || !roomId || !canStart) return;
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch { /* haptics not available */ }
    try {
      await startMatch({ roomId, userId: user.id });
      // Owner transitions to the game screen once the server confirms start.
      router.replace('/game');
    } catch {
      // error handled in context
    }
  };

  const handleLeave = () => {
    if (!user || !roomId) return;
    Alert.alert(
      'Leave room?',
      'You will need the room code to rejoin.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => {
            leaveRoom({ roomId, userId: user.id });
            router.replace('/');
          },
        },
      ]
    );
  };

  if (!user) {
    router.replace('/login');
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: webTop + 12 }]}>
        <Pressable onPress={handleLeave} hitSlop={12} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}>
          <Ionicons name="chevron-back" size={26} color={Colors.textSecondary} />
        </Pressable>
        <Text style={styles.headerTitle}>Room lobby</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: webBottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Room code</Text>
          <View style={styles.codeRow}>
            <Text style={styles.codeText} selectable>{roomCode}</Text>
            <Pressable onPress={handleShareCode} style={({ pressed }) => [styles.copyBtn, pressed && { opacity: 0.8 }]}>
              <Ionicons name="share-outline" size={22} color={Colors.gold} />
              <Text style={styles.copyBtnText}>Share</Text>
            </Pressable>
          </View>
          <Text style={styles.codeHint}>Share this code so friends can join (max {MAX_PLAYERS} players).</Text>
        </View>

        <Text style={styles.playersLabel}>Players ({players.length}/{MAX_PLAYERS})</Text>
        <View style={styles.playerList}>
          {players.map((p) => (
            <View key={p.user_id} style={styles.playerRow}>
              <View style={styles.playerInfo}>
                <Text style={styles.playerName}>{p.display_name}</Text>
                {p.is_owner && (
                  <View style={styles.ownerBadge}>
                    <Text style={styles.ownerBadgeText}>Owner</Text>
                  </View>
                )}
                {p.is_ready && (
                  <View style={styles.readyBadge}>
                    <Ionicons name="checkmark-circle" size={14} color={Colors.green} />
                    <Text style={styles.readyBadgeText}>Ready</Text>
                  </View>
                )}
                {!p.is_owner && !p.is_ready && isOwner && (
                  <View style={styles.notReadyBadge}>
                    <Text style={styles.notReadyBadgeText}>Not ready</Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>

        {players.length < MIN_PLAYERS_TO_START && (
          <Text style={styles.minHint}>
            At least {MIN_PLAYERS_TO_START} players needed to start. Waiting for more...
          </Text>
        )}
        {isOwner && players.length >= MIN_PLAYERS_TO_START && !allReady && (
          <Text style={styles.minHint}>
            All players must tap Ready before you can start.
          </Text>
        )}

        {!isOwner && (
          <Pressable
            onPress={handleReady}
            disabled={loading}
            style={({ pressed }) => [
              styles.readyButton,
              myReady && styles.readyButtonActive,
              (loading || pressed) && { opacity: 0.8 },
            ]}
          >
            <Ionicons
              name={myReady ? 'checkmark-circle' : 'ellipse-outline'}
              size={22}
              color={myReady ? Colors.green : Colors.textSecondary}
            />
            <Text style={[styles.readyButtonText, myReady && styles.readyButtonTextActive]}>
              {myReady ? 'Ready' : 'Not ready'}
            </Text>
          </Pressable>
        )}

        {isOwner && (
          <Pressable
            onPress={handleStart}
            disabled={loading || !canStart}
            style={({ pressed }) => [
              styles.startButton,
              (!canStart || loading || pressed) && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="play" size={22} color="#0A1628" />
            <Text style={styles.startButtonText}>Start match</Text>
          </Pressable>
        )}

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color={Colors.red} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
  backBtn: { padding: 8 },
  headerTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 20,
    color: Colors.text,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: Colors.textSecondary,
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 8 },
  codeCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  codeLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  codeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    letterSpacing: 4,
    color: Colors.gold,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  copyBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.gold,
  },
  codeHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 10,
  },
  playersLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  playerList: { gap: 10, marginBottom: 24 },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  playerName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: Colors.text,
  },
  ownerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(212,175,55,0.25)',
  },
  ownerBadgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: Colors.gold,
  },
  readyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  readyBadgeText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.green,
  },
  notReadyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  notReadyBadgeText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.textSecondary,
  },
  minHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 20,
  },
  readyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    marginBottom: 12,
  },
  readyButtonActive: {
    borderColor: Colors.green,
    backgroundColor: 'rgba(46,204,113,0.12)',
  },
  readyButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: Colors.textSecondary,
  },
  readyButtonTextActive: {
    color: Colors.green,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: Colors.gold,
    marginBottom: 12,
  },
  startButtonText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
    color: '#0A1628',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(231,76,60,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(231,76,60,0.4)',
  },
  errorText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colors.red,
    flex: 1,
  },
});

