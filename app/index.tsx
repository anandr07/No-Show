import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Dimensions,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';
import { useGame } from '@/context/GameContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

const { width, height } = Dimensions.get('window');

function FloatingCard({ delay, x, rotation, scale }: {
  delay: number; x: number; rotation: number; scale: number;
}) {
  const translateY = useSharedValue(height + 100);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withRepeat(
        withTiming(-height - 100, { duration: 8000 + delay * 200, easing: Easing.linear }),
        -1,
        false
      )
    );
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.25, { duration: 1000 }),
          withTiming(0.25, { duration: 6000 }),
          withTiming(0, { duration: 1000 })
        ),
        -1,
        false
      )
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { rotate: `${rotation}deg` }, { scale }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.floatingCard, { left: x }, style]}>
      <View style={styles.floatingCardInner} />
    </Animated.View>
  );
}

const CARDS = [
  { delay: 0, x: width * 0.05, rotation: -15, scale: 0.8 },
  { delay: 1200, x: width * 0.2, rotation: 8, scale: 1.0 },
  { delay: 2400, x: width * 0.4, rotation: -5, scale: 0.9 },
  { delay: 600, x: width * 0.6, rotation: 12, scale: 1.1 },
  { delay: 1800, x: width * 0.75, rotation: -20, scale: 0.75 },
  { delay: 3000, x: width * 0.88, rotation: 6, scale: 0.85 },
];

