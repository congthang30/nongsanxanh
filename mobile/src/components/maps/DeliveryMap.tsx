import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, radius, spacing } from '../../theme';

export interface MapPoint {
  lat: number;
  lng: number;
  label?: string;
}

interface Props {
  pickup?: MapPoint | null;
  dropoff?: MapPoint | null;
  current?: MapPoint | null;
  height?: number;
}

/**
 * Map preview cho shipper: current location + pickup + dropoff markers.
 *
 * react-native-maps khong chay tren web va can dev build (khong chay tren Expo Go
 * cho mot so config). Ta load dong va fallback ve placeholder neu module khong co,
 * de app van build/chay tren moi nen tang.
 */
let MapView: any = null;
let Marker: any = null;
let mapsAvailable = false;
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const maps = require('react-native-maps');
    MapView = maps.default;
    Marker = maps.Marker;
    mapsAvailable = true;
  } catch {
    mapsAvailable = false;
  }
}

function region(points: MapPoint[]) {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latDelta = Math.max(0.01, (maxLat - minLat) * 1.6);
  const lngDelta = Math.max(0.01, (maxLng - minLng) * 1.6);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  };
}

export function DeliveryMap({ pickup, dropoff, current, height = 220 }: Props) {
  const points = [pickup, dropoff, current].filter(Boolean) as MapPoint[];

  if (!mapsAvailable || points.length === 0) {
    return (
      <View style={[styles.placeholder, { height }]}>
        <Text style={styles.placeholderTitle}>Ban do</Text>
        <Text style={styles.placeholderText}>
          {points.length === 0
            ? 'Chua co toa do pickup/dropoff de hien thi.'
            : 'Map preview can dev build (react-native-maps). Dung nut "Chi duong" de mo Google/Apple Maps.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { height }]}>
      <MapView style={StyleSheet.absoluteFill} initialRegion={region(points)}>
        {pickup ? (
          <Marker
            coordinate={{ latitude: pickup.lat, longitude: pickup.lng }}
            title={pickup.label ?? 'Lay hang'}
            pinColor={colors.primary}
          />
        ) : null}
        {dropoff ? (
          <Marker
            coordinate={{ latitude: dropoff.lat, longitude: dropoff.lng }}
            title={dropoff.label ?? 'Giao hang'}
            pinColor={colors.danger}
          />
        ) : null}
        {current ? (
          <Marker
            coordinate={{ latitude: current.lat, longitude: current.lng }}
            title={current.label ?? 'Vi tri cua ban'}
            pinColor="#2563eb"
          />
        ) : null}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  placeholder: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.xs,
  },
  placeholderTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.primaryDark },
  placeholderText: { fontSize: fontSize.sm, color: colors.textMuted, textAlign: 'center' },
});
