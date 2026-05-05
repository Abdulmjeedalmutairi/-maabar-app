import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Image, Linking,
} from 'react-native';
import { Video } from 'expo-av';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';
import { getLang } from '../../lib/lang';
import { getPrimaryProductImage, buildProductSpecs } from '../../lib/productMedia';
import {
  formatPriceWithConversion,
  useDisplayCurrency,
} from '../../lib/displayCurrency';
import { getSpecialtyLabel } from '../../lib/specialtyLabel';
import TranslatedText from '../../components/TranslatedText';

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
// trust-signal helper removed — section dropped from the profile UI.
// ─────────────────────────────────────────────────────────────────────────────

const T = {
  back:           { ar: '← رجوع',                                   en: '← Back',                                              zh: '← 返回'                      },
  notFound:       { ar: 'المورد غير موجود',                         en: 'Supplier not found',                                  zh: '未找到供应商'                   },
  verified:       { ar: 'مورد موثّق',                               en: 'Verified Supplier',                                   zh: '认证供应商'                     },
  products:       { ar: 'منتج',                                      en: 'products',                                            zh: '产品'                          },
  samplesAvail:   { ar: 'عينات متاحة',                              en: 'Samples Available',                                   zh: '可提供样品'                     },
  minOrder:       { ar: 'الحد الأدنى',                              en: 'Min order',                                           zh: '最低订单'                       },
  sar:            { ar: 'ريال',                                      en: 'SAR',                                                 zh: 'SAR'                          },
  factoryImages:  { ar: 'صور المصنع',                               en: 'Factory Images',                                      zh: '工厂图片'                       },
  companyVideo:   { ar: 'فيديو الشركة',                              en: 'Company Video',                                       zh: '公司视频'                       },
  playVideo:      { ar: '▶ تشغيل الفيديو',                           en: '▶ Play Video',                                        zh: '▶ 播放视频'                     },
  protection:     { ar: 'للحماية الكاملة — أتمّ صفقتك عبر معبر',  en: 'For full protection — complete your deal on Maabar',  zh: '获得完整保障 — 通过Maabar完成交易' },
  maabarReview:   { ar: 'مراجعة مَعبر',                            en: 'Maabar Review',                                       zh: 'Maabar 审核'                   },
  reviewedText:   { ar: 'تمت مراجعة هذا المورد وإتاحته للمشترين على المنصة.', en: 'This supplier has been reviewed by Maabar and is visible to buyers.', zh: '该供应商已通过 Maabar 审核并对买家开放。' },
  pendingText:    { ar: 'الملف ما زال قيد المراجعة.',              en: 'This supplier profile is still under review.',        zh: '该供应商资料仍在审核中。'           },
  workingModel:   { ar: 'طريقة العمل',                              en: 'Working Model',                                       zh: '合作方式'                       },
  workingText:    { ar: 'التفاوض والاتفاق يتمان عبر معبر، مع حماية أوضح للدفعات والتوثيق.', en: 'Use Maabar for communication, quoting, and transaction flow to keep payment and records protected.', zh: '建议通过 Maabar 完成沟通、报价与交易，以获得更清晰的付款与记录保障。' },
  visitWebsite:   { ar: 'زيارة موقع الشركة',                       en: 'Visit company website',                               zh: '访问公司官网'                    },
  viewTrade:      { ar: 'عرض صفحة المتجر',                         en: 'View trade profile',                                  zh: '查看贸易主页'                    },
  wechatLabel:    { ar: 'ويتشات',                                    en: 'WeChat',                                              zh: 'WeChat'                       },
  whatsappLabel:  { ar: 'واتساب',                                    en: 'WhatsApp',                                            zh: 'WhatsApp'                     },
  businessType:   { ar: 'نوع النشاط التجاري',                      en: 'Business Type',                                       zh: '企业类型'                       },
  yearEst:        { ar: 'سنة التأسيس',                              en: 'Year Established',                                    zh: '成立年份'                       },
  customization:  { ar: 'دعم التخصيص',                              en: 'Customization Support',                               zh: '定制支持'                       },
  address:        { ar: 'عنوان الشركة',                             en: 'Company Address',                                     zh: '公司地址'                       },
  languages:      { ar: 'اللغات',                                    en: 'Languages',                                           zh: '支持语言'                       },
  exportMarkets:  { ar: 'الأسواق التصديرية',                        en: 'Export Markets',                                      zh: '出口市场'                       },
  exportYears:    { ar: 'سنوات التصدير',                            en: 'Export Years',                                        zh: '出口年限'                       },
  city:           { ar: 'المدينة',                                   en: 'City',                                                zh: '城市'                          },
  country:        { ar: 'الدولة',                                    en: 'Country',                                             zh: '国家'                          },
  specialty:      { ar: 'التخصص',                                    en: 'Specialty',                                           zh: '行业'                          },
  deals:          { ar: 'صفقات مكتملة',                             en: 'Deals Completed',                                     zh: '成交数'                         },
  completion:     { ar: 'نسبة الإتمام',                             en: 'Completion Rate',                                     zh: '完成率'                         },
  memberSince:    { ar: 'عضو منذ',                                   en: 'Member Since',                                        zh: '注册年份'                       },
  directContact:  { ar: 'تواصل مباشر',                              en: 'Direct Contact',                                      zh: '直接联系'                       },
  requestSample:  { ar: 'طلب عينة',                                 en: 'Request Sample',                                      zh: '请求样品'                       },
  postRequest:    { ar: 'ارفع طلب',                                  en: 'Post Request',                                        zh: '发布需求'                       },
  productsLabel:  { ar: 'منتجاته',                                   en: 'Products',                                            zh: '产品列表'                       },
  noProducts:     { ar: 'لا توجد منتجات بعد',                       en: 'No products yet',                                     zh: '暂无产品'                       },
  sample:         { ar: 'عينة',                                      en: 'SAMPLE',                                              zh: '样品'                          },
  details:        { ar: 'التفاصيل',                                  en: 'Details',                                             zh: '详情'                          },
  moqLabel:       { ar: 'الحد الأدنى للطلب',                        en: 'MOQ',                                                 zh: '最低起订量'                     },
  calcTitle:      { ar: 'احسب سعرك',                                en: 'Calculate Your Price',                                zh: '计算价格'                       },
  selectProduct:  { ar: 'اختر منتج',                                en: 'Select product',                                      zh: '选择产品'                       },
  qty:            { ar: 'الكمية',                                    en: 'Quantity',                                            zh: '数量'                          },
  calculate:      { ar: 'احسب',                                      en: 'Calculate',                                           zh: '计算'                          },
  unitPrice:      { ar: 'سعر الوحدة',                               en: 'Unit Price',                                          zh: '单价'                          },
  total:          { ar: 'الإجمالي',                                  en: 'Total',                                               zh: '总计'                          },
  minOrderUnits:  { ar: 'الحد الأدنى للطلب',                        en: 'Min order',                                           zh: '最低起订量'                     },
  units:          { ar: 'قطعة',                                      en: 'units',                                               zh: '件'                            },
  reviewsLabel:   { ar: 'التقييمات',                                en: 'Reviews',                                             zh: '评价'                          },
  maabarBuyer:    { ar: 'مشتري موثّق عبر مَعبر',                   en: 'Maabar buyer',                                        zh: '通过 Maabar 成交的买家'           },
  quality:        { ar: 'الجودة',                                    en: 'Quality',                                             zh: '质量'                          },
  shipping:       { ar: 'الشحن',                                     en: 'Shipping',                                            zh: '物流'                          },
  comm:           { ar: 'التواصل',                                   en: 'Comm',                                                zh: '沟通'                          },
  similarLabel:   { ar: 'موردون مشابهون',                           en: 'Similar Suppliers',                                   zh: '类似供应商'                     },
  qualityCerts:   { ar: 'شهادات الجودة',                            en: 'Quality Certifications',                              zh: '质量认证'                       },
  viewCert:       { ar: 'عرض الشهادة ←',                           en: 'View Certificate →',                                  zh: '查看证书 →'                     },
};

