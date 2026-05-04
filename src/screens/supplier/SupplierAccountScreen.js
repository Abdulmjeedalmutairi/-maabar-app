// SupplierAccountScreen — supplier dashboard's Account tab + full settings editor.
//
// The dashboard view (header, verify CTA, stats, quick actions, info, sign out)
// is unchanged. The "Edit Profile" button opens a full-screen modal with a
// 7-card settings form mirroring web/src/pages/DashboardSupplier.jsx:4789-5106:
//   Media         — avatar + factory images (up to 3) → product-images bucket
//   Card 1        — company_name / business_type / speciality / year_established
//   Card 2        — city / country / company_address / company_website
//   Card 3        — whatsapp / wechat (supplier-private; not buyer-facing)
//   Card 4        — languages
//   Card 5        — min_order_value / preferred_display_currency /
//                   customization_support / trade_link / export_markets
//   Card 6        — company_description (textarea)
//   Card 7        — quality certifications (multi-entry rows with file upload
//                   to supplier-certifications public bucket)
//
// Verification CTA navigates to SupplierVerificationScreen (Phase 6F). The old
// inline verification modal has been removed since SupplierVerificationScreen
// supersedes it.

import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, ActivityIndicator, Modal,
  KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../../lib/supabase';
import { getLang } from '../../lib/lang';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';
import { getSpecialtyLabel } from '../../lib/specialtyLabel';

// ─── Constants ───────────────────────────────────────────────────────────────
// Alibaba allows up to 10 factory photos in their supplier profile UI;
// matching that ceiling so we don't artificially constrain serious sellers.
const FACTORY_IMAGE_LIMIT = 10;
const SPECIALTY_KEYS = [
  'electronics', 'home_appliances', 'furniture', 'office_furniture',
  'bedroom_furniture', 'kitchen_furniture', 'outdoor_furniture', 'home_decor',
  'clothing', 'building', 'food', 'beauty', 'sports', 'toys', 'auto_parts',
  'car_accessories', 'tires', 'lubricants', 'health', 'packaging', 'gifts',
  'agriculture', 'other',
];
// business_type and customization_support option sets now mirror web
// (DashboardSupplier.jsx settings tab) — buyers see the same labels in the
// supplier profile regardless of which client edited the row.
const BUSINESS_TYPE_KEYS = ['manufacturer', 'trading_company', 'agent', 'distributor'];
const CUSTOMIZATION_KEYS = ['yes', 'oem', 'odm', 'no'];
const CURRENCY_OPTIONS = ['USD', 'SAR', 'CNY', 'EUR'];

