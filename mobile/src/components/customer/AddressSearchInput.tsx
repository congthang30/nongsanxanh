import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { geoApi } from '../../lib/api/geo.api';
import { Icon } from '../ui/Icon';
import { colors, fontSize, green, radius, shadow, spacing } from '../../theme';

/**
 * Ket qua sau khi nguoi dung chon mot dia chi (geocode + reverse tu Nominatim).
 * KHOP voi web AddressSearchInput.tsx (ResolvedAddress).
 */
export interface ResolvedAddress {
  placeId?: string;
  formattedAddress: string;
  province: string;
  district: string | null;
  ward: string | null;
  lat: number;
  lng: number;
}

interface Props {
  value?: ResolvedAddress | null;
  onChange: (addr: ResolvedAddress | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Input tim dia chi voi auto-suggest tu OpenStreetMap (Nominatim) — giong web:
 * - Debounce 300ms, goi /geo/autocomplete.
 * - Chon prediction -> /geo/geocode (lat/lng) + /geo/reverse (province/district/ward).
 * - Hien chip ket qua + nut X de chon lai.
 */
export function AddressSearchInput({ value, onChange, placeholder, disabled }: Props) {
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<{ placeId: string; description: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setPredictions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const preds = await geoApi.autocomplete(query.trim());
        setPredictions(preds);
        setOpen(true);
      } catch {
        setPredictions([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  async function pick(p: { placeId: string; description: string }) {
    setResolving(true);
    setOpen(false);
    setQuery(p.description);
    try {
      const geo = await geoApi.geocode(p.placeId, p.description);
      if (!geo) {
        onChange(null);
        return;
      }
      const rev = await geoApi.reverse(geo.lat, geo.lng);
      onChange({
        placeId: p.placeId,
        formattedAddress: rev?.formattedAddress ?? geo.formattedAddress,
        province: rev?.province ?? '',
        district: rev?.district ?? null,
        ward: rev?.ward ?? null,
        lat: geo.lat,
        lng: geo.lng,
      });
    } catch {
      onChange(null);
    } finally {
      setResolving(false);
    }
  }

  function reset() {
    setQuery('');
    setPredictions([]);
    setOpen(false);
    onChange(null);
  }

  // Da chon -> hien chip ket qua.
  if (value) {
    return (
      <View style={styles.picked}>
        <View style={styles.pickedBody}>
          <Text style={styles.pickedTitle}>{value.formattedAddress}</Text>
          <Text style={styles.pickedMeta}>
            {[value.ward, value.district, value.province].filter(Boolean).join(', ')}
            {'  ·  '}
            <Text style={styles.coords}>
              {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
            </Text>
          </Text>
        </View>
        {!disabled ? (
          <Pressable style={styles.clear} onPress={reset} accessibilityLabel="Xóa địa chỉ">
            <Icon name="x" size={16} color={colors.textMuted} strokeWidth={2.4} />
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.search}>
        <Icon name="search" size={20} color={colors.textMuted} />
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          onFocus={() => predictions.length > 0 && setOpen(true)}
          placeholder={placeholder ?? 'Nhập địa chỉ (vd: 123 Lê Lợi, Quận 1, TP.HCM)'}
          placeholderTextColor={colors.textMuted}
          editable={!disabled && !resolving}
          autoCorrect={false}
        />
        {searching || resolving ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      </View>

      {resolving ? <Text style={styles.hint}>Đang phân giải địa chỉ...</Text> : null}

      {open && predictions.length > 0 ? (
        <View style={styles.list}>
          {predictions.map((p, i) => (
            <Pressable
              key={p.placeId}
              style={[styles.item, i < predictions.length - 1 && styles.itemBorder]}
              onPress={() => pick(p)}
            >
              <Icon name="map-pin" size={16} color={colors.primary} />
              <Text style={styles.itemText} numberOfLines={2}>
                {p.description}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
  },
  input: { flex: 1, fontSize: fontSize.sm, color: colors.text, paddingVertical: 12 },
  hint: { fontSize: fontSize.xs, color: colors.primary },
  list: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    overflow: 'hidden',
    ...shadow.sm,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  itemText: { flex: 1, fontSize: fontSize.sm, color: colors.text, lineHeight: 19 },
  picked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: green[50],
    borderWidth: 1.5,
    borderColor: green[200],
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  pickedBody: { flex: 1, gap: 2 },
  pickedTitle: { fontSize: fontSize.sm, fontWeight: '700', color: colors.text },
  pickedMeta: { fontSize: fontSize.xs, color: colors.textMuted },
  coords: { fontSize: fontSize.xs, color: colors.primaryDark, fontWeight: '600' },
  clear: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
});