function t(key, lang) {
  return T[key]?.[lang] ?? T[key]?.en ?? key;
}

// Static enum-label tables for the two profile fields whose DB values are
// machine codes ('manufacturer', 'oem', …) rather than free text. The
// businessCards renderer below maps via these so buyers see localized
// labels instead of raw enum keys. Falls back to the raw value when an
// unknown key sneaks in (e.g. legacy rows after a vocabulary change).
const BIZ_TYPE_LABELS = {
  manufacturer:    { ar: 'مصنّع',         en: 'Manufacturer',     zh: '制造商' },
  trading_company: { ar: 'شركة تجارية',  en: 'Trading Company',  zh: '贸易公司' },
  agent:           { ar: 'وكيل',          en: 'Agent',            zh: '代理商' },
  distributor:     { ar: 'موزع',          en: 'Distributor',      zh: '经销商' },
};

const CUSTOM_LABELS = {
  yes: { ar: 'نعم',       en: 'Yes',             zh: '是'         },
  oem: { ar: 'OEM متاح',  en: 'OEM Available',   zh: 'OEM可提供'  },
  odm: { ar: 'ODM متاح',  en: 'ODM Available',   zh: 'ODM可提供'  },
  no:  { ar: 'لا',        en: 'No',              zh: '否'         },
};

function renderStars(rating) {
  let out = '';
  for (let i = 1; i <= 5; i++) out += i <= Math.round(rating || 0) ? '★' : '☆';
  return out;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ text, isAr }) {
  return (
    <Text style={[s.sectionLabel, { textAlign: isAr ? 'right' : 'left' }]}>{text}</Text>
  );
}

function InfoCard({ label, value, isAr, lang, translatable }) {
  const valueStyle = [
    s.infoCardValue,
    { textAlign: isAr ? 'right' : 'left', writingDirection: isAr ? 'rtl' : 'ltr' },
  ];
  return (
    <View style={s.infoCard}>
      <Text style={[s.infoCardLabel, { textAlign: isAr ? 'right' : 'left' }]}>{label}</Text>
      {translatable ? (
        <TranslatedText text={String(value || '')} lang={lang} textStyle={valueStyle} />
      ) : (
        <Text style={valueStyle}>{value}</Text>
      )}
    </View>
  );
}

