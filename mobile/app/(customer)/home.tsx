import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useDeliveryStore } from '../../src/store/delivery.store';
import { useAuthStore } from '../../src/store/auth.store';
import { usersApi } from '../../src/lib/api/users.api';
import { productsApi } from '../../src/lib/api/products.api';
import { getForegroundPermission } from '../../src/lib/location';
import { AddressResolverSheet } from '../../src/components/customer/AddressResolverSheet';
import { ProductCard } from '../../src/components/product/ProductCard';
import { Icon, IconName } from '../../src/components/ui/Icon';
import { colors, fontSize, gradients, green, radius, shadow, spacing } from '../../src/theme';

const TRUST_CHIPS = ['Tự kiểm tồn trước khi đặt', 'Giao từ cửa hàng phù hợp', 'COD hoặc VNPay'];

const STEPS = [
  { num: '01', title: 'Chọn nông sản', desc: 'Duyệt rau củ, trái cây và đồ thiết yếu tươi mỗi ngày.' },
  { num: '02', title: 'Nhập địa chỉ giao', desc: 'Hệ thống tự chọn cửa hàng phù hợp gần bạn còn đủ hàng.' },
  { num: '03', title: 'Nhận hàng tươi', desc: 'Cửa hàng soạn hàng và shipper giao tận nơi.' },
];

