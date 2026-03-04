import React from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Rule({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <View style={styles.rule}>
      <View style={styles.ruleIcon}>
        <Ionicons name={icon as any} size={20} color={Colors.gold} />
      </View>
      <View style={styles.ruleText}>
        <Text style={styles.ruleTitle}>{title}</Text>
        <Text style={styles.ruleBody}>{body}</Text>
      </View>
    </View>
  );
}

function CardValueRow({ rank, value }: { rank: string; value: string }) {
  return (
    <View style={styles.valueRow}>
      <Text style={styles.valueRank}>{rank}</Text>
      <Text style={styles.valueSep}>=</Text>
      <Text style={styles.valuePoints}>{value}</Text>
    </View>
  );
}

export default function HowToPlayScreen() {
  const insets = useSafeAreaInsets();
  const webTop = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const webBottom = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

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
        <Text style={styles.headerTitle}>How to Play</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: webBottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          No Show is a strategic card game where players compete to have the lowest hand score. 
          Form combos to reduce your score, then call "Show" when you're ready.
        </Text>

        <Section title="Objective">
          <Rule
            icon="trophy-outline"
            title="Win the game"
            body="Be the last player with a score under 99. Each round, minimize your hand score through strategic play."
          />
        </Section>

        <Section title="Setup">
          <Rule
            icon="people-outline"
            title="Players"
            body="3–6 players. Each receives 7 cards. One random player receives 8 cards and goes first."
          />
          <Rule
            icon="layers-outline"
            title="The Deck"
            body="Standard 52 cards. Remaining cards form the pickup deck. Top card starts the discard pile."
          />
        </Section>

        <Section title="Your Turn">
          <Rule
            icon="download-outline"
            title="1. Draw"
            body="Draw 1 card from the pickup deck OR take the top card from the discard pile."
          />
          <Rule
            icon="grid-outline"
            title="2. Form Combos (Optional)"
            body="Select 3+ consecutive rank cards for a Sequence, or 2+ same-rank cards for a Pair. Declared combos don't count toward your score."
          />
          <Rule
            icon="trash-outline"
            title="3. Discard"
            body="Discard exactly 1 card to the discard pile. You must end your turn with 7 cards in hand."
          />
        </Section>

        <Section title="Card Values">
          <View style={styles.valueTable}>
            <CardValueRow rank="A" value="1 point" />
            <CardValueRow rank="2–10" value="Face value" />
            <CardValueRow rank="J" value="11 points" />
            <CardValueRow rank="Q" value="12 points" />
            <CardValueRow rank="K" value="13 points" />
          </View>
        </Section>

        <Section title="Calling Show">
          <Rule
            icon="hand-left-outline"
            title="When to Show"
            body="On your turn, after drawing, you can press SHOW if you think you have the lowest score."
          />
          <Rule
            icon="checkmark-circle-outline"
            title="If you're lowest"
            body="Each other player adds the difference between their score and yours to their total score."
          />
          <Rule
            icon="warning-outline"
            title="If you're NOT lowest"
            body="You get a +15 point penalty added to your total score. Other players score nothing extra."
          />
        </Section>

        <Section title="Elimination">
          <Rule
            icon="skull-outline"
            title="Out at 99"
            body="Any player whose total score reaches or exceeds 99 is eliminated from future rounds."
          />
          <Rule
            icon="flag-outline"
            title="Game Over"
            body="The game ends when only one player remains. That player is the winner!"
          />
        </Section>

        <Section title="Valid Combos">
          <View style={styles.comboExample}>
            <Text style={styles.comboExampleTitle}>Sequence (3+ consecutive ranks)</Text>
            <Text style={styles.comboExampleValid}>Valid: A-2-3, 5-6-7, 10-J-Q, J-Q-K</Text>
            <Text style={styles.comboExampleInvalid}>Invalid: 2-4-5, 10-Q-K (gaps not allowed)</Text>
            <Text style={styles.comboExampleNote}>Suit does not matter</Text>
          </View>
          <View style={styles.comboExample}>
            <Text style={styles.comboExampleTitle}>Pair (2+ same rank)</Text>
            <Text style={styles.comboExampleValid}>Valid: 10♥-10♠, K♣-K♦-K♥</Text>
            <Text style={styles.comboExampleInvalid}>Invalid: 10♥-J♥ (different ranks)</Text>
            <Text style={styles.comboExampleNote}>Suit does not matter</Text>
          </View>
        </Section>
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 24,
  },
  intro: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 24,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    color: Colors.gold,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  rule: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ruleIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(212,175,55,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleText: {
    flex: 1,
    gap: 3,
  },
  ruleTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.text,
  },
  ruleBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  valueTable: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  valueRank: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: Colors.gold,
    width: 50,
  },
  valueSep: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.textMuted,
  },
  valuePoints: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colors.textSecondary,
  },
  comboExample: {
    padding: 14,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  comboExampleTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.text,
    marginBottom: 2,
  },
  comboExampleValid: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.green,
  },
  comboExampleInvalid: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.red,
  },
  comboExampleNote: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