// ─── i18n ────────────────────────────────────────────────────────────────────
const COPY = {
  ar: {
    title: 'حسابي',
    editProfile: 'تعديل الملف الشخصي',
    settingsTitle: 'إعدادات الملف',
    saveChanges: 'حفظ التغييرات',
    saving: 'جاري الحفظ...',
    saved: 'تم حفظ التغييرات',
    errorSave: 'حدث خطأ أثناء الحفظ',
    close: 'إغلاق',
    companyData: 'بيانات الشركة',
    email: 'البريد الإلكتروني',
    country: 'الدولة',
    city: 'المدينة',
    whatsapp: 'واتساب',
    wechat: 'WeChat',
    trustScore: 'التقييم',
    info: 'معلومات',
    joinDate: 'تاريخ الانضمام',
    stats: 'إحصائيات',
    statOffers: 'العروض المقدمة',
    statProducts: 'المنتجات',
    statAcceptRate: 'نسبة القبول',
    statTotalSales: 'إجمالي المبيعات (USD)',
    quickActions: 'إجراءات سريعة',
    qaOpenRequests: 'طلبات المشترين المفتوحة',
    qaMyProducts: 'منتجاتي',
    qaAddProduct: 'إضافة منتج جديد',
    signOut: 'تسجيل الخروج',
    signOutConfirm: 'هل أنت متأكد؟',
    signOutCancel: 'إلغاء',
    signOutAction: 'خروج',
    verifyBannerTitle: 'أكمل التحقق لتفعيل حسابك',
    verifyBannerSub: 'ارفع وثائق شركتك للبدء في استقبال الطلبات',
    verifyLabels: {
      registered: 'مسجّل',
      verification_required: 'التحقق مطلوب',
      verification_under_review: 'قيد المراجعة',
      verified: 'موثّق ✓',
      rejected: 'مرفوض',
      inactive: 'غير نشط',
    },

    // Settings cards
    cardMedia: 'الصور',
    cardIdentity: 'الهوية',
    cardLocation: 'الموقع',
    cardContact: 'التواصل',
    cardLanguages: 'اللغات',
    cardTrade: 'الإعدادات التجارية',
    cardDescription: 'وصف الشركة',
    cardCerts: 'شهادات الجودة',

    companyLogo: 'لوقو / صورة الشركة',
    factoryImagesLabel: 'صور المصنع',
    factoryImagesHint: (n, max) => `${n}/${max} · حتى ${max} صور`,
    addImage: '+ إضافة صورة',
    uploadAvatarBtn: 'تغيير اللوقو',
    avatarPlaceholder: 'أضف لوقو',
    confirmRemoveImage: 'حذف هذه الصورة؟',
    cancel: 'إلغاء',
    remove: 'حذف',

    companyName: 'اسم الشركة',
    businessType: 'نوع النشاط',
    businessTypePlaceholder: 'اختر نوع النشاط',
    bizManufacturer: 'مصنّع',
    bizTradingCompany: 'شركة تجارية',
    bizAgent: 'وكيل',
    bizDistributor: 'موزّع',
    specialty: 'التخصص',
    specialtyPlaceholder: 'اختر التخصص',
    yearEstablished: 'سنة التأسيس',

    companyAddress: 'عنوان الشركة',
    companyWebsite: 'موقع الشركة',

    languagesLabel: 'اللغات',
    languagesHint: 'افصل بفاصلة (مثال: العربية، الإنجليزية، الصينية)',

    minOrderValue: 'الحد الأدنى لقيمة الطلب (ريال)',
    preferredCurrency: 'العملة المفضلة للعرض',
    customizationLabel: 'دعم التخصيص',
    customizationPlaceholder: 'اختر',
    customYes: 'نعم',
    customOEM: 'OEM',
    customODM: 'ODM',
    customNo: 'لا',
    tradeProfile: 'رابط المتجر / الملف التجاري',
    exportMarketsLabel: 'أسواق التصدير',
    exportMarketsHint: 'افصل بفاصلة (مثال: السعودية، الإمارات)',

    descriptionLabel: 'وصف الشركة',
    descriptionHint: 'يمكنك الكتابة بأي لغة',

    addCert: '+ إضافة شهادة',
    certName: 'اسم الشهادة (مثال: ISO 9001)',
    certIssuer: 'الجهة المانحة',
    certValidUntil: 'صالحة حتى',
    uploadFile: 'رفع ملف',
    uploadingLabel: 'جاري الرفع...',
    uploadedLabel: 'تم الرفع',
    replace: 'استبدال',
    certUploadFailed: 'فشل الرفع',
    certFileTypesHint: 'PDF أو JPG أو PNG · حد أقصى 10 ميغابايت',
    permissionDenied: 'يرجى السماح بالوصول للصور',
    uploadFailed: 'فشل الرفع. حاول مرة أخرى.',

    profileVideoLabel: 'فيديو الشركة (اختياري)',
    profileVideoPickBtn: '+ رفع فيديو',
    profileVideoUploadedLabel: 'تم رفع الفيديو',
  },
  en: {
    title: 'My Account',
    editProfile: 'Edit Profile',
    settingsTitle: 'Profile Settings',
    saveChanges: 'Save Changes',
    saving: 'Saving...',
    saved: 'Changes saved',
    errorSave: 'Failed to save changes',
    close: 'Close',
    companyData: 'Company Details',
    email: 'Email',
    country: 'Country',
    city: 'City',
    whatsapp: 'WhatsApp',
    wechat: 'WeChat',
    trustScore: 'Trust Score',
    info: 'Info',
    joinDate: 'Member Since',
    stats: 'Stats',
    statOffers: 'Offers Submitted',
    statProducts: 'Products',
    statAcceptRate: 'Accept Rate',
    statTotalSales: 'Total Sales (USD)',
    quickActions: 'Quick Actions',
    qaOpenRequests: 'Open Buyer Requests',
    qaMyProducts: 'My Products',
    qaAddProduct: 'Add New Product',
    signOut: 'Sign Out',
    signOutConfirm: 'Are you sure?',
    signOutCancel: 'Cancel',
    signOutAction: 'Sign Out',
    verifyBannerTitle: 'Complete verification to activate your account',
    verifyBannerSub: 'Upload your company documents to start receiving orders',
    verifyLabels: {
      registered: 'Registered',
      verification_required: 'Verification Required',
      verification_under_review: 'Under Review',
      verified: 'Verified ✓',
      rejected: 'Rejected',
      inactive: 'Inactive',
    },

    cardMedia: 'Media',
    cardIdentity: 'Identity',
    cardLocation: 'Location',
    cardContact: 'Contact',
    cardLanguages: 'Languages',
    cardTrade: 'Trade Settings',
    cardDescription: 'Company Description',
    cardCerts: 'Quality Certifications',

    companyLogo: 'Company Logo',
    factoryImagesLabel: 'Factory Images',
    factoryImagesHint: (n, max) => `${n}/${max} · up to ${max} images`,
    addImage: '+ Add image',
    uploadAvatarBtn: 'Change logo',
    avatarPlaceholder: 'Add logo',
    confirmRemoveImage: 'Remove this image?',
    cancel: 'Cancel',
    remove: 'Remove',

    companyName: 'Company Name',
    businessType: 'Business Type',
    businessTypePlaceholder: 'Select business type',
    bizManufacturer: 'Manufacturer',
    bizTradingCompany: 'Trading Company',
    bizAgent: 'Agent',
    bizDistributor: 'Distributor',
    specialty: 'Specialty',
    specialtyPlaceholder: 'Select specialty',
    yearEstablished: 'Year Established',

    companyAddress: 'Company Address',
    companyWebsite: 'Company Website',

    languagesLabel: 'Languages',
    languagesHint: 'Comma-separated (e.g. Arabic, English, Chinese)',

    minOrderValue: 'Minimum Order Value (SAR)',
    preferredCurrency: 'Preferred Display Currency',
    customizationLabel: 'Customization Support',
    customizationPlaceholder: 'Select',
    customYes: 'Yes',
    customOEM: 'OEM',
    customODM: 'ODM',
    customNo: 'No',
    tradeProfile: 'Trade Profile / Storefront Link',
    exportMarketsLabel: 'Export Markets',
    exportMarketsHint: 'Comma-separated (e.g. Saudi Arabia, UAE)',

    descriptionLabel: 'Company Description',
    descriptionHint: 'You can write in any language',

    addCert: '+ Add certification',
    certName: 'Cert name (e.g. ISO 9001)',
    certIssuer: 'Issuing body',
    certValidUntil: 'Valid until',
    uploadFile: 'Upload file',
    uploadingLabel: 'Uploading...',
    uploadedLabel: 'Uploaded',
    replace: 'Replace',
    certUploadFailed: 'Upload failed',
    certFileTypesHint: 'PDF, JPG, PNG · 10 MB max',
    permissionDenied: 'Please allow photo library access',
    uploadFailed: 'Upload failed. Please try again.',

    profileVideoLabel: 'Company Profile Video (optional)',
    profileVideoPickBtn: '+ Upload video',
    profileVideoUploadedLabel: 'Video uploaded',
  },
  zh: {
    title: '我的账户',
    editProfile: '编辑资料',
    settingsTitle: '资料设置',
    saveChanges: '保存修改',
    saving: '保存中...',
    saved: '修改已保存',
    errorSave: '保存失败，请重试',
    close: '关闭',
    companyData: '公司信息',
    email: '电子邮件',
    country: '国家',
    city: '城市',
    whatsapp: 'WhatsApp',
    wechat: 'WeChat',
    trustScore: '信任评分',
    info: '信息',
    joinDate: '注册日期',
    stats: '统计',
    statOffers: '已提交报价',
    statProducts: '产品',
    statAcceptRate: '接受率',
    statTotalSales: '总销售额 (USD)',
    quickActions: '快捷操作',
    qaOpenRequests: '买家的开放需求',
    qaMyProducts: '我的产品',
    qaAddProduct: '添加新产品',
    signOut: '退出登录',
    signOutConfirm: '确认退出？',
    signOutCancel: '取消',
    signOutAction: '退出',
    verifyBannerTitle: '完成认证以激活账户',
    verifyBannerSub: '上传企业文件后即可开始接收订单',
    verifyLabels: {
      registered: '已注册',
      verification_required: '需要认证',
      verification_under_review: '审核中',
      verified: '已认证 ✓',
      rejected: '已拒绝',
      inactive: '未激活',
    },

    cardMedia: '图片',
    cardIdentity: '基本信息',
    cardLocation: '位置',
    cardContact: '联系方式',
    cardLanguages: '语言',
    cardTrade: '贸易设置',
    cardDescription: '公司介绍',
    cardCerts: '质量认证',

    companyLogo: '公司 Logo',
    factoryImagesLabel: '工厂图片',
    factoryImagesHint: (n, max) => `${n}/${max} · 最多 ${max} 张`,
    addImage: '+ 添加图片',
    uploadAvatarBtn: '更换 Logo',
    avatarPlaceholder: '上传 Logo',
    confirmRemoveImage: '删除此图片？',
    cancel: '取消',
    remove: '删除',

    companyName: '公司名称',
    businessType: '企业类型',
    businessTypePlaceholder: '请选择企业类型',
    bizManufacturer: '制造商',
    bizTradingCompany: '贸易公司',
    bizAgent: '代理商',
    bizDistributor: '经销商',
    specialty: '专业领域',
    specialtyPlaceholder: '请选择',
    yearEstablished: '成立年份',

    companyAddress: '公司地址',
    companyWebsite: '公司官网',

    languagesLabel: '支持语言',
    languagesHint: '用逗号分隔（例如：阿拉伯语、英语、中文）',

    minOrderValue: '最低订单金额（SAR）',
    preferredCurrency: '首选展示货币',
    customizationLabel: '定制支持',
    customizationPlaceholder: '请选择',
    customYes: '是',
    customOEM: 'OEM',
    customODM: 'ODM',
    customNo: '否',
    tradeProfile: '贸易主页 / 店铺链接',
    exportMarketsLabel: '出口市场',
    exportMarketsHint: '用逗号分隔（例如：沙特、阿联酋）',

    descriptionLabel: '公司介绍',
    descriptionHint: '可使用任意语言填写',

    addCert: '+ 添加认证',
    certName: '认证名称（例如 ISO 9001）',
    certIssuer: '颁发机构',
    certValidUntil: '有效期至',
    uploadFile: '上传文件',
    uploadingLabel: '上传中...',
    uploadedLabel: '已上传',
    replace: '更换',
    certUploadFailed: '上传失败',
    certFileTypesHint: 'PDF / JPG / PNG · 最大 10MB',
    permissionDenied: '请允许访问图库',
    uploadFailed: '上传失败，请重试。',

    profileVideoLabel: '公司介绍视频（可选）',
    profileVideoPickBtn: '+ 上传视频',
    profileVideoUploadedLabel: '视频已上传',
  },
};

