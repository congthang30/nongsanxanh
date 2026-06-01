import React from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { shipperApi } from '../../src/lib/api/shipper.api';
import { DeliveryJobCard } from '../../src/components/shipper/DeliveryJobCard';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/ui/States';
import { colors, fontSize, spacing } from '../../src/theme';

export default function ShipperJobsScreen() {
  const query = useQuery({
    queryKey: ['shipper-jobs', 'active'],
    queryFn: () => shipperApi.jobs('active'),
  });

  const jobs = query.data ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Đơn đang giao</Text>
        <Text style={styles.subtitle}>Các đơn được hệ thống gán cho bạn</Text>
      </View>

      {query.isLoading ? (
        <LoadingState label="Đang tải đơn giao..." />
      ) : query.isError ? (
        <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(j) => j.id}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={query.isFetching}
              onRefresh={() => query.refetch()}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title="Chưa có đơn cần giao"
              description="Khi có đơn mới được gán, đơn sẽ hiển thị ở đây. Kéo xuống để làm mới."
            />
          }
          renderItem={({ item }) => (
            <DeliveryJobCard
              job={item}
              onPress={() => router.push({ pathname: '/(shipper)/job/[id]', params: { id: item.id } })}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, gap: 2 },
  title: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: fontSize.sm, color: colors.textMuted },
  content: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
});
