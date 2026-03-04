import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  cancelAnimation,
  FadeIn,
  ZoomIn,
  FadeInDown,
  FadeOut,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';
import { useGame } from '@/context/GameContext';
import { CardView, CardBack } from '@/components/CardView';
import { getHandScore } from '@/lib/gameEngine';

function ThinkingDot({ delay }: { delay: number }) {
  const opacity = useSharedValue(0.3);
  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 400 }),
          withTiming(0.3, { duration: 400 })
        ),
        -1,
        false
      )
    );
    return () => { cancelAnimation(opacity); };
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.thinkingDot, style]} />;
}

function BotThinkingBanner({ botName }: { botName: string }) {
  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={styles.thinkingBanner}>
      <View style={styles.thinkingContent}>
        <View style={styles.thinkingDots}>
          <ThinkingDot delay={0} />
          <ThinkingDot delay={150} />
          <ThinkingDot delay={300} />
        </View>
        <Text style={styles.thinkingText}>{botName} is thinking...</Text>
      </View>
    </Animated.View>
  );
}

function BotActionBanner({ action }: { action: string }) {
  return (
    <Animated.View entering={FadeInDown.duration(300)} exiting={FadeOut.duration(300)} style={styles.actionBanner}>
      <Ionicons name="hardware-chip-outline" size={14} color={Colors.gold} />
      <Text style={styles.actionBannerText}>{action}</Text>
    </Animated.View>
  );
}

function ScorecardModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { game, gameMode, humanPlayerIndex } = useGame();
  const insets = useSafeAreaInsets();
  if (!game) return null;

  const activePlayers = game.players.filter(p => !p.eliminated);
  const eliminatedPlayers = game.players.filter(p => p.eliminated);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scorecardBackdrop} onPress={onClose}>
        <Pressable style={[styles.scorecardSheet, { paddingBottom: Math.max(insets.bottom, 24) }]} onPress={() => {}}>
          <View style={styles.scorecardHandle} />
          <View style={styles.scorecardHeader}>
            <Text style={styles.scorecardTitle}>Scorecard</Text>
            <Text style={styles.scorecardRound}>Round {game.roundNumber}</Text>
            <Pressable onPress={onClose} hitSlop={12} style={({ pressed }) => [styles.scorecardClose, pressed && { opacity: 0.6 }]}>
              <Ionicons name="close" size={20} color={Colors.textSecondary} />
            </Pressable>
          </View>
          <View style={styles.scorecardDivider} />
          {activePlayers.map(player => {
            const i = game.players.indexOf(player);
            const isCurrent = i === game.currentPlayerIndex;
            const isHuman = gameMode === 'vs_bots' && i === humanPlayerIndex;
            return (
              <View key={player.id} style={[styles.scorecardRow, isCurrent && styles.scorecardRowActive]}>
                <View style={styles.scorecardPlayerInfo}>
                  {player.isBot
                    ? <Ionicons name="hardware-chip-outline" size={15} color={isCurrent ? Colors.gold : Colors.textMuted} />
                    : <Ionicons name="person-outline" size={15} color={isCurrent ? Colors.gold : Colors.textMuted} />
                  }
                  <Text style={[styles.scorecardName, isCurrent && styles.scorecardNameActive]} numberOfLines={1}>
                    {isHuman ? 'You' : player.name}
                  </Text>
                  {isCurrent && (
                    <View style={styles.scorecardCurrentBadge}>
                      <Text style={styles.scorecardCurrentText}>Turn</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.scorecardScore, isCurrent && styles.scorecardScoreActive]}>{player.score}</Text>
              </View>
            );
          })}
          {eliminatedPlayers.length > 0 && (
            <>
              <View style={styles.scorecardDivider} />
              <Text style={styles.scorecardSectionLabel}>Eliminated</Text>
              {eliminatedPlayers.map(player => {
                const i = game.players.indexOf(player);
                const isHuman = gameMode === 'vs_bots' && i === humanPlayerIndex;
                return (
                  <View key={player.id} style={[styles.scorecardRow, styles.scorecardRowEliminated]}>
                    <View style={styles.scorecardPlayerInfo}>
                      {player.isBot
                        ? <Ionicons name="hardware-chip-outline" size={15} color={Colors.red} />
                        : <Ionicons name="person-outline" size={15} color={Colors.red} />
                      }
                      <Text style={[styles.scorecardName, styles.scorecardNameEliminated]} numberOfLines={1}>
                        {isHuman ? 'You' : player.name}
                      </Text>
                    </View>
                    <Text style={[styles.scorecardScore, styles.scorecardScoreEliminated]}>OUT</Text>
                  </View>
                );
              })}
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function PlayerInfoBar({ onPress }: { onPress: () => void }) {
  const { game } = useGame();
  if (!game) return null;

  const active = game.players.filter(p => !p.eliminated).length;
  const total = game.players.length;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.playerInfoButton, pressed && { opacity: 0.75 }]}
    >
      <View style={styles.playerInfoLeft}>
        <Ionicons name="people-outline" size={14} color={Colors.textMuted} />
        <Text style={styles.playerInfoCount}>{active}/{total} active</Text>
        <View style={styles.playerInfoSep} />
        <View style={styles.playerInfoDotRow}>
          {game.players.map((p, i) => (
            <View
              key={p.id}
              style={[
                styles.playerStatusDot,
                p.eliminated
                  ? styles.playerStatusDotEliminated
                  : i === game.currentPlayerIndex
                  ? styles.playerStatusDotActive
                  : styles.playerStatusDotIdle,
              ]}
            />
          ))}
        </View>
      </View>
      <View style={styles.playerInfoRight}>
        <Text style={styles.playerInfoScoresLabel}>Scores</Text>
        <Ionicons name="chevron-up" size={13} color={Colors.textMuted} />
      </View>
    </Pressable>
  );
}

