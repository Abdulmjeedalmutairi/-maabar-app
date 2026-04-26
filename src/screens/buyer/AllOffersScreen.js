import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { getLang } from '../../lib/lang';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';
import {
  formatPriceWithConversion,
  normalizeDisplayCurrency,
  useDisplayCurrency,
} from '../../lib/displayCurrency';

const COPY = {
  ar: {
    title: 'جميع العروض',
    back: 'رجوع',
    empty: 'لا توجد عروض معلقة',
    emptySub: 'سيظهر هنا كل عرض جديد ينتظر قرارك',
    pending: 'في انتظار ردك',
    supplier: 'مورد',
    unitPrice: 'سعر الوحدة',
    offersOne: 'عرض',
    offersMany: (n) => `${n} عروض`,
    viewRequest: 'عرض تفاصيل الطلب',
  },
  en: {
    title: 'All Offers',
    back: 'Back',
    empty: 'No pending offers',
    emptySub: 'New offers awaiting your decision will appear here',
    pending: 'Awaiting your response',
    supplier: 'Supplier',
    unitPrice: 'Unit Price',
    offersOne: '1 offer',
    offersMany: (n) => `${n} offers`,
    viewRequest: 'View request',
  },
  zh: {
    title: '全部报价',
    back: '返回',
    empty: '暂无待处理报价',
    emptySub: '有新报价等待处理时将显示在这里',
    pending: '等待您的回复',
    supplier: '供应商',
    unitPrice: '单价',
    offersOne: '1 份报价',
    offersMany: (n) => `${n} 份报价`,
    viewRequest: '查看订单',
  },
};