const VERIFY_COLOR = {
  registered: C.blue,
  verification_required: C.orange,
  verification_under_review: C.orange,
  verified: C.green,
  rejected: C.red,
  inactive: C.textDisabled,
};

const BIZ_LABEL = (lang) => ({
  manufacturer:    COPY[lang]?.bizManufacturer    || COPY.en.bizManufacturer,
  trading_company: COPY[lang]?.bizTradingCompany  || COPY.en.bizTradingCompany,
  agent:           COPY[lang]?.bizAgent           || COPY.en.bizAgent,
  distributor:     COPY[lang]?.bizDistributor     || COPY.en.bizDistributor,
});

const CUSTOM_LABEL = (lang) => ({
  yes: COPY[lang]?.customYes || 'Yes',
  oem: COPY[lang]?.customOEM || 'OEM',
  odm: COPY[lang]?.customODM || 'ODM',
  no:  COPY[lang]?.customNo  || 'No',
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
function hydrateCerts(rawCerts = []) {
  if (!Array.isArray(rawCerts)) return [];
  return rawCerts
    .map((c) => {
      const name      = typeof c === 'string' ? c : (c && c.name) ? c.name : '';
      const fileUrl   = (c && typeof c === 'object' && c.file_url)    ? c.file_url    : null;
      const issuer    = (c && typeof c === 'object' && c.issuer)      ? c.issuer      : '';
      const validUntil = (c && typeof c === 'object' && c.valid_until) ? c.valid_until : '';
      return {
        _id: Math.random().toString(36).slice(2, 10),
        name,
        issuer,
        valid_until: validUntil,
        file_url: fileUrl,
        uploading: false,
        error: null,
      };
    })
    .filter((c) => c.name || c.file_url || c.issuer || c.valid_until);
}

function serializeArray(a) {
  return Array.isArray(a) ? a.filter(Boolean).join(', ') : '';
}
function parseArray(s) {
  return String(s || '').split(',').map((t) => t.trim()).filter(Boolean);
}

async function uploadToProductImages(uri, mimeType, userId, type, ext) {
  const e = (ext || (mimeType?.includes('png') ? 'png' : 'jpg')).toLowerCase();
  const path = `${userId}/${type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${e}`;
  const ab = await fetch(uri).then((r) => r.arrayBuffer());
  const { error } = await supabase.storage.from('product-images').upload(path, ab, {
    contentType: mimeType || 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(path);
  return publicUrl;
}

async function uploadProfileVideo(uri, mimeType, userId, ext) {
  const e = (ext || (mimeType?.includes('quicktime') ? 'mov' : 'mp4')).toLowerCase();
  const path = `${userId}/profile_video_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${e}`;
  const ab = await fetch(uri).then((r) => r.arrayBuffer());
  const { error } = await supabase.storage.from('product-images').upload(path, ab, {
    contentType: mimeType || 'video/mp4',
    upsert: true,
  });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(path);
  return publicUrl;
}

async function uploadToCerts(uri, mimeType, userId, name) {
  const ext = (name?.split('.').pop() || 'pdf').toLowerCase();
  const path = `${userId}/cert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const ab = await fetch(uri).then((r) => r.arrayBuffer());
  const { error } = await supabase.storage.from('supplier-certifications').upload(path, ab, {
    contentType: mimeType || 'application/octet-stream',
    upsert: true,
  });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from('supplier-certifications').getPublicUrl(path);
  return publicUrl;
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function SupplierAccountScreen({ navigation }) {
  const lang = getLang();
  const t = COPY[lang] || COPY.ar;
  const isAr = lang === 'ar';

  const [profile, setProfile] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ offers: 0, products: 0, accepted: 0, totalSales: 0 });

  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    avatar_url: '',
    factory_images: [],
    company_video_url: '',
    company_name: '',
    business_type: '',
    speciality: '',
    year_established: '',
    city: '',
    country: '',
    company_address: '',
    company_website: '',
    whatsapp: '',
    wechat: '',
    languages: '',
    min_order_value: '',
    preferred_display_currency: 'USD',
    customization_support: '',
    trade_link: '',
    export_markets: '',
    company_description: '',
  });
  const [editCerts, setEditCerts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingFactory, setUploadingFactory] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  useEffect(() => { loadProfile(); }, []);

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserEmail(user.email || '');

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) console.error('[SupplierAccount] loadProfile error:', error);

    setProfile(data);
    if (data) {
      setEditForm({
        avatar_url: data.avatar_url || '',
        factory_images: Array.isArray(data.factory_images)
          ? data.factory_images.filter((u) => typeof u === 'string' && /^https?:/i.test(u))
          : [],
        company_video_url: data.company_video_url || '',
        company_name: data.company_name || '',
        business_type: data.business_type || '',
        speciality: data.speciality || '',
        year_established: data.year_established != null ? String(data.year_established) : '',
        city: data.city || '',
        country: data.country || '',
        company_address: data.company_address || '',
        company_website: data.company_website || '',
        whatsapp: data.whatsapp || '',
        wechat: data.wechat || '',
        languages: serializeArray(data.languages),
        min_order_value: data.min_order_value != null ? String(data.min_order_value) : '',
        preferred_display_currency: data.preferred_display_currency || 'USD',
        customization_support: data.customization_support || '',
        trade_link: data.trade_link || '',
        export_markets: serializeArray(data.export_markets),
        company_description: data.company_description || data.bio_en || data.bio_ar || data.bio_zh || '',
      });
      setEditCerts(hydrateCerts(data.certifications));
    }
    loadStats(user.id);
    setLoading(false);
  }

  async function loadStats(userId) {
    const [offersRes, productsRes, acceptedRes, paymentsRes] = await Promise.all([
      supabase.from('offers').select('id', { count: 'exact', head: true }).eq('supplier_id', userId),
      supabase.from('products').select('id', { count: 'exact', head: true }).eq('supplier_id', userId).eq('is_active', true),
      supabase.from('offers').select('id', { count: 'exact', head: true }).eq('supplier_id', userId).eq('status', 'accepted'),
      supabase.from('payments').select('amount').eq('supplier_id', userId).eq('status', 'first_paid'),
    ]);
    const totalSales = (paymentsRes.data || []).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    setStats({
      offers: offersRes.count || 0,
      products: productsRes.count || 0,
      accepted: acceptedRes.count || 0,
      totalSales: Math.round(totalSales),
    });
  }

  function setF(key, val) { setEditForm((f) => ({ ...f, [key]: val })); }

  // ── Avatar upload ────────────────────────────────────────────────────────
  async function pickAndUploadAvatar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') { Alert.alert('', t.permissionDenied); return; }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (r.canceled || !r.assets?.[0]) return;
    const asset = r.assets[0];
    setUploadingAvatar(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const ext = (asset.fileName?.split('.').pop() || 'jpg').toLowerCase();
      const url = await uploadToProductImages(asset.uri, asset.mimeType || 'image/jpeg', user.id, 'avatar', ext);
      setF('avatar_url', url);
    } catch (e) {
      console.error('[SupplierAccount] avatar upload error:', e?.message || e);
      Alert.alert('', t.uploadFailed);
    } finally {
      setUploadingAvatar(false);
    }
  }

  // ── Factory image upload (up to 3) ───────────────────────────────────────
  async function pickAndUploadFactoryImages() {
    const remaining = FACTORY_IMAGE_LIMIT - editForm.factory_images.length;
    if (remaining <= 0) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') { Alert.alert('', t.permissionDenied); return; }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.85,
    });
    if (r.canceled || !r.assets?.length) return;
    setUploadingFactory(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const newUrls = [];
      for (const asset of r.assets.slice(0, remaining)) {
        try {
          const ext = (asset.fileName?.split('.').pop() || 'jpg').toLowerCase();
          const url = await uploadToProductImages(asset.uri, asset.mimeType || 'image/jpeg', user.id, 'factory', ext);
          newUrls.push(url);
        } catch (e) {
          console.error('[SupplierAccount] factory upload error:', e?.message || e);
        }
      }
      setEditForm((f) => ({
        ...f,
        factory_images: [...f.factory_images, ...newUrls].slice(0, FACTORY_IMAGE_LIMIT),
      }));
    } finally {
      setUploadingFactory(false);
    }
  }

  function removeFactoryImage(url) {
    Alert.alert('', t.confirmRemoveImage, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.remove, style: 'destructive',
        onPress: () => setEditForm((f) => ({ ...f, factory_images: f.factory_images.filter((u) => u !== url) })),
      },
    ]);
  }

  // ── Profile video (single) ─────────────────────────────────────────────
  // Stored on profiles.company_video_url. The column is added by a separate
  // migration; if it's missing, the UPDATE in saveSettings will reject and
  // surface via the existing error path.
  async function pickAndUploadVideo() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') { Alert.alert('', t.permissionDenied); return; }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 0.85,
    });
    if (r.canceled || !r.assets?.[0]) return;
    setUploadingVideo(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const a = r.assets[0];
      const ext = (a.fileName?.split('.').pop() || '').toLowerCase();
      const url = await uploadProfileVideo(a.uri, a.mimeType || 'video/mp4', user.id, ext);
      setF('company_video_url', url);
    } catch (e) {
      console.error('[SupplierAccount] video upload error:', e?.message || e);
      Alert.alert('', t.uploadFailed);
    } finally {
      setUploadingVideo(false);
    }
  }
  function clearProfileVideo() { setF('company_video_url', ''); }

  // ── Cert handlers ────────────────────────────────────────────────────────
  const updateCert = (id, patch) => setEditCerts((p) => p.map((c) => (c._id === id ? { ...c, ...patch } : c)));
  const addCert = () => setEditCerts((p) => [
    ...p,
    { _id: Math.random().toString(36).slice(2, 10), name: '', file_url: null, uploading: false, error: null },
  ]);
  const removeCert = (id) => setEditCerts((p) => p.filter((c) => c._id !== id));
  const removeCertFile = (id) => updateCert(id, { file_url: null });

  async function uploadCertFile(id) {
    try {
      const r = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (r.canceled || !r.assets?.[0]) return;
      const asset = r.assets[0];
      updateCert(id, { uploading: true, error: null });
      const { data: { user } } = await supabase.auth.getUser();
      const url = await uploadToCerts(asset.uri, asset.mimeType, user.id, asset.name);
      updateCert(id, { uploading: false, file_url: url });
    } catch (e) {
      console.error('[SupplierAccount] cert upload error:', e?.message || e);
      updateCert(id, { uploading: false, error: t.certUploadFailed });
    }
  }

  // ── Save all settings (single UPDATE) ────────────────────────────────────
  async function saveSettings() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const yr = editForm.year_established ? parseInt(editForm.year_established, 10) : null;
    const moqv = editForm.min_order_value ? parseFloat(editForm.min_order_value) : null;
    const certsArray = editCerts
      .map((c) => ({
        name:        String(c.name || '').trim(),
        issuer:      String(c.issuer || '').trim(),
        valid_until: String(c.valid_until || '').trim(),
        file_url:    c.file_url || null,
      }))
      .filter((c) => c.name || c.issuer || c.valid_until || c.file_url);
    const description = editForm.company_description.trim();

    const payload = {
      avatar_url: editForm.avatar_url || null,
      factory_images: editForm.factory_images,
      company_video_url: editForm.company_video_url || null,
      company_name: editForm.company_name.trim() || null,
      business_type: editForm.business_type || null,
      speciality: editForm.speciality || null,
      year_established: Number.isFinite(yr) ? yr : null,
      city: editForm.city.trim() || null,
      country: editForm.country.trim() || null,
      company_address: editForm.company_address.trim() || null,
      company_website: editForm.company_website.trim() || null,
      whatsapp: editForm.whatsapp.trim() || null,
      wechat: editForm.wechat.trim() || null,
      languages: parseArray(editForm.languages),
      min_order_value: Number.isFinite(moqv) ? moqv : null,
      preferred_display_currency: editForm.preferred_display_currency || 'USD',
      customization_support: editForm.customization_support || null,
      trade_link: editForm.trade_link.trim() || null,
      export_markets: parseArray(editForm.export_markets),
      company_description: description || null,
      bio_en: description || null,
      certifications: certsArray,
    };

    const { error } = await supabase.from('profiles').update(payload).eq('id', user.id);
    setSaving(false);

    if (error) {
      console.error('[SupplierAccount] saveSettings error:', error);
      Alert.alert('', t.errorSave);
      return;
    }

    setShowEdit(false);
    loadProfile();
    Alert.alert('✓', t.saved);
  }

  function handleSignOut() {
    Alert.alert(t.signOut, t.signOutConfirm, [
      { text: t.signOutCancel, style: 'cancel' },
      { text: t.signOutAction, style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  }

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}><ActivityIndicator color={C.textSecondary} size="large" /></View>
      </SafeAreaView>
    );
  }

  const status = profile?.status || 'registered';
  const statusColor = VERIFY_COLOR[status] || C.textDisabled;
  const statusLabel = (t.verifyLabels || {})[status] || status;
  const canVerify = ['registered', 'verification_required'].includes(status);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Profile header */}
        <View style={s.profileHeader}>
          <View style={s.avatar}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={{ width: '100%', height: '100%' }} />
            ) : (
              <Text style={s.avatarText}>
                {profile?.company_name?.charAt(0)?.toUpperCase() || 'S'}
              </Text>
            )}
          </View>
          <Text style={[s.companyName, isAr && s.rtl]} numberOfLines={1}>
            {profile?.company_name || '—'}
          </Text>
          {profile?.maabar_supplier_id ? (
            <Text style={s.supplierId}>{profile.maabar_supplier_id}</Text>
          ) : null}
          <View style={[s.statusBadge, { backgroundColor: statusColor + '20', borderColor: statusColor + '40' }]}>
            <Text style={[s.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
          <TouchableOpacity style={s.editProfileBtn} onPress={() => setShowEdit(true)} activeOpacity={0.85}>
            <Text style={s.editProfileText}>{t.editProfile}</Text>
          </TouchableOpacity>
        </View>

        {/* Verification CTA — opens the dedicated 3-step screen (Phase 6F) */}
        {canVerify && (
          <TouchableOpacity
            style={s.verifyBanner}
            onPress={() => navigation.navigate('SupplierVerification')}
            activeOpacity={0.85}
          >
            <Text style={[s.verifyBannerTitle, isAr && s.rtl]}>{t.verifyBannerTitle}</Text>
            <Text style={[s.verifyBannerSub, isAr && s.rtl]}>{t.verifyBannerSub}</Text>
          </TouchableOpacity>
        )}

        {/* Stats */}
        <Text style={[s.blockHeader, isAr && s.rtl]}>{t.stats}</Text>
        <View style={s.statsGrid}>
          <StatTile label={t.statOffers} value={String(stats.offers)} />
          <StatTile label={t.statProducts} value={String(stats.products)} />
          <StatTile
            label={t.statAcceptRate}
            value={stats.offers > 0 ? `${Math.round((stats.accepted / stats.offers) * 100)}%` : '—'}
          />
          <StatTile
            label={t.statTotalSales}
            value={stats.totalSales ? stats.totalSales.toLocaleString() : '—'}
          />
        </View>

        {/* Quick Actions */}
        <Text style={[s.blockHeader, isAr && s.rtl]}>{t.quickActions}</Text>
        <View style={s.quickActions}>
          <TouchableOpacity style={[s.qaBtn, s.qaBtnPrimary]} activeOpacity={0.85}
            onPress={() => navigation?.navigate('SRequests')}>
            <Text style={[s.qaText, s.qaTextPrimary, isAr && s.rtl]}>{t.qaOpenRequests}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.qaBtn} activeOpacity={0.85}
            onPress={() => navigation?.navigate('SProducts')}>
            <Text style={[s.qaText, isAr && s.rtl]}>{t.qaMyProducts}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.qaBtn} activeOpacity={0.85}
            onPress={() => navigation?.navigate('SProducts', { openAdd: true })}>
            <Text style={[s.qaText, isAr && s.rtl]}>{t.qaAddProduct}</Text>
          </TouchableOpacity>
        </View>

        {/* Company details */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, isAr && s.rtl]}>{t.companyData}</Text>
          <InfoRow label={t.email} value={userEmail || '—'} isAr={isAr} />
          <InfoRow label={t.country} value={profile?.country || '—'} isAr={isAr} />
          <InfoRow label={t.city} value={profile?.city || '—'} isAr={isAr} />
          {profile?.whatsapp ? <InfoRow label={t.whatsapp} value={profile.whatsapp} isAr={isAr} /> : null}
          {profile?.wechat ? <InfoRow label={t.wechat} value={profile.wechat} isAr={isAr} /> : null}
          {profile?.trust_score != null ? (
            <InfoRow label={t.trustScore} value={`${profile.trust_score || 0} / 100`} isAr={isAr} />
          ) : null}
        </View>

        <View style={s.section}>
          <Text style={[s.sectionTitle, isAr && s.rtl]}>{t.info}</Text>
          <InfoRow
            label={t.joinDate}
            value={profile?.created_at
              ? new Date(profile.created_at).toLocaleDateString(lang === 'ar' ? 'ar-SA-u-nu-latn' : lang === 'zh' ? 'zh-CN' : 'en-GB')
              : '—'}
            isAr={isAr}
          />
        </View>

        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut} activeOpacity={0.85}>
          <Text style={s.signOutText}>{t.signOut}</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* ─────────────────  EDIT MODAL — full 7-card form  ───────────────── */}
      <Modal visible={showEdit} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowEdit(false)}>
        <SafeAreaView style={s.safe}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={[s.modalHeader, isAr && s.rowRtl]}>
              <TouchableOpacity onPress={() => setShowEdit(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={s.modalClose}>{t.close}</Text>
              </TouchableOpacity>
              <Text style={[s.modalTitle, isAr && s.rtl]}>{t.settingsTitle}</Text>
              <View style={{ width: 50 }} />
            </View>

            <ScrollView contentContainerStyle={s.modalScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

              {/* ── MEDIA CARD ── */}
              <View style={s.card}>
                <Text style={[s.cardTitle, isAr && s.rtl]}>{t.cardMedia}</Text>

                {/* Avatar */}
                <Text style={[s.cardFieldLabel, isAr && s.rtl]}>{t.companyLogo}</Text>
                <View style={[s.avatarRow, isAr && s.rowRtl]}>
                  <View style={s.avatarPreview}>
                    {editForm.avatar_url ? (
                      <Image source={{ uri: editForm.avatar_url }} style={{ width: '100%', height: '100%' }} />
                    ) : (
                      <Text style={[s.avatarPreviewText, { fontFamily: F.en }]}>{t.avatarPlaceholder}</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={[s.smallBtn, uploadingAvatar && { opacity: 0.6 }]}
                    onPress={pickAndUploadAvatar}
                    disabled={uploadingAvatar}
                    activeOpacity={0.85}
                  >
                    {uploadingAvatar
                      ? <ActivityIndicator color={C.textSecondary} size="small" />
                      : <Text style={s.smallBtnText}>{t.uploadAvatarBtn}</Text>}
                  </TouchableOpacity>
                </View>

                <View style={{ height: 18 }} />

                {/* Factory images */}
                <View style={[s.factoryHeaderRow, isAr && s.rowRtl]}>
                  <Text style={[s.cardFieldLabel, isAr && s.rtl, { flex: 1 }]}>{t.factoryImagesLabel}</Text>
                  <Text style={s.factoryCount}>{t.factoryImagesHint(editForm.factory_images.length, FACTORY_IMAGE_LIMIT)}</Text>
                </View>
                <View style={s.factoryGrid}>
                  {editForm.factory_images.map((url) => (
                    <TouchableOpacity
                      key={url}
                      style={s.factoryThumb}
                      onLongPress={() => removeFactoryImage(url)}
                      activeOpacity={0.85}
                    >
                      <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} />
                      <TouchableOpacity
                        style={s.factoryRemove}
                        onPress={() => removeFactoryImage(url)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Text style={[s.factoryRemoveText, { fontFamily: F.enBold }]}>×</Text>
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                  {editForm.factory_images.length < FACTORY_IMAGE_LIMIT && (
                    <TouchableOpacity
                      style={[s.factoryAdd, uploadingFactory && { opacity: 0.6 }]}
                      onPress={pickAndUploadFactoryImages}
                      disabled={uploadingFactory}
                      activeOpacity={0.85}
                    >
                      {uploadingFactory
                        ? <ActivityIndicator color={C.textSecondary} />
                        : <Text style={s.factoryAddText}>{t.addImage}</Text>}
                    </TouchableOpacity>
                  )}
                </View>

                <View style={{ height: 18 }} />

                {/* Profile video (single, optional) */}
                <View style={[s.factoryHeaderRow, isAr && s.rowRtl]}>
                  <Text style={[s.cardFieldLabel, isAr && s.rtl, { flex: 1 }]}>
                    {t.profileVideoLabel}
                  </Text>
                  {!editForm.company_video_url && (
                    <TouchableOpacity
                      style={[s.smallBtn, uploadingVideo && { opacity: 0.6 }]}
                      onPress={pickAndUploadVideo}
                      disabled={uploadingVideo}
                      activeOpacity={0.85}
                    >
                      {uploadingVideo
                        ? <ActivityIndicator color={C.textSecondary} size="small" />
                        : <Text style={s.smallBtnText}>{t.profileVideoPickBtn}</Text>}
                    </TouchableOpacity>
                  )}
                </View>
                {!!editForm.company_video_url && (
                  <View style={[s.certPill, isAr && s.rowRtl, { alignSelf: 'flex-start', marginTop: 4 }]}>
                    <Text style={[s.certPillCheck, { fontFamily: F.enBold }]}>✓</Text>
                    <Text
                      style={[s.certPillText, { fontFamily: isAr ? F.arSemi : F.enSemi }]}
                      numberOfLines={1}
                    >
                      {t.profileVideoUploadedLabel}
                    </Text>
                    <TouchableOpacity
                      onPress={clearProfileVideo}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={[s.certPillRemove, { fontFamily: F.enBold }]}>×</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* ── CARD 1 — IDENTITY ── */}
              <View style={s.card}>
                <Text style={[s.cardTitle, isAr && s.rtl]}>{t.cardIdentity}</Text>
                <FormField label={t.companyName} value={editForm.company_name} onChangeText={(v) => setF('company_name', v)} isAr={isAr} required />
                <PickerField
                  label={t.businessType} placeholder={t.businessTypePlaceholder}
                  value={editForm.business_type} onChange={(v) => setF('business_type', v)}
                  options={BUSINESS_TYPE_KEYS.map((k) => ({ val: k, label: BIZ_LABEL(lang)[k] }))}
                  isAr={isAr}
                />
                <PickerField
                  label={t.specialty} placeholder={t.specialtyPlaceholder}
                  value={editForm.speciality} onChange={(v) => setF('speciality', v)}
                  options={SPECIALTY_KEYS.map((k) => ({ val: k, label: getSpecialtyLabel(k, lang) }))}
                  isAr={isAr}
                />
                <FormField
                  label={t.yearEstablished} value={editForm.year_established}
                  onChangeText={(v) => setF('year_established', v)}
                  keyboardType="numeric" maxLength={4} dirOverride="ltr"
                />
              </View>

              {/* ── CARD 2 — LOCATION ── */}
              <View style={s.card}>
                <Text style={[s.cardTitle, isAr && s.rtl]}>{t.cardLocation}</Text>
                <FormField label={t.city} value={editForm.city} onChangeText={(v) => setF('city', v)} isAr={isAr} />
                <FormField label={t.country} value={editForm.country} onChangeText={(v) => setF('country', v)} isAr={isAr} />
                <FormField label={t.companyAddress} value={editForm.company_address} onChangeText={(v) => setF('company_address', v)} isAr={isAr} />
                <FormField
                  label={t.companyWebsite} value={editForm.company_website}
                  onChangeText={(v) => setF('company_website', v)}
                  keyboardType="url" autoCapitalize="none" dirOverride="ltr"
                  placeholder="https://..."
                />
              </View>

              {/* ── CARD 3 — CONTACT ── */}
              <View style={s.card}>
                <Text style={[s.cardTitle, isAr && s.rtl]}>{t.cardContact}</Text>
                <FormField
                  label={t.whatsapp} value={editForm.whatsapp}
                  onChangeText={(v) => setF('whatsapp', v)}
                  keyboardType="phone-pad" dirOverride="ltr"
                />
                <FormField
                  label={t.wechat} value={editForm.wechat}
                  onChangeText={(v) => setF('wechat', v)}
                  dirOverride="ltr"
                />
              </View>

              {/* ── CARD 4 — LANGUAGES ── */}
              <View style={s.card}>
                <Text style={[s.cardTitle, isAr && s.rtl]}>{t.cardLanguages}</Text>
                <FormField
                  label={t.languagesLabel} hint={t.languagesHint}
                  value={editForm.languages}
                  onChangeText={(v) => setF('languages', v)}
                  isAr={isAr}
                />
              </View>

              {/* ── CARD 5 — TRADE ── */}
              <View style={s.card}>
                <Text style={[s.cardTitle, isAr && s.rtl]}>{t.cardTrade}</Text>
                <FormField
                  label={t.minOrderValue} value={editForm.min_order_value}
                  onChangeText={(v) => setF('min_order_value', v)}
                  keyboardType="numeric" dirOverride="ltr"
                />
                <Text style={[s.cardFieldLabel, isAr && s.rtl]}>{t.preferredCurrency}</Text>
                <View style={[s.pillRow, isAr && s.rowRtl]}>
                  {CURRENCY_OPTIONS.map((code) => (
                    <TouchableOpacity
                      key={code}
                      style={[s.pill, editForm.preferred_display_currency === code && s.pillActive]}
                      onPress={() => setF('preferred_display_currency', code)}
                      activeOpacity={0.85}
                    >
                      <Text style={[
                        s.pillText, editForm.preferred_display_currency === code && s.pillTextActive,
                        { fontFamily: F.enSemi },
                      ]}>{code}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={{ height: 14 }} />
                <PickerField
                  label={t.customizationLabel} placeholder={t.customizationPlaceholder}
                  value={editForm.customization_support} onChange={(v) => setF('customization_support', v)}
                  options={CUSTOMIZATION_KEYS.map((k) => ({ val: k, label: CUSTOM_LABEL(lang)[k] }))}
                  isAr={isAr}
                />
                <FormField
                  label={t.tradeProfile} value={editForm.trade_link}
                  onChangeText={(v) => setF('trade_link', v)}
                  keyboardType="url" autoCapitalize="none" dirOverride="ltr"
                  placeholder="https://alibaba.com/..."
                />
                <FormField
                  label={t.exportMarketsLabel} hint={t.exportMarketsHint}
                  value={editForm.export_markets}
                  onChangeText={(v) => setF('export_markets', v)}
                  isAr={isAr}
                />
              </View>

              {/* ── CARD 6 — DESCRIPTION ── */}
              <View style={s.card}>
                <Text style={[s.cardTitle, isAr && s.rtl]}>{t.cardDescription}</Text>
                <FormField
                  label={t.descriptionLabel} hint={t.descriptionHint}
                  value={editForm.company_description}
                  onChangeText={(v) => setF('company_description', v)}
                  multiline isAr={isAr}
                />
              </View>

              {/* ── CARD 7 — CERTIFICATIONS ── */}
              <View style={s.card}>
                <Text style={[s.cardTitle, isAr && s.rtl]}>{t.cardCerts}</Text>
                <View style={{ gap: 10 }}>
                  {editCerts.map((cert) => (
                    <CertEditRow
                      key={cert._id}
                      cert={cert}
                      isAr={isAr}
                      lang={lang}
                      onChangeName={(v) => updateCert(cert._id, { name: v })}
                      onChangeIssuer={(v) => updateCert(cert._id, { issuer: v })}
                      onChangeValidUntil={(v) => updateCert(cert._id, { valid_until: v })}
                      onUpload={() => uploadCertFile(cert._id)}
                      onRemoveFile={() => removeCertFile(cert._id)}
                      onRemoveRow={() => removeCert(cert._id)}
                    />
                  ))}
                </View>
                <TouchableOpacity onPress={addCert} style={s.addCertBtn} activeOpacity={0.85}>
                  <Text style={[s.addCertText, { fontFamily: isAr ? F.arSemi : F.enSemi }]}>{t.addCert}</Text>
                </TouchableOpacity>
                <Text style={[s.fieldHint, isAr && s.rtl, { marginTop: 6 }]}>{t.certFileTypesHint}</Text>
              </View>

              {/* Save button */}
              <TouchableOpacity
                style={[s.saveBtn, saving && { opacity: 0.6 }]}
                onPress={saveSettings}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving
                  ? <ActivityIndicator color={C.btnPrimaryText} />
                  : <Text style={s.saveBtnText}>{t.saveChanges}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function InfoRow({ label, value, isAr }) {
  return (
    <View style={[s.infoRow, isAr && s.infoRowRtl]}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function StatTile({ label, value }) {
  return (
    <View style={s.statTile}>
      <Text style={s.statValue} numberOfLines={1}>{value}</Text>
      <Text style={s.statLabel} numberOfLines={2}>{label}</Text>
    </View>
  );
}

function FormField({ label, hint, required, isAr, dirOverride, multiline, ...inputProps }) {
  const dir = dirOverride || (isAr ? 'rtl' : 'ltr');
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[s.cardFieldLabel, isAr && s.rtl, { fontFamily: isAr ? F.ar : F.en }]}>
        {label}{required ? <Text style={s.required}>{' *'}</Text> : null}
      </Text>
      <TextInput
        style={[
          s.cardInput,
          multiline && s.cardInputMulti,
          { textAlign: dir === 'rtl' ? 'right' : 'left', writingDirection: dir, fontFamily: isAr ? F.ar : F.en },
        ]}
        placeholderTextColor={C.textDisabled}
        multiline={multiline}
        numberOfLines={multiline ? 5 : 1}
        {...inputProps}
      />
      {!!hint && (
        <Text style={[s.fieldHint, isAr && s.rtl, { fontFamily: isAr ? F.ar : F.en }]}>{hint}</Text>
      )}
    </View>
  );
}

function PickerField({ label, value, placeholder, options, onChange, isAr }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.val === value);
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[s.cardFieldLabel, isAr && s.rtl, { fontFamily: isAr ? F.ar : F.en }]}>{label}</Text>
      <TouchableOpacity
        style={[s.cardInput, s.pickerBtn, isAr && s.rowRtl]}
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.85}
      >
        <Text
          style={[
            s.pickerText,
            !selected && { color: C.textDisabled },
            { fontFamily: isAr ? F.ar : F.en, textAlign: isAr ? 'right' : 'left' },
          ]}
          numberOfLines={1}
        >
          {selected ? selected.label : placeholder}
        </Text>
        <Text style={[s.pickerCaret, { fontFamily: F.en }]}>{open ? '▴' : '▾'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={s.pickerList}>
          <ScrollView style={{ maxHeight: 280 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {options.map((o) => (
              <TouchableOpacity
                key={o.val}
                style={[s.pickerItem, value === o.val && s.pickerItemActive]}
                onPress={() => { onChange(o.val); setOpen(false); }}
              >
                <Text style={[
                  s.pickerItemText,
                  value === o.val && { color: C.textPrimary },
                  { fontFamily: isAr ? F.ar : F.en, textAlign: isAr ? 'right' : 'left' },
                ]}>
                  {o.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function CertEditRow({
  cert, isAr, lang,
  onChangeName, onChangeIssuer, onChangeValidUntil,
  onUpload, onRemoveFile, onRemoveRow,
}) {
  const t = COPY[lang] || COPY.en;
  return (
    <View style={s.certRowV2}>
      {/* Top row: cert name + × delete row */}
      <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, isAr && s.rowRtl]}>
        <TextInput
          style={[s.certNameInput, { flex: 1, fontFamily: isAr ? F.ar : F.en, textAlign: isAr ? 'right' : 'left' }]}
          placeholder={t.certName}
          placeholderTextColor={C.textDisabled}
          value={cert.name}
          onChangeText={onChangeName}
        />
        <TouchableOpacity
          onPress={onRemoveRow}
          style={s.certRowRemove}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[s.certRowRemoveText, { fontFamily: F.enBold }]}>×</Text>
        </TouchableOpacity>
      </View>

      {/* Issuer + valid_until — side-by-side on a second row */}
      <View style={[{ flexDirection: 'row', gap: 8, marginTop: 8 }, isAr && s.rowRtl]}>
        <TextInput
          style={[s.certSubInput, { flex: 1, fontFamily: isAr ? F.ar : F.en, textAlign: isAr ? 'right' : 'left' }]}
          placeholder={t.certIssuer}
          placeholderTextColor={C.textDisabled}
          value={cert.issuer || ''}
          onChangeText={onChangeIssuer}
        />
        <TextInput
          style={[s.certSubInput, { flex: 1, fontFamily: F.en, textAlign: 'left' }]}
          placeholder={t.certValidUntil}
          placeholderTextColor={C.textDisabled}
          value={cert.valid_until || ''}
          onChangeText={onChangeValidUntil}
        />
      </View>

      {/* File upload control / pill */}
      <View style={{ marginTop: 10 }}>
        {cert.uploading ? (
          <Text style={[s.certStatus, { fontFamily: isAr ? F.ar : F.en }]}>{t.uploadingLabel}</Text>
        ) : cert.file_url ? (
          <View style={[s.certPill, isAr && s.rowRtl, { alignSelf: 'flex-start' }]}>
            <Text style={[s.certPillCheck, { fontFamily: F.enBold }]}>✓</Text>
            <Text style={[s.certPillText, { fontFamily: isAr ? F.arSemi : F.enSemi }]}>{t.uploadedLabel}</Text>
            <TouchableOpacity onPress={onRemoveFile} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Text style={[s.certPillRemove, { fontFamily: F.enBold }]}>×</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={onUpload}
            style={[s.certUploadBtn, { alignSelf: 'flex-start' }]}
            activeOpacity={0.85}
          >
            <Text style={[s.certUploadText, { fontFamily: isAr ? F.ar : F.en }]}>{t.uploadFile}</Text>
          </TouchableOpacity>
        )}
      </View>

      {!!cert.error && (
        <Text style={[s.certError, { fontFamily: isAr ? F.ar : F.en, marginTop: 6 }]}>
          {cert.error}
        </Text>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bgBase },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 24, paddingBottom: 60 },
  rtl: { textAlign: 'right', writingDirection: 'rtl' },
  rowRtl: { flexDirection: 'row-reverse' },

  // Profile header (dashboard view)
  profileHeader: { alignItems: 'center', marginBottom: 24, paddingTop: 8 },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: C.bgRaised, alignItems: 'center', justifyContent: 'center',
    marginBottom: 12, borderWidth: 1, borderColor: C.borderDefault, overflow: 'hidden',
  },
  avatarText: { color: C.textSecondary, fontSize: 28, fontFamily: F.enBold },
  companyName: { color: C.textPrimary, fontSize: 20, fontFamily: F.arSemi, marginBottom: 4 },
  supplierId: { color: C.textDisabled, fontSize: 11, fontFamily: F.en, marginBottom: 10 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, borderWidth: 1 },
  statusText: { fontSize: 13, fontFamily: F.arSemi },

  editProfileBtn: {
    marginTop: 14, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 7,
    borderWidth: 1, borderColor: C.borderStrong, backgroundColor: C.bgOverlay,
  },
  editProfileText: { color: C.textPrimary, fontSize: 13, fontFamily: F.arSemi },

  verifyBanner: {
    backgroundColor: C.bgRaised, borderRadius: 16, padding: 18, marginBottom: 20,
    borderWidth: 1, borderColor: C.borderDefault, alignItems: 'center',
  },
  verifyBannerTitle: { color: C.textPrimary, fontSize: 15, fontFamily: F.arSemi, marginBottom: 4 },
  verifyBannerSub: { color: C.textSecondary, fontSize: 13, fontFamily: F.ar, textAlign: 'center' },

  blockHeader: {
    color: C.textTertiary, fontSize: 11, fontFamily: F.arSemi,
    letterSpacing: 0.5, marginBottom: 10, marginTop: 4,
  },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  statTile: {
    flexBasis: '48%', flexGrow: 1, backgroundColor: C.bgRaised, borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 14, borderWidth: 1, borderColor: C.borderDefault,
  },
  statValue: { color: C.textPrimary, fontSize: 22, fontFamily: F.enBold, lineHeight: 26, marginBottom: 4 },
  statLabel: { color: C.textSecondary, fontSize: 11, fontFamily: F.ar },
  quickActions: { gap: 8, marginBottom: 20 },
  qaBtn: {
    backgroundColor: C.bgRaised, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16,
    borderWidth: 1, borderColor: C.borderDefault, alignItems: 'center',
  },
  qaBtnPrimary: { backgroundColor: C.btnPrimary, borderColor: C.btnPrimary },
  qaText: { color: C.textPrimary, fontSize: 14, fontFamily: F.arSemi },
  qaTextPrimary: { color: C.btnPrimaryText },

  section: {
    backgroundColor: C.bgRaised, borderRadius: 16, borderWidth: 1, borderColor: C.borderDefault,
    marginBottom: 16, overflow: 'hidden',
  },
  sectionTitle: {
    color: C.textTertiary, fontSize: 11, fontFamily: F.arSemi,
    padding: 14, paddingBottom: 8, letterSpacing: 0.5,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },
  infoRowRtl: { flexDirection: 'row-reverse' },
  infoLabel: { color: C.textSecondary, fontSize: 14, fontFamily: F.ar },
  infoValue: { color: C.textPrimary, fontSize: 14, fontFamily: F.en, maxWidth: '60%' },

  signOutBtn: {
    backgroundColor: C.redSoft, borderRadius: 16, paddingVertical: 15,
    alignItems: 'center', borderWidth: 1, borderColor: C.red + '40', marginTop: 8,
  },
  signOutText: { color: C.red, fontFamily: F.arSemi, fontSize: 16 },

  // Modal frame
  modalScroll: { padding: 20, paddingBottom: 80 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
    backgroundColor: C.bgBase,
  },
  modalTitle: { color: C.textPrimary, fontSize: 17, fontFamily: F.arSemi },
  modalClose: { color: C.textSecondary, fontSize: 15, fontFamily: F.ar },

  // Card
  card: {
    backgroundColor: C.bgRaised, borderRadius: 16,
    padding: 18, marginBottom: 14,
    borderWidth: 1, borderColor: C.borderDefault,
  },
  cardTitle: {
    color: C.textTertiary, fontSize: 11, fontFamily: F.arSemi,
    letterSpacing: 1, marginBottom: 16, textTransform: 'uppercase',
  },
  cardFieldLabel: { color: C.textSecondary, fontSize: 12, fontFamily: F.ar, marginBottom: 6 },
  required: { color: C.red, fontSize: 12 },
  cardInput: {
    backgroundColor: C.bgBase, borderRadius: 10,
    borderWidth: 1, borderColor: C.borderMuted,
    paddingHorizontal: 14, paddingVertical: 11,
    color: C.textPrimary, fontSize: 14,
  },
  cardInputMulti: { minHeight: 110, textAlignVertical: 'top' },
  fieldHint: { color: C.textDisabled, fontSize: 11, marginTop: 4 },

  // Avatar (in card)
  avatarRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  avatarPreview: {
    width: 64, height: 64, borderRadius: 12,
    backgroundColor: C.bgBase,
    borderWidth: 1, borderColor: C.borderMuted,
    overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarPreviewText: { color: C.textDisabled, fontSize: 11 },
  smallBtn: {
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 10, borderWidth: 1, borderColor: C.borderDefault,
    backgroundColor: C.bgBase,
  },
  smallBtnText: { color: C.textSecondary, fontSize: 12, fontFamily: F.ar },

  // Factory images
  factoryHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8,
  },
  factoryCount: { color: C.textDisabled, fontSize: 11, fontFamily: F.en },
  factoryGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  },
  factoryThumb: {
    width: '31%', aspectRatio: 1,
    backgroundColor: C.bgBase, borderRadius: 10,
    borderWidth: 1, borderColor: C.borderMuted,
    overflow: 'hidden', position: 'relative',
  },
  factoryRemove: {
    position: 'absolute', top: 4, right: 4,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  factoryRemoveText: { color: '#fff', fontSize: 14, lineHeight: 14 },
  factoryAdd: {
    width: '31%', aspectRatio: 1, borderRadius: 10,
    borderWidth: 1, borderColor: C.borderMuted, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  factoryAddText: { color: C.textSecondary, fontSize: 12, fontFamily: F.ar },

  // Picker
  pickerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerText: { color: C.textPrimary, fontSize: 14, flex: 1 },
  pickerCaret: { color: C.textSecondary, fontSize: 12, marginInlineStart: 10 },
  pickerList: {
    backgroundColor: C.bgBase, borderRadius: 10,
    borderWidth: 1, borderColor: C.borderMuted,
    marginTop: 6, overflow: 'hidden',
  },
  pickerItem: {
    paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },
  pickerItemActive: { backgroundColor: C.bgHover },
  pickerItemText: { color: C.textSecondary, fontSize: 13 },

  // Pill row (currency)
  pillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  pill: {
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 999, borderWidth: 1, borderColor: C.borderDefault,
    backgroundColor: C.bgBase, minWidth: 60, alignItems: 'center',
  },
  pillActive: { backgroundColor: C.btnPrimary, borderColor: C.btnPrimary },
  pillText: { color: C.textSecondary, fontSize: 13, letterSpacing: 0.4 },
  pillTextActive: { color: C.btnPrimaryText },

  // Cert row
  certRow: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8,
    backgroundColor: C.bgBase, borderRadius: 10,
    borderWidth: 1, borderColor: C.borderSubtle,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  // V2 row stacks vertically: name+×, then issuer+valid_until, then file
  // upload — keeps the inputs readable on narrow phone screens.
  certRowV2: {
    backgroundColor: C.bgBase, borderRadius: 10,
    borderWidth: 1, borderColor: C.borderSubtle,
    paddingHorizontal: 12, paddingVertical: 12,
  },
  certNameInput: {
    flex: 1, minWidth: 130,
    color: C.textPrimary, fontSize: 14,
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },
  certSubInput: {
    color: C.textPrimary, fontSize: 13,
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },
  certStatus: { color: C.textSecondary, fontSize: 11, paddingHorizontal: 8 },
  certUploadBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: C.borderDefault,
    backgroundColor: C.bgRaised,
  },
  certUploadText: { color: C.textSecondary, fontSize: 12 },
  certPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999, backgroundColor: C.greenSoft,
    borderWidth: 1, borderColor: 'rgba(0,100,0,0.22)',
  },
  certPillCheck: { color: C.green, fontSize: 11 },
  certPillText: { color: C.green, fontSize: 11 },
  certPillRemove: { color: C.green, fontSize: 14, lineHeight: 14 },
  certRowRemove: { paddingHorizontal: 4 },
  certRowRemoveText: { color: C.textDisabled, fontSize: 18, lineHeight: 18 },
  certError: { flexBasis: '100%', color: C.red, fontSize: 11, marginTop: 4 },

  addCertBtn: {
    alignSelf: 'flex-start', marginTop: 12,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 8, borderWidth: 1,
    borderColor: C.borderSubtle, borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  addCertText: { color: C.textSecondary, fontSize: 12 },

  // Save button
  saveBtn: {
    backgroundColor: C.btnPrimary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
    marginTop: 12, marginBottom: 20,
  },
  saveBtnText: { color: C.btnPrimaryText, fontFamily: F.arSemi, fontSize: 16 },
});
