import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { SheetModal } from '../ui/SheetModal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { usersApi } from '../../lib/api/users.api';
import { useDeliveryStore } from '../../store/delivery.store';
import { useAuthStore } from '../../store/auth.store';
import { requestForegroundPermission } from '../../lib/location';
import { colors, fontSize, radius, spacing } from '../../theme';
import { Address } from '../../types';

/**
 * Flow resolve dia chi (theo spec): dia chi mac dinh -> GPS -> nhap thu cong.
 * KHONG cho chon khu vuc/store thu cong; chi cung cap dia chi/GPS, backend resolve store.
 */
export function AddressResolverSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const user = useAuthStore((s) => s.user);
  const { resolveByAddress, resolveByCurrentGps, resolveByManual, resolving } = useDeliveryStore();
  const [manual, setManual] = useState({ province: '', district: '', ward: '' });
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);

  const addressesQuery = useQuery({
    queryKey: ['addresses'],
    queryFn: () => usersApi.listAddresses(),
    enabled: visible && !!user,
  });

  async function pickAddress(addr: Address) {
    await resolveByAddress(addr);
    onClose();
  }

  async function useGps() {
    setGpsError(null);
    const perm = await requestForegroundPermission();
    if (perm !== 'granted') {
      setGpsError('Chua cap quyen vi tri. Ban co the nhap dia chi thu cong.');
      setShowManual(true);
      return;
    }
    const result = await resolveByCurrentGps();
    if (!result) {
      setGpsError('Khong lay duoc vi tri. Vui long nhap dia chi thu cong.');
      setShowManual(true);
      return;
    }
    onClose();
  }

  async function submitManual() {
    if (!manual.province.trim()) {
      setGpsError('Can it nhat Tinh/Thanh pho.');
      return;
    }
    await resolveByManual({
      province: manual.province.trim(),
      district: manual.district.trim(),
      ward: manual.ward.trim(),
    });
    onClose();
  }

  const addresses = addressesQuery.data ?? [];

  return (
    <SheetModal visible={visible} title="Dia chi giao hang" onClose={onClose}>
      <ScrollView style={{ maxHeight: 460 }} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          {/* 1. Dia chi da luu (uu tien dia chi mac dinh) */}
          {user ? (
            <>
              <Text style={styles.sectionTitle}>Dia chi cua ban</Text>
              {addressesQuery.isLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : addresses.length === 0 ? (
                <Text style={styles.muted}>Chua co dia chi da luu.</Text>
              ) : (
                addresses
                  .slice()
                  .sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
                  .map((addr) => (
                    <Button
                      key={addr.id}
                      title={`${addr.isDefault ? '★ ' : ''}${addr.line1}, ${addr.ward}, ${addr.district}`}
                      onPress={() => pickAddress(addr)}
                      variant="secondary"
                    />
                  ))
              )}
            </>
          ) : null}

          {/* 2. GPS */}
          <Text style={styles.sectionTitle}>Hoac</Text>
          <Button title="📍 Dung vi tri cua toi (GPS)" onPress={useGps} loading={resolving} />

          {/* 3. Nhap thu cong (fallback) */}
          <Button
            title={showManual ? 'An nhap thu cong' : 'Nhap dia chi thu cong'}
            onPress={() => setShowManual((v) => !v)}
            variant="ghost"
          />
          {showManual ? (
            <View style={styles.manual}>
              <Input
                label="Tinh/Thanh pho"
                value={manual.province}
                onChangeText={(t) => setManual((m) => ({ ...m, province: t }))}
                placeholder="vd: TP. Ho Chi Minh"
              />
              <Input
                label="Quan/Huyen"
                value={manual.district}
                onChangeText={(t) => setManual((m) => ({ ...m, district: t }))}
                placeholder="vd: Quan 7"
              />
              <Input
                label="Phuong/Xa"
                value={manual.ward}
                onChangeText={(t) => setManual((m) => ({ ...m, ward: t }))}
                placeholder="vd: Tan Phong"
              />
              <Button title="Tim cua hang giao" onPress={submitManual} loading={resolving} />
            </View>
          ) : null}

          {gpsError ? <Text style={styles.error}>{gpsError}</Text> : null}
        </View>
      </ScrollView>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  sectionTitle: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textMuted, marginTop: spacing.sm },
  muted: { fontSize: fontSize.sm, color: colors.textMuted },
  manual: {
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.md,
  },
  error: { color: colors.danger, fontSize: fontSize.sm, marginTop: spacing.xs },
});
