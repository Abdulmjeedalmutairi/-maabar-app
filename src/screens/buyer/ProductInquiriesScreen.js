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
  open:    C.blue,
  replied: C.green,
  closed:  C.textDisabled,
  pending: C.orange,
};

const STATUS_LABELS = {
  open:    { ar: 'مفتوح',    en: 'Open' },
  replied: { ar: 'تم الرد',  en: 'Replied' },
  closed:  { ar: 'مغلق',    en: 'Closed' },
  pending: { ar: 'معلق',     en: 'Pending' },
};

function statusLabel(s) {
  const entry = STATUS_LABELS[s];
  if (!entry) return s;
  return getLang() === 'ar' ? entry.ar : entry.en;
}

export default function ProductInquiriesScreen({ navigation }) {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); setRefreshing(false); return; }

    const { data } = await supabase
      .from('product_inquiries')
      .select('*, products(name_ar, name_en, name_zh)')
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false });

    setInquiries(data || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function getProductName(inq) {
    const lang = getLang();
    const p = inq.products;
    if (lang === 'ar') return p?.name_ar || p?.name_en || inq.product_name || tx('منتج', 'Product');
    if (lang === 'zh') return p?.name_zh || p?.name_en || inq.product_name || 'Product';
    return p?.name_en || p?.name_ar || inq.product_name || 'Product';
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={s.back}>{tx('← رجوع', '← Back')}</Text>
        </TouchableOpacity>
        <Text style={s.title}>{tx('استفساراتي', 'My Inquiries')}</Text>
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
          {inquiries.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyText}>{tx('لا توجد استفسارات بعد', 'No inquiries yet')}</Text>
            </View>
          ) : (
            inquiries.map(inq => {
              const color = STATUS_COLORS[inq.status] || C.textDisabled;
              return (
                <View key={inq.id} style={s.card}>
                  <View style={s.cardHeader}>
                    <View style={[s.badge, { backgroundColor: color + '20' }]}>
                      <Text style={[s.badgeText, { color }]}>{statusLabel(inq.status)}</Text>
                    </View>
                    <Text style={s.productName} numberOfLines={1}>{getProductName(inq)}</Text>
                  </View>

                  {!!inq.question_text && (
                    <Text style={s.question} numberOfLines={3}>{inq.question_text}</Text>
                  )}

                  {!!inq.answer_text && (
                    <View style={s.answerBox}>
                      <Text style={s.answerLabel}>{tx('رد المورد:', 'Supplier reply:')}</Text>
                      <Text style={s.answerText} numberOfLines={4}>{inq.answer_text}</Text>
                    </View>
                  )}

                  <View style={s.footer}>
                    <Text style={s.date}>
                      {new Date(inq.created_at).toLocaleDateString(getLang() === 'ar' ? 'ar-SA' : 'en-US')}
                    </Text>
                    {!!inq.supplier_id && (
                      <TouchableOpacity
                        style={s.chatBtn}
                        onPress={() => navigation.navigate('Inbox', { screen: 'Chat', params: { partnerId: inq.supplier_id } })}
                        activeOpacity={0.8}
                      >
                        <Text style={s.chatBtnText}>{tx('تواصل', 'Chat')}</Text>
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
    marginBottom: 10,
  },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, fontFamily: F.arSemi },
  productName: { flex: 1, color: C.textPrimary, fontFamily: F.arSemi, fontSize: 14, textAlign: 'right' },

  question: { color: C.textSecondary, fontFamily: F.ar, fontSize: 13, textAlign: 'right', lineHeight: 20, marginBottom: 10 },

  answerBox: {
    backgroundColor: C.bgOverlay,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  answerLabel: { color: C.textTertiary, fontFamily: F.arSemi, fontSize: 11, textAlign: 'right', marginBottom: 4 },
  answerText:  { color: C.textPrimary, fontFamily: F.ar, fontSize: 13, textAlign: 'right', lineHeight: 18 },

  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  date:   { color: C.textDisabled, fontFamily: F.en, fontSize: 11 },
  chatBtn: {
    backgroundColor: C.bgHover,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.borderDefault,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  chatBtnText: { color: C.textPrimary, fontFamily: F.arSemi, fontSize: 13 },
});
