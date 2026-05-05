import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Image, Modal,
} from 'react-native';
import { Video } from 'expo-av';
import { WebView } from 'react-native-webview';
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
  // Identity card
  estPrefix:      { ar: 'تأسست',                                     en: 'Est.',                                                zh: '成立于'                          },
  spProducts:     { ar: 'المنتجات',                                  en: 'Products',                                            zh: '产品'                           },
  spOffers:       { ar: 'العروض',                                    en: 'Offers',                                              zh: '报价'                           },
  spRating:       { ar: 'التقييم',                                   en: 'Rating',                                              zh: '评分'                           },
  // About / Trade Info
  aboutLabel:     { ar: 'نبذة',                                      en: 'About',                                               zh: '公司介绍'                        },
  tradeInfo:      { ar: 'معلومات تجارية',                            en: 'Trade Info',                                          zh: '贸易信息'                        },
  numEmployees:   { ar: 'عدد الموظفين',                              en: 'Employees',                                           zh: '员工人数'                        },
  incoterms:      { ar: 'شروط الشحن',                                en: 'Incoterms',                                           zh: '贸易术语'                        },
  leadTime:       { ar: 'مدة التصنيع',                               en: 'Lead Time',                                           zh: '生产交期'                        },
  portOfLoading:  { ar: 'ميناء الشحن',                               en: 'Port of Loading',                                     zh: '装运港'                         },
  // Certifications card
  certIssuer:     { ar: 'الجهة المانحة',                             en: 'Issuing body',                                        zh: '颁发机构'                        },
  certValidUntil: { ar: 'صالحة حتى',                                 en: 'Valid until',                                         zh: '有效期至'                        },
  closeBtn:       { ar: 'إغلاق',                                      en: 'Close',                                               zh: '关闭'                           },
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

// Substring-match the cert name against the known type vocabulary so we can
// render a small type chip alongside the name. Falls back to `null` when no
// known type appears in the name (form just shows the bare cert name).
const KNOWN_CERT_TYPES = ['SASO', 'ROHS', 'HALAL', 'FCC', 'FDA', 'ISO', 'CE'];
function detectCertType(name) {
  const upper = String(name || '').toUpperCase();
  for (const t of KNOWN_CERT_TYPES) {
    // word-boundary-ish check so 'CE' doesn't match 'CERTIFICATION'
    const re = new RegExp(`(^|[^A-Z0-9])${t}([^A-Z0-9]|$)`);
    if (re.test(upper)) {
      // Pretty-print RoHS (the only known type with mixed case).
      return t === 'ROHS' ? 'RoHS' : t;
    }
  }
  return null;
}