const FEATURES: { title: string; desc: string; icon: IconName }[] = [
  { title: 'Giao nhanh trong ngày', desc: 'Tuyến giao ưu tiên nội thành, hàng tươi đến tay bạn.', icon: 'truck' },
  { title: 'Truy xuất nguồn gốc', desc: 'Rõ vùng trồng, nhà vườn và quy trình thu hoạch.', icon: 'shield' },
  { title: 'Tồn kho minh bạch', desc: 'Kiểm tồn theo địa chỉ giao trước khi đặt, tránh thiếu hàng.', icon: 'box' },
  { title: 'Thanh toán an toàn', desc: 'COD tận nhà hoặc VNPay, minh bạch và bảo mật.', icon: 'card' },
];

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const { store, resolveByAddress, resolveByCurrentGps } = useDeliveryStore();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [autoTried, setAutoTried] = useState(false);
  const [searchQ, setSearchQ] = useState('');

  // Auto resolve khi mo app: dia chi mac dinh -> GPS (neu da co quyen) -> CTA nhap.
  useEffect(() => {
    if (autoTried || store) return;
    let cancelled = false;
    (async () => {
      setAutoTried(true);
      if (user) {
        try {
          const addresses = await usersApi.listAddresses();
          const def = addresses.find((a) => a.isDefault) ?? addresses[0];
          if (def && !cancelled) {
            await resolveByAddress(def);
            return;
          }
        } catch {
          // ignore -> thu GPS
        }
      }
      const perm = await getForegroundPermission();
      if (perm === 'granted' && !cancelled) {
        await resolveByCurrentGps();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, store, autoTried, resolveByAddress, resolveByCurrentGps]);

  const productsQuery = useQuery({
    queryKey: ['home-products', store?.storeId],
    queryFn: () => productsApi.listByStore(store!.storeId, { limit: 8 }),
    enabled: !!store?.storeId,
  });

  useFocusEffect(
    useCallback(() => {
      if (store?.storeId) void productsQuery.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [store?.storeId]),
  );

  const products = productsQuery.data?.data ?? [];

  // Danh muc suy ra tu san pham dang co (khong co endpoint categories rieng tren mobile).
  const categories = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach((p) => {
      if (p.category) map.set(p.category.id, p.category.name);
    });
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [products]);

  function submitSearch() {
    router.push('/(customer)/products');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={productsQuery.isFetching}
            onRefresh={() => productsQuery.refetch()}
            tintColor={colors.primary}
          />
        }
      >
        {/* ---------- Hero ---------- */}
        <LinearGradient colors={[green[50], colors.surface]} style={styles.hero}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Icon name="leaf" size={18} color="#04210f" />
            </View>
            <Text style={styles.brand}>Nông Sản Xanh</Text>
          </View>

          <View style={styles.eyebrow}>
            <Text style={styles.eyebrowText}>Chuỗi cửa hàng nông sản tươi</Text>
          </View>
          <Text style={styles.h1}>
            Nông sản tươi <Text style={styles.h1Accent}>mỗi ngày</Text>
          </Text>
          <Text style={styles.heroSub}>
            Đặt rau củ, trái cây và đồ thiết yếu. Hệ thống tự chọn cửa hàng phù hợp gần bạn có đủ hàng.
          </Text>

          {/* Search */}
          <View style={styles.search}>
            <Icon name="search" size={20} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm rau củ, trái cây, gạo ST25..."
              placeholderTextColor={colors.textMuted}
              value={searchQ}
              onChangeText={setSearchQ}
              onSubmitEditing={submitSearch}
              returnKeyType="search"
            />
            <Pressable style={styles.searchBtn} onPress={submitSearch}>
              <LinearGradient colors={gradients.leaf} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.searchBtnInner}>
                <Text style={styles.searchBtnText}>Tìm</Text>
              </LinearGradient>
            </Pressable>
          </View>

          {/* CTA row */}
          <View style={styles.ctaRow}>
            <Pressable style={styles.ctaPrimary} onPress={() => router.push('/(customer)/products')}>
              <LinearGradient colors={gradients.leaf} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaPrimaryInner}>
                <Text style={styles.ctaPrimaryText}>Mua ngay</Text>
              </LinearGradient>
            </Pressable>
            <Pressable style={styles.ctaGhost} onPress={() => router.push('/(customer)/orders')}>
              <Text style={styles.ctaGhostText}>Xem đơn hàng</Text>
            </Pressable>
          </View>

          {/* Trust chips */}
          <View style={styles.trustWrap}>
            {TRUST_CHIPS.map((chip) => (
              <View key={chip} style={styles.trustChip}>
                <Icon name="check" size={15} color={colors.primary} strokeWidth={2.6} />
                <Text style={styles.trustText}>{chip}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        <View style={styles.bodyPad}>

          {/* ---------- Categories ---------- */}
          {categories.length > 0 ? (
            <View style={styles.section}>
              <SectionIntro
                label="Danh mục"
                title="Mua theo loại nông sản"
                desc="Chọn danh mục phù hợp, hệ thống giao từ cửa hàng gần bạn."
              />
              <View style={styles.catGrid}>
                {categories.map((cat) => (
                  <Pressable key={cat.id} style={styles.catCard} onPress={() => router.push('/(customer)/products')}>
                    <View style={styles.catBadge}>
                      <Text style={styles.catBadgeText}>{cat.name.charAt(0)}</Text>
                    </View>
                    <Text style={styles.catName} numberOfLines={1}>
                      {cat.name}
                    </Text>
                    <Icon name="chevron-right" size={18} color={colors.primary} />
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {/* ---------- Featured products ---------- */}
          {store ? (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <SectionIntro label="Nổi bật" title="Sản phẩm được yêu thích" />
                <Pressable onPress={() => router.push('/(customer)/products')}>
                  <Text style={styles.link}>Xem tất cả</Text>
                </Pressable>
              </View>

              {productsQuery.isLoading ? (
                <View style={styles.grid}>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <View key={i} style={[styles.cardWrap, styles.skeleton]} />
                  ))}
                </View>
              ) : products.length === 0 ? (
                <Text style={styles.muted}>Cửa hàng này chưa có sản phẩm khả dụng.</Text>
              ) : (
                <View style={styles.grid}>
                  {products.map((item) => (
                    <View key={item.id} style={styles.cardWrap}>
                      <ProductCard
                        product={item}
                        onPress={() =>
                          router.push({ pathname: '/(customer)/product/[slug]', params: { slug: item.slug } })
                        }
                      />
                    </View>
                  ))}
                </View>
              )}
            </View>
          ) : (
            <View style={styles.section}>
              <View style={styles.emptyStore}>
                <View style={styles.emptyStoreIcon}>
                  <Icon name="map-pin" size={28} color={colors.primary} />
                </View>
                <Text style={styles.emptyStoreTitle}>Nhập địa chỉ giao hàng để bắt đầu</Text>
                <Text style={styles.muted}>
                  Hệ thống sẽ tự chọn cửa hàng gần bạn có đủ hàng. Bạn không cần chọn khu vực.
                </Text>
                <Pressable style={styles.emptyStoreBtn} onPress={() => setSheetOpen(true)}>
                  <LinearGradient colors={gradients.leaf} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.emptyStoreBtnInner}>
                    <Text style={styles.ctaPrimaryText}>Nhập địa chỉ giao hàng</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          )}

          {/* ---------- How it works ---------- */}
          <View style={styles.section}>
            <SectionIntro center label="Quy trình" title="Mua nông sản chỉ 3 bước" />
            <View style={styles.stepsWrap}>
              {STEPS.map((step) => (
                <View key={step.num} style={styles.stepCard}>
                  <Text style={styles.stepNum}>{step.num}</Text>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.muted}>{step.desc}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* ---------- Features ---------- */}
          <View style={styles.section}>
            <View style={styles.featuresWrap}>
              {FEATURES.map((f) => (
                <View key={f.title} style={styles.featureCard}>
                  <View style={styles.featureIcon}>
                    <Icon name={f.icon} size={22} color={colors.primary} strokeWidth={1.8} />
                  </View>
                  <View style={styles.featureBody}>
                    <Text style={styles.featureTitle}>{f.title}</Text>
                    <Text style={styles.muted}>{f.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* ---------- CTA ---------- */}
          <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaBanner}>
            <Text style={styles.ctaBannerLabel}>BẮT ĐẦU NGAY</Text>
            <Text style={styles.ctaBannerTitle}>Sẵn sàng ăn sạch, sống khỏe?</Text>
            <Text style={styles.ctaBannerSub}>
              Khám phá hàng trăm nông sản tươi, giao nhanh từ cửa hàng phù hợp với bạn.
            </Text>
            <Pressable style={styles.ctaBannerBtn} onPress={() => router.push('/(customer)/products')}>
              <Text style={styles.ctaBannerBtnText}>Mua sắm ngay</Text>
              <Icon name="arrow-right" size={18} color={colors.primaryDark} strokeWidth={2.4} />
            </Pressable>
          </LinearGradient>
        </View>
      </ScrollView>

      <AddressResolverSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </SafeAreaView>
  );
}

function SectionIntro({
  label,
  title,
  desc,
  center,
}: {
  label: string;
  title: string;
  desc?: string;
  center?: boolean;
}) {
  return (
    <View style={center ? styles.introCenter : undefined}>
      <Text style={styles.sectionLabel}>{label.toUpperCase()}</Text>
      <Text style={[styles.sectionTitle, center && styles.textCenter]}>{title}</Text>
      {desc ? <Text style={[styles.muted, center && styles.textCenter]}>{desc}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: spacing.xxl },

  // Hero
  hero: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  brandMark: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: green[300],
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: { fontSize: fontSize.lg, fontWeight: '800', color: colors.primaryDark },
  eyebrow: {
    alignSelf: 'flex-start',
    backgroundColor: green[100],
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginBottom: spacing.md,
  },
  eyebrowText: { fontSize: fontSize.xs, fontWeight: '700', color: colors.primaryDark },
  h1: { fontSize: fontSize.display, fontWeight: '800', color: colors.text, letterSpacing: -0.3, lineHeight: 40 },
  h1Accent: { color: colors.primary },
  heroSub: { fontSize: fontSize.md, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 23 },

  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingLeft: spacing.lg,
    paddingRight: 6,
    paddingVertical: 6,
    marginTop: spacing.lg,
    ...shadow.sm,
  },
  searchInput: { flex: 1, fontSize: fontSize.sm, color: colors.text, paddingVertical: 8 },
  searchBtn: { borderRadius: radius.pill, overflow: 'hidden' },
  searchBtnInner: { paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: radius.pill },
  searchBtnText: { fontSize: fontSize.sm, fontWeight: '700', color: '#04210f' },

  ctaRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  ctaPrimary: { borderRadius: radius.pill, overflow: 'hidden', ...shadow.sm },
  ctaPrimaryInner: { paddingHorizontal: spacing.xl, paddingVertical: 12, borderRadius: radius.pill },
  ctaPrimaryText: { fontSize: fontSize.sm, fontWeight: '700', color: '#04210f' },
  ctaGhost: {
    paddingHorizontal: spacing.xl,
    paddingVertical: 12,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: green[200],
    justifyContent: 'center',
  },
  ctaGhostText: { fontSize: fontSize.sm, fontWeight: '700', color: colors.primaryDark },

  trustWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xl },
  trustChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trustText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.text },

  // Body
  bodyPad: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.lg },
  section: { gap: spacing.md },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  introCenter: { alignItems: 'center' },
  textCenter: { textAlign: 'center' },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: colors.primary, marginBottom: 4 },
  sectionTitle: { fontSize: fontSize.xl, fontWeight: '800', color: colors.text },
  muted: { fontSize: fontSize.sm, color: colors.textMuted, lineHeight: 20 },
  link: { fontSize: fontSize.sm, fontWeight: '700', color: colors.primary },

  // Categories
  catGrid: { gap: spacing.sm },
  catCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadow.sm,
  },
  catBadge: {
    width: 46,
    height: 46,
    borderRadius: radius.sm,
    backgroundColor: green[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  catBadgeText: { fontSize: fontSize.xl, fontWeight: '800', color: colors.primaryDark },
  catName: { flex: 1, fontSize: fontSize.md, fontWeight: '700', color: colors.text },

  // Product grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  cardWrap: { width: '47.8%', flexGrow: 1 },
  skeleton: { height: 250, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },

  // Empty store
  emptyStore: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.xl,
    gap: spacing.sm,
    ...shadow.sm,
  },
  emptyStoreIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: green[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyStoreTitle: { fontSize: fontSize.md, fontWeight: '800', color: colors.text, textAlign: 'center' },
  emptyStoreBtn: { borderRadius: radius.pill, overflow: 'hidden', marginTop: spacing.sm },
  emptyStoreBtnInner: { paddingHorizontal: spacing.xl, paddingVertical: 14, borderRadius: radius.pill },

  // Steps
  stepsWrap: { gap: spacing.md },
  stepCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    ...shadow.sm,
  },
  stepNum: { fontSize: fontSize.xxl, fontWeight: '800', color: green[200], marginBottom: 4 },
  stepTitle: { fontSize: fontSize.md, fontWeight: '800', color: colors.text, marginBottom: 4 },

  // Features
  featuresWrap: { gap: spacing.md },
  featureCard: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    ...shadow.sm,
  },
  featureIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: green[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureBody: { flex: 1, gap: 2 },
  featureTitle: { fontSize: fontSize.md, fontWeight: '800', color: colors.text },

  // CTA banner
  ctaBanner: { borderRadius: radius.lg, padding: spacing.xl, gap: spacing.sm, marginTop: spacing.sm, ...shadow.md },
  ctaBannerLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: '#fde68a' },
  ctaBannerTitle: { fontSize: fontSize.xl, fontWeight: '800', color: '#fff' },
  ctaBannerSub: { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.9)', lineHeight: 21, marginBottom: spacing.sm },
  ctaBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    backgroundColor: '#fff',
    paddingHorizontal: spacing.xl,
    paddingVertical: 12,
    borderRadius: radius.pill,
  },
  ctaBannerBtnText: { fontSize: fontSize.sm, fontWeight: '800', color: colors.primaryDark },
});
