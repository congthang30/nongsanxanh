import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SheetModal } from '../ui/SheetModal';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { AddressSearchInput, ResolvedAddress } from './AddressSearchInput';
import { usersApi } from '../../lib/api/users.api';
import { useDeliveryStore } from '../../store/delivery.store';
import { useAuthStore } from '../../store/auth.store';
import { requestForegroundPermission } from '../../lib/location';
import { colors, fontSize, green, radius, spacing } from '../../theme';
import { Address } from '../../types';
import { ApiError } from '../../lib/api/client';

/**
 * Flow chon/them dia chi giao hang — KHOP voi web customer (CheckoutPage):
 * - Form them dia chi: Nguoi nhan + SDT + tim dia chi (autocomplete) + so nha/ghi chu + "Luu dia chi".
 *   Luu that su qua POST /users/me/addresses, sau do resolve cua hang theo dia chi moi.
 * - Danh sach dia chi da luu (tap de chon).
 * - GPS vi tri hien tai.
 * Backend luon la source of truth cho viec chon cua hang.
 */
export function AddressResolverSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const { resolveByAddress, resolveByCoords, resolveByCurrentGps, resolving } = useDeliveryStore();

  const [showForm, setShowForm] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [phone, setPhone] = useState('');
  const [picked, setPicked] = useState<ResolvedAddress | null>(null);
  const [detail, setDetail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const addressesQuery = useQuery({
    queryKey: ['addresses'],
    queryFn: () => usersApi.listAddresses(),
    enabled: visible && !!user,
  });

  const saveMutation = useMutation({
    mutationFn: (input: Parameters<typeof usersApi.createAddress>[0]) => usersApi.createAddress(input),
  });

  function resetForm() {
    setRecipientName('');
    setPhone('');
    setPicked(null);
    setDetail('');
    setError(null);
  }

  async function pickSaved(addr: Address) {
    setError(null);
    try {
      await resolveByAddress(addr);
      onClose();
    } catch {
      setError('Không tìm được cửa hàng cho địa chỉ này.');
    }
  }

  // Luu dia chi moi (giong web saveAddress) -> persist -> resolve store -> dong.
  async function onSaveAddress() {
    if (!recipientName.trim() || !phone.trim()) {
      setError('Nhập tên người nhận và số điện thoại.');
      return;
    }
    if (!picked) {
      setError('Hãy chọn địa chỉ từ gợi ý bản đồ.');
      return;
    }
    setError(null);
    const det = detail.trim();
    const fullAddress = det ? `${det}, ${picked.formattedAddress}` : picked.formattedAddress;
    try {
      const created = await saveMutation.mutateAsync({
        recipientName: recipientName.trim(),
        phone: phone.trim(),
        province: picked.province || picked.formattedAddress,
        district: picked.district || '-',
        ward: picked.ward || '-',
        line1: det || picked.formattedAddress,
        formattedAddress: fullAddress,
        placeId: picked.placeId,
        lat: picked.lat,
        lng: picked.lng,
        isDefault: true,
      });
      await queryClient.invalidateQueries({ queryKey: ['addresses'] });
      // Resolve cua hang theo dia chi vua luu.
      try {
        await resolveByAddress(created);
      } catch {
        await resolveByCoords(picked.lat, picked.lng).catch(() => {});
      }
      resetForm();
      setShowForm(false);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Không lưu được địa chỉ. Vui lòng thử lại.');
    }
  }

  async function useGps() {
    setError(null);
    const perm = await requestForegroundPermission();
    if (perm !== 'granted') {
      setError('Chưa cấp quyền vị trí. Bạn có thể thêm địa chỉ ở trên.');
      return;
    }
    const result = await resolveByCurrentGps();
    if (!result) {
      setError('Không lấy được vị trí. Vui lòng thêm địa chỉ ở trên.');
      return;
    }
    onClose();
  }

  const addresses = addressesQuery.data ?? [];
  const saving = saveMutation.isPending || resolving;

  return (
    <SheetModal visible={visible} title="Địa chỉ giao hàng" onClose={onClose}>
      <ScrollView style={{ maxHeight: 520 }} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          {/* Toggle them dia chi */}
          <View style={styles.headerRow}>
            <Text style={styles.sectionTitle}>
              {user ? 'Địa chỉ của bạn' : 'Thêm địa chỉ giao hàng'}
            </Text>
            {user ? (
              <Pressable
                onPress={() => {
                  setShowForm((s) => !s);
                  setError(null);
                }}
              >
                <Text style={styles.toggle}>{showForm ? 'Đóng' : '+ Thêm địa chỉ'}</Text>
              </Pressable>
            ) : null}
          </View>

          {/* Form them dia chi (mac dinh mo neu chua dang nhap hoac chua co dia chi) */}
          {showForm || !user || addresses.length === 0 ? (
            <View style={styles.form}>
              <View style={styles.nameRow}>
                <View style={styles.flex}>
                  <TextInput
                    style={styles.input}
                    value={recipientName}
                    onChangeText={setRecipientName}
                    placeholder="Người nhận"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <View style={styles.flex}>
                  <TextInput
                    style={styles.input}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="Số điện thoại"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              <Text style={styles.label}>Tìm địa chỉ giao hàng</Text>
              <AddressSearchInput
                value={picked}
                onChange={setPicked}
                placeholder="Gõ tên đường rồi chọn từ gợi ý (vd: Lê Duẩn, Quận 1)..."
              />

              {picked ? (
                <>
                  <Text style={styles.label}>Số nhà, hẻm, tầng, ghi chú địa chỉ</Text>
                  <TextInput
                    style={styles.input}
                    value={detail}
                    onChangeText={setDetail}
                    placeholder="vd: 8/10/5 đường số 21, tầng 2..."
                    placeholderTextColor={colors.textMuted}
                  />
                </>
              ) : null}

              <Button
                title="Lưu địa chỉ"
                onPress={onSaveAddress}
                loading={saving}
                disabled={!picked || saving}
              />
            </View>
          ) : null}

          {/* GPS */}
          <View style={styles.orRow}>
            <View style={styles.line} />
            <Text style={styles.orText}>hoặc</Text>
            <View style={styles.line} />
          </View>
          <Pressable style={styles.gpsBtn} onPress={useGps} disabled={saving}>
            {resolving ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Icon name="map-pin" size={20} color={colors.primaryDark} />
            )}
            <Text style={styles.gpsText}>Dùng vị trí của tôi (GPS)</Text>
          </Pressable>

          {/* Danh sach dia chi da luu */}
          {user && addresses.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Chọn địa chỉ đã lưu</Text>
              {addressesQuery.isLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                addresses
                  .slice()
                  .sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
                  .map((addr) => (
                    <Pressable
                      key={addr.id}
                      style={({ pressed }) => [styles.savedItem, pressed && styles.savedItemPressed]}
                      onPress={() => pickSaved(addr)}
                    >
                      <View style={styles.savedIcon}>
                        <Icon name={addr.isDefault ? 'star' : 'map-pin'} size={16} color={colors.primary} />
                      </View>
                      <View style={styles.flex}>
                        <Text style={styles.savedTitle} numberOfLines={1}>
                          {addr.recipientName} · {addr.phone}
                        </Text>
                        <Text style={styles.savedAddr} numberOfLines={2}>
                          {addr.formattedAddress ??
                            [addr.line1, addr.ward, addr.district, addr.province].filter(Boolean).join(', ')}
                        </Text>
                      </View>
                      <Icon name="chevron-right" size={18} color={colors.textMuted} />
                    </Pressable>
                  ))
              )}
            </>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </ScrollView>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md, paddingBottom: spacing.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: fontSize.sm, fontWeight: '700', color: colors.text, marginTop: spacing.xs },
  toggle: { fontSize: fontSize.sm, fontWeight: '700', color: colors.primary },
  flex: { flex: 1 },
  form: {
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  nameRow: { flexDirection: 'row', gap: spacing.sm },
  label: { fontSize: fontSize.xs, fontWeight: '700', color: colors.textMuted, marginTop: spacing.xs },
  input: {
    minHeight: 46,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.sm,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  orText: { fontSize: fontSize.xs, color: colors.textMuted },
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: green[200],
    backgroundColor: green[50],
  },
  gpsText: { fontSize: fontSize.md, fontWeight: '700', color: colors.primaryDark },
  savedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
  },
  savedItemPressed: { backgroundColor: colors.surfaceAlt },
  savedIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: green[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedTitle: { fontSize: fontSize.sm, fontWeight: '700', color: colors.text },
  savedAddr: { fontSize: fontSize.xs, color: colors.textMuted },
  error: { color: colors.danger, fontSize: fontSize.sm, marginTop: spacing.xs },
});
