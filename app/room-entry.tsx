import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { useRoom } from '@/context/RoomContext';

export default function RoomEntryScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { createRoom, joinRoom, error, loading } = useRoom();
  const [joinCode, setJoinCode] = useState('');
  const [displayName, setDisplayName] = useState('');

  const webTop = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const webBottom = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  useEffect(() => {
    if (!user) {
      router.replace('/login');
      return;
    }
    setDisplayName(user.email?.split('@')[0] || 'Player');
  }, [user?.id]);

  const handleCreateRoom = async () => {
    if (!user) return;
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    const name = (displayName || user.email || 'Player').trim().slice(0, 50);
    try {
      await createRoom({ userId: user.id, displayName: name });
      router.replace('/room-lobby');
    } catch {
      // error handled in context
    }
  };

  const handleJoinRoom = async () => {
    if (!user || !joinCode.trim()) return;
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    const name = (displayName || user.email || 'Player').trim().slice(0, 50);
    try {
      await joinRoom({ roomCode: joinCode.trim(), userId: user.id, displayName: name });
      router.replace('/room-lobby');
    } catch {
      // error handled in context
    }
  };

  if (!user) return null;

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
        <Text style={styles.headerTitle}>Play with Friends</Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.content, { paddingBottom: webBottom + 24 }]}
      >
        <Text style={styles.subtitle}>Create a room or join one with a code.</Text>

        <View style={styles.section}>
          <Text style={styles.label}>Your display name</Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Display name"
            placeholderTextColor={Colors.textMuted}
            style={styles.input}
            maxLength={50}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.buttons}>
          <Pressable
            onPress={handleCreateRoom}
            disabled={loading}
            style={({ pressed }) => [
              styles.primaryButton,
              (loading || pressed) && { opacity: 0.8 },
            ]}
          >
            <View style={styles.primaryButtonInner}>
              <LinearGradient
                colors={[Colors.gold, Colors.goldDark]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <Ionicons name="add-circle-outline" size={22} color="#0A1628" />
              <Text style={styles.primaryButtonText}>
                {loading ? 'Creating...' : 'Create Room'}
              </Text>
            </View>
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or join with code</Text>
            <View style={styles.dividerLine} />
          </View>

          <TextInput
            value={joinCode}
            onChangeText={(t) => setJoinCode(t.toUpperCase())}
            placeholder="Room code"
            placeholderTextColor={Colors.textMuted}
            style={styles.input}
            maxLength={6}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <Pressable
            onPress={handleJoinRoom}
            disabled={loading || joinCode.trim().length < 4}
            style={({ pressed }) => [
              styles.secondaryButton,
              (loading || pressed) && { opacity: 0.8 },
            ]}
          >
            <Ionicons name="log-in-outline" size={20} color={Colors.gold} />
            <Text style={styles.secondaryButtonText}>Join Room</Text>
          </Pressable>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color={Colors.red} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <Text style={styles.loadingHint}>Connecting to server…</Text>
        ) : null}
      </KeyboardAvoidingView>
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
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 8 },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 24,
  },
  section: { marginBottom: 20 },
  label: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    color: Colors.text,
  },
  buttons: { gap: 16 },
  primaryButton: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.gold,
    minHeight: 52,
    justifyContent: 'center',
  },
  primaryButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    position: 'relative',
  },
  primaryButtonText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
    color: '#0A1628',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textMuted,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  secondaryButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: Colors.gold,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
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
  loadingHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 12,
  },
});

