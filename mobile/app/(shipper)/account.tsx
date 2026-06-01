import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore, authSelectors } from '../../src/store/auth.store';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { colors, fontSize, spacing } from '../../src/theme';

export default function ShipperAccountScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const setMode = useAuthStore((s) => s.setMode);
  const hasCustomerRole = useAuthStore(authSelectors.isCustomer);

  async function onLogout() {
    await logout();
    router.replace('/(auth)/login');
  }

  function switchToCustomer() {
    setMode('customer');
    router.replace('/(customer)/home');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Tài khoản</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <View style={styles.avatarRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(user?.fullName ?? user?.email ?? '?').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.name}>{user?.fullName ?? 'Shipper'}</Text>
              <Text style={styles.email}>{user?.email}</Text>
            </View>
          </View>
          <View style={styles.roles}>
            <Badge label="Shipper" tone="success" />
            {hasCustomerRole ? <Badge label="Khách hàng" tone="primary" /> : null}
          </View>
        </Card>

        <View style={styles.menu}>
          {hasCustomerRole ? (
            <Button title="Chuyển sang mua hàng" onPress={switchToCustomer} variant="secondary" />
          ) : null}
        </View>

        <Button title="Đăng xuất" onPress={onLogout} variant="danger" />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg },
  title: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text },
  content: { padding: spacing.lg, gap: spacing.lg },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: fontSize.xl, fontWeight: '800', color: colors.primaryDark },
  flex: { flex: 1 },
  name: { fontSize: fontSize.lg, fontWeight: '800', color: colors.text },
  email: { fontSize: fontSize.sm, color: colors.textMuted },
  roles: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  menu: { gap: spacing.sm },
});
