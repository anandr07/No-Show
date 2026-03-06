import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { signInWithEmail, signUpWithEmail, loading, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const webTop = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const webBottom = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    if (!trimmedEmail || !trimmedPassword) {
      setError('Please enter email and password.');
      setSubmitting(false);
      return;
    }

    const fn = mode === 'login' ? signInWithEmail : signUpWithEmail;
    const result = await fn(trimmedEmail, trimmedPassword);
    if (result.error) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    if (user) {
      router.replace('/');
    } else {
      router.replace('/');
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0A1628', '#0D1F3C', '#091424']}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.content, { paddingTop: webTop + 20, paddingBottom: webBottom + 24 }]}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="chevron-back" size={26} color={Colors.textSecondary} />
          </Pressable>
          <Text style={styles.headerTitle}>
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.formCard}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor={Colors.textMuted}
            style={styles.input}
          />

          <Text style={[styles.label, { marginTop: 16 }]}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor={Colors.textMuted}
            style={styles.input}
          />

          {error && (
            <Text style={styles.errorText}>{error}</Text>
          )}

          <Pressable
            onPress={handleSubmit}
            disabled={submitting || loading}
            style={({ pressed }) => [
              styles.primaryBtn,
              (pressed || submitting) && { opacity: 0.9 },
            ]}
          >
            <LinearGradient
              colors={[Colors.gold, Colors.goldDark]}
              style={styles.primaryBtnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.primaryBtnText}>
                {mode === 'login' ? 'Sign In' : 'Sign Up'}
              </Text>
            </LinearGradient>
          </Pressable>

          <Pressable
            onPress={() => setMode(prev => (prev === 'login' ? 'signup' : 'login'))}
            style={({ pressed }) => [styles.secondaryLink, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.secondaryLinkText}>
              {mode === 'login'
                ? "Don't have an account? Create one"
                : 'Already have an account? Sign in'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    gap: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 24,
    color: Colors.text,
  },
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  label: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  input: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colors.text,
    backgroundColor: Colors.surfaceHigh,
  },
  errorText: {
    marginTop: 10,
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.red,
  },
  primaryBtn: {
    marginTop: 18,
    borderRadius: 14,
    overflow: 'hidden',
  },
  primaryBtnGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: '#0A1628',
  },
  secondaryLink: {
    marginTop: 14,
    alignItems: 'center',
  },
  secondaryLinkText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textMuted,
  },
});

