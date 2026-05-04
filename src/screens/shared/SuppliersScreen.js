import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, ScrollView, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';
import { getLang } from '../../lib/lang';
import { getSpecialtyLabel } from '../../lib/specialtyLabel';

// ─── Inlined from web/src/lib/supplierOnboarding.js ──────────────────────────
const _STATUS_MAP = {
  verified: 'verified', approved: 'verified', active: 'verified',
  rejected: 'rejected',
  disabled: 'inactive', inactive: 'inactive', suspended: 'inactive',
  verification_under_review: 'verification_under_review',
  pending: 'verification_under_review', under_review: 'verification_under_review',
  submitted: 'verification_under_review', review: 'verification_under_review',
};
function _normalizeStatus(raw) {
  return _STATUS_MAP[String(raw || '').trim().toLowerCase()] || 'registered';
}
function isSupplierPubliclyVisible(raw) {
  return _normalizeStatus(raw) === 'verified';
}
function getSupplierMaabarId(profile = {}) {
  const raw = typeof profile === 'string' ? profile : profile?.maabar_supplier_id;
  return String(raw || '').trim().toUpperCase();
}
function buildSupplierTrustSignals(profile = {}) {
  const signals = [];
  if (_normalizeStatus(profile?.status) === 'verified') signals.push('maabar_reviewed');
  const tradeLinks = [profile?.trade_link, ...(Array.isArray(profile?.trade_links) ? profile.trade_links : [])].filter(Boolean);
  if (tradeLinks.length > 0) signals.push('trade_profile_available');
  if (profile?.wechat) signals.push('wechat_available');
  if (profile?.whatsapp) signals.push('whatsapp_available');
  if (Array.isArray(profile?.factory_images) && profile.factory_images.length > 0) signals.push('factory_media_available');
  return signals;
}
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES = {
  ar: [
    { val: 'all', label: 'الكل' },
    { val: 'electronics', label: 'إلكترونيات' },
    { val: 'furniture', label: 'أثاث' },
    { val: 'clothing', label: 'ملابس' },
    { val: 'building', label: 'مواد بناء' },
    { val: 'food', label: 'غذاء' },
    { val: 'other', label: 'أخرى' },
  ],
  en: [
    { val: 'all', label: 'All' },
    { val: 'electronics', label: 'Electronics' },
    { val: 'furniture', label: 'Furniture' },
    { val: 'clothing', label: 'Clothing' },
    { val: 'building', label: 'Building Materials' },
    { val: 'food', label: 'Food' },
    { val: 'other', label: 'Other' },
  ],
  zh: [
    { val: 'all', label: '全部' },
    { val: 'electronics', label: '电子产品' },
    { val: 'furniture', label: '家具' },
    { val: 'clothing', label: '服装' },
    { val: 'building', label: '建材' },
    { val: 'food', label: '食品' },
    { val: 'other', label: '其他' },
  ],
};

const T = {
  title:       { ar: 'الموردون',                   en: 'Suppliers',               zh: '供应商'        },
  search:      { ar: 'ابحث عن مورد...',             en: 'Search suppliers...',     zh: '搜索供应商...'  },
  back:        { ar: '← رجوع',                     en: '← Back',                 zh: '← 返回'        },
  verified:    { ar: 'معتمد',                       en: 'Verified',               zh: '已认证'         },
  deals:       { ar: 'صفقة مكتملة',                 en: 'deals',                  zh: '笔交易'         },
  products:    { ar: 'منتج',                        en: 'products',               zh: '产品'           },
  idLabel:     { ar: 'معرّف',                       en: 'ID',                     zh: '编号'           },
  tradeLink:   { ar: 'رابط متجر موثق',             en: 'Trade link on file',     zh: '店铺链接已提供'   },
  factoryPics: { ar: 'صور منشأة',                  en: 'Factory photos',         zh: '工厂图片'        },
  minOrder:    { ar: 'أقل طلب',                    en: 'Min',                    zh: '最低订单'        },
  sar:         { ar: 'ريال',                        en: 'SAR',                    zh: 'SAR'            },
  chat:        { ar: 'تواصل',                       en: 'Chat',                   zh: '联系'           },
  viewProfile: { ar: 'الملف ←',                    en: 'View →',                 zh: '查看 →'         },
  noSuppliers: { ar: 'لا يوجد موردون بعد',         en: 'No suppliers yet',       zh: '暂无供应商'      },
  suppliers:   { ar: 'مورد',                        en: 'suppliers',              zh: '供应商'          },
  reviewed:    { ar: 'تمت مراجعة الحساب من مَعبر', en: 'Reviewed by Maabar',    zh: '已通过 Maabar 审核' },
  awaiting:    { ar: 'الحساب بانتظار المراجعة',    en: 'Awaiting review',        zh: '等待平台审核'     },
  tradeOnFile: { ar: 'رابط الشركة متوفر',          en: 'trade profile available', zh: '已提供店铺/官网链接' },
  wechatAvail: { ar: 'WeChat متوفر',               en: 'WeChat available',       zh: '可通过 WeChat 联系' },
};

