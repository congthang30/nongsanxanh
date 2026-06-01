import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore, authSelectors } from '../../src/store/auth.store';
import { useDeliveryStore } from '../../src/store/delivery.store';
import { Badge } from '../../src/components/ui/Badge';
import { Icon, IconName } from '../../src/components/ui/Icon';
import { colors, fontSize, gradients, green, radius, shadow, spacing } from '../../src/theme';

export default function AccountScreen() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const setMode = useAuthStore((s) => s.setMode);
  const hasShipperRole = useAuthStore(authSelectors.isShipper);
  const resetDelivery = useDeliveryStore((s) => s.reset);

  async function onLogout() {
    await logout();
    resetDelivery();
    router.replace('/(auth)/login');
  }

  function switchToShipper() {
    setMode('shipper');
    router.replace('/(shipper)/jobs');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Tài khoản</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarRow}>
            <LinearGradient colors={gradients.leaf} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(user?.fullName ?? user?.email ?? '?').charAt(0).toUpperCase()}
              </Text>
            </LinearGradient>
            <View style={styles.flex}>
              <Text style={styles.name}>{user?.fullName ?? 'Khách hàng'}</Text>
              <Text style={styles.email}>{user?.email}</Text>
            </View>
          </View>
          <View style={styles.roles}>
            <Badge label="Khách hàng" tone="primary" />
            {hasShipperRole ? <Badge label="Shipper" tone="success" /> : null}
          </View>
        </View>

        {/* Menu */}
        <View style={styles.menu}>
          <MenuRow
            icon="map-pin"
            label="Địa chỉ giao hàng"
            onPress={() => router.push('/(customer)/addresses')}
          />
          <View style={styles.divider} />
          <MenuRow
            icon="package"
            label="Đơn hàng của tôi"
            onPress={() => router.push('/(customer)/orders')}
          />
          {hasShipperRole ? (
            <>
              <View style={styles.divider} />
              <MenuRow icon="truck" label="Chuyển sang giao hàng" onPress={switchToShipper} />
            </>
          ) : null}
        </View>

        {/* Logout */}
        <Pressable style={styles.logout} onPress={onLogout} accessibilityRole="button">
          <Icon name="logout" size={20} color={colors.danger} strokeWidth={2.2} />
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuRow({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.menuRow, pressed && styles.menuRowPressed]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={styles.menuIcon}>
        <Icon name={icon} size={20} color={colors.primary} strokeWidth={2} />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      <Icon name="chevron-right" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg },
  title: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text },
  content: { padding: spacing.lg, gap: spacing.lg },

  profileCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.sm,
  },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: fontSize.xl, fontWeight: '800', color: '#04210f' },
  flex: { flex: 1 },
  name: { fontSize: fontSize.lg, fontWeight: '800', color: colors.text },
  email: { fontSize: fontSize.sm, color: colors.textMuted },
  roles: { flexDirection: 'row', gap: spacing.sm },

  menu: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.sm,
  },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  menuRowPressed: { backgroundColor: colors.surfaceAlt },
  menuIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: green[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: { flex: 1, fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: spacing.lg + 38 + spacing.md },

  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.dangerLight,
    backgroundColor: colors.dangerLight,
  },
  logoutText: { fontSize: fontSize.md, fontWeight: '700', color: colors.danger },
});
