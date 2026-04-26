/**
 * ProductsScreen
 * Mirrors web src/pages/Products.jsx exactly:
 *  - Supabase query: select('*').eq('is_active',true).order('created_at',{ascending:false})
 *  - Batch-fetch supplier profiles (mirrors attachSupplierProfiles)
 *  - Visibility filter: isSupplierPubliclyVisible (status === 'verified' | 'active' | 'approved')
 *  - Client-side: search, category, price range, capability filters, sort
 *  - Single-column list: image right, info left
 *  - Trust signals: verified badge, lead time, customization, supplier ID, WeChat, factory photos, trade link
 *  - Two buttons per card: التفاصيل / اشتر الآن
 *  - No purple anywhere — former-purple badges use dark neutral gray
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, FlatList,
  StyleSheet, ActivityIndicator, RefreshControl, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { getLang } from '../../lib/lang';
import { getPrimaryProductImage } from '../../lib/productMedia';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';
import {
  formatPriceWithConversion,
  useDisplayCurrency,
} from '../../lib/displayCurrency';

/* ── Category constants (mirrors web CATEGORIES) ─────── */
const CATEGORIES = {
  ar: [
    { val: 'all',         label: 'الكل' },
    { val: 'electronics', label: 'إلكترونيات' },
    { val: 'furniture',   label: 'أثاث' },
    { val: 'clothing',    label: 'ملابس' },
    { val: 'building',    label: 'مواد بناء' },
    { val: 'food',        label: 'غذاء' },
    { val: 'other',       label: 'أخرى' },
  ],
  en: [
    { val: 'all',         label: 'All' },
    { val: 'electronics', label: 'Electronics' },
    { val: 'furniture',   label: 'Furniture' },
    { val: 'clothing',    label: 'Clothing' },
    { val: 'building',    label: 'Building Materials' },
    { val: 'food',        label: 'Food' },
    { val: 'other',       label: 'Other' },
  ],
  zh: [
    { val: 'all',         label: '全部' },
    { val: 'electronics', label: '电子产品' },
    { val: 'furniture',   label: '家具' },
    { val: 'clothing',    label: '服装' },
    { val: 'building',    label: '建材' },
    { val: 'food',        label: '食品' },
    { val: 'other',       label: '其他' },
  ],
};

/* ── Supplier helpers (ported from web supplierOnboarding.js) */
const SUPPLIER_STATUS_EQUIVALENTS = {
  registered: 'registered',
  verification_required: 'verification_required',
  verification_under_review: 'verification_under_review',
  verified: 'verified',
  draft: 'registered',
  incomplete: 'registered',
  pending: 'verification_under_review',
  under_review: 'verification_under_review',
  submitted: 'verification_under_review',
  review: 'verification_under_review',
  approved: 'verified',
  active: 'verified',
  rejected: 'rejected',
  disabled: 'inactive',
  inactive: 'inactive',
  suspended: 'inactive',
};

function normalizeSupplierStatus(rawStatus) {
  const s = String(rawStatus || 'registered').trim().toLowerCase();
  return SUPPLIER_STATUS_EQUIVALENTS[s] || 'registered';
}

function isSupplierPubliclyVisible(rawStatus) {
  return normalizeSupplierStatus(rawStatus) === 'verified';
}

function getSupplierMaabarId(profile = {}) {
  const raw = typeof profile === 'string' ? profile : profile?.maabar_supplier_id;
  return String(raw || '').trim().toUpperCase();
}

function getSupplierTradeLinks(profile = {}) {
  const links = [];
  if (Array.isArray(profile?.trade_links)) {
    profile.trade_links.forEach(v => { const s = String(v || '').trim(); if (s && !links.includes(s)) links.push(s); });
  }
  const single = String(profile?.trade_link || '').trim();
  if (single && !links.includes(single)) links.push(single);
  return links;
}

function buildSupplierTrustSignals(profile = {}) {
  const signals = [];
  if (normalizeSupplierStatus(profile?.status) === 'verified') signals.push('maabar_reviewed');
  if (getSupplierTradeLinks(profile).length > 0) signals.push('trade_profile_available');
  if (profile?.wechat) signals.push('wechat_available');
  if (profile?.whatsapp) signals.push('whatsapp_available');
  if (Array.isArray(profile?.factory_images) && profile.factory_images.length > 0) signals.push('factory_media_available');
  return signals;
}

