import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Dimensions,
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
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.85);
  const subtitleOpacity = useSharedValue(0);

  useEffect(() => {
    resetGame();
    logoOpacity.value = withDelay(200, withTiming(1, { duration: 700 }));
    logoScale.value = withDelay(200, withTiming(1, { duration: 700, easing: Easing.out(Easing.back(1.1)) }));
    subtitleOpacity.value = withDelay(700, withTiming(1, { duration: 500 }));
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const subtitleStyle = useAnimatedStyle(() => ({ opacity: subtitleOpacity.value }));

  const webTop = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const webBottom = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  const handleVsSystem = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({ pathname: '/setup', params: { mode: 'vs_bots' } });
  };

  const handleMultiplayer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({ pathname: '/setup', params: { mode: 'pvp' } });
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
            subtitle="Pass &amp; play with friends"
            onPress={handleMultiplayer}
            gradient={['rgba(126,200,227,0.15)', 'rgba(126,200,227,0.04)']}
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