function ModeCard({
  icon,
  title,
  subtitle,
  onPress,
  gradient,
  delay,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
  gradient: string[];
  delay: number;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 500 }));
    translateY.value = withDelay(delay, withTiming(0, { duration: 500, easing: Easing.out(Easing.quad) }));
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.modeCardWrapper, style]}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.modeCard, pressed && styles.modeCardPressed]}
      >
        <LinearGradient
          colors={gradient as [string, string]}
          style={styles.modeCardGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.modeCardIcon}>{icon}</View>
          <View style={styles.modeCardText}>
            <Text style={styles.modeCardTitle}>{title}</Text>
            <Text style={styles.modeCardSubtitle}>{subtitle}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.5)" />
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { resetGame } = useGame();
  const { user } = useAuth();
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.85);
  const subtitleOpacity = useSharedValue(0);

  const [profileOpen, setProfileOpen] = useState(false);
  const [username, setUsername] = useState('PlayerOne');
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [pendingUsername, setPendingUsername] = useState(username);
  const [friendInputOpen, setFriendInputOpen] = useState(false);
  const [newFriendName, setNewFriendName] = useState('');

  useEffect(() => {
    resetGame();
    logoOpacity.value = withDelay(200, withTiming(1, { duration: 700 }));
    logoScale.value = withDelay(200, withTiming(1, { duration: 700, easing: Easing.out(Easing.back(1.1)) }));
    subtitleOpacity.value = withDelay(700, withTiming(1, { duration: 500 }));
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single()
      .then(({ data, error }) => {
        if (cancelled || error || !data?.username) return;
        setUsername(data.username);
        setPendingUsername(data.username);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const subtitleStyle = useAnimatedStyle(() => ({ opacity: subtitleOpacity.value }));

  const webTop = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const webBottom = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  const closePanels = () => {
    setProfileOpen(false);
    setIsEditingUsername(false);
    setFriendInputOpen(false);
  };

  const handleVsSystem = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({ pathname: '/setup', params: { mode: 'vs_bots' } });
  };

  const handleMultiplayer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/room-entry');
  };

  const handleOnlineMultiplayer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/online-setup');
  };

  const handleHowToPlay = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/howtoplay');
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0A1628', '#0D1F3C', '#091424']}
        style={StyleSheet.absoluteFill}
      />

      {profileOpen && (
        <Pressable style={styles.overlayBackdrop} onPress={closePanels} />
      )}

      <View style={[styles.topBar, { paddingTop: webTop + 8 }]}>
        <Pressable
          onPress={() => {
            setProfileOpen(prev => !prev);
          }}
          style={({ pressed }) => [
            styles.profileIconButton,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Ionicons name="person-circle-outline" size={36} color={Colors.text} />
        </Pressable>
      </View>

      {profileOpen && (
        <View style={[styles.profilePanel, { top: webTop + 52 }]}>
          <Text style={styles.panelTitle}>Profile</Text>

          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>Username</Text>
            <Text style={styles.profileValue}>{username}</Text>
          </View>

          {isEditingUsername && (
            <View style={styles.profileInputRow}>
              <TextInput
                value={pendingUsername}
                onChangeText={setPendingUsername}
                placeholder="Enter new username"
                placeholderTextColor={Colors.textMuted}
                style={styles.textInput}
                maxLength={20}
                autoCapitalize="none"
              />
              <Pressable
                onPress={() => {
                  const trimmed = pendingUsername.trim();
                  if (trimmed.length > 0) {
                    setUsername(trimmed);
                    if (user) {
                      supabase
                        .from('profiles')
                        .update({ username: trimmed })
                        .eq('id', user.id)
                        .then(() => {
                          // best-effort sync; errors are ignored for now
                        });
                    }
                  }
                  setIsEditingUsername(false);
                }}
                style={({ pressed }) => [
                  styles.smallPrimaryButton,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={styles.smallPrimaryButtonText}>Save</Text>
              </Pressable>
            </View>
          )}

          <Pressable
            onPress={() => {
              setIsEditingUsername(prev => !prev);
              setPendingUsername(username);
            }}
            style={({ pressed }) => [
              styles.panelButton,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Ionicons name="pencil-outline" size={16} color={Colors.text} />
            <Text style={styles.panelButtonText}>Change Username</Text>
          </Pressable>

          <Pressable
            onPress={() => setFriendInputOpen(prev => !prev)}
            style={({ pressed }) => [
              styles.panelButton,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Ionicons name="person-add-outline" size={16} color={Colors.text} />
            <Text style={styles.panelButtonText}>Add Friends</Text>
          </Pressable>

          {friendInputOpen && (
            <View style={styles.profileInputRow}>
              <TextInput
                value={newFriendName}
                onChangeText={setNewFriendName}
                placeholder="Type a username (mock)"
                placeholderTextColor={Colors.textMuted}
                style={styles.textInput}
                maxLength={20}
                autoCapitalize="none"
              />
              <Pressable
                onPress={() => {
                  // Dummy behavior: clear field only
                  setNewFriendName('');
                }}
                style={({ pressed }) => [
                  styles.smallSecondaryButton,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={styles.smallSecondaryButtonText}>Send</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {CARDS.map((card, i) => (
        <FloatingCard key={i} {...card} />
      ))}

      <View style={[styles.content, { paddingTop: webTop + 20, paddingBottom: webBottom + 20 }]}>
        <Animated.View style={[styles.logoContainer, logoStyle]}>
          <View style={styles.suitRow}>
            <Text style={styles.suit}>♠</Text>
            <Text style={[styles.suit, styles.redSuit]}>♥</Text>
            <Text style={styles.suit}>♣</Text>
            <Text style={[styles.suit, styles.redSuit]}>♦</Text>
          </View>
          <Text style={styles.title}>No Show</Text>
          <View style={styles.titleUnderline} />
        </Animated.View>

        <Animated.View style={subtitleStyle}>
          <Text style={styles.subtitle}>The strategic card game of low scores and bold bluffs</Text>
        </Animated.View>

        <View style={styles.modesContainer}>
          <Text style={styles.modesLabel}>Choose Mode</Text>

          <ModeCard
            delay={900}
            icon={<Ionicons name="hardware-chip-outline" size={26} color={Colors.gold} />}
            title="vs System"
            subtitle="Play solo against AI bots"
            onPress={handleVsSystem}
            gradient={['rgba(212,175,55,0.18)', 'rgba(212,175,55,0.06)']}
          />

          <ModeCard
            delay={1050}
            icon={<Ionicons name="people-outline" size={26} color="#7EC8E3" />}
            title="Multiplayer"
            subtitle="Create a room and play with friends"
            onPress={handleMultiplayer}
            gradient={['rgba(126,200,227,0.15)', 'rgba(126,200,227,0.04)']}
          />

          <ModeCard
            delay={1200}
            icon={<Ionicons name="globe-outline" size={26} color="#9B7BFF" />}
            title="Online"
            subtitle="Match with players worldwide"
            onPress={handleOnlineMultiplayer}
            gradient={['rgba(155,123,255,0.18)', 'rgba(155,123,255,0.06)']}
          />
        </View>

        <Pressable
          onPress={handleHowToPlay}
          style={({ pressed }) => [styles.howToPlayBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="book-outline" size={16} color={Colors.textMuted} />
          <Text style={styles.howToPlayText}>How to Play</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  overlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    zIndex: 20,
  },
  topButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'rgba(7,16,30,0.9)',
  },
  friendsButton: {
    paddingHorizontal: 14,
  },
  topButtonText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.text,
  },
  profileIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(7,16,30,0.9)',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  profilePanel: {
    position: 'absolute',
    right: 16,
    width: 260,
    padding: 14,
    borderRadius: 16,
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
    zIndex: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  friendsPanel: {
    // Friends panel removed from homescreen (placeholder style kept intentionally empty)
  },
  panelTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 18,
    color: Colors.text,
    marginBottom: 4,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.textMuted,
  },
  profileValue: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.text,
  },
  profileInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  textInput: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    paddingHorizontal: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colors.text,
  },
  panelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  panelButtonText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colors.text,
  },
  smallPrimaryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: Colors.gold,
  },
  smallPrimaryButtonText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    color: '#0A1628',
  },
  smallSecondaryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'rgba(7,16,30,0.9)',
  },
  smallSecondaryButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.text,
  },
  friendRow: {
    // no-op: friends UI removed from homescreen
  },
  friendName: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colors.text,
  },
  friendStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotOnline: {
    backgroundColor: '#2ecc71',
  },
  statusDotOffline: {
    backgroundColor: Colors.border,
  },
  friendStatusText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
    paddingHorizontal: 24,
  },
  floatingCard: {
    position: 'absolute',
    bottom: -100,
    width: 60,
    height: 84,
    borderRadius: 8,
  },
  floatingCardInner: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: Colors.cardBack,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  logoContainer: { alignItems: 'center', gap: 6 },
  suitRow: { flexDirection: 'row', gap: 12, marginBottom: 2 },
  suit: { fontSize: 22, color: Colors.textSecondary },
  redSuit: { color: 'rgba(231,76,60,0.55)' },
  title: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 52,
    color: Colors.gold,
    letterSpacing: 2,
    textAlign: 'center',
  },
  titleUnderline: {
    width: 70,
    height: 2,
    backgroundColor: Colors.gold,
    borderRadius: 1,
    opacity: 0.5,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  modesContainer: {
    width: '100%',
    gap: 10,
  },
  modesLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 2,
    paddingLeft: 2,
  },
  modeCardWrapper: { width: '100%' },
  modeCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  modeCardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  modeCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 18,
    gap: 14,
  },
  modeCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeCardText: { flex: 1, gap: 2 },
  modeCardTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
    color: Colors.text,
    letterSpacing: 0.2,
  },
  modeCardSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  howToPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  howToPlayText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colors.textMuted,
  },
});