function TableArea({ disabled }: { disabled?: boolean }) {
  const { game, doPickFromDeck, doPickFromAvailable } = useGame();
  if (!game) return null;

  const isPick = game.phase === 'pick';
  const canPick = isPick && !disabled;

  return (
    <View style={styles.tableArea}>
      <View style={styles.deckArea}>
        <View style={styles.deckSection}>
          <Text style={styles.deckLabel}>DECK</Text>
          <Pressable
            onPress={() => {
              if (canPick) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                doPickFromDeck();
              }
            }}
            disabled={!canPick}
            style={({ pressed }) => [
              styles.deckPressable,
              !canPick && styles.deckDisabled,
              pressed && canPick && { opacity: 0.8 },
            ]}
          >
            <CardBack />
            <View style={styles.deckCountBadge}>
              <Text style={styles.deckCountText}>{game.deck.length}</Text>
            </View>
            {canPick && (
              <View style={styles.pickGlow} />
            )}
          </Pressable>
          {canPick && <Text style={styles.pickHint}>tap to draw</Text>}
        </View>

        <View style={styles.deckDivider}>
          <Text style={styles.deckDividerText}>↔</Text>
        </View>

        <View style={styles.availableSection}>
          <Text style={styles.deckLabel}>AVAILABLE</Text>
          {game.currentAvailable.length === 0 ? (
            <View style={styles.emptyAvailable}>
              <Text style={styles.emptyAvailableText}>—</Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.availableScroll}
            >
              {game.currentAvailable.map(card => (
                <Pressable
                  key={card.id}
                  onPress={() => {
                    if (canPick) {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      doPickFromAvailable(card.id);
                    }
                  }}
                  disabled={!canPick}
                  style={({ pressed }) => [
                    styles.availableCardWrap,
                    canPick && styles.availableCardWrapActive,
                    pressed && canPick && { opacity: 0.75 },
                    !canPick && styles.availableCardWrapDimmed,
                  ]}
                >
                  <CardView card={card} size="small" />
                </Pressable>
              ))}
            </ScrollView>
          )}
          {canPick && game.currentAvailable.length > 0 && (
            <Text style={styles.pickHint}>tap a card to pick</Text>
          )}
        </View>
      </View>
    </View>
  );
}