export default function AllOffersScreen({ navigation }) {
  const lang = getLang();
  const t = COPY[lang] || COPY.ar;
  const isAr = lang === 'ar';
  const { displayCurrency: viewerCurrency, rates: exchangeRates } = useDisplayCurrency();

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); setRefreshing(false); return; }

    const { data: requests } = await supabase
      .from('requests')
      .select('id, title_ar, title_en, title_zh, quantity, status, created_at')
      .eq('buyer_id', user.id);

    const requestIds = (requests || []).map(r => r.id);
    if (requestIds.length === 0) {
      setGroups([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const { data: offers, error: offersError } = await supabase
      .from('offers')
      .select('id, request_id, supplier_id, price, shipping_cost, currency, status, created_at')
      .in('request_id', requestIds)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (offersError) console.error('[AllOffers] offers error:', offersError);

    const pending = offers || [];
    const supplierIds = [...new Set(pending.map(o => o.supplier_id).filter(Boolean))];

    let profileById = {};
    if (supplierIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, company_name, full_name, maabar_supplier_id')
        .in('id', supplierIds);
      profileById = (profs || []).reduce((acc, p) => { acc[p.id] = p; return acc; }, {});
    }

    const reqById = (requests || []).reduce((acc, r) => { acc[r.id] = r; return acc; }, {});

    const byReq = {};
    pending.forEach(o => {
      if (!byReq[o.request_id]) {
        byReq[o.request_id] = { request: reqById[o.request_id], offers: [], latestAt: '' };
      }
      byReq[o.request_id].offers.push({ ...o, profile: profileById[o.supplier_id] || null });
      if (o.created_at > byReq[o.request_id].latestAt) byReq[o.request_id].latestAt = o.created_at;
    });

    const grouped = Object.values(byReq)
      .filter(g => g.request)
      .sort((a, b) => String(b.latestAt).localeCompare(String(a.latestAt)));

    setGroups(grouped);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function onRefresh() { setRefreshing(true); load(); }

  function getTitle(r) {
    if (!r) return '—';
    if (lang === 'ar') return r.title_ar || r.title_en || r.title_zh || '—';
    if (lang === 'zh') return r.title_zh || r.title_en || r.title_ar || '—';
    return r.title_en || r.title_ar || r.title_zh || '—';
  }

  function fmtPrice(amount, currency) {
    const num = parseFloat(amount);
    if (!Number.isFinite(num)) return '—';
    return formatPriceWithConversion({
      amount: num,
      sourceCurrency: normalizeDisplayCurrency(currency || 'USD'),
      displayCurrency: viewerCurrency,
      rates: exchangeRates,
      lang,
      options: { minimumFractionDigits: 2 },
    });
  }

  function openGroup(group) {
    navigation.navigate('Offers', {
      requestId: group.request.id,
      title: getTitle(group.request),
      quantity: group.request.quantity,
    });
  }

  function offersCountLabel(n) {
    return n === 1 ? t.offersOne : t.offersMany(n);
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={[s.topBar, isAr && s.rowRtl]}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={s.back}>{isAr ? `→ ${t.back}` : `← ${t.back}`}</Text>
        </TouchableOpacity>
        <Text style={[s.pageTitle, isAr && s.rtl]} numberOfLines={1}>{t.title}</Text>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={C.textTertiary} size="large" />
        </View>
      ) : groups.length === 0 ? (
        <View style={s.emptyCard}>
          <Text style={[s.emptyText, isAr && s.rtl]}>{t.empty}</Text>
          <Text style={[s.emptySubText, isAr && s.rtl]}>{t.emptySub}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.textTertiary} />
          }
        >
          {groups.map(group => (
            <View key={group.request.id} style={s.group}>
              <TouchableOpacity
                style={[s.groupHeader, isAr && s.rowRtl]}
                onPress={() => openGroup(group)}
                activeOpacity={0.7}
              >
                <Text style={s.groupCount}>{offersCountLabel(group.offers.length)}</Text>
                <Text style={[s.groupTitle, isAr && s.rtl]} numberOfLines={1}>
                  {getTitle(group.request)}
                </Text>
              </TouchableOpacity>

              {group.offers.map(offer => {
                const name = offer.profile?.company_name
                  || offer.profile?.full_name
                  || t.supplier;
                return (
                  <TouchableOpacity
                    key={offer.id}
                    style={s.offerRow}
                    onPress={() => openGroup(group)}
                    activeOpacity={0.85}
                  >
                    <View style={[s.offerTop, isAr && s.rowRtl]}>
                      <View style={s.statusBadge}>
                        <Text style={s.statusText}>{t.pending}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.supplierName, isAr && s.rtl]} numberOfLines={1}>{name}</Text>
                        {!!offer.profile?.maabar_supplier_id && (
                          <Text style={[s.supplierId, isAr && s.rtl]} numberOfLines={1}>
                            {offer.profile.maabar_supplier_id}
                          </Text>
                        )}
                      </View>
                    </View>

                    <View style={[s.priceRow, isAr && s.rowRtl]}>
                      <Text style={s.priceLabel}>{t.unitPrice}</Text>
                      <Text style={s.priceValue}>{fmtPrice(offer.price, offer.currency)}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bgBase },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  rtl: { textAlign: 'right', writingDirection: 'rtl' },
  rowRtl: { flexDirection: 'row-reverse' },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
  },
  back: { color: C.textSecondary, fontFamily: F.ar, fontSize: 14 },
  pageTitle: { color: C.textPrimary, fontFamily: F.arBold, fontSize: 17, maxWidth: '70%' },

  list: { padding: 16, paddingBottom: 40, gap: 22 },

  group: { gap: 8 },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingBottom: 4,
    gap: 10,
  },
  groupTitle: { flex: 1, color: C.textPrimary, fontFamily: F.arSemi, fontSize: 15 },
  groupCount: { color: C.textTertiary, fontFamily: F.ar, fontSize: 11 },

  offerRow: {
    backgroundColor: C.bgRaised,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: C.borderDefault,
  },
  offerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  supplierName: { color: C.textPrimary, fontFamily: F.arSemi, fontSize: 14 },
  supplierId: { color: C.textDisabled, fontFamily: F.en, fontSize: 11, marginTop: 2 },

  statusBadge: {
    backgroundColor: C.redSoft,
    borderWidth: 1,
    borderColor: C.red + '40',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusText: { color: C.red, fontFamily: F.arSemi, fontSize: 11 },

  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: C.bgOverlay,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  priceLabel: { color: C.textTertiary, fontFamily: F.ar, fontSize: 12 },
  priceValue: { color: C.textPrimary, fontFamily: F.enLight, fontSize: 18, letterSpacing: -0.5 },

  emptyCard: {
    margin: 20,
    backgroundColor: C.bgRaised,
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.borderDefault,
  },
  emptyText: { color: C.textSecondary, fontFamily: F.ar, fontSize: 15, marginBottom: 8 },
  emptySubText: { color: C.textTertiary, fontFamily: F.ar, fontSize: 13, textAlign: 'center' },
});
