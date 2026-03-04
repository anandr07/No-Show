import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Card, getSuitSymbol, isRedSuit } from '@/lib/gameEngine';
import Colors from '@/constants/colors';

interface CardViewProps {
  card: Card;
  selected?: boolean;
  onPress?: () => void;
  size?: 'normal' | 'small' | 'tiny';
  dimmed?: boolean;
  disabled?: boolean;
  inCombo?: boolean;
}

function CardContent({ card, size, selected, dimmed, inCombo }: {
  card: Card;
  size: 'normal' | 'small' | 'tiny';
  selected?: boolean;
  dimmed?: boolean;
  inCombo?: boolean;
}) {
  const isRed = isRedSuit(card.suit);
  const suitSymbol = getSuitSymbol(card.suit);
  const cardColor = isRed ? Colors.heartDiamond : Colors.clubSpade;

  const cardStyle = [
    styles.card,
    size === 'small' && styles.cardSmall,
    size === 'tiny' && styles.cardTiny,
    selected && styles.cardSelected,
    dimmed && styles.cardDimmed,
    inCombo && styles.cardInCombo,
  ];

  if (size === 'tiny') {
    return (
      <View style={cardStyle}>
        <Text style={[styles.rankTiny, { color: cardColor }]}>{card.rank}</Text>
        <Text style={[styles.suitTiny, { color: cardColor }]}>{suitSymbol}</Text>
      </View>
    );
  }

  if (size === 'small') {
    return (
      <View style={cardStyle}>
        <Text style={[styles.rankSmall, { color: cardColor }]}>{card.rank}</Text>
        <Text style={[styles.suitSmall, { color: cardColor }]}>{suitSymbol}</Text>
      </View>
    );
  }

  return (
    <View style={cardStyle}>
      {selected && <View style={styles.selectedIndicator} />}
      {inCombo && <View style={styles.comboIndicator} />}
      <View style={styles.cardCornerTL}>
        <Text style={[styles.rankLabel, { color: cardColor }]}>{card.rank}</Text>
        <Text style={[styles.suitLabel, { color: cardColor }]}>{suitSymbol}</Text>
      </View>
      <Text style={[styles.centerSuit, { color: cardColor }]}>{suitSymbol}</Text>
      <View style={styles.cardCornerBR}>
        <Text style={[styles.rankLabel, styles.flipped, { color: cardColor }]}>{card.rank}</Text>
        <Text style={[styles.suitLabel, styles.flipped, { color: cardColor }]}>{suitSymbol}</Text>
      </View>
    </View>
  );
}

export function CardView({ card, selected, onPress, size = 'normal', dimmed, disabled, inCombo }: CardViewProps) {
  if (!onPress) {
    return <CardContent card={card} size={size} selected={selected} dimmed={dimmed} inCombo={inCombo} />;
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        pressed && !disabled ? { transform: [{ scale: 0.95 }] } : {},
      ]}
    >
      <CardContent card={card} size={size} selected={selected} dimmed={dimmed} inCombo={inCombo} />
    </Pressable>
  );
}

export function CardBack({ size = 'normal' }: { size?: 'normal' | 'small' | 'tiny' }) {
  return (
    <View style={[
      styles.cardBack,
      size === 'small' && styles.cardSmall,
      size === 'tiny' && styles.cardTiny,
    ]}>
      <View style={styles.cardBackPattern}>
        <Text style={styles.cardBackSymbol}>♠</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 70,
    height: 100,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    padding: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
    justifyContent: 'space-between',
  },
  cardSmall: {
    width: 50,
    height: 70,
    borderRadius: 7,
    padding: 4,
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  cardTiny: {
    width: 36,
    height: 50,
    borderRadius: 5,
    padding: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  cardSelected: {
    borderColor: Colors.gold,
    borderWidth: 2.5,
    shadowColor: Colors.gold,
    shadowOpacity: 0.5,
    shadowRadius: 8,
    transform: [{ translateY: -10 }],
  },
  cardDimmed: {
    opacity: 0.5,
  },
  cardInCombo: {
    borderColor: Colors.green,
    borderWidth: 2,
    shadowColor: Colors.green,
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  selectedIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: Colors.gold,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
  },
  comboIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: Colors.green,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
  },
  cardCornerTL: {
    alignItems: 'flex-start',
  },
  cardCornerBR: {
    alignItems: 'flex-end',
  },
  rankLabel: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    lineHeight: 16,
  },
  suitLabel: {
    fontSize: 12,
    lineHeight: 14,
  },
  flipped: {
    transform: [{ rotate: '180deg' }],
  },
  centerSuit: {
    fontSize: 28,
    textAlign: 'center',
    lineHeight: 32,
  },
  rankSmall: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    lineHeight: 14,
  },
  suitSmall: {
    fontSize: 10,
    lineHeight: 12,
  },
  rankTiny: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
  },
  suitTiny: {
    fontSize: 9,
  },
  cardBack: {
    width: 70,
    height: 100,
    borderRadius: 10,
    backgroundColor: Colors.cardBack,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
  cardBackPattern: {
    width: 50,
    height: 80,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.borderBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBackSymbol: {
    fontSize: 24,
    color: Colors.gold,
    opacity: 0.6,
  },
});
