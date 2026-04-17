import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';
import { getLang } from '../../lib/lang';

const tx = (ar, en) => getLang() === 'ar' ? ar : en;

const STATUS_COLORS = {
  pending:  C.orange,
  approved: C.green,
  rejected: C.red,
  paid:     C.green,
};

const STATUS_LABELS = {
  pending:  { ar: 'بانتظار الموافقة', en: 'Pending' },
  approved: { ar: 'تمت الموافقة',     en: 'Approved' },
  rejected: { ar: 'مرفوض',           en: 'Rejected' },
  paid:     { ar: 'تم الدفع',         en: 'Paid' },
};

function statusLabel(st) {
  const entry = STATUS_LABELS[st];
  if (!entry) return st;
  return getLang() === 'ar' ? entry.ar : entry.en;
}

function getProductName(sample) {
  const lang = getLang();
  const p = sample.products;
  if (!p) return tx('منتج', 'Product');
  if (lang === 'ar') return p.name_ar || p.name_en || tx('منتج', 'Product');
  return p.name_en || p.name_ar || 'Product';
}

export default function SamplesScreen({ navigation }) {
  const [samples, setSamples]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); setRefreshing(false); return; }

    const { data } = await supabase
      .from('samples')
      .select('*, products(name_ar, name_en, name_zh)')
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false });

    setSamples(data || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={s.back}>{tx('← رجوع', '← Back')}</Text>
        </TouchableOpacity>
        <Text style={s.title}>{tx('طلبات العينات', 'Sample Requests')}</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={C.textDisabled} size="large" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.textDisabled} />
          }
          showsVerticalScrollIndicator={false}
        >
          {samples.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyText}>{tx('لا توجد طلبات عينات', 'No sample requests yet')}</Text>
            </View>
          ) : (
            samples.map(sample => {
              const color = STATUS_COLORS[sample.status] || C.textDisabled;
              const canPay = sample.status === 'approved' && (sample.sample_price > 0 || sample.total_price > 0);
              const payAmount = Number(sample.sample_price || sample.total_price || 0) * 3.75;

              return (
                <View key={sample.id} style={s.card}>
                  <View style={s.cardHeader}>
                    <View style={[s.badge, { backgroundColor: color + '20' }]}>
                      <Text style={[s.badgeText, { color }]}>{statusLabel(sample.status)}</Text>
                    </View>
                    <Text style={s.productName} numberOfLines={1}>{getProductName(sample)}</Text>
                  </View>

                  <View style={s.infoRow}>
                    <View style={s.infoItem}>
                      <Text style={s.infoLabel}>{tx('الكمية', 'Qty')}</Text>
                      <Text style={s.infoValue}>{sample.quantity || '—'}</Text>
                    </View>
                    {(sample.sample_price > 0 || sample.total_price > 0) && (
                      <View style={s.infoItem}>
                        <Text style={s.infoLabel}>{tx('السعر', 'Price')}</Text>
                        <Text style={s.infoValue}>
                          {payAmount.toLocaleString('ar-SA', { maximumFractionDigits: 2 })} {tx('ر.س', 'SAR')}
                        </Text>
                      </View>
                    )}
                  </View>

                  {!!sample.notes && (
                    <Text style={s.notes} numberOfLines={2}>{sample.notes}</Text>
                  )}

                  <View style={s.cardFooter}>
                    <Text style={s.date}>
                      {new Date(sample.created_at).toLocaleDateString(getLang() === 'ar' ? 'ar-SA' : 'en-US')}
                    </Text>
                    {canPay && (
                      <TouchableOpacity
                        style={s.payBtn}
                        activeOpacity={0.85}
                        onPress={() => navigation.navigate('Payment', {
                          amount: payAmount,
                          type: 'sample',
                          sampleId: sample.id,
                        })}
                      >
                        <Text style={s.payBtnText}>{tx('ادفع الآن', 'Pay Now')}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bgBase },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
  },
  back:  { color: C.textSecondary, fontFamily: F.ar, fontSize: 14 },
  title: { color: C.textPrimary, fontFamily: F.arBold, fontSize: 17 },

  list: { padding: 16, paddingBottom: 40 },

  empty: { padding: 40, alignItems: 'center' },
  emptyText: { color: C.textSecondary, fontFamily: F.ar, fontSize: 15 },

  card: {
    backgroundColor: C.bgRaised,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.borderDefault,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, fontFamily: F.arSemi },
  productName: { flex: 1, color: C.textPrimary, fontFamily: F.arSemi, fontSize: 14, textAlign: 'right' },

  infoRow: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  infoItem: {
    flex: 1,
    backgroundColor: C.bgOverlay,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  infoLabel: { color: C.textTertiary, fontFamily: F.ar, fontSize: 11, marginBottom: 3 },
  infoValue: { color: C.textPrimary, fontFamily: F.enSemi, fontSize: 15 },

  notes: { color: C.textSecondary, fontFamily: F.ar, fontSize: 13, textAlign: 'right', lineHeight: 18, marginBottom: 10 },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { color: C.textDisabled, fontFamily: F.en, fontSize: 11 },
  payBtn: {
    backgroundColor: C.btnPrimary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  payBtnText: { color: C.btnPrimaryText, fontFamily: F.arBold, fontSize: 13 },
});