function HumanHandArea() {
  const {
    game, gameMode, humanPlayerIndex, isHumanTurn,
    selectedCardIds, selectCard,
    doThrowCards, doShow,
    throwSelectionValid, showAllowed,
  } = useGame();
  const [showConfirm, setShowConfirm] = useState(false);

  if (!game) return null;

  const player = gameMode === 'vs_bots'
    ? game.players[humanPlayerIndex]
    : game.players[game.currentPlayerIndex];

  if (!player) return null;

  const canThrow = game.phase === 'throw' && isHumanTurn;
  const isPick = game.phase === 'pick' && isHumanTurn;

  const handleCardPress = (cardId: string) => {
    if (!canThrow) return;
    Haptics.selectionAsync();
    selectCard(cardId);
  };

  const handleThrow = () => {
    if (selectedCardIds.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    doThrowCards(selectedCardIds);
  };

  const handleShow = () => {
    setShowConfirm(true);
  };

  const confirmShow = () => {
    setShowConfirm(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    doShow();
  };

  const score = getHandScore(player.hand);
  const isHumanLabel = gameMode === 'vs_bots';

  const sortedHand = [...player.hand].sort((a, b) => b.value - a.value);

  return (
    <View style={styles.handArea}>
      <View style={styles.handHeader}>
        <View style={styles.handTitleRow}>
          {isHumanLabel && <Ionicons name="person" size={14} color={Colors.gold} />}
          <Text style={styles.handTitle}>
            {isHumanLabel ? 'Your Hand' : `${player.name}'s Hand`}
          </Text>
        </View>
        <View style={styles.scoreChip}>
          <Text style={styles.scoreChipLabel}>Score</Text>
          <Text style={styles.scoreChipValue}>{score}</Text>
        </View>
      </View>

      <View style={styles.handGrid}>
        {sortedHand.map(card => {
          const selected = selectedCardIds.includes(card.id);
          return (
            <View key={card.id} style={styles.handCardWrapper}>
              <CardView
                card={card}
                selected={selected}
                onPress={canThrow ? () => handleCardPress(card.id) : undefined}
                disabled={!canThrow}
                dimmed={!isHumanTurn && gameMode === 'vs_bots'}
              />
            </View>
          );
        })}
      </View>

      {canThrow && (
        <View style={styles.actionButtons}>
          {selectedCardIds.length > 0 ? (
            <Pressable
              onPress={handleThrow}
              style={({ pressed }) => [
                styles.actionBtn,
                throwSelectionValid ? styles.actionBtnThrow : styles.actionBtnInvalid,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Ionicons
                name={throwSelectionValid ? 'arrow-up-circle' : 'close-circle'}
                size={18}
                color={throwSelectionValid ? Colors.gold : Colors.red}
              />
              <Text style={[styles.actionBtnText, { color: throwSelectionValid ? Colors.gold : Colors.red }]}>
                {throwSelectionValid
                  ? (selectedCardIds.length === 1
                    ? 'Throw Card'
                    : `Throw ${selectedCardIds.length} Cards`)
                  : 'Invalid — select 1, pair of 2+, or sequence of 3+'}
              </Text>
            </Pressable>
          ) : (
            <Text style={styles.actionHint}>
              {showAllowed
                ? 'Select cards to throw, or call Show below'
                : `Select 1 card, a pair, or a sequence of 3+`}
            </Text>
          )}
        </View>
      )}

      {canThrow && showAllowed && selectedCardIds.length === 0 && !showConfirm && (
        <View style={styles.showButtonContainer}>
          <Pressable
            testID="show-button"
            onPress={handleShow}
            style={({ pressed }) => [styles.showButton, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.showButtonText}>Show</Text>
          </Pressable>
        </View>
      )}

      {showConfirm && (
        <View style={styles.showConfirmContainer}>
          <Text style={styles.showConfirmTitle}>Call Show?</Text>
          <Text style={styles.showConfirmBody}>
            Your hand score is {score}. If any player has a lower score, you get +15 penalty.
          </Text>
          <View style={styles.showConfirmButtons}>
            <Pressable
              testID="show-cancel-button"
              onPress={() => setShowConfirm(false)}
              style={({ pressed }) => [styles.showConfirmCancel, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.showConfirmCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              testID="show-confirm-button"
              onPress={confirmShow}
              style={({ pressed }) => [styles.showConfirmOk, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.showConfirmOkText}>Call Show</Text>
            </Pressable>
          </View>
        </View>
      )}

      {isPick && isHumanTurn && (
        <View style={styles.pickPhaseHint}>
          <Ionicons name="hand-left-outline" size={16} color={Colors.gold} />
          <Text style={styles.pickPhaseHintText}>Pick a card above — from Available or Deck</Text>
        </View>
      )}

      {!isHumanTurn && gameMode === 'vs_bots' && game.phase !== 'show_reveal' && game.phase !== 'game_over' && (
        <View style={styles.waitingOverlay}>
          <Text style={styles.waitingText}>Waiting for bots...</Text>
        </View>
      )}
    </View>
  );
}

function BotHandsViewer() {
  const { game, gameMode, humanPlayerIndex } = useGame();
  if (!game || gameMode !== 'vs_bots') return null;

  const bots = game.players.filter((p, i) => i !== humanPlayerIndex && !p.eliminated);
  if (bots.length === 0) return null;

  return (
    <View style={styles.botHandsSection}>
      <Text style={styles.botHandsTitle}>Opponents</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.botHandsScroll}>
        {bots.map(bot => {
          const isActive = game.players.indexOf(bot) === game.currentPlayerIndex;
          return (
            <View key={bot.id} style={[styles.botHandCard, isActive && styles.botHandCardActive]}>
              <View style={styles.botHandHeader}>
                <Ionicons name="hardware-chip-outline" size={12} color={isActive ? Colors.gold : Colors.textMuted} />
                <Text style={[styles.botHandName, isActive && styles.botHandNameActive]} numberOfLines={1}>
                  {bot.name}
                </Text>
                {isActive && <View style={styles.activeDot} />}
              </View>
              <View style={styles.botHandCards}>
                {bot.hand.slice(0, 5).map((_, ci) => (
                  <CardBack key={ci} size="tiny" />
                ))}
                {bot.hand.length > 5 && (
                  <Text style={styles.botMoreCards}>+{bot.hand.length - 5}</Text>
                )}
              </View>
              <Text style={styles.botHandCount}>{bot.hand.length} cards</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function ShowRevealModal() {
  const { game, gameMode, humanPlayerIndex, doNextRound } = useGame();
  if (!game || (game.phase !== 'show_reveal' && game.phase !== 'game_over')) return null;

  const isGameOver = game.phase === 'game_over';
  const showingPlayer = game.showCalledByIndex !== null ? game.players[game.showCalledByIndex] : null;

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isGameOver) {
      router.replace('/results');
    } else {
      doNextRound();
    }
  };

  return (
    <Modal transparent animationType="fade" visible>
      <View style={styles.modalOverlay}>
        <Animated.View entering={ZoomIn.duration(300)} style={styles.revealModal}>
          <LinearGradient colors={['#132038', '#0A1628']} style={styles.revealModalGradient}>
            <Text style={styles.revealTitle}>
              {isGameOver ? 'Game Over' : 'Show!'}
            </Text>

            {showingPlayer && (
              <Text style={styles.revealSubtitle}>
                {gameMode === 'vs_bots' && showingPlayer.id === game.players[humanPlayerIndex]?.id
                  ? 'You called Show'
                  : `${showingPlayer.name} called Show`}
              </Text>
            )}

            <View style={styles.revealScores}>
              {game.players.filter(p => !p.eliminated || game.phase === 'show_reveal').map((player, _) => {
                const roundScore = game.roundScores.find(rs => rs.playerId === player.id);
                const handScore = getHandScore(player.hand);
                const isShower = game.showCalledByIndex !== null && game.players[game.showCalledByIndex]?.id === player.id;
                const i = game.players.indexOf(player);
                const isHumanPlayer = gameMode === 'vs_bots' && i === humanPlayerIndex;

                return (
                  <View key={player.id} style={[styles.revealRow, isShower && styles.revealRowShower]}>
                    <View style={styles.revealPlayerInfo}>
                      {isShower && <Ionicons name="hand-left" size={13} color={Colors.gold} />}
                      {player.isBot && !isShower && <Ionicons name="hardware-chip-outline" size={13} color={Colors.textMuted} />}
                      <Text style={styles.revealPlayerName} numberOfLines={1}>
                        {isHumanPlayer ? 'You' : player.name}
                      </Text>
                    </View>
                    <View style={styles.revealPlayerHand}>
                      {player.hand.slice(0, 5).map(card => (
                        <CardView key={card.id} card={card} size="tiny" />
                      ))}
                      {player.hand.length > 5 && (
                        <Text style={styles.revealMoreCards}>+{player.hand.length - 5}</Text>
                      )}
                    </View>
                    <View style={styles.revealScoreCol}>
                      <Text style={styles.revealHandScore}>{handScore}</Text>
                      {roundScore && roundScore.added > 0 && (
                        <Text style={styles.revealPenalty}>+{roundScore.added}</Text>
                      )}
                      <Text style={styles.revealTotalScore}>{player.score} total</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {isGameOver && game.winner && (
              <Animated.View entering={FadeInDown.delay(400)} style={styles.winnerBanner}>
                <Text style={styles.winnerLabel}>Winner</Text>
                <Text style={styles.winnerName}>
                  {gameMode === 'vs_bots' && !game.winner.isBot ? 'You Win!' : game.winner.name}
                </Text>
              </Animated.View>
            )}

            <Pressable
              onPress={handleContinue}
              style={({ pressed }) => [styles.continueBtn, pressed && { opacity: 0.85 }]}
            >
              <LinearGradient
                colors={[Colors.gold, Colors.goldDark]}
                style={styles.continueBtnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.continueBtnText}>
                  {isGameOver ? 'See Final Results' : `Next Round ${game.roundNumber + 1}`}
                </Text>
                <Ionicons name="arrow-forward" size={18} color="#0A1628" />
              </LinearGradient>
            </Pressable>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

function PassDeviceOverlay({ onReady }: { onReady: () => void }) {
  return (
    <Modal transparent animationType="fade" visible>
      <View style={styles.passOverlay}>
        <Animated.View entering={FadeIn.duration(300)} style={styles.passCard}>
          <Ionicons name="phone-portrait-outline" size={48} color={Colors.gold} />
          <Text style={styles.passTitle}>Pass the device</Text>
          <Text style={styles.passSubtitle}>Cover the screen and hand it to the next player</Text>
          <Pressable
            onPress={onReady}
            style={({ pressed }) => [styles.readyBtn, pressed && { opacity: 0.85 }]}
          >
            <LinearGradient colors={[Colors.gold, Colors.goldDark]} style={styles.readyBtnGradient}>
              <Text style={styles.readyBtnText}>I'm Ready</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

export default function GameScreen() {
  const insets = useSafeAreaInsets();
  const {
    game, gameMode, resetGame,
    botThinking, botLastAction, isHumanTurn, humanPlayerIndex,
  } = useGame();
  const [showPassOverlay, setShowPassOverlay] = useState(false);
  const [showScorecard, setShowScorecard] = useState(false);

  const webTop = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;

  useEffect(() => {
    if (!game || gameMode !== 'pvp') return;
    if (game.phase === 'game_over' || game.phase === 'show_reveal') {
      setShowPassOverlay(false);
      return;
    }
    if (game.phase === 'pick') {
      setShowPassOverlay(true);
    }
  }, [game?.phase, game?.currentPlayerIndex, gameMode]);

  useEffect(() => {
    if (!game) {
      router.replace('/');
    }
  }, [game]);

  if (!game) return null;

  const currentPlayer = game.players[game.currentPlayerIndex];
  const displayCurrentName = gameMode === 'vs_bots' && game.currentPlayerIndex === humanPlayerIndex
    ? 'You'
    : currentPlayer.name;

  const handleQuit = () => {
    Alert.alert('Quit Game', 'Are you sure you want to quit?', [
      { text: 'Keep Playing', style: 'cancel' },
      {
        text: 'Quit',
        style: 'destructive',
        onPress: () => {
          resetGame();
          router.replace('/');
        },
      },
    ]);
  };

  const isBotTurn = gameMode === 'vs_bots' && currentPlayer.isBot;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0A1628', '#0D2040', '#091424']} style={StyleSheet.absoluteFill} />

      <View style={[styles.header, { paddingTop: webTop + 8 }]}>
        <Pressable onPress={handleQuit} hitSlop={12} style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.6 }]}>
          <Ionicons name="close" size={24} color={Colors.textSecondary} />
        </Pressable>
        <View style={styles.roundBadge}>
          <Text style={styles.roundText}>Round {game.roundNumber}</Text>
        </View>
        <View style={styles.turnIndicator}>
          {isBotTurn && <Ionicons name="hardware-chip-outline" size={13} color={Colors.gold} />}
          <Text style={styles.turnText} numberOfLines={1}>
            {displayCurrentName}
          </Text>
          <View style={[
            styles.phaseDot,
            game.phase === 'pick' ? styles.phaseDotPick : styles.phaseDotThrow,
          ]} />
        </View>
      </View>

      {gameMode === 'vs_bots' && isHumanTurn && (
        <Animated.View
          entering={FadeInDown.duration(250)}
          exiting={FadeOut.duration(200)}
          style={styles.yourTurnPopup}
        >
          <Ionicons name="hand-left-outline" size={16} color={Colors.gold} />
          <Text style={styles.yourTurnPopupText}>Your Turn</Text>
        </Animated.View>
      )}

      <PlayerInfoBar onPress={() => setShowScorecard(true)} />

      {botThinking && currentPlayer.isBot && (
        <BotThinkingBanner botName={currentPlayer.name} />
      )}

      {botLastAction && !botThinking && (
        <BotActionBanner action={botLastAction} />
      )}

      <TableArea disabled={!isHumanTurn} />

      {gameMode === 'vs_bots' && (
        <BotHandsViewer />
      )}

      <HumanHandArea />

      <ShowRevealModal />

      <ScorecardModal visible={showScorecard} onClose={() => setShowScorecard(false)} />

      {showPassOverlay && gameMode === 'pvp' && (
        <PassDeviceOverlay onReady={() => setShowPassOverlay(false)} />
      )}
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
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundBadge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  roundText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  turnIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: 130,
  },
  turnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.gold,
    flex: 1,
    textAlign: 'right',
  },
  yourTurnPopup: {
    marginHorizontal: 16,
    marginBottom: 4,
    marginTop: 4,
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.gold,
  },
  yourTurnPopupText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.gold,
    letterSpacing: 0.5,
  },
  phaseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  phaseDotPick: { backgroundColor: Colors.textMuted },
  phaseDotThrow: { backgroundColor: Colors.green },
  playerInfoButton: {
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playerInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  playerInfoCount: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.textMuted,
  },
  playerInfoSep: {
    width: 1,
    height: 12,
    backgroundColor: Colors.border,
  },
  playerInfoDotRow: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
  },
  playerStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  playerStatusDotActive: { backgroundColor: Colors.gold },
  playerStatusDotIdle: { backgroundColor: Colors.border },
  playerStatusDotEliminated: { backgroundColor: Colors.red, opacity: 0.4 },
  playerInfoRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  playerInfoScoresLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.textMuted,
  },
  scorecardBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  scorecardSheet: {
    backgroundColor: '#0F1E38',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  scorecardHandle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  scorecardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 8,
  },
  scorecardTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 18,
    color: Colors.textPrimary,
    flex: 1,
  },
  scorecardRound: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.textMuted,
  },
  scorecardClose: { padding: 4, marginLeft: 4 },
  scorecardDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 20,
    marginVertical: 4,
  },
  scorecardSectionLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  scorecardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    justifyContent: 'space-between',
  },
  scorecardRowActive: { backgroundColor: 'rgba(212,175,55,0.06)' },
  scorecardRowEliminated: { opacity: 0.55 },
  scorecardPlayerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  scorecardName: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: Colors.textSecondary,
    flex: 1,
  },
  scorecardNameActive: { color: Colors.textPrimary, fontFamily: 'Inter_600SemiBold' },
  scorecardNameEliminated: { color: Colors.textMuted, textDecorationLine: 'line-through' },
  scorecardCurrentBadge: {
    backgroundColor: 'rgba(212,175,55,0.15)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
  },
  scorecardCurrentText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: Colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scorecardScore: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    color: Colors.textSecondary,
    minWidth: 36,
    textAlign: 'right',
  },
  scorecardScoreActive: { color: Colors.gold },
  scorecardScoreEliminated: { color: Colors.red, fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  thinkingBanner: {
    marginHorizontal: 16,
    marginBottom: 4,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  thinkingContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thinkingDots: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  thinkingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.gold },
  thinkingText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  actionBanner: {
    marginHorizontal: 16,
    marginBottom: 4,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(212,175,55,0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBannerText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  tableArea: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  deckArea: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    gap: 16,
  },
  deckSection: { alignItems: 'center', gap: 6 },
  deckLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 1.5,
  },
  deckPressable: { position: 'relative' },
  deckDisabled: { opacity: 0.45 },
  deckCountBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: Colors.gold,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  deckCountText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    color: '#0A1628',
  },
  pickGlow: {
    position: 'absolute',
    inset: -3,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: Colors.gold,
  },
  pickHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.gold,
    letterSpacing: 0.3,
  },
  deckDivider: { paddingTop: 40 },
  deckDividerText: { fontSize: 20, color: Colors.textMuted },
  availableSection: {
    flex: 1,
    gap: 6,
  },
  availableScroll: {
    gap: 6,
    paddingRight: 4,
  },
  availableCardWrap: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  availableCardWrapActive: {
    borderColor: Colors.gold,
    shadowColor: Colors.gold,
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  availableCardWrapDimmed: { opacity: 0.6 },
  emptyAvailable: {
    width: 58,
    height: 80,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyAvailableText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 18,
    color: Colors.textMuted,
  },
  botHandsSection: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  botHandsTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  botHandsScroll: { paddingHorizontal: 16, gap: 10 },
  botHandCard: {
    paddingHorizontal: 10,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
    minWidth: 100,
  },
  botHandCardActive: {
    borderColor: Colors.gold,
    backgroundColor: 'rgba(212,175,55,0.07)',
  },
  botHandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  botHandName: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: Colors.textSecondary, flex: 1 },
  botHandNameActive: { color: Colors.gold },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.green },
  botHandCards: {
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  botMoreCards: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colors.textMuted,
    alignSelf: 'center',
  },
  botHandCount: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  handArea: { flex: 1, paddingTop: 10, gap: 8 },
  handHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  handTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  handTitle: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 18, color: Colors.text },
  scoreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: Colors.surfaceHigh,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  scoreChipLabel: { fontFamily: 'Inter_400Regular', fontSize: 12, color: Colors.textMuted },
  scoreChipValue: { fontFamily: 'Inter_700Bold', fontSize: 16, color: Colors.gold },
  handScroll: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 4,
    alignItems: 'flex-end',
  },
  handGrid: {
    paddingHorizontal: 16,
    paddingBottom: 4,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  handCardWrapper: {
    marginBottom: 4,
  },
  actionButtons: {
    paddingHorizontal: 16,
    alignItems: 'center',
    minHeight: 40,
    justifyContent: 'center',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    flexShrink: 1,
  },
  actionBtnThrow: {
    borderColor: 'rgba(212,175,55,0.5)',
    backgroundColor: 'rgba(212,175,55,0.1)',
  },
  actionBtnInvalid: {
    borderColor: 'rgba(231,76,60,0.3)',
    backgroundColor: 'rgba(231,76,60,0.06)',
  },
  actionBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, flexShrink: 1 },
  actionHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  showButtonContainer: { paddingHorizontal: 16 },
  showButton: {
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(231,76,60,0.12)',
    borderWidth: 1.5,
    borderColor: Colors.red,
  },
  showButtonText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: Colors.red,
    letterSpacing: 1,
  },
  showConfirmContainer: {
    marginHorizontal: 16,
    backgroundColor: 'rgba(10,22,40,0.95)',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.red,
    padding: 16,
    gap: 10,
  },
  showConfirmTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
    color: Colors.red,
    textAlign: 'center',
  },
  showConfirmBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  showConfirmButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  showConfirmCancel: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  showConfirmCancelText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.textSecondary,
  },
  showConfirmOk: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(231,76,60,0.15)',
    borderWidth: 1,
    borderColor: Colors.red,
  },
  showConfirmOkText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.red,
  },
  pickPhaseHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  pickPhaseHintText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  waitingOverlay: { alignItems: 'center', paddingHorizontal: 16 },
  waitingText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  revealModal: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderBright,
  },
  revealModalGradient: { padding: 20, gap: 14 },
  revealTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 30,
    color: Colors.gold,
    textAlign: 'center',
  },
  revealSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: -6,
  },
  revealScores: { gap: 8 },
  revealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  revealRowShower: {
    borderColor: Colors.goldDark,
    backgroundColor: 'rgba(212,175,55,0.06)',
  },
  revealPlayerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: 80,
  },
  revealPlayerName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.text,
    flex: 1,
  },
  revealPlayerHand: { flex: 1, flexDirection: 'row', gap: 2 },
  revealMoreCards: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colors.textMuted,
    alignSelf: 'center',
  },
  revealScoreCol: { alignItems: 'flex-end', minWidth: 55 },
  revealHandScore: { fontFamily: 'Inter_700Bold', fontSize: 18, color: Colors.gold },
  revealPenalty: { fontFamily: 'Inter_500Medium', fontSize: 11, color: Colors.red },
  revealTotalScore: { fontFamily: 'Inter_400Regular', fontSize: 11, color: Colors.textMuted },
  winnerBanner: {
    alignItems: 'center',
    padding: 14,
    backgroundColor: 'rgba(212,175,55,0.1)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    gap: 3,
  },
  winnerLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.textSecondary,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  winnerName: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 26, color: Colors.gold },
  continueBtn: { borderRadius: 12, overflow: 'hidden', marginTop: 2 },
  continueBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
  },
  continueBtnText: { fontFamily: 'Inter_700Bold', fontSize: 16, color: '#0A1628' },
  passOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  passCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    width: '100%',
    maxWidth: 340,
  },
  passTitle: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 26, color: Colors.text, textAlign: 'center' },
  passSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  readyBtn: { width: '100%', borderRadius: 12, overflow: 'hidden', marginTop: 8 },
  readyBtnGradient: { paddingVertical: 16, alignItems: 'center' },
  readyBtnText: { fontFamily: 'Inter_700Bold', fontSize: 17, color: '#0A1628' },
});
