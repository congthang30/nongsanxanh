import React, { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View, Alert } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usersApi } from '../../src/lib/api/users.api';
import { Button } from '../../src/components/ui/Button';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/ui/States';
import { AddressCard } from '../../src/components/customer/AddressCard';
import { AddressResolverSheet } from '../../src/components/customer/AddressResolverSheet';
import { colors, fontSize, spacing } from '../../src/theme';

export default function AddressesScreen() {
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);

  const query = useQuery({
    queryKey: ['addresses'],
    queryFn: () => usersApi.listAddresses(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.deleteAddress(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['addresses'] }),
    onError: (e) => Alert.alert('Lỗi', (e as Error).message || 'Không xóa được địa chỉ.'),
  });

  function confirmDelete(id: string) {
    Alert.alert('Xóa địa chỉ', 'Bạn có chắc muốn xóa địa chỉ này?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
    ]);
  }

  const addresses = query.data ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <Text style={styles.back} onPress={() => router.back()}>‹ Quay lại</Text>
        <Text style={styles.title}>Địa chỉ giao hàng</Text>
      </View>

      {query.isLoading ? (
        <LoadingState label="Đang tải địa chỉ..." />
      ) : query.isError ? (
        <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={query.isFetching} onRefresh={() => query.refetch()} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <EmptyState
              title="Chưa có địa chỉ"
              description="Thêm địa chỉ giao hàng để hệ thống tự chọn cửa hàng gần bạn."
              actionLabel="Thêm địa chỉ"
              onAction={() => setSheetOpen(true)}
            />
          }
          renderItem={({ item }) => (
            <AddressCard address={item} onDelete={() => confirmDelete(item.id)} />
          )}
          ListFooterComponent={
            addresses.length > 0 ? (
              <View style={styles.footer}>
                <Button title="Thêm địa chỉ mới" onPress={() => setSheetOpen(true)} variant="secondary" />
              </View>
            ) : null
          }
        />
      )}

      <AddressResolverSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topbar: { padding: spacing.md, gap: spacing.xs },
  back: { fontSize: fontSize.md, color: colors.primary, fontWeight: '600' },
  title: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text, paddingHorizontal: spacing.xs },
  content: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  footer: { marginTop: spacing.md },
});
