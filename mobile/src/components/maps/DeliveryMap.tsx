import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
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

interface MarkerData {
  lat: number;
  lng: number;
  color: string;
  title: string;
}

/**
 * Map preview cho shipper: current location + pickup + dropoff markers.
 *
 * Dung OpenStreetMap (Leaflet) render trong WebView -> KHONG can Google Maps API key,
 * chay duoc tren Expo Go va web. Tiles lay tu tile.openstreetmap.org (can internet).
 */
function buildHtml(markers: MarkerData[]): string {
  const data = JSON.stringify(markers);
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>html,body,#map{margin:0;padding:0;height:100%;width:100%;background:#e8f5ee;}</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var markers = ${data};
  var map = L.map('map', { zoomControl: true, attributionControl: true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '\u00A9 OpenStreetMap contributors'
  }).addTo(map);
  var latlngs = [];
  markers.forEach(function (m) {
    var c = L.circleMarker([m.lat, m.lng], {
      radius: 9, color: '#ffffff', weight: 2, fillColor: m.color, fillOpacity: 1
    }).addTo(map);
    if (m.title) { c.bindPopup(m.title); }
    latlngs.push([m.lat, m.lng]);
  });
  if (latlngs.length === 1) {
    map.setView(latlngs[0], 15);
  } else if (latlngs.length > 1) {
    map.fitBounds(latlngs, { padding: [40, 40] });
  } else {
    map.setView([10.7769, 106.7009], 12);
  }
</script>
</body>
</html>`;
}

export function DeliveryMap({ pickup, dropoff, current, height = 220 }: Props) {
  const points = [pickup, dropoff, current].filter(Boolean) as MapPoint[];

  const html = useMemo(() => {
    const markers: MarkerData[] = [];
    if (pickup) {
      markers.push({ lat: pickup.lat, lng: pickup.lng, color: colors.primary, title: pickup.label ?? 'Lấy hàng' });
    }
    if (dropoff) {
      markers.push({ lat: dropoff.lat, lng: dropoff.lng, color: colors.danger, title: dropoff.label ?? 'Giao hàng' });
    }
    if (current) {
      markers.push({ lat: current.lat, lng: current.lng, color: '#2563eb', title: current.label ?? 'Vị trí của bạn' });
    }
    return buildHtml(markers);
  }, [pickup, dropoff, current]);

  if (points.length === 0) {
    return (
      <View style={[styles.placeholder, { height }]}>
        <Text style={styles.placeholderTitle}>Bản đồ</Text>
        <Text style={styles.placeholderText}>Chưa có tọa độ pickup/dropoff để hiển thị.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { height }]}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={StyleSheet.absoluteFill}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        startInLoadingState
      />
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
