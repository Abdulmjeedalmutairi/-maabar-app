/**
 * ProductDetailScreen
 * Mirrors web src/pages/ProductDetail.jsx
 *
 * Supabase queries (exact copies):
 *   1. products → select('*').eq('id', productId).maybeSingle()
 *   2. profiles  → select('*').eq('id', base.supplier_id).maybeSingle()
 *
 * Sections (per spec):
 *   gallery carousel · name + verified badge · manufacturer/alt name ·
 *   price (display currency) + original USD · MOQ + supplier + city ·
 *   description · sourcing highlights grid · specs grid ·
 *   مراجعة معبر · دلائل الثقة · الهوية التجارية ·
 *   supplier card (avatar, name, rating, reviews, city, verified) ·
 *   contact badges (ID, trade link, WhatsApp, WeChat) ·
 *   factory photos row (tap → fullscreen modal) ·
 *   3 action buttons: اشتر الآن / استفسار / تواصل مع المورد
 *
 * Currency: base is USD · ar→SAR(×3.75) · zh→CNY(×7.2) · en→USD(×1)
 * No purple anywhere.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  StyleSheet, ActivityIndicator, Modal, Dimensions,
  TouchableWithoutFeedback, StatusBar, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { getLang } from '../../lib/lang';
import { getProductGalleryImages, buildProductSpecs } from '../../lib/productMedia';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';

/* ── Fixed exchange rates (mirrors web displayCurrency DEFAULT_RATES) ── */
const RATES = { USD: 1, SAR: 3.75, CNY: 7.2 };

function getDisplayCurrency(lang) {
  if (lang === 'ar') return 'SAR';
  if (lang === 'zh') return 'CNY';
  return 'USD';
}

function convertAndFormat(usdAmount, targetCurrency, lang) {
  const rate = RATES[targetCurrency] || 1;
  const converted = Number(usdAmount || 0) * rate;
  const locale = lang === 'ar' ? 'ar-SA' : lang === 'zh' ? 'zh-CN' : 'en-US';
  const str = converted.toLocaleString(locale, { maximumFractionDigits: 2 });
  return `${str} ${targetCurrency}`;
}

function formatUSD(amount) {
  const n = Number(amount || 0);
  return `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })} USD`;
}

/* ── Supplier helpers (mirrors web supplierOnboarding.js) ─────────── */
const STATUS_MAP = {
  verified: 'verified',   active: 'verified',      approved: 'verified',
  draft: 'registered',    incomplete: 'registered',
  pending: 'under_review', under_review: 'under_review',
  submitted: 'under_review', review: 'under_review',
  rejected: 'rejected',   disabled: 'inactive',
  inactive: 'inactive',   suspended: 'inactive',
};
function normalizeStatus(raw) {
  return STATUS_MAP[String(raw || '').trim().toLowerCase()] || 'registered';
}
function isSupplierPubliclyVisible(raw) {
  return normalizeStatus(raw) === 'verified';
}
function getSupplierMaabarId(profile = {}) {
  return String(profile?.maabar_supplier_id || '').trim().toUpperCase();
}
function buildTrustSignals(profile = {}) {
  const signals = [];
  if (normalizeStatus(profile?.status) === 'verified') signals.push('maabar_reviewed');
  const tradeLinks = [
    ...(Array.isArray(profile?.trade_links) ? profile.trade_links : []),
    profile?.trade_link,
  ].filter(Boolean);
  if (tradeLinks.length > 0)                                                    signals.push('trade_profile_available');
  if (profile?.wechat)                                                           signals.push('wechat_available');
  if (profile?.whatsapp)                                                         signals.push('whatsapp_available');
  if (Array.isArray(profile?.factory_images) && profile.factory_images.length)  signals.push('factory_media_available');
  return signals;
}

/* ── Text helpers (mirrors web getLocalizedText) ──────────────────── */
function getLocalizedText(product, lang, key) {
  if (key === 'name') {
    if (lang === 'ar') return product.name_ar || product.name_en || product.name_zh || '';
    if (lang === 'zh') return product.name_zh || product.name_en || product.name_ar || '';
    return product.name_en || product.name_zh || product.name_ar || '';
  }
  if (key === 'desc') {
    if (lang === 'ar') return product.desc_ar || product.desc_en || product.desc_zh || '';
    if (lang === 'zh') return product.desc_zh || product.desc_en || product.desc_ar || '';
    return product.desc_en || product.desc_zh || product.desc_ar || '';
  }
  return '';
}

function starsStr(rating) {
  let s = '';
  for (let i = 1; i <= 5; i++) s += i <= Math.round(rating || 0) ? '★' : '☆';
  return s;
}

const { width: SW } = Dimensions.get('window');

