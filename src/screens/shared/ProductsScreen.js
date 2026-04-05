import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, RefreshControl, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { C } from '../../lib/colors';

const CATEGORIES = ['الكل', 'إلكترونيات', 'أثاث', 'ملابس', 'مواد بناء', 'غذاء', 'أخرى'];

export default function ProductsScreen({ navigation }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('الكل');

  const load = useCallback(async () => {
    let query = supabase
      .from('products')
      .select(`
        id, name_ar, name_en, price_from, currency, moq, category,
        image_url, sample_available, created_at,
        profiles:supplier_id (company_name, maabar_supplier_id, status)
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(30);

    if (category !== 'الكل') query = query.eq('category', category);
    if (search.trim()) {
      query = query.or(`name_ar.ilike.%${search.trim()}%,name_en.ilike.%${search.trim()}%`);
    }

    const { data } = await query;
    setProducts(data || []);
    setLoading(false);
    setRefreshing(false);
  }, [search, category]);

  useEffect(() => { load(); }, [load]);
  function onRefresh() { setRefreshing(true); load(); }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.back}>← رجوع</Text>
        </TouchableOpacity>
        <Text style={s.pageTitle}>المنتجات</Text>
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="ابحث عن منتج..."
          placeholderTextColor={C.textDisabled}
          textAlign="right"
          returnKeyType="search"
          onSubmitEditing={load}
        />
      </View>

      {/* Categories */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.catBar}
      >
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[s.catChip, category === cat && s.catChipActive]}
            onPress={() => setCategory(cat)}
          >
            <Text style={[s.catChipText, category === cat && { color: C.accent }]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={C.accent} size="large" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={s.grid}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
        >
          {products.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyText}>لا توجد نتائج</Text>
            </View>
          ) : (
            products.map(p => (
              <TouchableOpacity
                key={p.id}
                style={s.productCard}
                onPress={() => navigation.navigate('ProductDetail', { productId: p.id })}
                activeOpacity={0.8}
              >
                {p.image_url ? (
                  <Image source={{ uri: p.image_url }} style={s.productImg} resizeMode="cover" />
                ) : (
                  <View style={[s.productImg, s.productImgPlaceholder]}>
                    <Text style={s.imgPlaceholderText}>صورة</Text>
                  </View>
                )}
                <View style={s.productInfo}>
                  <Text style={s.productName} numberOfLines={2}>{p.name_ar || p.name_en}</Text>
                  {p.price_from && (
                    <Text style={s.productPrice}>${p.price_from} {p.currency}</Text>
                  )}
                  <View style={s.productMeta}>
                    {p.sample_available && (
                      <View style={s.sampleBadge}>
                        <Text style={s.sampleText}>عينة</Text>
                      </View>
                    )}
                    {p.moq && <Text style={s.moqText}>MOQ {p.moq}</Text>}
                  </View>
                  {p.profiles?.company_name && (
                    <Text style={s.supplierName} numberOfLines={1}>{p.profiles.company_name}</Text>
                  )}
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

  catBar: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  catChip: {
    borderWidth: 1, borderColor: C.borderDefault,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: C.bgRaised,
  },
  catChipActive: { borderColor: C.accent, backgroundColor: C.accentSoft },
  catChipText: { color: C.textSecondary, fontSize: 13 },

  grid: { padding: 12, gap: 12, paddingBottom: 40 },
  productCard: {
    backgroundColor: C.bgRaised, borderRadius: 16,
    borderWidth: 1, borderColor: C.borderDefault, overflow: 'hidden',
  },
  productImg: { width: '100%', height: 180, backgroundColor: C.bgOverlay },
  productImgPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  imgPlaceholderText: { color: C.textDisabled, fontSize: 14 },
  productInfo: { padding: 14 },
  productName: { color: C.textPrimary, fontSize: 15, fontWeight: '600', textAlign: 'right', marginBottom: 6 },
  productPrice: { color: C.accent, fontSize: 18, fontWeight: '600', textAlign: 'right', marginBottom: 8 },
  productMeta: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginBottom: 6 },
  sampleBadge: {
    backgroundColor: C.greenSoft, borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  sampleText: { color: C.green, fontSize: 11, fontWeight: '600' },
  moqText: { color: C.textTertiary, fontSize: 12 },
  supplierName: { color: C.textTertiary, fontSize: 12, textAlign: 'right' },
  empty: { padding: 60, alignItems: 'center' },
  emptyText: { color: C.textSecondary, fontSize: 15 },
});
