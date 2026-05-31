import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/store/auth.store';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { colors, fontSize, spacing } from '../../src/theme';

export default function LoginScreen() {
  const { login, loading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function onSubmit() {
    clearError();
    try {
      await login(email.trim(), password);
      router.replace('/');
    } catch {
      // error da set trong store
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <Text style={styles.logo}>NongSan Xanh</Text>
            <Text style={styles.subtitle}>Nong san sach giao tan noi</Text>
          </View>

          <View style={styles.form}>
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="ban@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Input
              label="Mat khau"
              value={password}
              onChangeText={setPassword}
              placeholder="Mat khau"
              secureTextEntry
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button title="Dang nhap" onPress={onSubmit} loading={loading} large />
            <Button
              title="Tao tai khoan moi"
              onPress={() => router.push('/(auth)/register')}
              variant="ghost"
            />
          </View>

          <Text style={styles.hint}>
            Dang nhap bang tai khoan khach hang hoac shipper. He thong tu chuyen dung giao dien theo vai tro.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.xl, flexGrow: 1, justifyContent: 'center' },
  brand: { alignItems: 'center', gap: spacing.xs },
  logo: { fontSize: fontSize.xxl, fontWeight: '800', color: colors.primary },
  subtitle: { fontSize: fontSize.sm, color: colors.textMuted },
  form: { gap: spacing.md },
  error: { color: colors.danger, fontSize: fontSize.sm },
  hint: { color: colors.textMuted, fontSize: fontSize.xs, textAlign: 'center' },
});