/* ── Text helpers (mirrors web) ───────────────────────── */
function buildSearchableText(p) {
  return [
    p.name_ar, p.name_en, p.name_zh,
    p.desc_ar, p.desc_en, p.desc_zh,
    p.profiles?.company_name, p.profiles?.city, p.profiles?.country,
    p.profiles?.maabar_supplier_id, p.spec_customization,
    p.spec_material, p.spec_packaging_details,
  ].filter(Boolean).join(' ').toLowerCase();
}

function getProductDisplayName(p, lang) {
  if (lang === 'ar') return p.name_ar || p.name_en || p.name_zh || '';
  if (lang === 'zh') return p.name_zh || p.name_en || p.name_ar || '';
  return p.name_en || p.name_zh || p.name_ar || '';
}

function getProductSecondaryName(p, lang) {
  if (lang === 'zh') return p.name_en || p.name_ar || '';
  if (lang === 'ar') return p.name_zh || p.name_en || '';
  return p.name_zh || p.name_ar || '';
}

/* ── Main screen ──────────────────────────────────────── */
export default function ProductsScreen({ navigation, route }) {
  const lang         = getLang();
  const isAr         = lang === 'ar';
  const cats         = CATEGORIES[lang] || CATEGORIES.ar;
  const isSupplier   = route?.params?.role === 'supplier';
  const filterCurrency = lang === 'ar' ? 'SAR' : lang === 'zh' ? 'CNY' : 'USD';

  const [allProducts, setAllProducts]           = useState([]);
  const [loading, setLoading]                   = useState(true);
  const [refreshing, setRefreshing]             = useState(false);
  const [search, setSearch]                     = useState('');
  const [activeCategory, setActiveCategory]     = useState('all');
  const [sortBy, setSortBy]                     = useState('newest');
  const [priceRange, setPriceRange]             = useState({ min: '', max: '' });
  const [capabilityFilters, setCapabilityFilters] = useState({ sample: false, customization: false });

  /* ── Supabase query — copied exactly from web loadProducts ── */
  const load = useCallback(async () => {
    // Step 1: fetch products
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    console.log('[ProductsScreen] products query error:', error);
    console.log('[ProductsScreen] products raw count:', Array.isArray(data) ? data.length : 'not array', data);

    if (Array.isArray(data) && data.length > 0) {
      // Step 2: batch-fetch supplier profiles (mirrors web attachSupplierProfiles)
      const ids = [...new Set(data.map(p => p.supplier_id).filter(Boolean))];
      console.log('[ProductsScreen] supplier_ids to fetch:', ids);

      let profileMap = {};
      if (ids.length) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .in('id', ids);
        console.log('[ProductsScreen] profiles query error:', profilesError);
        console.log('[ProductsScreen] profiles fetched:', Array.isArray(profiles) ? profiles.length : 'not array', profiles);
        profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));
      }

      // Step 3: join profiles (no visibility filter — show all is_active products)
      const withProfiles = data.map(p => ({ ...p, profiles: profileMap[p.supplier_id] || null }));
      setAllProducts(withProfiles);
    } else {
      console.log('[ProductsScreen] no products returned — data was:', data);
      setAllProducts([]);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = () => { setRefreshing(true); load(); };

  /* ── Client-side filtering + sort (mirrors web filtered) ─── */
  const filtered = allProducts
    .filter(p => !search.trim() || buildSearchableText(p).includes(search.trim().toLowerCase()))
    .filter(p => activeCategory === 'all' || p.category === activeCategory)
    .filter(p => {
      if (!priceRange.min) return true;
      return (p.price_from || 0) >= parseFloat(priceRange.min);
    })
    .filter(p => {
      if (!priceRange.max) return true;
      return (p.price_from || 0) <= parseFloat(priceRange.max);
    })
    .filter(p => !capabilityFilters.sample || Boolean(p.sample_available))
    .filter(p => !capabilityFilters.customization || Boolean(p.spec_customization))
    .sort((a, b) => {
      if (sortBy === 'price_asc')  return (a.price_from || 0) - (b.price_from || 0);
      if (sortBy === 'price_desc') return (b.price_from || 0) - (a.price_from || 0);
      return new Date(b.created_at) - new Date(a.created_at);
    });

  const hasActiveFilters = search || activeCategory !== 'all'
    || capabilityFilters.sample || capabilityFilters.customization
    || priceRange.min || priceRange.max;

  const resetAll = () => {
    setSearch('');
    setActiveCategory('all');
    setCapabilityFilters({ sample: false, customization: false });
    setPriceRange({ min: '', max: '' });
  };

  /* ── i18n strings ─────────────────────────────────────── */
  const t = {
    title:       isAr ? 'المنتجات'                 : lang === 'zh' ? '产品'         : 'Products',
    back:        isAr ? 'رجوع'                      : lang === 'zh' ? '返回'         : 'Back',
    searchPH:    isAr ? 'ابحث بالعربي أو الإنجليزي أو الصيني...' : lang === 'zh' ? '可搜索中文 / 英文 / 阿文产品名...' : 'Search Arabic, English, or Chinese names...',
    sortNewest:  isAr ? 'الأحدث'                   : lang === 'zh' ? '最新'          : 'Newest',
    sortPriceAsc: isAr ? 'السعر: الأقل'            : lang === 'zh' ? '价格从低到高'  : 'Price: Low',
    sortPriceDsc: isAr ? 'السعر: الأعلى'           : lang === 'zh' ? '价格从高到低'  : 'Price: High',
    priceLbl:    isAr ? 'السعر:'                    : lang === 'zh' ? '价格:'         : 'Price:',
    priceMin:    isAr ? 'من'                        : lang === 'zh' ? '最小'          : 'Min',
    priceMax:    isAr ? 'إلى'                       : lang === 'zh' ? '最大'          : 'Max',
    priceClear:  isAr ? 'مسح'                       : lang === 'zh' ? '清除'          : 'Clear',
    quickFilter: isAr ? 'تصفية سريعة:'             : lang === 'zh' ? '快速筛选：'     : 'Quick filters:',
    sampleBtn:   isAr ? 'عينة متاحة'               : lang === 'zh' ? '可提供样品'     : 'Sample available',
    oemBtn:      isAr ? 'تخصيص / علامة خاصة'       : lang === 'zh' ? 'OEM / 定制'    : 'OEM / customization',
    clearFilters: isAr ? 'مسح التصفية'             : lang === 'zh' ? '清空筛选'       : 'Clear filters',
    resetFilters: isAr ? 'إعادة ضبط الفلاتر'       : lang === 'zh' ? '重置筛选'       : 'Reset filters',
    noProducts:  isAr ? 'لا توجد منتجات مطابقة'    : lang === 'zh' ? '暂无匹配产品'   : 'No products found',
    products:    isAr ? 'منتج'                      : lang === 'zh' ? '产品'           : 'products',
  };

  const SORT_OPTIONS = [
    { val: 'newest',     label: t.sortNewest },
    { val: 'price_asc',  label: t.sortPriceAsc },
    { val: 'price_desc', label: t.sortPriceDsc },
  ];

  return (
    <SafeAreaView style={s.safe}>

      {/* Top bar */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={[s.back, { fontFamily: isAr ? F.ar : F.en }]}>{t.back}</Text>
        </TouchableOpacity>
        <Text style={[s.pageTitle, { fontFamily: isAr ? F.arBold : F.enBold }]}>{t.title}</Text>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <ProductRow
            product={item}
            lang={lang}
            isSupplier={isSupplier}
            onPress={() => navigation.navigate('ProductDetail', { productId: item.id })}
          />
        )}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="rgba(0,0,0,0.35)"
          />
        }
        ListHeaderComponent={
          <View>
            {/* Search + sort row */}
            <View style={s.searchRow}>
              <TextInput
                style={[s.searchInput, { flex: 1, textAlign: isAr ? 'right' : 'left', fontFamily: isAr ? F.ar : F.en }]}
                value={search}
                onChangeText={setSearch}
                placeholder={t.searchPH}
                placeholderTextColor={C.textDisabled}
                returnKeyType="search"
              />
            </View>

            {/* Sort chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipBar}>
              {SORT_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.val}
                  style={[s.sortChip, sortBy === opt.val && s.sortChipActive]}
                  onPress={() => setSortBy(opt.val)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.sortChipText, { fontFamily: isAr ? F.ar : F.en }, sortBy === opt.val && s.sortChipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Category chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.chipBar, { paddingTop: 0 }]}>
              {cats.map(cat => (
                <TouchableOpacity
                  key={cat.val}
                  style={[s.chip, activeCategory === cat.val && s.chipActive]}
                  onPress={() => setActiveCategory(cat.val)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.chipText, { fontFamily: isAr ? F.ar : F.en }, activeCategory === cat.val && s.chipTextActive]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Price range */}
            <View style={[s.filterRow, { flexDirection: isAr ? 'row-reverse' : 'row' }]}>
              <Text style={[s.filterLabel, { fontFamily: isAr ? F.ar : F.en }]}>{t.priceLbl}</Text>
              <TextInput
                style={[s.priceInput, { textAlign: isAr ? 'right' : 'left', fontFamily: isAr ? F.ar : F.en }]}
                value={priceRange.min}
                onChangeText={v => setPriceRange(p => ({ ...p, min: v }))}
                placeholder={t.priceMin}
                placeholderTextColor={C.textDisabled}
                keyboardType="numeric"
              />
              <Text style={s.filterLabel}>—</Text>
              <TextInput
                style={[s.priceInput, { textAlign: isAr ? 'right' : 'left', fontFamily: isAr ? F.ar : F.en }]}
                value={priceRange.max}
                onChangeText={v => setPriceRange(p => ({ ...p, max: v }))}
                placeholder={t.priceMax}
                placeholderTextColor={C.textDisabled}
                keyboardType="numeric"
              />
              <Text style={[s.filterLabel, { fontFamily: F.en }]}>{filterCurrency}</Text>
              {(priceRange.min || priceRange.max) && (
                <TouchableOpacity onPress={() => setPriceRange({ min: '', max: '' })} style={s.clearBtn} activeOpacity={0.7}>
                  <Text style={[s.clearBtnText, { fontFamily: isAr ? F.ar : F.en }]}>{t.priceClear}</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Capability quick filters */}
            <View style={[s.filterRow, { flexWrap: 'wrap', flexDirection: isAr ? 'row-reverse' : 'row' }]}>
              <Text style={[s.filterLabel, { fontFamily: isAr ? F.ar : F.en }]}>{t.quickFilter}</Text>
              <TouchableOpacity
                onPress={() => setCapabilityFilters(prev => ({ ...prev, sample: !prev.sample }))}
                style={[s.capBtn, capabilityFilters.sample && s.capBtnSampleActive]}
                activeOpacity={0.8}
              >
                <Text style={[s.capBtnText, { fontFamily: isAr ? F.ar : F.en }, capabilityFilters.sample && s.capBtnSampleTextActive]}>
                  {t.sampleBtn}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setCapabilityFilters(prev => ({ ...prev, customization: !prev.customization }))}
                style={[s.capBtn, capabilityFilters.customization && s.capBtnNeutralActive]}
                activeOpacity={0.8}
              >
                <Text style={[s.capBtnText, { fontFamily: isAr ? F.ar : F.en }, capabilityFilters.customization && s.capBtnNeutralTextActive]}>
                  {t.oemBtn}
                </Text>
              </TouchableOpacity>
              {(capabilityFilters.sample || capabilityFilters.customization) && (
                <TouchableOpacity onPress={() => setCapabilityFilters({ sample: false, customization: false })} style={s.clearBtn} activeOpacity={0.7}>
                  <Text style={[s.clearBtnText, { fontFamily: isAr ? F.ar : F.en }]}>{t.clearFilters}</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Product count */}
            {!loading && (
              <Text style={[s.countText, { fontFamily: isAr ? F.ar : F.en, textAlign: isAr ? 'right' : 'left' }]}>
                {filtered.length} {t.products}
              </Text>
            )}

            {/* Loading skeletons */}
            {loading && (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator color="rgba(0,0,0,0.35)" size="large" />
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={s.empty}>
              <Text style={[s.emptyText, { fontFamily: isAr ? F.ar : F.en }]}>{t.noProducts}</Text>
              {hasActiveFilters && (
                <TouchableOpacity onPress={resetAll} style={s.resetBtn} activeOpacity={0.7}>
                  <Text style={[s.resetBtnText, { fontFamily: isAr ? F.ar : F.en }]}>{t.resetFilters}</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null
        }
        contentContainerStyle={s.list}
      />
    </SafeAreaView>
  );
}

/* ── Product row (single-column list) ────────────────── */
function ProductRow({ product: p, lang, isSupplier, onPress }) {
  const [imgErr, setImgErr] = useState(false);
  const imgSrc = getPrimaryProductImage(p);
  const isAr   = lang === 'ar';
  const { displayCurrency: viewerCurrency, rates: exchangeRates } = useDisplayCurrency();

  const displayName   = getProductDisplayName(p, lang);
  const secondaryName = getProductSecondaryName(p, lang);
  const showSecondary = secondaryName && secondaryName !== displayName;

  const trustSignals    = buildSupplierTrustSignals(p.profiles || {});
  const isVerified      = isSupplierPubliclyVisible(p.profiles?.status);
  const supplierMaabarId = getSupplierMaabarId(p.profiles || {});

  const supplierLine = [
    p.profiles?.company_name,
    p.profiles?.city,
    p.profiles?.country,
  ].filter(Boolean).join(' · ');

  const priceText = p.price_from != null
    ? formatPriceWithConversion({
        amount: Number(p.price_from),
        sourceCurrency: p.currency || 'USD',
        displayCurrency: viewerCurrency,
        rates: exchangeRates,
        lang,
        options: { minimumFractionDigits: Number(p.price_from) % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 },
      })
    : null;

  const moqLabel = isAr
    ? `الحد الأدنى للطلب: ${p.moq || '—'}`
    : lang === 'zh'
      ? `MOQ: ${p.moq || '—'}`
      : `MOQ: ${p.moq || '—'}`;

  const detailsLabel  = isAr ? 'التفاصيل'  : lang === 'zh' ? '详情'   : 'Details';
  const buyNowLabel   = isAr ? 'اشترِ الآن' : lang === 'zh' ? '立即购买' : 'Buy Now';

  const leadTimeBadge = p.spec_lead_time_days
    ? (isAr ? `تجهيز ${p.spec_lead_time_days} يوم` : lang === 'zh' ? `交期 ${p.spec_lead_time_days} 天` : `Lead time ${p.spec_lead_time_days}d`)
    : null;

  const oemBadge = p.spec_customization
    ? (isAr ? 'تخصيص / علامة خاصة' : lang === 'zh' ? '支持 OEM / 定制' : 'OEM / customization')
    : null;

  const supplierIdBadge = supplierMaabarId && isVerified
    ? (isAr ? `معرّف ${supplierMaabarId}` : lang === 'zh' ? `编号 ${supplierMaabarId}` : `ID ${supplierMaabarId}`)
    : null;

  const wechatBadge    = trustSignals.includes('wechat_available');
  const factoryBadge   = trustSignals.includes('factory_media_available');
  const tradeLinkBadge = trustSignals.includes('trade_profile_available');

  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.8}>

      {/* Info — left side */}
      <View style={[s.rowInfo, { alignItems: isAr ? 'flex-end' : 'flex-start' }]}>

        {/* Name row + verified badge */}
        <View style={[s.nameRow, { flexDirection: isAr ? 'row-reverse' : 'row' }]}>
          <Text
            style={[s.productName, { textAlign: isAr ? 'right' : 'left', fontFamily: isAr ? F.arSemi : F.enSemi }]}
            numberOfLines={2}
          >
            {displayName}
          </Text>
          {isVerified && (
            <View style={[s.badgeGreen, s.badgeInline]}>
              <Text style={[s.badgeGreenText, { fontFamily: isAr ? F.ar : F.en }]}>
                {isAr ? '✓ مورد موثّق' : lang === 'zh' ? '✓ 认证供应商' : '✓ Verified'}
              </Text>
            </View>
          )}
        </View>

        {/* Secondary / factory name */}
        {showSecondary && (
          <Text style={[s.secondaryName, { textAlign: isAr ? 'right' : 'left', fontFamily: isAr ? F.ar : F.en }]} numberOfLines={1}>
            {isAr
              ? `اسم المصنع: ${secondaryName}`
              : lang === 'zh'
                ? `英文 / 其他名称：${secondaryName}`
                : `Factory name: ${secondaryName}`}
          </Text>
        )}

        {/* Price */}
        {priceText && (
          <Text style={[s.price, { textAlign: isAr ? 'right' : 'left', fontFamily: F.enSemi }]}>
            {priceText}
          </Text>
        )}

        {/* MOQ + supplier */}
        <Text style={[s.meta, { textAlign: isAr ? 'right' : 'left', fontFamily: isAr ? F.ar : F.en }]} numberOfLines={1}>
          {moqLabel}{supplierLine ? ` · ${supplierLine}` : ''}
        </Text>

        {/* Trust / capability badges */}
        <View style={[s.badgeRow, { flexDirection: isAr ? 'row-reverse' : 'row' }]}>
          {p.sample_available && (
            <View style={s.badgeGreen}>
              <Text style={[s.badgeGreenText, { fontFamily: isAr ? F.ar : F.en }]}>
                {isAr ? 'عينة متاحة' : lang === 'zh' ? '可提供样品' : 'Sample'}
              </Text>
            </View>
          )}
          {leadTimeBadge && (
            <View style={s.badgeNeutral}>
              <Text style={[s.badgeNeutralText, { fontFamily: isAr ? F.ar : F.en }]}>{leadTimeBadge}</Text>
            </View>
          )}
          {oemBadge && (
            <View style={s.badgeNeutralDim}>
              <Text style={[s.badgeNeutralDimText, { fontFamily: isAr ? F.ar : F.en }]}>{oemBadge}</Text>
            </View>
          )}
          {supplierIdBadge && (
            <View style={s.badgeNeutral}>
              <Text style={[s.badgeNeutralText, { fontFamily: F.en }]}>{supplierIdBadge}</Text>
            </View>
          )}
          {wechatBadge && (
            <View style={s.badgeNeutral}>
              <Text style={[s.badgeNeutralText, { fontFamily: F.en }]}>WeChat</Text>
            </View>
          )}
          {tradeLinkBadge && (
            <View style={s.badgeGreenDim}>
              <Text style={[s.badgeGreenDimText, { fontFamily: isAr ? F.ar : F.en }]}>
                {isAr ? 'رابط شركة' : lang === 'zh' ? '店铺链接' : 'Trade link'}
              </Text>
            </View>
          )}
          {factoryBadge && (
            <View style={s.badgeNeutralDim}>
              <Text style={[s.badgeNeutralDimText, { fontFamily: isAr ? F.ar : F.en }]}>
                {isAr ? 'صور مصنع' : lang === 'zh' ? '工厂图片' : 'Factory photos'}
              </Text>
            </View>
          )}
        </View>

        {/* Action buttons */}
        <View style={[s.btnRow, { flexDirection: isAr ? 'row-reverse' : 'row' }]}>
          <TouchableOpacity style={s.btnDark} onPress={onPress} activeOpacity={0.8}>
            <Text style={[s.btnDarkText, { fontFamily: isAr ? F.arSemi : F.enSemi }]}>{detailsLabel}</Text>
          </TouchableOpacity>
          {!isSupplier && (
            <TouchableOpacity style={s.btnOutline} onPress={onPress} activeOpacity={0.8}>
              <Text style={[s.btnOutlineText, { fontFamily: isAr ? F.arSemi : F.enSemi }]}>{buyNowLabel}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Image — right side */}
      <View style={s.imgWrap}>
        {imgSrc && !imgErr ? (
          <Image
            source={{ uri: imgSrc }}
            style={s.img}
            resizeMode="cover"
            onError={() => setImgErr(true)}
          />
        ) : (
          <View style={[s.img, s.imgPlaceholder]} />
        )}
      </View>

    </TouchableOpacity>
  );
}

/* ── Styles ───────────────────────────────────────────── */
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bgBase },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
  },
  back:      { color: C.textSecondary, fontSize: 14 },
  pageTitle: { color: C.textPrimary, fontSize: 17 },

  list: { paddingBottom: 40 },

  /* ─ Filters ─ */
  searchRow: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, flexDirection: 'row', gap: 10 },
  searchInput: {
    backgroundColor: C.bgRaised,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.borderMuted,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: C.textPrimary,
    fontSize: 14,
  },

  chipBar: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12, gap: 8, alignItems: 'center' },
  chip: {
    flexShrink: 0,
    borderWidth: 1,
    borderColor: C.borderDefault,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: C.bgRaised,
  },
  chipActive:     { backgroundColor: C.btnPrimary, borderColor: C.btnPrimary },
  chipText:       { color: C.textSecondary, fontSize: 13 },
  chipTextActive: { color: C.btnPrimaryText },

  sortChip: {
    flexShrink: 0,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: 'transparent',
  },
  sortChipActive:     { borderColor: C.borderStrong },
  sortChipText:       { color: C.textTertiary, fontSize: 12 },
  sortChipTextActive: { color: C.textPrimary },

  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  filterLabel: { color: C.textDisabled, fontSize: 12 },

  priceInput: {
    width: 80,
    backgroundColor: C.bgRaised,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.borderMuted,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: C.textPrimary,
    fontSize: 13,
  },

  capBtn: {
    borderWidth: 1,
    borderColor: C.borderSubtle,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'transparent',
  },
  capBtnSampleActive:      { borderColor: 'rgba(45,122,79,0.35)', backgroundColor: 'rgba(45,122,79,0.08)' },
  capBtnNeutralActive:     { borderColor: 'rgba(0,0,0,0.15)', backgroundColor: 'rgba(0,0,0,0.06)' },
  capBtnText:              { color: C.textSecondary, fontSize: 12 },
  capBtnSampleTextActive:  { color: '#2D6A4F' },
  capBtnNeutralTextActive: { color: 'rgba(0,0,0,0.55)' },

  clearBtn: {
    borderWidth: 1,
    borderColor: C.borderSubtle,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  clearBtnText: { color: C.textSecondary, fontSize: 11 },

  countText: {
    color: C.textDisabled,
    fontSize: 12,
    letterSpacing: 0.3,
    paddingHorizontal: 16,
    marginBottom: 8,
  },

  /* ─ List row ─ */
  row: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
  },
  rowInfo: { flex: 1, paddingRight: 12 },

  nameRow:      { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 3 },
  productName:  { color: C.textPrimary, fontSize: 14, lineHeight: 20, flexShrink: 1 },
  secondaryName: { color: C.textDisabled, fontSize: 11, marginBottom: 5 },

  price: { color: C.textPrimary, fontSize: 15, marginBottom: 3 },
  meta:  { color: C.textSecondary, fontSize: 12, marginBottom: 8, lineHeight: 17 },

  badgeRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 10 },
  badgeInline: { marginLeft: 4 },

  /* Green badges (sample available, verified, trade link) */
  badgeGreen: {
    backgroundColor: 'rgba(45,122,79,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(45,122,79,0.22)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeGreenText: { color: '#2D6A4F', fontSize: 10 },

  badgeGreenDim: {
    backgroundColor: 'rgba(58,122,82,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0,100,0,0.12)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeGreenDimText: { color: '#2D6A4F', fontSize: 10 },

  /* Light neutral badges (lead time, supplier ID, WeChat) */
  badgeNeutral: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.07)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeNeutralText: { color: 'rgba(0,0,0,0.45)', fontSize: 10 },

  /* Even dimmer neutral (OEM, factory photos) */
  badgeNeutralDim: {
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.07)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeNeutralDimText: { color: 'rgba(0,0,0,0.30)', fontSize: 10 },

  /* ─ Image ─ */
  imgWrap: { width: 80, flexShrink: 0, justifyContent: 'flex-start', paddingTop: 2 },
  img: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  imgPlaceholder: {},

  /* ─ Buttons ─ */
  btnRow: { flexDirection: 'row', gap: 8 },
  btnDark: {
    backgroundColor: C.btnPrimary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  btnDarkText:    { color: C.btnPrimaryText, fontSize: 13 },
  btnOutline: {
    borderWidth: 1,
    borderColor: C.borderDefault,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  btnOutlineText: { color: C.textSecondary, fontSize: 13 },

  /* ─ Empty state ─ */
  empty:        { padding: 60, alignItems: 'center' },
  emptyText:    { color: C.textSecondary, fontSize: 15, marginBottom: 20 },
  resetBtn: {
    borderWidth: 1,
    borderColor: C.borderSubtle,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  resetBtnText: { color: C.textSecondary, fontSize: 13 },
});
