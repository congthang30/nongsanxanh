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

export default function RegisterScreen() {
  const { register, loading, error, clearError } = useAuthStore();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  async function onSubmit() {
    clearError();
    setLocalError(null);
    if (password.length < 6) {
      setLocalError('Mat khau toi thieu 6 ky tu');
      return;
    }
    try {
      await register({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password,
      });
      router.replace('/');
    } catch {
      // store error
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Tao tai khoan</Text>
          <View style={styles.form}>
            <Input label="Ho ten" value={fullName} onChangeText={setFullName} placeholder="Nguyen Van A" />
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
              label="So dien thoai (tuy chon)"
              value={phone}
              onChangeText={setPhone}
              placeholder="09xxxxxxxx"
              keyboardType="phone-pad"
            />
            <Input label="Mat khau" value={password} onChangeText={setPassword} placeholder="Toi thieu 6 ky tu" secureTextEntry />
            {(localError || error) ? <Text style={styles.error}>{localError ?? error}</Text> : null}
            <Button title="Dang ky" onPress={onSubmit} loading={loading} large />
            <Button title="Da co tai khoan? Dang nhap" onPress={() => router.back()} variant="ghost" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.lg, flexGrow: 1, justifyContent: 'center' },
  title: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text, textAlign: 'center' },
  form: { gap: spacing.md },
  error: { color: colors.danger, fontSize: fontSize.sm },
});