function t(key, lang) {
  return T[key]?.[lang] ?? T[key]?.en ?? key;
}

function renderStars(rating) {
  let out = '';
  for (let i = 1; i <= 5; i++) out += i <= Math.round(rating || 0) ? '★' : '☆';
  return out;
}

// ─── Supplier Card ────────────────────────────────────────────────────────────
function SupplierCard({ sup, lang, cats, navigation }) {
  const isAr = lang === 'ar';
  const rowDir = isAr ? 'row-reverse' : 'row';
  const textAlign = isAr ? 'right' : 'left';
  const wDir = isAr ? 'rtl' : 'ltr';

  const trustSignals = buildSupplierTrustSignals(sup);
  const isVerified   = isSupplierPubliclyVisible(sup.status);
  const maabarId     = getSupplierMaabarId(sup);
  // Use the canonical 24-category translator from lib/specialtyLabel.js
  // instead of the local 6-category `cats` table — matches web Suppliers.jsx
  // (Phase 6B Task 3). Falls back to the raw code if no entry matches.
  const catLabel     = getSpecialtyLabel(sup.speciality, lang);
  const bio = isAr
    ? (sup.bio_ar || sup.bio_en)
    : lang === 'zh'
      ? (sup.bio_zh || sup.bio_en)
      : (sup.bio_en || sup.bio_ar);

  return (
    <TouchableOpacity
      style={s.card}
      activeOpacity={0.78}
      onPress={() => navigation.navigate('SupplierProfile', { supplierId: sup.id })}
    >
      {/* ── HEADER: avatar + name + stars ── */}
      <View style={[s.row, { flexDirection: rowDir, marginBottom: 14 }]}>
        <View style={[s.avatar, isAr ? { marginLeft: 14, marginRight: 0 } : { marginRight: 14 }]}>
          {sup.avatar_url
            ? <Image source={{ uri: sup.avatar_url }} style={s.avatarImg} />
            : <Text style={s.avatarInitial}>{(sup.company_name || '?')[0].toUpperCase()}</Text>
          }
        </View>

        <View style={[s.nameBlock, { alignItems: isAr ? 'flex-end' : 'flex-start' }]}>
          {/* name + verified badge */}
          <View style={[s.row, { flexDirection: rowDir, gap: 6, marginBottom: 4, flexWrap: 'wrap' }]}>
            <Text style={s.companyName} numberOfLines={1}>{sup.company_name || '—'}</Text>
            {isVerified && (
              <View style={s.verifiedBadge}>
                <Text style={s.verifiedText}>✓ {t('verified', lang)}</Text>
              </View>
            )}
          </View>

          {/* specialty (under company name, above stars) — matches web Phase 6B Task 3 */}
          {sup.speciality && sup.speciality !== 'other' && (
            <Text
              style={[s.specialtyLine, { textAlign, fontFamily: isAr ? F.arSemi : F.enSemi }]}
              numberOfLines={1}
            >
              {catLabel}
            </Text>
          )}

          {/* stars + review count + deals badge */}
          <View style={[s.row, { flexDirection: rowDir, gap: 8, flexWrap: 'wrap' }]}>
            <Text style={s.stars}>{renderStars(sup.rating)}</Text>
            {sup.reviews_count > 0 && (
              <Text style={s.reviewCount}>({sup.reviews_count})</Text>
            )}
            {sup.reviews_count > 0 && (
              <View style={s.grayBadge}>
                <Text style={s.grayBadgeText}>{sup.reviews_count} {t('deals', lang)}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* ── BIO ── */}
      {!!bio && (
        <Text
          style={[s.bio, { textAlign, writingDirection: wDir }]}
          numberOfLines={2}
        >
          {bio}
        </Text>
      )}

      {/* ── TAGS — specialty promoted to header above; WeChat removed (Phase 6A) ── */}
      <View style={[s.tagRow, { flexDirection: rowDir }]}>
        {!!maabarId && isVerified && (
          <View style={s.tag}>
            <Text style={s.tagText}>{t('idLabel', lang)}: {maabarId}</Text>
          </View>
        )}
        {!!sup.city && (
          <View style={s.tag}><Text style={s.tagText}>{sup.city}</Text></View>
        )}
        {sup.product_count > 0 && (
          <View style={s.tag}>
            <Text style={s.tagText}>{sup.product_count} {t('products', lang)}</Text>
          </View>
        )}
        {trustSignals.includes('trade_profile_available') && (
          <View style={[s.tag, s.tagGreen]}>
            <Text style={[s.tagText, s.tagGreenText]}>{t('tradeLink', lang)}</Text>
          </View>
        )}
        {trustSignals.includes('factory_media_available') && (
          <View style={s.tag}><Text style={s.tagText}>{t('factoryPics', lang)}</Text></View>
        )}
      </View>

      {/* ── TRUST SIGNAL TEXT (WeChat segment removed — Phase 6A) ── */}
      {trustSignals.length > 0 && (
        <Text style={[s.trustText, { textAlign, writingDirection: wDir }]}>
          {isVerified ? t('reviewed', lang) : t('awaiting', lang)}
          {trustSignals.includes('trade_profile_available') ? ` · ${t('tradeOnFile', lang)}` : ''}
        </Text>
      )}

      {/* ── FOOTER: min order + chat + view ── */}
      <View style={[s.cardFooter, { flexDirection: rowDir }]}>
        {sup.min_order_value
          ? <Text style={s.minOrder}>{t('minOrder', lang)}: {sup.min_order_value} {t('sar', lang)}</Text>
          : <View />
        }
        <View style={[s.row, { flexDirection: rowDir, gap: 8 }]}>
          <TouchableOpacity
            style={s.chatBtn}
            onPress={() =>
              navigation.navigate('Inbox', { screen: 'Chat', params: { partnerId: sup.id } })
            }
          >
            <Text style={[s.chatBtnText, { fontFamily: isAr ? F.ar : F.en }]}>
              {t('chat', lang)}
            </Text>
          </TouchableOpacity>
          <Text style={[s.viewText, { fontFamily: isAr ? F.ar : F.en }]}>
            {t('viewProfile', lang)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function SuppliersScreen({ navigation }) {
  const lang = getLang();
  const isAr = lang === 'ar';
  const cats = CATEGORIES[lang] || CATEGORIES.ar;

  const [suppliers, setSuppliers] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search,    setSearch]    = useState('');
  const [activeCat, setActiveCat] = useState('all');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function fetchSuppliers() {
      let query = supabase
        .from('supplier_public_profiles')
        .select('*')
        .order('rating', { ascending: false });

      if (activeCat !== 'all') query = query.eq('speciality', activeCat);

      const { data, error } = await query;
      console.log('[SuppliersScreen] supplier_public_profiles →', data?.length ?? 0, 'rows | error:', error?.message ?? null);

      if (!cancelled) {
        setSuppliers(data || []);
        setLoading(false);
        setRefreshing(false);
      }
    }

    fetchSuppliers();
    return () => { cancelled = true; };
  }, [activeCat]);

  function onRefresh() {
    setRefreshing(true);
    // toggling activeCat re-triggers useEffect; force re-run by flipping a dummy refresh flag
    setActiveCat(prev => prev); // state identity preserved → need a different approach
    // Direct call avoids the identity-equal no-op:
    supabase
      .from('supplier_public_profiles')
      .select('*')
      .order('rating', { ascending: false })
      .then(({ data, error }) => {
        console.log('[SuppliersScreen] refresh →', data?.length ?? 0, 'rows | error:', error?.message ?? null);
        setSuppliers(data || []);
        setRefreshing(false);
      });
  }

  const filtered = suppliers.filter(sup => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    // wechat/whatsapp removed from the search index — Phase 6A keeps them
    // off every buyer-facing surface (no display, no side-channel search).
    return [
      sup.company_name, sup.bio_ar, sup.bio_en, sup.speciality,
      sup.city, sup.country, sup.maabar_supplier_id,
      sup.trade_link,
    ].filter(Boolean).some(v => String(v).toLowerCase().includes(q));
  });

  const rowDir = isAr ? 'row-reverse' : 'row';

  return (
    <SafeAreaView style={s.safe}>

      {/* ── TOP BAR ── */}
      <View style={[s.topBar, { flexDirection: rowDir }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[s.back, { fontFamily: isAr ? F.ar : F.en }]}>{t('back', lang)}</Text>
        </TouchableOpacity>
        <Text style={[s.pageTitle, { fontFamily: isAr ? F.arBold : F.enBold, writingDirection: isAr ? 'rtl' : 'ltr' }]}>
          {t('title', lang)}
        </Text>
      </View>

      {/* ── SEARCH ── */}
      <View style={s.searchWrap}>
        <TextInput
          style={[
            s.searchInput,
            { textAlign: isAr ? 'right' : 'left', fontFamily: isAr ? F.ar : F.en },
          ]}
          value={search}
          onChangeText={setSearch}
          placeholder={t('search', lang)}
          placeholderTextColor={C.textDisabled}
          returnKeyType="search"
        />
      </View>

      {/* ── CATEGORY PILLS ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[s.catScroll, isAr && { flexDirection: 'row-reverse' }]}
      >
        {cats.map(c => (
          <TouchableOpacity
            key={c.val}
            style={[s.catPill, activeCat === c.val && s.catPillActive]}
            onPress={() => setActiveCat(c.val)}
          >
            <Text style={[
              s.catPillText,
              activeCat === c.val && s.catPillTextActive,
              { fontFamily: isAr ? F.ar : F.en },
            ]}>
              {c.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── COUNT ── */}
      {!loading && (
        <Text style={[s.countText, { textAlign: isAr ? 'right' : 'left', fontFamily: isAr ? F.ar : F.en }]}>
          {filtered.length} {t('suppliers', lang)}
        </Text>
      )}

      {/* ── LIST ── */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={C.textSecondary} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={s.list}
          refreshing={refreshing}
          onRefresh={onRefresh}
          renderItem={({ item }) => (
            <SupplierCard
              sup={item}
              lang={lang}
              cats={cats}
              navigation={navigation}
            />
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={[s.emptyText, { fontFamily: isAr ? F.ar : F.en }]}>
                {t('noSuppliers', lang)}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bgBase },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Top bar
  topBar: {
    justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },
  back:      { color: C.textSecondary, fontSize: 14 },
  pageTitle: { color: C.textPrimary, fontSize: 18 },

  // Search
  searchWrap:  { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 2 },
  searchInput: {
    backgroundColor: C.bgRaised,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.borderMuted,
    paddingHorizontal: 16,
    paddingVertical: 11,
    color: C.textPrimary,
    fontSize: 15,
  },

  // Category pills
  catScroll:         { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  catPill:           { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: C.borderDefault, backgroundColor: C.bgBase },
  catPillActive:     { backgroundColor: C.bgRaised, borderColor: C.borderStrong },
  catPillText:       { fontSize: 12, color: C.textSecondary },
  catPillTextActive: { color: C.textPrimary },

  // Count
  countText: { paddingHorizontal: 20, paddingBottom: 4, fontSize: 12, color: C.textSecondary },

  // FlatList
  list: { padding: 16, gap: 12, paddingBottom: 40 },

  // Card
  card: {
    backgroundColor: C.bgRaised,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: C.borderDefault,
  },

  // Shared layout helpers
  row: { flexDirection: 'row', alignItems: 'center' },

  // Avatar
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: C.bgHover,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', flexShrink: 0,
  },
  avatarImg:     { width: '100%', height: '100%' },
  avatarInitial: { fontSize: 20, fontWeight: '600', color: C.textSecondary },

  // Name block
  nameBlock:   { flex: 1, minWidth: 0 },
  companyName: { fontSize: 15, fontWeight: '600', color: C.textPrimary, flexShrink: 1 },

  // Specialty (under company name, above stars) — matches web Phase 6B Task 3
  specialtyLine: {
    fontSize: 12, color: C.textSecondary,
    fontWeight: '500', marginBottom: 4,
    letterSpacing: 0.2,
  },

  // Verified badge — green (trust signal, not purple)
  verifiedBadge: {
    backgroundColor: C.greenSoft,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,100,0,0.12)',
  },
  verifiedText: { fontSize: 10, fontWeight: '700', color: C.green },

  // Stars
  stars:       { fontSize: 13, color: '#e8a020' },
  reviewCount: { fontSize: 11, color: C.textSecondary },

  // Gray badge (deals, categories, city, WeChat, factory — all neutral)
  grayBadge:     { backgroundColor: C.bgHover, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
  grayBadgeText: { fontSize: 10, color: C.textSecondary },

  // Bio
  bio: { fontSize: 12, color: C.textSecondary, lineHeight: 19, marginBottom: 12 },

  // Tags
  tagRow:       { flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  tag:          { paddingHorizontal: 10, paddingVertical: 3, backgroundColor: C.bgHover, borderRadius: 20 },
  tagText:      { fontSize: 10, color: C.textSecondary, letterSpacing: 0.5 },
  tagGreen:     { backgroundColor: C.greenSoft, borderWidth: 1, borderColor: 'rgba(0,100,0,0.12)' },
  tagGreenText: { color: C.green },

  // Trust signal text line
  trustText: { fontSize: 11, color: C.textSecondary, lineHeight: 18, marginBottom: 12 },

  // Card footer
  cardFooter: {
    justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: C.borderSubtle,
    paddingTop: 12, gap: 8,
  },
  minOrder: { fontSize: 11, color: C.textSecondary, letterSpacing: 0.5 },

  // Chat button — neutral gray, no purple
  chatBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: C.bgHover,
    borderWidth: 1, borderColor: C.borderDefault,
  },
  chatBtnText: { fontSize: 11, color: C.textSecondary, letterSpacing: 0.5 },
  viewText:    { fontSize: 12, color: C.textPrimary, letterSpacing: 0.5 },

  // Empty state
  empty:     { padding: 60, alignItems: 'center' },
  emptyText: { color: C.textSecondary, fontSize: 15 },
});