function ProductRow({ product, lang, navigation, supplierId, onChat }) {
  const isAr = lang === 'ar';
  const rowDir = isAr ? 'row-reverse' : 'row';
  const img  = getPrimaryProductImage(product);
  const { displayCurrency: viewerCurrency, rates: exchangeRates } = useDisplayCurrency();
  const name = isAr
    ? (product.name_ar || product.name_en)
    : lang === 'zh'
      ? (product.name_zh || product.name_en)
      : (product.name_en || product.name_ar);
  const specs = buildProductSpecs(product, lang).slice(0, 2);

  return (
    <TouchableOpacity
      style={[s.productRow, { flexDirection: rowDir }]}
      activeOpacity={0.78}
      onPress={() => navigation.navigate('ProductDetail', { productId: product.id })}
    >
      {/* Thumbnail */}
      <View style={s.productThumb}>
        {img
          ? <Image source={{ uri: img }} style={s.productThumbImg} resizeMode="cover" />
          : <Text style={s.productThumbIcon}>📦</Text>
        }
      </View>

      {/* Details */}
      <View style={[s.productDetails, { alignItems: isAr ? 'flex-end' : 'flex-start' }]}>
        <View style={{ flexDirection: rowDir, flexWrap: 'wrap', gap: 6, marginBottom: 4, alignItems: 'center' }}>
          <Text style={s.productName} numberOfLines={2}>{name}</Text>
          {product.sample_available && (
            <View style={s.sampleBadge}>
              <Text style={s.sampleBadgeText}>{t('sample', lang)}</Text>
            </View>
          )}
        </View>
        {product.price_from > 0 && (
          <Text style={s.productPrice}>
            {formatPriceWithConversion({
              amount: Number(product.price_from),
              sourceCurrency: product.currency || 'USD',
              displayCurrency: viewerCurrency,
              rates: exchangeRates,
              lang,
              options: { minimumFractionDigits: Number(product.price_from) % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 },
            })}
          </Text>
        )}
        {!!product.moq && (
          <Text style={s.productMeta}>{t('moqLabel', lang)}: {product.moq}</Text>
        )}
        {specs.length > 0 && (
          <Text style={[s.productMeta, { textAlign: isAr ? 'right' : 'left' }]} numberOfLines={1}>
            {specs.map(sp => `${sp.label}: ${sp.value}`).join(' · ')}
          </Text>
        )}
      </View>

      {/* Action buttons */}
      <View style={{ gap: 6 }}>
        <TouchableOpacity
          style={s.detailsBtn}
          onPress={() => navigation.navigate('ProductDetail', { productId: product.id })}
        >
          <Text style={[s.detailsBtnText, { fontFamily: isAr ? F.ar : F.en }]}>{t('details', lang)}</Text>
        </TouchableOpacity>
        {product.sample_available && (
          <TouchableOpacity style={s.detailsBtn} onPress={onChat}>
            <Text style={[s.detailsBtnText, { fontFamily: isAr ? F.ar : F.en }]}>{t('sample', lang)}</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

function ReviewCard({ review, lang }) {
  const isAr = lang === 'ar';
  const rowDir = isAr ? 'row-reverse' : 'row';
  return (
    <View style={s.reviewCard}>
      <View style={{ flexDirection: rowDir, justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={[s.reviewBuyer, { fontFamily: isAr ? F.arSemi : F.enSemi }]}>{t('maabarBuyer', lang)}</Text>
        <Text style={s.reviewStars}>{renderStars(review.rating)}</Text>
      </View>
      {!!review.comment && (
        <Text style={[s.reviewComment, { textAlign: isAr ? 'right' : 'left', writingDirection: isAr ? 'rtl' : 'ltr', fontFamily: isAr ? F.ar : F.en }]}>
          {review.comment}
        </Text>
      )}
      {(review.quality_rating || review.shipping_rating || review.communication_rating) && (
        <View style={{ flexDirection: rowDir, gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
          {!!review.quality_rating       && <Text style={s.reviewSub}>{t('quality', lang)}: {review.quality_rating}/5</Text>}
          {!!review.shipping_rating      && <Text style={s.reviewSub}>{t('shipping', lang)}: {review.shipping_rating}/5</Text>}
          {!!review.communication_rating && <Text style={s.reviewSub}>{t('comm', lang)}: {review.communication_rating}/5</Text>}
        </View>
      )}
    </View>
  );
}

function SimilarCard({ supplier: sim, lang, navigation }) {
  const isAr = lang === 'ar';
  const isVerified = isSupplierPubliclyVisible(sim.status);
  return (
    <TouchableOpacity
      style={s.similarCard}
      activeOpacity={0.78}
      onPress={() => navigation.push('SupplierProfile', { supplierId: sim.id })}
    >
      <View style={s.similarAvatar}>
        {sim.avatar_url
          ? <Image source={{ uri: sim.avatar_url }} style={{ width: '100%', height: '100%' }} />
          : <Text style={s.similarAvatarInitial}>{(sim.company_name || '?')[0].toUpperCase()}</Text>
        }
      </View>
      <Text style={[s.similarName, { textAlign: isAr ? 'right' : 'left', fontFamily: isAr ? F.arSemi : F.enSemi }]} numberOfLines={2}>
        {sim.company_name}
      </Text>
      <Text style={s.similarStars}>{renderStars(sim.rating)}</Text>
      {!!sim.city && (
        <Text style={[s.similarCity, { textAlign: isAr ? 'right' : 'left' }]}>{sim.city}</Text>
      )}
      {isVerified && (
        <View style={s.verifiedBadge}>
          <Text style={s.verifiedText}>✓ {t('verified', lang)}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function SupplierProfileScreen({ route, navigation }) {
  const { supplierId } = route.params || {};
  const lang  = getLang();
  const isAr  = lang === 'ar';
  const rowDir    = isAr ? 'row-reverse' : 'row';
  const textAlign = isAr ? 'right' : 'left';

  const [supplier,         setSupplier]         = useState(null);
  const [products,         setProducts]         = useState([]);
  const [reviews,          setReviews]          = useState([]);
  const [similarSuppliers, setSimilarSuppliers] = useState([]);
  const [loading,          setLoading]          = useState(true);

  // Price calculator
  const [calcProductId, setCalcProductId] = useState(null);
  const [calcQty,       setCalcQty]       = useState('');
  const [calcResult,    setCalcResult]    = useState(null);

  useEffect(() => {
    if (!supplierId) return;
    let cancelled = false;

    async function load() {
      // 1 — Supplier (same view as Suppliers list screen).
      // The view does NOT expose company_video_url (added to profiles
      // after the view was created — see migration
      // 202604011430_profile_visibility_partition.sql). Fetch the field
      // directly from profiles in parallel; the verified-supplier branch
      // of the SELECT RLS policy added in 20260501000001 permits this for
      // any authenticated user. Errors are swallowed so a missing column
      // (no migration yet) doesn't break profile loading.
      const [supRes, vidRes] = await Promise.all([
        supabase
          .from('supplier_public_profiles')
          .select('*')
          .eq('id', supplierId)
          .single(),
        supabase
          .from('profiles')
          .select('company_video_url')
          .eq('id', supplierId)
          .maybeSingle(),
      ]);
      const sup    = supRes.data;
      const supErr = supRes.error;
      console.log('[SupplierProfile] supplier_public_profiles →', sup?.company_name ?? null, '| error:', supErr?.message ?? null);
      if (sup && vidRes && !vidRes.error && vidRes.data) {
        sup.company_video_url = vidRes.data.company_video_url || null;
      } else if (vidRes?.error) {
        console.log('[SupplierProfile] company_video_url fetch error (non-fatal):', vidRes.error.message);
      }

      if (!sup || cancelled) {
        if (!cancelled) { setLoading(false); }
        return;
      }

      // 2 — Products + Reviews in parallel (exact web query)
      const [{ data: prods, error: prodsErr }, { data: revs, error: revsErr }] = await Promise.all([
        supabase.from('products').select('*').eq('supplier_id', supplierId).eq('is_active', true),
        supabase.from('reviews').select('*').eq('supplier_id', supplierId).order('created_at', { ascending: false }),
      ]);
      console.log('[SupplierProfile] products →', prods?.length ?? 0, '| error:', prodsErr?.message ?? null);
      console.log('[SupplierProfile] reviews  →', revs?.length  ?? 0, '| error:', revsErr?.message  ?? null);

      // 3 — Similar suppliers (exact web query — same columns, same filters)
      let simData = [];
      if (sup.speciality) {
        const { data: sim, error: simErr } = await supabase
          .from('supplier_public_profiles')
          .select('id,company_name,rating,reviews_count,city,country,avatar_url,status,trade_link,wechat,whatsapp,factory_images,years_experience,maabar_supplier_id,speciality,product_count')
          .eq('speciality', sup.speciality)
          .neq('id', supplierId)
          .limit(3);
        console.log('[SupplierProfile] similar →', sim?.length ?? 0, '| error:', simErr?.message ?? null);
        simData = sim || [];
      }

      if (!cancelled) {
        setSupplier(sup);
        setProducts(prods || []);
        setReviews(revs || []);
        setSimilarSuppliers(simData);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [supplierId]);

  function calcPrice() {
    const product = products.find(p => p.id === calcProductId);
    if (!product || !calcQty) return;
    const qty = parseFloat(calcQty);
    setCalcResult({
      unitPrice:  product.price_from,
      total:      qty * product.price_from,
      currency:   product.currency || 'USD',
      meetsmoq:   qty >= parseFloat(product.moq || 1),
      moq:        product.moq,
    });
  }

  // Auth-gated chat opener. Guests are bounced to Login (the only route
  // shared between AuthStack and the buyer tree); authenticated buyers
  // hit the canonical nested-navigator path. No getParent() — React
  // Navigation v6 bubbles the unresolved 'Inbox' name to the parent
  // Tab.Navigator on its own.
  async function openChat() {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      navigation.navigate('Inbox', { screen: 'Chat', params: { partnerId: supplierId } });
    } else {
      navigation.navigate('Login');
    }
  }

  // ── Loading ──
  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={[s.back, { fontFamily: isAr ? F.ar : F.en }]}>{t('back', lang)}</Text>
          </TouchableOpacity>
        </View>
        <View style={s.center}><ActivityIndicator color={C.textSecondary} size="large" /></View>
      </SafeAreaView>
    );
  }

  // ── Not found ──
  if (!supplier) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={[s.back, { fontFamily: isAr ? F.ar : F.en }]}>{t('back', lang)}</Text>
          </TouchableOpacity>
        </View>
        <View style={s.center}>
          <Text style={[s.notFound, { fontFamily: isAr ? F.ar : F.en }]}>{t('notFound', lang)}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Derived values ──
  const isVerified    = isSupplierPubliclyVisible(supplier.status);
  const maabarId      = getSupplierMaabarId(supplier);
  const samplesCount  = products.filter(p => p.sample_available).length;

  const bio = supplier.company_description
    || (isAr
      ? supplier.bio_ar || supplier.bio_en
      : lang === 'zh'
        ? supplier.bio_zh || supplier.bio_en
        : supplier.bio_en || supplier.bio_ar)
    || '';

  const supplierLanguages = Array.isArray(supplier.languages)      ? supplier.languages      : [];
  const exportMarkets     = Array.isArray(supplier.export_markets) ? supplier.export_markets : [];

  const businessCards = [
    supplier.business_type          && { label: t('businessType',  lang), value: BIZ_TYPE_LABELS[supplier.business_type]?.[lang] || supplier.business_type },
    supplier.year_established       && { label: t('yearEst',       lang), value: supplier.year_established },
    supplier.customization_support  && { label: t('customization', lang), value: CUSTOM_LABELS[supplier.customization_support]?.[lang] || supplier.customization_support },
    supplier.company_address        && { label: t('address',       lang), value: supplier.company_address, translatable: true },
    supplierLanguages.length > 0    && { label: t('languages',     lang), value: supplierLanguages.join(' · ') },
    exportMarkets.length > 0        && { label: t('exportMarkets', lang), value: exportMarkets.join(' · ') },
  ].filter(Boolean);

  // Phase port — specialty moved to hero (under company name); remove from stats grid.
  const stats = [
    supplier.export_years     && { label: t('exportYears', lang), val: supplier.export_years },
    supplier.city             && { label: t('city',        lang), val: supplier.city },
    supplier.country          && { label: t('country',     lang), val: supplier.country },
    supplier.deals_completed  && { label: t('deals',       lang), val: supplier.deals_completed },
    supplier.completion_rate  && { label: t('completion',  lang), val: `${supplier.completion_rate}%` },
    supplier.created_at       && { label: t('memberSince', lang), val: new Date(supplier.created_at).getFullYear() },
  ].filter(Boolean);

  // Localized specialty label for hero (skips empty + 'other').
  const specialtyLabel = supplier.speciality && supplier.speciality !== 'other'
    ? getSpecialtyLabel(supplier.speciality, lang)
    : '';

  // Normalize certifications for the buyer-facing block. Tolerates legacy
  // shapes: ["ISO 9001"] (bare string) and [{ name }] (no file_url).
  const certifications = (Array.isArray(supplier.certifications) ? supplier.certifications : [])
    .map((c) => {
      if (typeof c === 'string') return { name: c, file_url: null };
      if (c && typeof c === 'object') return { name: c.name || '', file_url: c.file_url || null };
      return null;
    })
    .filter((c) => c && (c.name || c.file_url));

  return (
    <SafeAreaView style={s.safe}>

      {/* ── TOP BAR ── */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[s.back, { fontFamily: isAr ? F.ar : F.en }]}>{t('back', lang)}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* ── HERO ── */}
        <View style={s.hero}>
          <View style={s.avatar}>
            {supplier.avatar_url
              ? <Image source={{ uri: supplier.avatar_url }} style={s.avatarImg} />
              : <Text style={s.avatarInitial}>{(supplier.company_name || '?')[0].toUpperCase()}</Text>
            }
          </View>

          {/* Name + verified */}
          <View style={{ flexDirection: rowDir, alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 6 }}>
            <Text style={[s.companyName, { fontFamily: isAr ? F.arBold : F.enBold }]}>
              {supplier.company_name}
            </Text>
            {isVerified && (
              <View style={s.verifiedBadge}>
                <Text style={[s.verifiedText, { fontFamily: isAr ? F.arSemi : F.enSemi }]}>
                  ✓ {t('verified', lang)}
                </Text>
              </View>
            )}
          </View>

          {/* Specialty (under company name, above city/country) — translated label */}
          {!!specialtyLabel && (
            <Text style={[s.specialtyLine, { fontFamily: isAr ? F.arSemi : F.enSemi }]}>
              {specialtyLabel}
            </Text>
          )}

          {/* Stars + city + country */}
          <Text style={s.heroMeta}>
            <Text style={s.stars}>{renderStars(Math.round(supplier.rating || 0))}</Text>
            {supplier.city    ? ` · ${supplier.city}`    : ''}
            {supplier.country ? ` · ${supplier.country}` : ''}
          </Text>

          {/* Maabar ID — clean muted text under city/country (was a pill) */}
          {!!maabarId && isVerified && (
            <Text style={s.maabarIdText}>
              Maabar ID · {maabarId}
            </Text>
          )}

          {/* Product count + samples badge + min order */}
          <View style={{ flexDirection: rowDir, gap: 12, marginTop: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Text style={s.heroStat}>{products.length} {t('products', lang)}</Text>
            {samplesCount > 0 && (
              <View style={s.grayBadge}>
                <Text style={[s.grayBadgeText, { fontFamily: isAr ? F.ar : F.en }]}>{t('samplesAvail', lang)}</Text>
              </View>
            )}
            {!!supplier.min_order_value && (
              <Text style={s.heroStat}>{t('minOrder', lang)}: {supplier.min_order_value} {t('sar', lang)}</Text>
            )}
          </View>
        </View>

        {/* ── FACTORY IMAGES ── */}
        {Array.isArray(supplier.factory_images) && supplier.factory_images.length > 0 && (
          <View style={s.section}>
            <SectionLabel text={t('factoryImages', lang)} isAr={isAr} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {supplier.factory_images.map((img, i) => (
                <View key={i} style={s.factoryThumb}>
                  <Image source={{ uri: img }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── COMPANY VIDEO ──
            Inline player via expo-av. useNativeControls renders the
            platform-native play / pause / scrub bar, so we don't need a
            custom transport. resizeMode="contain" preserves the source
            aspect ratio inside our 16:9 container. */}
        {!!supplier.company_video_url && (
          <View style={s.section}>
            <SectionLabel text={t('companyVideo', lang)} isAr={isAr} />
            <Video
              style={s.videoPlayer}
              source={{ uri: supplier.company_video_url }}
              resizeMode="contain"
              useNativeControls
            />
          </View>
        )}

        {/* ── PROTECTION BANNER ── */}
        <View style={s.protectionBanner}>
          <Text style={[s.protectionText, { textAlign, fontFamily: isAr ? F.ar : F.en }]}>
            {t('protection', lang)}
          </Text>
        </View>

        {/* ── TRUST INFO CARDS (Maabar review + working model) ──
            Trust-signals card removed: it duplicated info already visible
            elsewhere on the profile (factory images, contact links). */}
        <View style={s.section}>
          <InfoCard
            label={t('maabarReview', lang)}
            value={isVerified ? t('reviewedText', lang) : t('pendingText', lang)}
            isAr={isAr}
          />
          <InfoCard label={t('workingModel', lang)} value={t('workingText', lang)} isAr={isAr} />
        </View>

        {/* ── CONTACT LINKS ──
            WeChat & WhatsApp removed: all trader-supplier communication must
            flow through Maabar's internal chat (matches web Phase 6A policy). */}
        {(supplier.company_website || supplier.trade_link) && (
          <View style={s.section}>
            <View style={{ gap: 8 }}>
              {!!supplier.company_website && (
                <TouchableOpacity
                  style={s.contactBtn}
                  onPress={() => Linking.openURL(supplier.company_website)}
                >
                  <Text style={[s.contactBtnText, { fontFamily: isAr ? F.ar : F.en, textAlign }]}>
                    {t('visitWebsite', lang)} ↗
                  </Text>
                </TouchableOpacity>
              )}
              {!!supplier.trade_link && (
                <TouchableOpacity
                  style={s.contactBtn}
                  onPress={() => Linking.openURL(supplier.trade_link)}
                >
                  <Text style={[s.contactBtnText, { fontFamily: isAr ? F.ar : F.en, textAlign }]}>
                    {t('viewTrade', lang)} ↗
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* ── COMPANY DESCRIPTION (with AI translation) ── */}
        {!!bio && (
          <View style={s.section}>
            <TranslatedText
              text={bio}
              lang={lang}
              textStyle={[s.bio, { textAlign, fontFamily: isAr ? F.ar : F.en }]}
            />
          </View>
        )}

        {/* ── QUALITY CERTIFICATIONS ── */}
        {certifications.length > 0 && (
          <View style={s.section}>
            <SectionLabel text={t('qualityCerts', lang)} isAr={isAr} />
            <View style={{ gap: 10 }}>
              {certifications.map((cert, i) => (
                <View
                  key={`${cert.name}-${i}`}
                  style={[s.certRow, { flexDirection: rowDir }]}
                >
                  <Text style={[s.certName, { textAlign, fontFamily: isAr ? F.arSemi : F.enSemi, flex: 1 }]} numberOfLines={2}>
                    {cert.name}
                  </Text>
                  {!!cert.file_url && (
                    <TouchableOpacity
                      onPress={() => Linking.openURL(cert.file_url)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Text style={[s.certLink, { fontFamily: isAr ? F.ar : F.en }]}>
                        {t('viewCert', lang)}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── BUSINESS DETAIL CARDS ── */}
        {businessCards.length > 0 && (
          <View style={s.section}>
            {businessCards.map(card => (
              <InfoCard
                key={card.label}
                label={card.label}
                value={card.value}
                isAr={isAr}
                lang={lang}
                translatable={card.translatable}
              />
            ))}
          </View>
        )}

        {/* ── STATS GRID ── */}
        {stats.length > 0 && (
          <View style={s.section}>
            <View style={s.statsGrid}>
              {stats.map(st => (
                <View key={st.label} style={s.statCell}>
                  <Text style={[s.statLabel, { textAlign }]}>{st.label}</Text>
                  <Text style={[s.statValue, { textAlign }]}>{st.val}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── ACTION BUTTONS ── */}
        <View style={[s.section, { flexDirection: rowDir, gap: 10, flexWrap: 'wrap' }]}>
          <TouchableOpacity
            style={s.ctaBtn}
            activeOpacity={0.85}
            onPress={openChat}
          >
            <Text style={[s.ctaBtnText, { fontFamily: isAr ? F.arSemi : F.enSemi }]}>
              {t('directContact', lang)}
            </Text>
          </TouchableOpacity>
          {samplesCount > 0 && (
            <TouchableOpacity style={s.outlineBtn} onPress={openChat}>
              <Text style={[s.outlineBtnText, { fontFamily: isAr ? F.ar : F.en }]}>{t('requestSample', lang)}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={s.outlineBtn}
            onPress={() => navigation.navigate('Requests')}
          >
            <Text style={[s.outlineBtnText, { fontFamily: isAr ? F.ar : F.en }]}>{t('postRequest', lang)}</Text>
          </TouchableOpacity>
        </View>

        {/* ── PRODUCTS LIST ── */}
        <View style={s.section}>
          <SectionLabel text={t('productsLabel', lang)} isAr={isAr} />
          {products.length === 0 ? (
            <Text style={[s.emptyText, { textAlign, fontFamily: isAr ? F.ar : F.en }]}>{t('noProducts', lang)}</Text>
          ) : (
            products.map(p => (
              <ProductRow key={p.id} product={p} lang={lang} navigation={navigation} supplierId={supplierId} onChat={openChat} />
            ))
          )}
        </View>

        {/* ── PRICE CALCULATOR ── */}
        {products.length > 0 && (
          <View style={s.section}>
            <SectionLabel text={t('calcTitle', lang)} isAr={isAr} />
            <View style={s.calcCard}>

              {/* Product selector pills */}
              <Text style={[s.calcSubLabel, { textAlign, fontFamily: isAr ? F.ar : F.en }]}>
                {t('selectProduct', lang)}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingBottom: 14, flexDirection: isAr ? 'row-reverse' : 'row' }}
              >
                {products.map(p => {
                  const pName = isAr
                    ? (p.name_ar || p.name_en)
                    : lang === 'zh'
                      ? (p.name_zh || p.name_en)
                      : (p.name_en || p.name_ar);
                  const selected = calcProductId === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[s.calcPill, selected && s.calcPillActive]}
                      onPress={() => { setCalcProductId(p.id); setCalcResult(null); }}
                    >
                      <Text
                        style={[s.calcPillText, selected && s.calcPillTextActive, { fontFamily: isAr ? F.ar : F.en }]}
                        numberOfLines={1}
                      >
                        {pName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Qty input + calculate button */}
              <View style={{ flexDirection: rowDir, gap: 10, alignItems: 'center' }}>
                <TextInput
                  style={[s.calcQtyInput, { textAlign, fontFamily: isAr ? F.ar : F.en }]}
                  value={calcQty}
                  onChangeText={v => { setCalcQty(v); setCalcResult(null); }}
                  placeholder={t('qty', lang)}
                  placeholderTextColor={C.textDisabled}
                  keyboardType="numeric"
                  returnKeyType="done"
                />
                <TouchableOpacity style={s.calcBtn} onPress={calcPrice}>
                  <Text style={[s.calcBtnText, { fontFamily: isAr ? F.arSemi : F.enSemi }]}>
                    {t('calculate', lang)}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Result */}
              {calcResult && (
                <View style={s.calcResult}>
                  <View style={{ flexDirection: rowDir, justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={s.calcResultLabel}>{t('unitPrice', lang)}</Text>
                    <Text style={s.calcResultVal}>{calcResult.unitPrice} {calcResult.currency}</Text>
                  </View>
                  <View style={{ flexDirection: rowDir, justifyContent: 'space-between' }}>
                    <Text style={[s.calcResultLabel, { fontSize: 14, color: C.textPrimary }]}>{t('total', lang)}</Text>
                    <Text style={[s.calcResultVal, { fontSize: 20, fontWeight: '300' }]}>
                      {calcResult.total.toLocaleString()} {calcResult.currency}
                    </Text>
                  </View>
                  {!calcResult.meetsmoq && (
                    <View style={s.moqWarning}>
                      <Text style={[s.moqWarningText, { fontFamily: isAr ? F.ar : F.en }]}>
                        {t('minOrderUnits', lang)}: {calcResult.moq} {t('units', lang)}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── REVIEWS ── */}
        {reviews.length > 0 && (
          <View style={s.section}>
            <SectionLabel text={t('reviewsLabel', lang)} isAr={isAr} />
            {reviews.map((rv, i) => (
              <ReviewCard key={rv.id || i} review={rv} lang={lang} />
            ))}
          </View>
        )}

        {/* ── SIMILAR SUPPLIERS ── */}
        {similarSuppliers.length > 0 && (
          <View style={s.section}>
            <SectionLabel text={t('similarLabel', lang)} isAr={isAr} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, flexDirection: isAr ? 'row-reverse' : 'row' }}
            >
              {similarSuppliers.map(sim => (
                <SimilarCard key={sim.id} supplier={sim} lang={lang} navigation={navigation} />
              ))}
            </ScrollView>
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: C.bgBase },
  center:   { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notFound: { color: C.textSecondary, fontSize: 16 },
  content:  { paddingBottom: 20 },

  // Top bar
  topBar: {
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },
  back: { color: C.textSecondary, fontSize: 14 },

  // Hero
  hero: {
    alignItems: 'center', paddingHorizontal: 24, paddingVertical: 28,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: C.bgHover,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', marginBottom: 14,
  },
  avatarImg:     { width: '100%', height: '100%' },
  avatarInitial: { fontSize: 26, fontWeight: '600', color: C.textSecondary },
  companyName:   { fontSize: 22, color: C.textPrimary },

  verifiedBadge: {
    backgroundColor: C.greenSoft, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(0,100,0,0.12)',
  },
  verifiedText: { fontSize: 11, fontWeight: '700', color: C.green },

  // letterSpacing intentionally omitted — this label often renders Arabic
  // ('أثاث منزلي', 'مواد بناء', …) and any positive letter-spacing breaks
  // Arabic ligature shaping. Same applies to every other style below.
  specialtyLine: { fontSize: 13, color: C.textSecondary, marginTop: 2, marginBottom: 2 },

  heroMeta:  { fontSize: 14, color: C.textSecondary, marginTop: 4 },
  stars:     { color: '#e8a020' },

  // Maabar ID — clean muted text below city/country, replaces earlier pill.
  maabarIdText: { fontSize: 12, color: '#6B6459', fontFamily: F.en, marginTop: 6 },

  heroStat:      { fontSize: 12, color: C.textSecondary },
  grayBadge:     { backgroundColor: C.bgHover, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  grayBadgeText: { fontSize: 11, color: C.textSecondary },

  // Section wrapper
  section: {
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },
  sectionLabel: {
    fontSize: 10, textTransform: 'uppercase',
    color: C.textDisabled, marginBottom: 12,
  },

  // Factory images
  factoryThumb: {
    width: 120, height: 80, borderRadius: 8,
    overflow: 'hidden', borderWidth: 1, borderColor: C.borderSubtle,
    flexShrink: 0,
  },

  // Inline video player
  videoPlayer: {
    width: '100%', aspectRatio: 16 / 9,
    backgroundColor: '#000', borderRadius: 12,
  },

  // Protection banner
  protectionBanner: {
    marginHorizontal: 20, marginVertical: 14,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: C.bgSubtle, borderRadius: 10,
    borderWidth: 1, borderColor: C.borderMuted,
  },
  protectionText: { fontSize: 12, color: C.textSecondary, lineHeight: 18 },

  // Info cards (trust, business details)
  infoCard: {
    backgroundColor: C.bgSubtle, borderRadius: 12,
    padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: C.borderSubtle,
  },
  infoCardLabel: {
    fontSize: 10, textTransform: 'uppercase',
    color: C.textDisabled, marginBottom: 6,
  },
  infoCardValue: { fontSize: 13, lineHeight: 22, color: C.textPrimary },

  // Stats grid
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 1, backgroundColor: C.borderSubtle,
    borderRadius: 12, overflow: 'hidden',
  },
  statCell:  { width: '49.5%', backgroundColor: C.bgSubtle, padding: 12 },
  statLabel: {
    fontSize: 10, color: C.textDisabled,
    marginBottom: 4, textTransform: 'uppercase',
  },
  statValue: { fontSize: 14, fontWeight: '500', color: C.textPrimary },

  // Contact
  contactBtn: {
    paddingHorizontal: 14, paddingVertical: 11,
    borderRadius: 10, borderWidth: 1, borderColor: C.borderDefault,
    backgroundColor: C.bgRaised,
  },
  contactBtnText:     { fontSize: 13, color: C.textSecondary },
  contactDisplay:     { paddingHorizontal: 14, paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: C.borderSubtle },
  contactDisplayText: { fontSize: 13, color: C.textSecondary },

  // Bio
  bio: { fontSize: 14, lineHeight: 24, color: C.textSecondary },

  // Quality certifications
  certRow: {
    alignItems: 'center', justifyContent: 'space-between', gap: 12,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },
  certName: { fontSize: 13, color: C.textPrimary, lineHeight: 18 },
  certLink: { fontSize: 11, color: C.green },

  // Action buttons
  ctaBtn: {
    flex: 1, backgroundColor: C.btnPrimary,
    borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', minWidth: 130,
  },
  ctaBtnText:    { fontSize: 15, color: C.btnPrimaryText },
  outlineBtn:    { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: C.borderDefault },
  outlineBtnText: { fontSize: 13, color: C.textSecondary },

  // Products
  emptyText: { fontSize: 14, color: C.textSecondary },
  productRow: {
    alignItems: 'flex-start', gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },
  productThumb: {
    width: 80, height: 80, borderRadius: 10,
    backgroundColor: C.bgRaised, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  productThumbImg:  { width: '100%', height: '100%' },
  productThumbIcon: { fontSize: 28 },
  productDetails:   { flex: 1, minWidth: 0 },
  productName:      { fontSize: 13, fontWeight: '600', color: C.textPrimary, lineHeight: 18 },
  sampleBadge:      {
    backgroundColor: C.greenSoft, borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2,
    borderWidth: 1, borderColor: 'rgba(0,100,0,0.12)',
  },
  sampleBadgeText: { fontSize: 9, color: C.green },
  productPrice:    { fontSize: 14, fontWeight: '600', color: C.textPrimary, marginTop: 4 },
  productMeta:     { fontSize: 11, color: C.textSecondary, marginTop: 2 },
  detailsBtn:      {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, backgroundColor: C.bgHover,
    borderWidth: 1, borderColor: C.borderDefault,
  },
  detailsBtnText: { fontSize: 11, color: C.textSecondary },

  // Price calculator
  calcCard: {
    backgroundColor: C.bgRaised, borderRadius: 14,
    padding: 16, borderWidth: 1, borderColor: C.borderMuted,
  },
  calcSubLabel:       { fontSize: 11, color: C.textSecondary, marginBottom: 8 },
  calcPill:           {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: C.borderDefault,
    backgroundColor: C.bgBase, maxWidth: 160,
  },
  calcPillActive:     { backgroundColor: C.bgHover, borderColor: C.borderStrong },
  calcPillText:       { fontSize: 12, color: C.textSecondary },
  calcPillTextActive: { color: C.textPrimary },
  calcQtyInput: {
    flex: 1, backgroundColor: C.bgSubtle,
    borderRadius: 10, borderWidth: 1, borderColor: C.borderSubtle,
    paddingHorizontal: 12, paddingVertical: 10,
    color: C.textPrimary, fontSize: 14,
  },
  calcBtn:     {
    paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 10, backgroundColor: C.bgHover,
    borderWidth: 1, borderColor: C.borderDefault,
  },
  calcBtnText:    { fontSize: 13, color: C.textPrimary },
  calcResult:     { borderTopWidth: 1, borderTopColor: C.borderSubtle, paddingTop: 12, marginTop: 12 },
  calcResultLabel: { fontSize: 12, color: C.textDisabled },
  calcResultVal:   { fontSize: 12, fontWeight: '500', color: C.textPrimary },
  moqWarning: {
    marginTop: 10, paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: 'rgba(122,96,48,0.10)', borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(122,96,48,0.20)',
  },
  moqWarningText: { fontSize: 11, color: '#a08850' },

  // Reviews
  reviewCard: {
    backgroundColor: C.bgRaised, borderRadius: 12,
    padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: C.borderSubtle,
  },
  reviewBuyer:   { fontSize: 13, color: C.textPrimary },
  reviewStars:   { color: '#e8a020', fontSize: 13 },
  reviewComment: { fontSize: 13, color: C.textSecondary, lineHeight: 20 },
  reviewSub:     { fontSize: 10, color: C.textDisabled },

  // Similar suppliers
  similarCard: {
    width: 160, backgroundColor: C.bgRaised,
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: C.borderSubtle,
  },
  similarAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.bgHover,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', marginBottom: 8,
  },
  similarAvatarInitial: { fontSize: 16, fontWeight: '600', color: C.textSecondary },
  similarName:          { fontSize: 13, color: C.textPrimary, marginBottom: 4, lineHeight: 18 },
  similarStars:         { fontSize: 12, color: '#e8a020', marginBottom: 4 },
  similarCity:          { fontSize: 11, color: C.textSecondary, marginBottom: 6 },
});