// Decide whether a file URL points at an image we can render directly with
// <Image>. PDFs and unknown types route through the WebView modal instead.
function isImageUrl(url) {
  return /\.(jpg|jpeg|png|gif|webp)(\?|$|#)/i.test(String(url || ''));
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

// Compact label-on-left / value-on-right row — used inside About and Trade
// Info sections so a buyer scanning the profile gets a clean key:value
// readout instead of stacked cards. Auto-flips for RTL.
function DetailRow({ label, value, isAr }) {
  return (
    <View style={[s.detailRow, isAr && { flexDirection: 'row-reverse' }]}>
      <Text style={[s.detailLabel, isAr && s.rtl]}>{label}</Text>
      <Text style={[s.detailValue, isAr && s.rtl]}>{value}</Text>
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
  const [offersCount,      setOffersCount]      = useState(0);
  const [loading,          setLoading]          = useState(true);

  // Cert viewer modal — holds the cert object currently being viewed
  // (null = closed). Image certs render with <Image>, everything else
  // goes through Google Docs Viewer in a WebView.
  const [viewingCert, setViewingCert] = useState(null);

  useEffect(() => {
    if (!supplierId) return;
    let cancelled = false;

    async function load() {
      // 1 — Supplier (same view as Suppliers list screen).
      // The view does NOT expose company_video_url, cover_photo_url,
      // certifications, or num_employees (some predate the view, others
      // were added later via migrations 20260506000001 etc). Fetch them
      // directly from profiles in parallel; the verified-supplier branch
      // of the SELECT RLS policy added in 20260501000001 permits this
      // for any authenticated user. Errors are swallowed so missing
      // columns (un-applied migrations) don't break profile loading.
      const [supRes, extraRes, offersRes] = await Promise.all([
        supabase
          .from('supplier_public_profiles')
          .select('*')
          .eq('id', supplierId)
          .single(),
        supabase
          .from('profiles')
          .select('company_video_url, cover_photo_url, certifications, num_employees')
          .eq('id', supplierId)
          .maybeSingle(),
        supabase
          .from('offers')
          .select('id', { count: 'exact', head: true })
          .eq('supplier_id', supplierId),
      ]);
      const sup    = supRes.data;
      const supErr = supRes.error;
      console.log('[SupplierProfile] supplier_public_profiles →', sup?.company_name ?? null, '| error:', supErr?.message ?? null);
      if (sup && extraRes && !extraRes.error && extraRes.data) {
        sup.company_video_url = extraRes.data.company_video_url || null;
        sup.cover_photo_url   = extraRes.data.cover_photo_url   || null;
        sup.certifications    = extraRes.data.certifications    || sup.certifications || null;
        sup.num_employees     = extraRes.data.num_employees     ?? null;
      } else if (extraRes?.error) {
        console.log('[SupplierProfile] supplemental fetch error (non-fatal):', extraRes.error.message);
      }
      if (!offersRes.error && !cancelled) {
        setOffersCount(offersRes.count || 0);
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
  const supplierIncoterms = Array.isArray(supplier.incoterms)      ? supplier.incoterms      : [];

  // Localized specialty label for hero (skips empty + 'other').
  const specialtyLabel = supplier.speciality && supplier.speciality !== 'other'
    ? getSpecialtyLabel(supplier.speciality, lang)
    : '';
  const businessTypeLabel = supplier.business_type
    ? (BIZ_TYPE_LABELS[supplier.business_type]?.[lang] || supplier.business_type)
    : '';
  const customizationLabel = supplier.customization_support
    ? (CUSTOM_LABELS[supplier.customization_support]?.[lang] || supplier.customization_support)
    : '';

  // Identity-card derived values (mirrors SupplierHomeScreen).
  const company = (supplier.company_name || '').trim();
  const firstLetter = company[0]?.toUpperCase() || '·';
  const cover = supplier.cover_photo_url || null;
  const cityCountry = [supplier.city, supplier.country].filter(Boolean).join(' · ');
  const sideAlign = isAr ? 'flex-end' : 'flex-start';

  // Lead-time as a single human string when both bounds are present on the
  // supplier row. (Currently these fields live at the product level; the
  // guards below mean nothing renders if the supplier doesn't have them.)
  let leadTimeText = '';
  const lmin = supplier.lead_time_min_days;
  const lmax = supplier.lead_time_max_days;
  if (Number.isFinite(lmin) && Number.isFinite(lmax)) leadTimeText = `${lmin}–${lmax}`;
  else if (Number.isFinite(lmin)) leadTimeText = String(lmin);
  else if (Number.isFinite(lmax)) leadTimeText = String(lmax);

  // Normalize certifications for the buyer-facing cards. Tolerates legacy
  // shapes: ["ISO 9001"] (bare string), { name } (no file_url), and the
  // current shape { name, issuer, valid_until, file_url }.
  const certifications = (Array.isArray(supplier.certifications) ? supplier.certifications : [])
    .map((c) => {
      if (typeof c === 'string') return { name: c, issuer: '', valid_until: '', file_url: null };
      if (c && typeof c === 'object') return {
        name: c.name || '',
        issuer: c.issuer || '',
        valid_until: c.valid_until || '',
        file_url: c.file_url || null,
      };
      return null;
    })
    .filter((c) => c && (c.name || c.file_url));

  // Anything to render in About / Trade Info? Used to hide empty sections.
  const hasAbout = !!bio || !!businessTypeLabel || !!supplier.year_established
    || supplier.num_employees != null || supplierLanguages.length > 0;
  const hasTradeInfo = !!supplier.min_order_value || !!customizationLabel
    || exportMarkets.length > 0 || supplierIncoterms.length > 0
    || !!leadTimeText || !!supplier.port_of_loading;

  return (
    <SafeAreaView style={s.safe}>

      {/* ── TOP BAR ── */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={[s.back, { fontFamily: isAr ? F.ar : F.en }]}>{t('back', lang)}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* ── HERO IDENTITY CARD ── */}
        {/* Cover photo + overlapping avatar + identity info + 3-stat row.
            Mirrors SupplierHomeScreen so suppliers see the same card layout
            on their dashboard that buyers see on their profile. */}
        <View style={s.identityCard}>
          {/* Cover photo — image when set, else plain cream fill */}
          <View style={s.coverPhoto}>
            {cover ? (
              <Image source={{ uri: cover }} style={s.coverImage} resizeMode="cover" />
            ) : null}
          </View>

          {/* Body */}
          <View style={s.identityBody}>
            {/* Avatar — overlaps cover bottom by half its height */}
            <View style={[s.idAvatar, { alignSelf: sideAlign }]}>
              {supplier.avatar_url ? (
                <Image
                  source={{ uri: supplier.avatar_url }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              ) : (
                <Text style={s.idAvatarLetter}>{firstLetter}</Text>
              )}
            </View>

            {/* Company name */}
            <Text style={[s.identityName, isAr && s.rtl]} numberOfLines={2}>
              {company || '—'}
            </Text>

            {/* ✓ Verified pill */}
            {isVerified && (
              <View style={[s.idVerifiedPill, { alignSelf: sideAlign }]}>
                <Text style={s.idVerifiedPillText}>✓ {t('verified', lang)}</Text>
              </View>
            )}

            {/* Specialty */}
            {!!specialtyLabel && (
              <Text style={[s.identityRow, isAr && s.rtl]}>{specialtyLabel}</Text>
            )}

            {/* Est. year */}
            {!!supplier.year_established && (
              <Text style={[s.identityRow, isAr && s.rtl]}>
                {t('estPrefix', lang)} {supplier.year_established}
              </Text>
            )}

            {/* City · Country */}
            {!!cityCountry && (
              <Text style={[s.identityRow, isAr && s.rtl]}>{cityCountry}</Text>
            )}

            {/* Maabar ID badge */}
            {!!maabarId && isVerified && (
              <View style={[s.maabarIdBadge, { alignSelf: sideAlign }]}>
                <Text style={s.maabarIdBadgeText}>
                  Maabar ID · {maabarId}
                </Text>
              </View>
            )}

            {/* Stats row — Products / Offers / Rating */}
            <View style={[s.identityStats, isAr && { flexDirection: 'row-reverse' }]}>
              <View style={s.identityStat}>
                <Text style={s.identityStatValue}>{products.length}</Text>
                <Text style={s.identityStatLabel}>{t('spProducts', lang)}</Text>
              </View>
              <View style={s.identityStat}>
                <Text style={s.identityStatValue}>{offersCount}</Text>
                <Text style={s.identityStatLabel}>{t('spOffers', lang)}</Text>
              </View>
              <View style={s.identityStat}>
                <Text style={s.identityStatValue}>
                  {supplier.rating ? String(supplier.rating) : '—'}
                </Text>
                <Text style={s.identityStatLabel}>{t('spRating', lang)}</Text>
              </View>
            </View>
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

        {/* ── ABOUT ──
            Combines the company description (AI-translatable bio) with
            structured rows for business type / year / employees / languages.
            Section is hidden entirely if nothing to show. */}
        {hasAbout && (
          <View style={s.section}>
            <SectionLabel text={t('aboutLabel', lang)} isAr={isAr} />
            {!!bio && (
              <View style={{ marginBottom: 12 }}>
                <TranslatedText
                  text={bio}
                  lang={lang}
                  textStyle={[s.bio, { textAlign, fontFamily: isAr ? F.ar : F.en }]}
                />
              </View>
            )}
            {!!businessTypeLabel && (
              <DetailRow label={t('businessType', lang)} value={businessTypeLabel} isAr={isAr} />
            )}
            {!!supplier.year_established && (
              <DetailRow label={t('yearEst', lang)} value={String(supplier.year_established)} isAr={isAr} />
            )}
            {supplier.num_employees != null && supplier.num_employees !== '' && (
              <DetailRow label={t('numEmployees', lang)} value={String(supplier.num_employees)} isAr={isAr} />
            )}
            {supplierLanguages.length > 0 && (
              <DetailRow label={t('languages', lang)} value={supplierLanguages.join(' · ')} isAr={isAr} />
            )}
          </View>
        )}

        {/* ── TRADE INFO ──
            min_order_value / customization / export markets / incoterms /
            lead time / port. Incoterms / lead-time / port currently live
            at the product level so they'll usually be empty here; included
            with guards so the section gracefully expands if those fields
            ever migrate to the supplier row. */}
        {hasTradeInfo && (
          <View style={s.section}>
            <SectionLabel text={t('tradeInfo', lang)} isAr={isAr} />
            {!!supplier.min_order_value && (
              <DetailRow
                label={t('minOrder', lang)}
                value={`${supplier.min_order_value} ${t('sar', lang)}`}
                isAr={isAr}
              />
            )}
            {!!customizationLabel && (
              <DetailRow label={t('customization', lang)} value={customizationLabel} isAr={isAr} />
            )}
            {exportMarkets.length > 0 && (
              <DetailRow label={t('exportMarkets', lang)} value={exportMarkets.join(' · ')} isAr={isAr} />
            )}
            {supplierIncoterms.length > 0 && (
              <DetailRow label={t('incoterms', lang)} value={supplierIncoterms.join(' · ')} isAr={isAr} />
            )}
            {!!leadTimeText && (
              <DetailRow label={t('leadTime', lang)} value={leadTimeText} isAr={isAr} />
            )}
            {!!supplier.port_of_loading && (
              <DetailRow label={t('portOfLoading', lang)} value={supplier.port_of_loading} isAr={isAr} />
            )}
          </View>
        )}

        {/* ── QUALITY CERTIFICATIONS ──
            Each cert renders as a self-contained card. Image file_urls show
            an inline thumb that opens a fullscreen Image modal; PDF / unknown
            file_urls show a "View Certificate" button that opens a Modal
            with a WebView (no Linking.openURL — keeps users in-app). */}
        {certifications.length > 0 && (
          <View style={s.section}>
            <SectionLabel text={t('qualityCerts', lang)} isAr={isAr} />
            <View style={{ gap: 10 }}>
              {certifications.map((cert, i) => {
                const certType = detectCertType(cert.name);
                const showImage = cert.file_url && isImageUrl(cert.file_url);
                return (
                  <View key={`${cert.name}-${i}`} style={s.certCard}>
                    <View style={[{ flexDirection: rowDir, alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }]}>
                      <Text
                        style={[s.certCardName, { textAlign, fontFamily: isAr ? F.arSemi : F.enSemi, flex: 1, minWidth: 100 }]}
                        numberOfLines={2}
                      >
                        {cert.name}
                      </Text>
                      {!!certType && (
                        <View style={s.certTypeBadge}>
                          <Text style={s.certTypeBadgeText}>{certType}</Text>
                        </View>
                      )}
                    </View>
                    {!!cert.issuer && (
                      <Text style={[s.certCardMeta, { textAlign, fontFamily: isAr ? F.ar : F.en }]}>
                        {t('certIssuer', lang)} · {cert.issuer}
                      </Text>
                    )}
                    {!!cert.valid_until && (
                      <Text style={[s.certCardMeta, { textAlign, fontFamily: isAr ? F.ar : F.en }]}>
                        {t('certValidUntil', lang)} · {cert.valid_until}
                      </Text>
                    )}
                    {showImage && (
                      <TouchableOpacity
                        onPress={() => setViewingCert(cert)}
                        activeOpacity={0.85}
                        style={s.certImageWrap}
                      >
                        <Image
                          source={{ uri: cert.file_url }}
                          style={s.certImage}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                    )}
                    {!showImage && !!cert.file_url && (
                      <TouchableOpacity
                        style={s.certViewBtn}
                        onPress={() => setViewingCert(cert)}
                        activeOpacity={0.85}
                      >
                        <Text style={[s.certViewBtnText, { fontFamily: isAr ? F.arSemi : F.enSemi }]}>
                          {t('viewCert', lang)}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

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

        {/* Price calculator removed — out of scope for the redesigned
            buyer-facing profile. Kept openChat as the main CTA below. */}

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

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* ── STICKY BOTTOM ACTION BAR ──
          Lives outside the ScrollView so the CTAs stay reachable while the
          buyer scrolls the profile. Two buttons per spec: chat + post
          request. Auth gate is inside openChat. */}
      <View style={[s.bottomBar, isAr && { flexDirection: 'row-reverse' }]}>
        <TouchableOpacity
          style={s.ctaBtn}
          activeOpacity={0.85}
          onPress={openChat}
        >
          <Text style={[s.ctaBtnText, { fontFamily: isAr ? F.arSemi : F.enSemi }]}>
            {t('directContact', lang)}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.outlineBtn}
          onPress={() => navigation.navigate('Requests')}
          activeOpacity={0.85}
        >
          <Text style={[s.outlineBtnText, { fontFamily: isAr ? F.arSemi : F.enSemi }]}>
            {t('postRequest', lang)}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── CERT VIEWER MODAL ──
          Image certs render directly with <Image>; everything else (PDF +
          unknown) goes through Google Docs Viewer in a WebView so the file
          renders inside the app — no external browser. */}
      <Modal
        visible={!!viewingCert}
        animationType="slide"
        onRequestClose={() => setViewingCert(null)}
      >
        <SafeAreaView style={s.certModalSafe}>
          <View style={s.certModalHeader}>
            <TouchableOpacity
              onPress={() => setViewingCert(null)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[s.certModalClose, { fontFamily: isAr ? F.arSemi : F.enSemi }]}>
                {t('closeBtn', lang)}
              </Text>
            </TouchableOpacity>
            <Text
              style={[s.certModalTitle, { fontFamily: isAr ? F.arSemi : F.enSemi }]}
              numberOfLines={1}
            >
              {viewingCert?.name || ''}
            </Text>
            <View style={{ width: 50 }} />
          </View>
          {viewingCert && (
            isImageUrl(viewingCert.file_url) ? (
              <Image
                source={{ uri: viewingCert.file_url }}
                style={{ flex: 1, width: '100%', backgroundColor: '#000' }}
                resizeMode="contain"
              />
            ) : (
              <WebView
                source={{
                  uri: 'https://docs.google.com/gview?embedded=true&url=' +
                       encodeURIComponent(viewingCert.file_url || ''),
                }}
                style={{ flex: 1 }}
                startInLoadingState
                renderLoading={() => (
                  <View style={s.certModalLoading}>
                    <ActivityIndicator color={C.textSecondary} size="large" />
                  </View>
                )}
              />
            )
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: C.bgBase },
  center:   { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notFound: { color: C.textSecondary, fontSize: 16 },
  content:  { paddingBottom: 20 },
  rtl:      { textAlign: 'right', writingDirection: 'rtl' },

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

  // Maabar ID — sage-green pill badge below city/country. Single Text so
  // the entire string ("Maabar ID · MS-XXXXXX") renders at one font size.
  maabarIdBadge: {
    alignSelf: 'center',
    backgroundColor: '#E8F5E9',
    borderColor: '#A5D6A7',
    borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 4,
    marginTop: 6,
  },
  maabarIdBadgeText: {
    fontSize: 13, color: '#2E7D32',
    fontFamily: F.num, // Inter_500Medium — weight 500
  },

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

  // ── Identity card (cover photo + overlapping avatar + 3-stat row) ──
  // Mirrors SupplierHomeScreen so suppliers and buyers see the same visual.
  identityCard: {
    backgroundColor: '#FAF5E4',
    borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.10)',
    margin: 16, marginTop: 16, marginBottom: 12,
    overflow: 'hidden',
  },
  coverPhoto: {
    width: '100%', height: 160,
    backgroundColor: '#FAF8F5',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  coverImage: { width: '100%', height: '100%' },
  identityBody: { paddingHorizontal: 18, paddingBottom: 16 },
  idAvatar: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 3, borderColor: '#FFFFFF',
    backgroundColor: C.bgRaised,
    marginTop: -32, marginBottom: 12,
    overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  idAvatarLetter: { fontSize: 22, color: C.textPrimary, fontFamily: F.enBold },
  identityName: {
    fontSize: 20, fontFamily: F.arSemi, color: C.textPrimary,
    marginBottom: 8,
  },
  idVerifiedPill: {
    backgroundColor: 'rgba(80,180,120,0.10)',
    borderColor: 'rgba(80,180,120,0.22)',
    borderWidth: 1, borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 3,
    marginBottom: 8,
  },
  idVerifiedPillText: { fontSize: 11, color: '#5a9a72', fontFamily: F.arSemi },
  identityRow: {
    fontSize: 12, color: C.textSecondary, fontFamily: F.ar,
    marginBottom: 4,
  },
  identityStats: {
    flexDirection: 'row',
    paddingTop: 12, marginTop: 8,
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
  },
  identityStat: { flex: 1, alignItems: 'center' },
  identityStatValue: {
    fontSize: 18, fontFamily: F.enBold, color: C.textPrimary, lineHeight: 22,
  },
  identityStatLabel: {
    fontSize: 10, color: C.textDisabled, fontFamily: F.ar, marginTop: 2,
  },

  // ── DetailRow (key:value pairs inside About / Trade Info sections) ──
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8, gap: 12,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },
  detailLabel: { fontSize: 12, color: C.textTertiary, fontFamily: F.ar, flexShrink: 0 },
  detailValue: { fontSize: 13, color: C.textPrimary, fontFamily: F.ar, flex: 1, textAlign: 'right' },

  // ── Certifications cards ──
  certCard: {
    backgroundColor: C.bgRaised, borderRadius: 12,
    padding: 14, borderWidth: 1, borderColor: C.borderSubtle,
  },
  certCardName: { fontSize: 14, color: C.textPrimary, lineHeight: 20 },
  certCardMeta: { fontSize: 11, color: C.textSecondary, marginTop: 4 },
  certTypeBadge: {
    backgroundColor: 'rgba(80,180,120,0.10)',
    borderColor: 'rgba(80,180,120,0.22)',
    borderWidth: 1, borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  certTypeBadgeText: { fontSize: 10, color: '#5a9a72', fontFamily: F.numSemi, letterSpacing: 0.3 },
  certImageWrap: {
    marginTop: 10, width: '100%', height: 160,
    borderRadius: 8, overflow: 'hidden',
    backgroundColor: C.bgBase,
    borderWidth: 1, borderColor: C.borderSubtle,
  },
  certImage: { width: '100%', height: '100%' },
  certViewBtn: {
    marginTop: 10, alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1, borderColor: C.borderDefault,
    backgroundColor: C.bgBase,
  },
  certViewBtnText: { fontSize: 12, color: C.textPrimary, fontFamily: F.ar },

  // ── Cert viewer modal ──
  certModalSafe: { flex: 1, backgroundColor: '#000' },
  certModalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: C.bgRaised,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },
  certModalClose: { color: C.textSecondary, fontSize: 14 },
  certModalTitle: { color: C.textPrimary, fontSize: 14, flex: 1, textAlign: 'center', marginHorizontal: 8 },
  certModalLoading: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#000',
  },

  // ── Sticky bottom action bar ──
  bottomBar: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16,
    backgroundColor: C.bgRaised,
    borderTopWidth: 1, borderTopColor: C.borderSubtle,
  },
});
