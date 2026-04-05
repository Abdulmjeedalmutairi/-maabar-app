import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { C } from '../../lib/colors';

export default function SuppliersScreen({ navigation }) {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    let query = supabase
      .from('profiles')
      .select('id, company_name, country, city, maabar_supplier_id, trust_score, status, whatsapp, wechat, trade_link, years_experience')
      .eq('role', 'supplier')
      .eq('status', 'verified')
      .order('trust_score', { ascending: false })
      .limit(30);

    if (search.trim()) {
      query = query.ilike('company_name', `%${search.trim()}%`);
    }

    const { data } = await query;
    setSuppliers(data || []);
    setLoading(false);
    setRefreshing(false);
  }, [search]);

  useEffect(() => { load(); }, [load]);
  function onRefresh() { setRefreshing(true); load(); }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.back}>← رجوع</Text>
        </TouchableOpacity>
        <Text style={s.pageTitle}>الموردون</Text>
      </View>

      <View style={s.searchWrap}>
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="ابحث عن مورد..."
          placeholderTextColor={C.textDisabled}
          textAlign="right"
          returnKeyType="search"
          onSubmitEditing={load}
        />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={C.accent} size="large" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
        >
          {suppliers.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyText}>لا توجد نتائج</Text>
            </View>
          ) : (
            suppliers.map(sup => (
              <TouchableOpacity
                key={sup.id}
                style={s.card}
                onPress={() => navigation.navigate('SupplierProfile', { supplierId: sup.id })}
                activeOpacity={0.8}
              >
                <View style={s.cardTop}>
                  <View style={s.verifiedBadge}>
                    <Text style={s.verifiedText}>موثّق ✓</Text>
                  </View>
                  <View style={s.cardInfo}>
                    <Text style={s.companyName} numberOfLines={1}>{sup.company_name}</Text>
                    <Text style={s.location}>{[sup.city, sup.country].filter(Boolean).join('، ')}</Text>
                  </View>
                </View>

                {sup.maabar_supplier_id && (
                  <Text style={s.supplierId}>{sup.maabar_supplier_id}</Text>
                )}

                <View style={s.trustRow}>
                  {sup.years_experience && (
                    <Text style={s.trustItem}>{sup.years_experience} سنة خبرة</Text>
                  )}
                  {sup.trust_score !== null && (
                    <Text style={s.trustItem}>تقييم {sup.trust_score}/100</Text>
                  )}
                  {sup.whatsapp && <Text style={s.trustItem}>واتساب ✓</Text>}
                  {sup.wechat && <Text style={s.trustItem}>WeChat ✓</Text>}
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bgBase },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },
  back: { color: C.accent, fontSize: 14 },
  pageTitle: { color: C.textPrimary, fontSize: 18, fontWeight: '700' },
  searchWrap: { paddingHorizontal: 16, paddingVertical: 10 },
  searchInput: {
    backgroundColor: C.bgRaised, borderRadius: 14,
    borderWidth: 1, borderColor: C.borderMuted,
    paddingHorizontal: 16, paddingVertical: 11,
    color: C.textPrimary, fontSize: 15,
  },
  list: { padding: 16, gap: 10, paddingBottom: 40 },
  card: {
    backgroundColor: C.bgRaised, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: C.borderDefault,
  },
  cardTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 4,
  },
  cardInfo: { flex: 1, alignItems: 'flex-end' },
  companyName: { color: C.textPrimary, fontSize: 16, fontWeight: '700', textAlign: 'right' },
  location: { color: C.textSecondary, fontSize: 12, marginTop: 3 },
  verifiedBadge: {
    backgroundColor: C.greenSoft, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start',
  },
  verifiedText: { color: C.green, fontSize: 11, fontWeight: '700' },
  supplierId: { color: C.textDisabled, fontSize: 11, textAlign: 'right', marginBottom: 10 },
  trustRow: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end',
    gap: 8, marginTop: 10,
    borderTopWidth: 1, borderTopColor: C.borderSubtle, paddingTop: 10,
  },
  trustItem: {
    color: C.textTertiary, fontSize: 12,
    backgroundColor: C.bgOverlay, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  empty: { padding: 60, alignItems: 'center' },
  emptyText: { color: C.textSecondary, fontSize: 15 },
});