/* ── Main screen ──────────────────────────────────────────────────── */
export default function ProductDetailScreen({ route, navigation }) {
  const { productId } = route.params || {};
  const lang  = getLang();
  const isAr  = lang === 'ar';

  const [product, setProduct]             = useState(null);
  const [loading, setLoading]             = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const [photoViewer, setPhotoViewer]     = useState(null);   // uri string | null
  const [inquiryModal, setInquiryModal]   = useState(false);
  const [inquiryText, setInquiryText]     = useState('');
  const [inquirySending, setInquirySending] = useState(false);
  const [sampleModal, setSampleModal]     = useState(false);
  const [sampleQty, setSampleQty]         = useState('1');
  const [sampleNotes, setSampleNotes]     = useState('');
  const [sampleSending, setSampleSending] = useState(false);

  /* ── Supabase query — exact copy from web loadProduct ─────────── */
  useEffect(() => {
    if (!productId) { setLoading(false); return; }

    (async () => {
      // Step 1: fetch product (mirrors web: sb.from('products').select('*').eq('id', id).maybeSingle())
      const { data: base, error: prodError } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .maybeSingle();

      console.log('[ProductDetail] products error:', prodError);
      console.log('[ProductDetail] product:', base?.id, base?.name_ar || base?.name_en);

      if (!base) { setLoading(false); return; }

      // Step 2: fetch supplier profile (mirrors web attachSupplierProfiles)
      let prof = null;
      if (base.supplier_id) {
        const { data: profData, error: profError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', base.supplier_id)
          .maybeSingle();
        console.log('[ProductDetail] profiles error:', profError);
        console.log('[ProductDetail] profile:', profData?.id, 'status:', profData?.status);
        prof = profData;
      }

      const full = { ...base, profiles: prof };
      setProduct(full);
      const imgs = getProductGalleryImages(full);
      if (imgs[0]) setSelectedImage(imgs[0]);
      setLoading(false);
    })();
  }, [productId]);

  /* ── Actions ─────────────────────────────────────────────────── */
  const handleBuyNow = () => {
    console.log('handleBuyNow called - navigating to Checkout');
    console.log('Product:', product?.id, product?.name_ar);
    navigation.navigate('Checkout', { product: product });
  };

  // تواصل مع المورد — go directly to ChatScreen
  async function handleContactSupplier() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigation.navigate('Login'); return; }
    const supplierId = product?.supplier_id;
    if (!supplierId) return;
    navigation.navigate('Inbox', { screen: 'Chat', params: { partnerId: supplierId } });
  }

  // استفسار — open inline text modal, send as message via Supabase
  async function handleOpenInquiry() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigation.navigate('Login'); return; }
    setInquiryText('');
    setInquiryModal(true);
  }

  async function handleSendInquiry() {
    const text = inquiryText.trim();
    if (!text || inquirySending) return;
    const supplierId = product?.supplier_id;
    if (!supplierId) return;

    setInquirySending(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setInquirySending(false); return; }

    await supabase.from('product_inquiries').insert({
      product_id:    product.id,
      buyer_id:      user.id,
      supplier_id:   supplierId,
      question_text: text,
    });
    await supabase.from('notifications').insert({
      user_id:   supplierId,
      type:      'product_inquiry',
      title:     'استفسار عن منتج',
      body:      text.slice(0, 100),
      data:      JSON.stringify({ product_id: product.id }),
      is_read:   false,
    });

    setInquirySending(false);
    setInquiryModal(false);
    setInquiryText('');
  }

  async function handleRequestSample() {
    const supplierId = product?.supplier_id;
    if (!supplierId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigation.navigate('Login'); return; }
    setSampleQty('1');
    setSampleNotes('');
    setSampleModal(true);
  }

  async function handleSendSampleRequest() {
    if (sampleSending) return;
    setSampleSending(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSampleSending(false); return; }
    await supabase.from('samples').insert({
      product_id:  product.id,
      buyer_id:    user.id,
      supplier_id: product.supplier_id,
      quantity:    parseInt(sampleQty, 10) || 1,
      notes:       sampleNotes.trim(),
      status:      'pending',
    });
    setSampleSending(false);
    setSampleModal(false);
    setSampleQty('1');
    setSampleNotes('');
  }

  /* ── Loading ─────────────────────────────────────────────────── */
  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <ActivityIndicator color="rgba(0,0,0,0.35)" size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Text style={[s.back, { fontFamily: isAr ? F.ar : F.en }]}>
              {isAr ? 'رجوع' : lang === 'zh' ? '返回' : 'Back'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={s.center}>
          <Text style={[s.notFound, { fontFamily: isAr ? F.ar : F.en }]}>
            {isAr ? 'المنتج غير موجود' : lang === 'zh' ? '产品不存在' : 'Product not found'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  /* ── Derived data ────────────────────────────────────────────── */
  const sup           = product.profiles || {};
  const supplierId    = sup.id || product.supplier_id || '';
  const name          = getLocalizedText(product, lang, 'name');
  const desc          = getLocalizedText(product, lang, 'desc');
  const isVerified    = isSupplierPubliclyVisible(sup.status);
  const trustSignals  = buildTrustSignals(sup);
  const maabarId      = getSupplierMaabarId(sup);
  const galleryImages = getProductGalleryImages(product);
  const specs         = buildProductSpecs(product, lang);
  const factoryPhotos = Array.isArray(sup.factory_images) ? sup.factory_images.slice(0, 5) : [];

  const secondaryName = lang === 'zh'
    ? (product.name_en || product.name_ar || '')
    : isAr
      ? (product.name_zh || product.name_en || '')
      : (product.name_zh || product.name_ar || '');

  /* Price */
  const displayCurrency  = getDisplayCurrency(lang);
  const priceDisplay     = product.price_from != null
    ? convertAndFormat(product.price_from, displayCurrency, lang)
    : null;
  const priceOriginalUSD = product.price_from != null && displayCurrency !== 'USD'
    ? formatUSD(product.price_from)
    : null;

  /* Sourcing highlights (mirrors web sourcingHighlights array exactly) */
  const origin = product.origin || sup.country || (isAr ? 'الصين' : lang === 'zh' ? '中国' : 'China');
  const highlights = [
    { label: isAr ? 'الحد الأدنى للطلب' : lang === 'zh' ? '起订量'   : 'MOQ',
      value: product.moq || '—' },
    { label: isAr ? 'بلد المنشأ'         : lang === 'zh' ? '原产地'   : 'Origin',
      value: isAr && origin === 'China' ? 'الصين' : origin },
    { label: isAr ? 'مدة التجهيز'        : lang === 'zh' ? '备货周期' : 'Lead time',
      value: product.spec_lead_time_days
        ? (isAr ? `${product.spec_lead_time_days} يوم` : lang === 'zh' ? `${product.spec_lead_time_days} 天` : `${product.spec_lead_time_days} days`)
        : '—' },
    { label: isAr ? 'التخصيص'            : lang === 'zh' ? '定制能力' : 'Customization',
      value: product.spec_customization || (isAr ? 'غير موضح' : lang === 'zh' ? '未说明' : 'Not specified') },
    { label: isAr ? 'العينات'            : lang === 'zh' ? '样品'     : 'Samples',
      value: product.sample_available
        ? (isAr ? 'متاحة' : lang === 'zh' ? '可提供' : 'Available')
        : (isAr ? 'غير متاحة' : lang === 'zh' ? '暂无' : 'Not available') },
    { label: isAr ? 'التغليف'            : lang === 'zh' ? '包装'     : 'Packaging',
      value: product.spec_packaging_details || '—' },
  ];

  /* Trust card texts (mirrors web exactly) */
  const maabarReviewText = isVerified
    ? (isAr ? 'هذا المورد ظاهر للمشترين بعد مراجعة مَعبر.'
        : lang === 'zh' ? '该供应商已通过 Maabar 审核并向买家展示。'
        : 'This supplier is visible to buyers after Maabar review.')
    : (isAr ? 'ملف المورد غير معروض كمورد موثّق.'
        : lang === 'zh' ? '该供应商尚未以认证状态展示。'
        : 'This supplier is not currently shown as verified.');

  const trustSignalsText = isAr
    ? `${trustSignals.includes('trade_profile_available') ? 'رابط الشركة متوفر' : 'لا يوجد رابط شركة ظاهر'}${trustSignals.includes('wechat_available') ? ' · WeChat متاح' : ''}${trustSignals.includes('factory_media_available') ? ' · صور منشأة متاحة' : ''}`
    : lang === 'zh'
      ? `${trustSignals.includes('trade_profile_available') ? '已提供店铺/官网链接' : '暂无公开店铺链接'}${trustSignals.includes('wechat_available') ? ' · 支持 WeChat 沟通' : ''}${trustSignals.includes('factory_media_available') ? ' · 提供工厂图片' : ''}`
      : `${trustSignals.includes('trade_profile_available') ? 'trade profile available' : 'no public trade profile shown'}${trustSignals.includes('wechat_available') ? ' · WeChat available' : ''}${trustSignals.includes('factory_media_available') ? ' · factory photos available' : ''}`;

  const identityText = maabarId
    ? (isAr ? `معرّف المورد: ${maabarId}` : lang === 'zh' ? `供应商编号：${maabarId}` : `Supplier ID: ${maabarId}`)
    : (isAr ? 'معرّف المورد غير ظاهر بعد' : lang === 'zh' ? '暂无供应商编号' : 'Supplier ID not shown yet');
  const identityExtra = sup.years_experience
    ? (isAr ? ` · ${sup.years_experience} سنة خبرة` : lang === 'zh' ? ` · ${sup.years_experience} 年经验` : ` · ${sup.years_experience} yrs experience`)
    : '';

  /* ── Render ─────────────────────────────────────────────────── */
  return (
    <SafeAreaView style={s.safe}>

      {/* Top bar */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={[s.back, { fontFamily: isAr ? F.ar : F.en }]}>
            {isAr ? '← رجوع' : lang === 'zh' ? '← 返回' : '← Back'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* ── 1. Gallery ────────────────────────────────────── */}
        {selectedImage ? (
          <TouchableOpacity onPress={() => setPhotoViewer(selectedImage)} activeOpacity={0.95}>
            <Image source={{ uri: selectedImage }} style={s.mainImg} resizeMode="cover" />
          </TouchableOpacity>
        ) : (
          <View style={[s.mainImg, s.mainImgPlaceholder]} />
        )}

        {galleryImages.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.thumbBar}
          >
            {galleryImages.map((img, idx) => (
              <TouchableOpacity
                key={`${img}-${idx}`}
                style={[s.thumb, selectedImage === img && s.thumbActive]}
                onPress={() => setSelectedImage(img)}
                activeOpacity={0.8}
              >
                <Image source={{ uri: img }} style={s.thumbImg} resizeMode="cover" />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* ── 2. Name + verified badge ──────────────────────── */}
        <View style={s.section}>
          <Text style={[s.productName, { textAlign: isAr ? 'right' : 'left', fontFamily: isAr ? F.arBold : F.enBold }]}>
            {name}
          </Text>

          <View style={[s.badgeRow, { justifyContent: isAr ? 'flex-end' : 'flex-start' }]}>
            {isVerified && (
              <View style={s.badgeGreen}>
                <Text style={[s.badgeGreenText, { fontFamily: isAr ? F.ar : F.en }]}>
                  ✓ {isAr ? 'مورد موثّق' : lang === 'zh' ? '认证供应商' : 'Verified supplier'}
                </Text>
              </View>
            )}
            {product.sample_available && (
              <View style={s.badgeGreenDim}>
                <Text style={[s.badgeGreenDimText, { fontFamily: isAr ? F.ar : F.en }]}>
                  {isAr ? 'عينة متاحة' : lang === 'zh' ? '可提供样品' : 'Sample available'}
                </Text>
              </View>
            )}
          </View>

          {/* ── 3. Manufacturer / secondary name ── */}
          {!!secondaryName && secondaryName !== name && (
            <Text style={[s.secondaryName, { textAlign: isAr ? 'right' : 'left', fontFamily: isAr ? F.ar : F.en }]}>
              {isAr
                ? `اسم المصنع / الاسم البديل: ${secondaryName}`
                : lang === 'zh'
                  ? `英文 / 其他名称：${secondaryName}`
                  : `Factory / alternate name: ${secondaryName}`}
            </Text>
          )}
        </View>

        {/* ── 4. Price ──────────────────────────────────────── */}
        {priceDisplay && (
          <View style={s.priceSection}>
            <Text style={[s.price, { textAlign: isAr ? 'right' : 'left', fontFamily: F.enSemi }]}>
              {priceDisplay}
            </Text>
            {priceOriginalUSD && (
              <Text style={[s.priceOriginal, { textAlign: isAr ? 'right' : 'left', fontFamily: F.en }]}>
                {isAr ? `السعر الأصلي: ${priceOriginalUSD}` : lang === 'zh' ? `原始价格：${priceOriginalUSD}` : `Original: ${priceOriginalUSD}`}
              </Text>
            )}
          </View>
        )}

        {/* ── 5. MOQ + supplier name + city ─────────────────── */}
        <View style={[s.metaRow, { flexDirection: isAr ? 'row-reverse' : 'row' }]}>
          {product.moq != null && (
            <Text style={[s.metaChip, { fontFamily: isAr ? F.ar : F.en }]}>
              {isAr ? `الحد الأدنى: ${product.moq}` : lang === 'zh' ? `起订量: ${product.moq}` : `MOQ: ${product.moq}`}
            </Text>
          )}
          {sup.company_name && (
            <Text style={[s.metaChip, { fontFamily: isAr ? F.ar : F.en }]}>{sup.company_name}</Text>
          )}
          {(sup.city || sup.country) && (
            <Text style={[s.metaChip, { fontFamily: isAr ? F.ar : F.en }]}>
              {[sup.city, sup.country].filter(Boolean).join(', ')}
            </Text>
          )}
        </View>

        {/* ── 6. Description ────────────────────────────────── */}
        {!!desc && (
          <View style={s.section}>
            <Text style={[s.descText, { textAlign: isAr ? 'right' : 'left', fontFamily: isAr ? F.ar : F.en }]}>
              {desc}
            </Text>
          </View>
        )}

        {/* ── 7. Sourcing highlights grid ───────────────────── */}
        <View style={s.section}>
          <Text style={[s.sectionLabel, { textAlign: isAr ? 'right' : 'left', fontFamily: isAr ? F.ar : F.en }]}>
            {isAr ? 'ملخص التوريد' : lang === 'zh' ? '采购摘要' : 'Sourcing snapshot'}
          </Text>
          <View style={s.infoGrid}>
            {highlights.map(h => (
              <View key={h.label} style={s.infoCard}>
                <Text style={[s.infoLabel, { textAlign: isAr ? 'right' : 'left', fontFamily: isAr ? F.ar : F.en }]}>
                  {h.label}
                </Text>
                <Text style={[s.infoValue, { textAlign: isAr ? 'right' : 'left', fontFamily: isAr ? F.arSemi : F.enSemi }]}>
                  {h.value}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── 8. Specs grid ─────────────────────────────────── */}
        {specs.length > 0 && (
          <View style={s.section}>
            <Text style={[s.sectionLabel, { textAlign: isAr ? 'right' : 'left', fontFamily: isAr ? F.ar : F.en }]}>
              {isAr ? 'المواصفات' : lang === 'zh' ? '规格参数' : 'Specifications'}
            </Text>
            <View style={s.infoGrid}>
              {specs.map(sp => (
                <View key={sp.key} style={s.infoCard}>
                  <Text style={[s.infoLabel, { textAlign: isAr ? 'right' : 'left', fontFamily: isAr ? F.ar : F.en }]}>
                    {sp.label}
                  </Text>
                  <Text style={[s.infoValue, { textAlign: isAr ? 'right' : 'left', fontFamily: isAr ? F.arSemi : F.enSemi }]}>
                    {sp.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── 9-11. Trust cards (مراجعة معبر + دلائل الثقة + الهوية التجارية) ── */}
        {supplierId ? (
          <View style={s.section}>
            {/* مراجعة معبر */}
            <View style={s.trustCard}>
              <Text style={[s.trustCardLabel, { textAlign: isAr ? 'right' : 'left', fontFamily: isAr ? F.ar : F.en }]}>
                {isAr ? 'مراجعة مَعبر' : lang === 'zh' ? 'Maabar 审核' : 'Maabar review'}
              </Text>
              <Text style={[s.trustCardText, { textAlign: isAr ? 'right' : 'left', fontFamily: isAr ? F.ar : F.en }]}>
                {maabarReviewText}
              </Text>
            </View>

            {/* دلائل الثقة */}
            <View style={s.trustCard}>
              <Text style={[s.trustCardLabel, { textAlign: isAr ? 'right' : 'left', fontFamily: isAr ? F.ar : F.en }]}>
                {isAr ? 'دلائل الثقة' : lang === 'zh' ? '信任信号' : 'Trust signals'}
              </Text>
              <Text style={[s.trustCardText, { textAlign: isAr ? 'right' : 'left', fontFamily: isAr ? F.ar : F.en }]}>
                {trustSignalsText}
              </Text>
            </View>

            {/* الهوية التجارية */}
            <View style={[s.trustCard, { marginBottom: 16 }]}>
              <Text style={[s.trustCardLabel, { textAlign: isAr ? 'right' : 'left', fontFamily: isAr ? F.ar : F.en }]}>
                {isAr ? 'الهوية التجارية' : lang === 'zh' ? '商业身份' : 'Commercial identity'}
              </Text>
              <Text style={[s.trustCardText, { textAlign: isAr ? 'right' : 'left', fontFamily: isAr ? F.ar : F.en }]}>
                {identityText}{identityExtra}
              </Text>
            </View>

            {/* ── 12. Supplier card ────────────────────────── */}
            <TouchableOpacity
              style={s.supplierCard}
              onPress={() => navigation.navigate('SupplierProfile', { supplierId })}
              activeOpacity={0.8}
            >
              <View style={[s.supplierRow, { flexDirection: isAr ? 'row-reverse' : 'row' }]}>
                <View style={s.avatar}>
                  {sup.avatar_url ? (
                    <Image source={{ uri: sup.avatar_url }} style={s.avatarImg} resizeMode="cover" />
                  ) : (
                    <Text style={s.avatarLetter}>{(sup.company_name || '?')[0]}</Text>
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <View style={[s.supplierNameRow, { flexDirection: isAr ? 'row-reverse' : 'row' }]}>
                    <Text style={[s.supplierName, { textAlign: isAr ? 'right' : 'left', fontFamily: isAr ? F.arSemi : F.enSemi }]}>
                      {sup.company_name || '—'}
                    </Text>
                    {isVerified && (
                      <View style={s.badgeGreen}>
                        <Text style={[s.badgeGreenText, { fontFamily: isAr ? F.ar : F.en }]}>
                          ✓ {isAr ? 'موثّق' : lang === 'zh' ? '已认证' : 'Verified'}
                        </Text>
                      </View>
                    )}
                  </View>

                  {(sup.rating != null) && (
                    <Text style={s.stars}>{starsStr(sup.rating)}</Text>
                  )}

                  {(sup.city || sup.country) && (
                    <Text style={[s.supplierLocation, { textAlign: isAr ? 'right' : 'left', fontFamily: isAr ? F.ar : F.en }]}>
                      {[sup.city, sup.country].filter(Boolean).join(', ')}
                      {sup.reviews_count ? ` · ${sup.reviews_count} ${isAr ? 'تقييم' : lang === 'zh' ? '条评价' : 'reviews'}` : ''}
                    </Text>
                  )}
                </View>

                <Text style={s.supplierArrow}>{isAr ? '←' : '→'}</Text>
              </View>
            </TouchableOpacity>

            {/* ── 13. Contact badges ───────────────────────── */}
            {(maabarId || sup.trade_link || sup.wechat || sup.whatsapp) && (
              <View style={[s.contactBadges, { flexDirection: isAr ? 'row-reverse' : 'row' }]}>
                {maabarId && (
                  <View style={s.contactBadge}>
                    <Text style={[s.contactBadgeText, { fontFamily: F.en }]}>
                      {isAr ? `معرّف المورد: ${maabarId}` : lang === 'zh' ? `编号: ${maabarId}` : `ID: ${maabarId}`}
                    </Text>
                  </View>
                )}
                {sup.trade_link && (
                  <View style={[s.contactBadge, s.contactBadgeGreen]}>
                    <Text style={[s.contactBadgeGreenText, { fontFamily: isAr ? F.ar : F.en }]}>
                      {isAr ? 'رابط الشركة' : lang === 'zh' ? '官网/店铺' : 'Trade link'}
                    </Text>
                  </View>
                )}
                {sup.wechat && (
                  <View style={s.contactBadge}>
                    <Text style={[s.contactBadgeText, { fontFamily: F.en }]}>WeChat: {sup.wechat}</Text>
                  </View>
                )}
                {sup.whatsapp && (
                  <View style={s.contactBadge}>
                    <Text style={[s.contactBadgeText, { fontFamily: F.en }]}>WhatsApp: {sup.whatsapp}</Text>
                  </View>
                )}
              </View>
            )}

            {/* ── 14. Factory photos row ───────────────────── */}
            {factoryPhotos.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.factoryRow}
              >
                {factoryPhotos.map((img, idx) => (
                  <TouchableOpacity
                    key={`${img}-${idx}`}
                    onPress={() => setPhotoViewer(img)}
                    activeOpacity={0.85}
                  >
                    <Image source={{ uri: img }} style={s.factoryPhoto} resizeMode="cover" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        ) : null}

        {/* ── 15. Action buttons ───────────────────────────── */}
        <View style={s.actionsSection}>
          {/* اشتر الآن */}
          <TouchableOpacity style={s.btnPrimary} onPress={handleBuyNow} activeOpacity={0.85}>
            <Text style={[s.btnPrimaryText, { fontFamily: isAr ? F.arBold : F.enBold }]}>
              {isAr ? 'اشترِ الآن' : lang === 'zh' ? '立即下单' : 'Buy Now'}
            </Text>
          </TouchableOpacity>

          {/* طلب عينة — only when sample_available */}
          {product.sample_available && (
            <TouchableOpacity style={s.btnSecondary} onPress={handleRequestSample} activeOpacity={0.8}>
              <Text style={[s.btnSecondaryText, { fontFamily: isAr ? F.arSemi : F.enSemi }]}>
                {isAr ? 'طلب عينة' : lang === 'zh' ? '申请样品' : 'Request Sample'}
              </Text>
            </TouchableOpacity>
          )}

          {/* استفسار — opens inline text modal */}
          <TouchableOpacity style={s.btnSecondary} onPress={handleOpenInquiry} activeOpacity={0.8}>
            <Text style={[s.btnSecondaryText, { fontFamily: isAr ? F.arSemi : F.enSemi }]}>
              {isAr ? 'استفسار' : lang === 'zh' ? '咨询' : 'Inquiry'}
            </Text>
          </TouchableOpacity>

          {/* تواصل مع المورد — navigate to ChatScreen */}
          <TouchableOpacity style={s.btnSecondary} onPress={handleContactSupplier} activeOpacity={0.8}>
            <Text style={[s.btnSecondaryText, { fontFamily: isAr ? F.arSemi : F.enSemi }]}>
              {isAr ? 'تواصل مع المورد' : lang === 'zh' ? '联系供应商' : 'Contact Supplier'}
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* ── Fullscreen photo viewer modal ─────────────────────── */}
      <Modal
        visible={photoViewer !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setPhotoViewer(null)}
      >
        <TouchableWithoutFeedback onPress={() => setPhotoViewer(null)}>
          <View style={s.modalBg}>
            {photoViewer && (
              <Image
                source={{ uri: photoViewer }}
                style={s.modalImg}
                resizeMode="contain"
              />
            )}
            <TouchableOpacity style={s.modalClose} onPress={() => setPhotoViewer(null)} activeOpacity={0.8}>
              <Text style={s.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ── Inquiry modal ─────────────────────────────────────── */}
      <Modal
        visible={inquiryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setInquiryModal(false)}
      >
        <KeyboardAvoidingView
          style={s.inquiryOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableWithoutFeedback onPress={() => setInquiryModal(false)}>
            <View style={{ flex: 1 }} />
          </TouchableWithoutFeedback>

          <View style={s.inquirySheet}>
            <View style={s.inquiryHandle} />

            <Text style={[s.inquiryTitle, { textAlign: isAr ? 'right' : 'left' }]}>
              {isAr ? 'استفسار عن المنتج' : 'Product Inquiry'}
            </Text>

            <TextInput
              style={[s.inquiryInput, { textAlign: isAr ? 'right' : 'left' }]}
              value={inquiryText}
              onChangeText={setInquiryText}
              placeholder={isAr ? 'اكتب سؤالك هنا...' : 'Type your question here...'}
              placeholderTextColor={C.textDisabled}
              multiline
              maxLength={500}
              autoFocus
            />

            <View style={s.inquiryActions}>
              <TouchableOpacity
                style={s.inquiryCancelBtn}
                onPress={() => setInquiryModal(false)}
                activeOpacity={0.7}
              >
                <Text style={[s.inquiryCancelText, { fontFamily: isAr ? F.ar : F.en }]}>
                  {isAr ? 'إلغاء' : 'Cancel'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.inquirySendBtn, (!inquiryText.trim() || inquirySending) && s.inquirySendBtnDisabled]}
                onPress={handleSendInquiry}
                disabled={!inquiryText.trim() || inquirySending}
                activeOpacity={0.85}
              >
                <Text style={[s.inquirySendText, { fontFamily: isAr ? F.arBold : F.enBold }]}>
                  {inquirySending
                    ? (isAr ? 'جاري الإرسال...' : 'Sending...')
                    : (isAr ? 'إرسال' : 'Send')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Sample request modal ──────────────────────────────── */}
      <Modal
        visible={sampleModal}
        transparent
        animationType="slide"
        onRequestClose={() => setSampleModal(false)}
      >
        <KeyboardAvoidingView
          style={s.inquiryOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableWithoutFeedback onPress={() => setSampleModal(false)}>
            <View style={{ flex: 1 }} />
          </TouchableWithoutFeedback>

          <View style={s.inquirySheet}>
            <View style={s.inquiryHandle} />

            <Text style={[s.inquiryTitle, { textAlign: isAr ? 'right' : 'left' }]}>
              {isAr ? 'طلب عينة' : 'Request Sample'}
            </Text>

            <Text style={[{ color: C.textTertiary, fontFamily: isAr ? F.ar : F.en, fontSize: 12, textAlign: isAr ? 'right' : 'left', marginBottom: 6 }]}>
              {isAr ? 'الكمية' : 'Quantity'}
            </Text>
            <TextInput
              style={[s.inquiryInput, { textAlign: isAr ? 'right' : 'left', minHeight: 44 }]}
              value={sampleQty}
              onChangeText={setSampleQty}
              keyboardType="numeric"
              placeholder="1"
              placeholderTextColor={C.textDisabled}
            />

            <Text style={[{ color: C.textTertiary, fontFamily: isAr ? F.ar : F.en, fontSize: 12, textAlign: isAr ? 'right' : 'left', marginBottom: 6, marginTop: 10 }]}>
              {isAr ? 'ملاحظات (اختياري)' : 'Notes (optional)'}
            </Text>
            <TextInput
              style={[s.inquiryInput, { textAlign: isAr ? 'right' : 'left' }]}
              value={sampleNotes}
              onChangeText={setSampleNotes}
              placeholder={isAr ? 'أي متطلبات خاصة...' : 'Any special requirements...'}
              placeholderTextColor={C.textDisabled}
              multiline
              maxLength={300}
            />

            <View style={s.inquiryActions}>
              <TouchableOpacity
                style={s.inquiryCancelBtn}
                onPress={() => setSampleModal(false)}
                activeOpacity={0.7}
              >
                <Text style={[s.inquiryCancelText, { fontFamily: isAr ? F.ar : F.en }]}>
                  {isAr ? 'إلغاء' : 'Cancel'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.inquirySendBtn, sampleSending && s.inquirySendBtnDisabled]}
                onPress={handleSendSampleRequest}
                disabled={sampleSending}
                activeOpacity={0.85}
              >
                <Text style={[s.inquirySendText, { fontFamily: isAr ? F.arBold : F.enBold }]}>
                  {sampleSending
                    ? (isAr ? 'جاري الإرسال...' : 'Sending...')
                    : (isAr ? 'إرسال الطلب' : 'Submit')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

/* ── Styles ────────────────────────────────────────────────────── */
const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: C.bgBase },
  center:   { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notFound: { color: C.textSecondary, fontSize: 16 },

  topBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
  },
  back: { color: C.textSecondary, fontSize: 14 },

  content: { paddingBottom: 60 },

  /* ── Gallery ── */
  mainImg:            { width: '100%', height: 280, backgroundColor: 'rgba(0,0,0,0.04)' },
  mainImgPlaceholder: {},
  thumbBar: { paddingHorizontal: 16, paddingVertical: 12, gap: 8, alignItems: 'center' },
  thumb: {
    width: 72, height: 56, borderRadius: 8, overflow: 'hidden',
    borderWidth: 1, borderColor: C.borderSubtle,
  },
  thumbActive: { borderColor: 'rgba(0,0,0,0.50)' },
  thumbImg:    { width: '100%', height: '100%' },

  /* ── Name section ── */
  section: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
  },
  productName:   { color: C.textPrimary, fontSize: 22, lineHeight: 32, marginBottom: 10 },
  secondaryName: { color: C.textDisabled, fontSize: 12, marginTop: 6, lineHeight: 18 },

  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },

  /* Green badge (verified, sample) */
  badgeGreen: {
    backgroundColor: 'rgba(45,122,79,0.10)',
    borderWidth: 1, borderColor: 'rgba(45,122,79,0.22)',
    borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4,
  },
  badgeGreenText: { color: '#2D6A4F', fontSize: 11 },

  /* Dimmer green (sample available) */
  badgeGreenDim: {
    backgroundColor: 'rgba(58,122,82,0.08)',
    borderWidth: 1, borderColor: 'rgba(0,100,0,0.12)',
    borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4,
  },
  badgeGreenDimText: { color: '#2D6A4F', fontSize: 11 },

  /* ── Price ── */
  priceSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
  },
  price:         { color: C.textPrimary, fontSize: 30, letterSpacing: -0.5 },
  priceOriginal: { color: C.textDisabled, fontSize: 13, marginTop: 4 },

  /* ── MOQ / meta row ── */
  metaRow: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexWrap: 'wrap',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
  },
  metaChip: {
    color: C.textSecondary,
    fontSize: 13,
    backgroundColor: C.bgRaised,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },

  /* ── Description ── */
  sectionLabel: { color: C.textTertiary, fontSize: 10, letterSpacing: 1.4, marginBottom: 12 },
  descText:     { color: C.textSecondary, fontSize: 14, lineHeight: 22 },

  /* ── Info grid (highlights + specs) ── */
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  infoCard: {
    width: '47%',
    backgroundColor: C.bgOverlay,
    borderRadius: 12, borderWidth: 1, borderColor: C.borderSubtle,
    padding: 12,
  },
  infoLabel: { color: C.textTertiary, fontSize: 10, letterSpacing: 1.2, marginBottom: 6 },
  infoValue: { color: C.textPrimary, fontSize: 13, lineHeight: 18 },

  /* ── Trust cards ── */
  trustCard: {
    backgroundColor: C.bgSubtle,
    borderRadius: 12, borderWidth: 1, borderColor: C.borderSubtle,
    padding: 14, marginBottom: 8,
  },
  trustCardLabel: { color: C.textDisabled, fontSize: 10, letterSpacing: 1.4, marginBottom: 6 },
  trustCardText:  { color: C.textPrimary, fontSize: 13, lineHeight: 20 },

  /* ── Supplier card ── */
  supplierCard: {
    backgroundColor: C.bgOverlay,
    borderRadius: 14, borderWidth: 1, borderColor: C.borderSubtle,
    padding: 14, marginBottom: 12,
  },
  supplierRow:     { gap: 12, alignItems: 'flex-start' },
  supplierNameRow: { gap: 6, alignItems: 'center', marginBottom: 3, flexWrap: 'wrap' },
  supplierName:    { color: C.textPrimary, fontSize: 15 },
  stars:           { color: C.orange, fontSize: 14, marginBottom: 3, fontFamily: F.en },
  supplierLocation: { color: C.textSecondary, fontSize: 12, lineHeight: 17 },
  supplierArrow:   { color: C.textDisabled, fontSize: 16, alignSelf: 'center' },
  avatar: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: C.bgRaised, borderWidth: 1, borderColor: C.borderDefault,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  avatarImg:    { width: '100%', height: '100%', borderRadius: 10 },
  avatarLetter: { color: C.textSecondary, fontFamily: F.enSemi, fontSize: 18 },

  /* ── Contact badges ── */
  contactBadges: { flexWrap: 'wrap', gap: 7, marginBottom: 14 },
  contactBadge: {
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.07)',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  contactBadgeText: { color: 'rgba(0,0,0,0.45)', fontSize: 11 },
  contactBadgeGreen: {
    backgroundColor: '#F0F7F0',
    borderColor: 'rgba(0,100,0,0.12)',
  },
  contactBadgeGreenText: { color: '#2D6A4F', fontSize: 11 },

  /* ── Factory photos ── */
  factoryRow: { gap: 8, paddingVertical: 4 },
  factoryPhoto: {
    width: 120, height: 82, borderRadius: 10,
    borderWidth: 1, borderColor: C.borderSubtle,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },

  /* ── Action buttons ── */
  actionsSection: { padding: 20, gap: 10 },
  btnPrimary: {
    backgroundColor: C.btnPrimary,
    borderRadius: 14, paddingVertical: 15, alignItems: 'center',
  },
  btnPrimaryText: { color: C.btnPrimaryText, fontSize: 16 },
  btnSecondary: {
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.18)',
    borderRadius: 14, paddingVertical: 14, alignItems: 'center',
    backgroundColor: 'transparent',
  },
  btnSecondaryText: { color: C.textPrimary, fontSize: 14 },

  /* ── Photo viewer modal ── */
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalImg: {
    width: SW,
    height: SW,
  },
  modalClose: {
    position: 'absolute',
    top: 52,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: { color: '#fff', fontSize: 16, fontFamily: F.en },

  /* ── Inquiry modal ── */
  inquiryOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  inquirySheet: {
    backgroundColor: C.bgBase,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  inquiryHandle: {
    width: 40, height: 4,
    backgroundColor: C.borderDefault,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 18,
  },
  inquiryTitle: {
    fontFamily: F.arBold,
    fontSize: 16,
    color: C.textPrimary,
    marginBottom: 14,
  },
  inquiryInput: {
    backgroundColor: C.bgRaised,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.borderMuted,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: C.textPrimary,
    fontFamily: F.ar,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  inquiryActions: { flexDirection: 'row', gap: 10 },
  inquiryCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.borderDefault,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: C.bgOverlay,
  },
  inquiryCancelText: { color: C.textSecondary, fontSize: 14 },
  inquirySendBtn: {
    flex: 2,
    backgroundColor: C.btnPrimary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  inquirySendBtnDisabled: { opacity: 0.35 },
  inquirySendText: { color: C.btnPrimaryText, fontSize: 14 },
});
