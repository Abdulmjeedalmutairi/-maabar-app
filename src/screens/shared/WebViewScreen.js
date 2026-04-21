import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';

export default function WebViewScreen({ navigation, route }) {
  const { url, title } = route.params;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.7} hitSlop={8}>
          <Text style={s.backArrow}>{Platform.OS === 'ios' ? '‹' : '←'}</Text>
          <Text style={s.backLabel}>رجوع</Text>
        </TouchableOpacity>
        {!!title && <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>}
        <View style={s.headerSpacer} />
      </View>

      <View style={s.content}>
        <WebView
          source={{ uri: url }}
          onLoadStart={() => { setLoading(true); setError(false); }}
          onLoadEnd={() => setLoading(false)}
          onError={() => { setLoading(false); setError(true); }}
          style={s.webview}
        />
        {loading && (
          <View style={s.loadingOverlay}>
            <ActivityIndicator size="large" color={C.textDisabled} />
          </View>
        )}
        {error && (
          <View style={s.errorOverlay}>
            <Text style={s.errorText}>تعذّر تحميل الصفحة</Text>
            <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.75}>
              <Text style={s.errorBack}>رجوع</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: '#fff' },
  header:  {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
    backgroundColor: C.bgBase,
  },
  backBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backArrow:    { fontSize: 22, color: C.textPrimary, fontFamily: F.en, lineHeight: 26 },
  backLabel:    { fontSize: 14, color: C.textPrimary, fontFamily: F.ar },
  headerTitle:  { flex: 1, textAlign: 'center', fontSize: 14, fontFamily: F.arSemi, color: C.textPrimary },
  headerSpacer: { width: 60 },
  content:      { flex: 1 },
  webview:      { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.bgBase,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.bgBase,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  errorText: { fontFamily: F.ar, fontSize: 15, color: C.textSecondary },
  errorBack: { fontFamily: F.arSemi, fontSize: 14, color: C.textPrimary },
});
