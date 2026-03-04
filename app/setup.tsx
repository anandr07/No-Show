import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeOut,
  Layout,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';
import { useGame } from '@/context/GameContext';

const MAX_PLAYERS = 6;
const MIN_PLAYERS = 3;
const MAX_BOTS = 5;
const MIN_BOTS = 2;

function PlayerRow({
  name,
  index,
  onChange,
  onRemove,
  canRemove,
}: {
  name: string;
  index: number;
  onChange: (val: string) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(200)}
      layout={Layout.springify()}
      style={styles.playerRow}
    >
      <View style={styles.playerIndexBadge}>
        <Text style={styles.playerIndexText}>{index + 1}</Text>
      </View>
      <View style={[styles.inputWrapper, focused && styles.inputWrapperFocused]}>
        <TextInput
          value={name}
          onChangeText={onChange}
          placeholder={`Player ${index + 1}`}
          placeholderTextColor={Colors.textMuted}
          style={styles.input}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          maxLength={20}
          returnKeyType="next"
          autoCapitalize="words"
        />
      </View>
      {canRemove && (
        <Pressable
          onPress={onRemove}
          hitSlop={12}
          style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="remove-circle" size={26} color={Colors.red} />
        </Pressable>
      )}
    </Animated.View>
  );
}

function BotCountSelector({
  count,
  onDecrease,
  onIncrease,
}: {
  count: number;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <View style={styles.botSelector}>
      <View style={styles.botSelectorInfo}>
        <Ionicons name="hardware-chip-outline" size={20} color={Colors.gold} />
        <View>
          <Text style={styles.botSelectorLabel}>AI Opponents</Text>
          <Text style={styles.botSelectorSub}>{count} bot{count !== 1 ? 's' : ''} at medium difficulty</Text>
        </View>
      </View>
      <View style={styles.botCountControl}>
        <Pressable
          onPress={onDecrease}
          disabled={count <= MIN_BOTS}
          style={({ pressed }) => [
            styles.countBtn,
            count <= MIN_BOTS && styles.countBtnDisabled,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons name="remove" size={20} color={count <= MIN_BOTS ? Colors.textMuted : Colors.gold} />
        </Pressable>
        <Text style={styles.botCount}>{count}</Text>
        <Pressable
          onPress={onIncrease}
          disabled={count >= MAX_BOTS}
          style={({ pressed }) => [
            styles.countBtn,
            count >= MAX_BOTS && styles.countBtnDisabled,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons name="add" size={20} color={count >= MAX_BOTS ? Colors.textMuted : Colors.gold} />
        </Pressable>
      </View>
    </View>
  );
}

export default function SetupScreen() {
  const insets = useSafeAreaInsets();
  const { startGame, startGameVsBots } = useGame();
  const { mode } = useLocalSearchParams<{ mode: string }>();
  const isVsBots = mode === 'vs_bots';

  const [names, setNames] = useState<string[]>(['Player 1', 'Player 2', 'Player 3']);
  const [humanName, setHumanName] = useState('Player 1');
  const [humanFocused, setHumanFocused] = useState(false);
  const [botCount, setBotCount] = useState(2);

  const webTop = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const webBottom = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  const handleStart = () => {
    if (isVsBots) {
      const trimmed = humanName.trim();
      if (!trimmed) {
        Alert.alert('Enter your name', 'Please enter your name to start.');
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      startGameVsBots(trimmed, botCount);
      router.replace('/game');
    } else {
      const trimmed = names.map(n => n.trim());
      if (trimmed.some(n => n.length === 0)) {
        Alert.alert('Missing Names', 'All players need a name to start.');
        return;
      }
      if (new Set(trimmed).size !== trimmed.length) {
        Alert.alert('Duplicate Names', 'All player names must be unique.');
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      startGame(trimmed);
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
          <Ionicons name="chevron-back" size={28} color={Colors.gold} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {isVsBots ? 'vs System' : 'Multiplayer'}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: webBottom + 100 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {isVsBots ? (
          <>
            <View style={styles.sectionHeader}>
              <Ionicons name="person-outline" size={16} color={Colors.gold} />
              <Text style={styles.sectionTitle}>Your Name</Text>
            </View>

            <View style={[styles.inputWrapper, humanFocused && styles.inputWrapperFocused]}>
              <TextInput
                value={humanName}
                onChangeText={setHumanName}
                placeholder="Enter your name"
                placeholderTextColor={Colors.textMuted}
                style={styles.input}
                onFocus={() => setHumanFocused(true)}
                onBlur={() => setHumanFocused(false)}
                maxLength={20}
                autoCapitalize="words"
                autoFocus
              />
            </View>

            <View style={[styles.sectionHeader, { marginTop: 8 }]}>
              <Ionicons name="hardware-chip-outline" size={16} color={Colors.gold} />
              <Text style={styles.sectionTitle}>AI Opponents</Text>
            </View>

            <BotCountSelector
              count={botCount}
              onDecrease={() => {
                Haptics.selectionAsync();
                setBotCount(c => Math.max(MIN_BOTS, c - 1));
              }}
              onIncrease={() => {
                Haptics.selectionAsync();
                setBotCount(c => Math.min(MAX_BOTS, c + 1));
              }}
            />

            <View style={styles.botPreview}>
              <Text style={styles.botPreviewLabel}>Bot Names (assigned randomly)</Text>
              <View style={styles.botNamePills}>
                {['Shadow', 'Viper', 'Nova', 'Rook', 'Blaze', 'Cipher'].slice(0, botCount).map(name => (
                  <View key={name} style={styles.botPill}>
                    <Ionicons name="hardware-chip-outline" size={12} color={Colors.textMuted} />
                    <Text style={styles.botPillText}>{name}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.ruleNote}>
              <Ionicons name="information-circle-outline" size={16} color={Colors.textMuted} />
              <Text style={styles.ruleNoteText}>
                You vs {botCount} AI opponent{botCount !== 1 ? 's' : ''}. Total {botCount + 1} players. Bots play automatically on their turn.
              </Text>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.subtitle}>
              {names.length} / {MAX_PLAYERS} players
            </Text>

            {names.map((name, index) => (
              <PlayerRow
                key={index}
                name={name}
                index={index}
                onChange={val => {
                  const updated = [...names];
                  updated[index] = val;
                  setNames(updated);
                }}
                onRemove={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setNames(prev => prev.filter((_, i) => i !== index));
                }}
                canRemove={names.length > MIN_PLAYERS}
              />
            ))}

            {names.length < MAX_PLAYERS && (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setNames(prev => [...prev, `Player ${prev.length + 1}`]);
                }}
                style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="add-circle-outline" size={22} color={Colors.gold} />
                <Text style={styles.addBtnText}>Add Player</Text>
              </Pressable>
            )}

            <View style={styles.ruleNote}>
              <Ionicons name="information-circle-outline" size={16} color={Colors.textMuted} />
              <Text style={styles.ruleNoteText}>
                One player randomly receives 8 cards and goes first. Pass the device between turns.
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: webBottom + 16 }]}>
        <Pressable
          onPress={handleStart}
          style={({ pressed }) => [styles.startBtn, pressed && { opacity: 0.88, transform: [{ scale: 0.97 }] }]}
        >
          <LinearGradient
            colors={[Colors.gold, Colors.goldDark]}
            style={styles.startBtnGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.startBtnText}>Deal Cards</Text>
            <Ionicons name="play" size={18} color="#0A1628" />
          </LinearGradient>
        </Pressable>
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
    letterSpacing: 0.5,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  sectionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.gold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  playerIndexBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  playerIndexText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.gold,
  },
  inputWrapper: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  inputWrapperFocused: {
    borderColor: Colors.gold,
    backgroundColor: Colors.surfaceHigh,
  },
  input: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    color: Colors.text,
  },
  removeBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    marginTop: 4,
  },
  addBtnText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: Colors.gold,
  },
  botSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  botSelectorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  botSelectorLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: Colors.text,
  },
  botSelectorSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
  botCountControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  countBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  countBtnDisabled: {
    opacity: 0.4,
  },
  botCount: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    color: Colors.gold,
    width: 32,
    textAlign: 'center',
  },
  botPreview: {
    gap: 8,
    padding: 14,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  botPreviewLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
    letterSpacing: 0.3,
  },
  botNamePills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  botPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: Colors.surfaceHigh,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  botPillText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  ruleNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 14,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ruleNoteText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textMuted,
    flex: 1,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  startBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  startBtnGradient: {
    paddingVertical: 18,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  startBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    color: '#0A1628',
    letterSpacing: 0.5,
  },
});
