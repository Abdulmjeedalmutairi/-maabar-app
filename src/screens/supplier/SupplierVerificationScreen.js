// SupplierVerificationScreen — 3-step supplier verification flow.
//
// Mirrors the web verification flow (web/src/pages/DashboardSupplier.jsx:4319-4738):
//   Step 1 — Company Profile (10 fields, persisted to public.profiles)
//   Step 2 — Documents (3 single-file uploads + factory images + factory video,
//            all routed to the private `supplier-docs` bucket; field text fields
//            persisted alongside)
//   Step 3 — Review & Submit (read-only summary → submit_supplier_verification RPC)
//
// File-upload contract matches web exactly (see DashboardSupplier.jsx:819-853):
//   path = `${user.id}/${type}_${timestamp}_${random}.${ext}`
//   bucket = 'supplier-docs' (private; RLS pins first folder segment to auth.uid())
//   Stored as a relative path string in the corresponding profiles column.
//   Buyers do NOT see these files — only the supplier (via signed URL) and admin.
//
// Submit calls supabase.rpc('submit_supplier_verification') — same name the web
// uses; spec said _flow suffix but no such function exists in the migrations.

import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView,
  Platform, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { getLang } from '../../lib/lang';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';
import { getSpecialtyLabel } from '../../lib/specialtyLabel';

// ─── Constants ───────────────────────────────────────────────────────────────
const FACTORY_IMAGE_LIMIT = 5;
const VIDEO_MAX_BYTES = 50 * 1024 * 1024; // 50 MB
const ACCEPTED_DOC_MIMES = ['application/pdf', 'image/*'];

// 24-category list — same set as web/src/lib/supplierDashboardConstants.js
// Just the keys here; getSpecialtyLabel handles the localization.
const SPECIALTY_KEYS = [
  'electronics', 'home_appliances', 'furniture', 'office_furniture',
  'bedroom_furniture', 'kitchen_furniture', 'outdoor_furniture', 'home_decor',
  'clothing', 'building', 'food', 'beauty', 'sports', 'toys', 'auto_parts',
  'car_accessories', 'tires', 'lubricants', 'health', 'packaging', 'gifts',
  'agriculture', 'other',
];

const BUSINESS_TYPE_KEYS = ['manufacturer', 'wholesaler', 'trading', 'other'];

// ─── i18n ────────────────────────────────────────────────────────────────────
const T = {
  ar: {
    title: 'طلب التحقق',
    exitConfirmTitle: 'الخروج من التحقق؟',
    exitConfirmBody: 'سيتم الاحتفاظ بما حفظته من بيانات. يمكنك العودة لاحقاً لإكمال الطلب.',
    exitConfirmCancel: 'البقاء',
    exitConfirmAction: 'خروج',
    stepLabel: (n) => `خطوة ${n} من 3`,
    stepProfile: 'بيانات الشركة',
    stepDocuments: 'المستندات',
    stepReview: 'المراجعة',

    // Step 1
    s1Title: 'بيانات الشركة الأساسية',
    s1Sub: 'هذه المعلومات تُعرض للمشترين السعوديين بعد التوثيق.',
    companyName: 'اسم الشركة',
    city: 'المدينة',
    country: 'الدولة',
    specialty: 'التخصص',
    businessType: 'نوع النشاط',
    wechat: 'WeChat',
    whatsapp: 'واتساب',
    tradeLink: 'رابط الصفحة التجارية',
    tradeLinkHint: 'مثال: alibaba.com/...',
    companyWebsite: 'موقع الشركة',
    companyDescription: 'وصف الشركة',
    companyDescriptionHint: 'يمكنك الكتابة بأي لغة',
    bizManufacturer: 'مصنّع',
    bizWholesaler: 'تاجر جملة',
    bizTrading: 'شركة تجارية',
    bizOther: 'أخرى',
    bizPickerPlaceholder: 'اختر نوع النشاط',
    specialtyPickerPlaceholder: 'اختر التخصص',

    // Step 2
    s2Title: 'مستندات التحقق',
    s2Sub: 'الملفات تُحفظ بشكل خاص — يطّلع عليها فريق مَعبر فقط.',
    regNumber: 'رقم تسجيل الشركة',
    yearsExp: 'سنوات الخبرة',
    numEmployees: 'عدد الموظفين',
    numEmployeesHint: 'اختياري',
    docsHeader: 'المستندات',
    license: 'رخصة الأعمال أو هوية المنشأة',
    legalRepId: 'هوية الممثل القانوني',
    addressProof: 'إثبات عنوان المصنع أو المكتب',
    factoryPhotos: 'صور المصنع أو المستودع',
    factoryPhotosHint: (count, max) => `${count}/${max} · حتى ${max} صور`,
    factoryVideo: 'فيديو المصنع',
    factoryVideoHint: 'جولة في المصنع · MP4 · حتى 50MB',
    addImage: '+ إضافة صورة',
    uploadFile: 'رفع الملف',
    uploadVideo: 'رفع الفيديو',
    fileTypesHint: 'PDF أو صورة · حتى 10MB',
    uploading: 'جاري الرفع...',
    uploaded: 'تم الرفع',
    view: 'عرض',
    replace: 'استبدال',
    remove: 'حذف',
    privacyNote: 'ملفاتك محفوظة بشكل خاص ولن تُشارك علنياً. البيانات البنكية تُجمع بعد القبول.',

    // Step 3
    s3Title: 'مراجعة نهائية',
    s3Sub: 'تأكد من صحة بياناتك قبل الإرسال. سيراجع فريق مَعبر الطلب خلال 3-5 أيام عمل.',
    reviewCompany: 'الشركة',
    reviewLocation: 'الموقع',
    reviewSpecialty: 'التخصص',
    reviewWeChat: 'WeChat',
    reviewTradeLink: 'الرابط التجاري',

    // Buttons / status
    next: 'التالي ←',
    back: 'رجوع',
    submit: 'إرسال للمراجعة',
    submitting: 'جاري الإرسال...',
    saving: 'جاري الحفظ...',

    // Validation
    fillRequiredS1: 'يرجى إكمال الحقول المطلوبة في بيانات الشركة.',
    fillRequiredS2: 'يرجى إكمال البيانات والمستندات المطلوبة.',
    videoTooLarge: 'حجم الفيديو يجب أن يكون أقل من 50MB.',
    permissionDenied: 'يرجى السماح بالوصول للصور لإكمال الرفع.',
    uploadFailed: 'فشل رفع الملف. حاول مرة أخرى.',
    saveFailed: 'حدث خطأ أثناء الحفظ. حاول مرة أخرى.',
    submitFailed: 'تعذر إرسال الطلب. حاول مرة أخرى.',

    // Success
    submitSuccessTitle: 'تم إرسال طلب التحقق ✓',
    submitSuccessBody: 'سيراجعه فريق مَعبر خلال 3-5 أيام عمل.',
    submitSuccessAction: 'العودة للحساب',
  },
  en: {
    title: 'Verification Request',
    exitConfirmTitle: 'Exit verification?',
    exitConfirmBody: 'Your saved progress will be kept. You can come back later to finish.',
    exitConfirmCancel: 'Stay',
    exitConfirmAction: 'Exit',
    stepLabel: (n) => `Step ${n} of 3`,
    stepProfile: 'Profile',
    stepDocuments: 'Documents',
    stepReview: 'Review',

    s1Title: 'Company Profile',
    s1Sub: 'This information is shown to Saudi buyers after verification.',
    companyName: 'Company Name',
    city: 'City',
    country: 'Country',
    specialty: 'Specialty',
    businessType: 'Business Type',
    wechat: 'WeChat',
    whatsapp: 'WhatsApp',
    tradeLink: 'Trade Profile Link',
    tradeLinkHint: 'e.g. alibaba.com/...',
    companyWebsite: 'Company Website',
    companyDescription: 'Company Description',
    companyDescriptionHint: 'You can write in any language',
    bizManufacturer: 'Manufacturer',
    bizWholesaler: 'Wholesaler',
    bizTrading: 'Trading Company',
    bizOther: 'Other',
    bizPickerPlaceholder: 'Select business type',
    specialtyPickerPlaceholder: 'Select specialty',

    s2Title: 'Verification Documents',
    s2Sub: 'Files are stored privately — only the Maabar team can review them.',
    regNumber: 'Company Registration Number',
    yearsExp: 'Years of Experience',
    numEmployees: 'Number of Employees',
    numEmployeesHint: 'Optional',
    docsHeader: 'Documents',
    license: 'Business License or Company ID',
    legalRepId: 'Legal Representative ID',
    addressProof: 'Factory or Office Address Proof',
    factoryPhotos: 'Factory or Warehouse Photos',
    factoryPhotosHint: (count, max) => `${count}/${max} · up to ${max} photos`,
    factoryVideo: 'Factory Video',
    factoryVideoHint: 'Factory tour · MP4 · max 50MB',
    addImage: '+ Add image',
    uploadFile: 'Upload file',
    uploadVideo: 'Upload video',
    fileTypesHint: 'PDF or image · up to 10MB',
    uploading: 'Uploading...',
    uploaded: 'Uploaded',
    view: 'View',
    replace: 'Replace',
    remove: 'Remove',
    privacyNote: 'Your files are stored privately and not publicly accessible. Bank details are collected after approval.',

    s3Title: 'Final Review',
    s3Sub: 'Confirm your details before submitting. The Maabar team will review within 3-5 business days.',
    reviewCompany: 'Company',
    reviewLocation: 'Location',
    reviewSpecialty: 'Specialty',
    reviewWeChat: 'WeChat',
    reviewTradeLink: 'Trade link',

    next: 'Next →',
    back: 'Back',
    submit: 'Submit for Review',
    submitting: 'Submitting...',
    saving: 'Saving...',

    fillRequiredS1: 'Please complete the required Company Profile fields.',
    fillRequiredS2: 'Please complete the required fields and uploads.',
    videoTooLarge: 'Video must be smaller than 50MB.',
    permissionDenied: 'Please allow photo library access to upload.',
    uploadFailed: 'Upload failed. Please try again.',
    saveFailed: 'Failed to save. Please try again.',
    submitFailed: 'Submission failed. Please try again.',

    submitSuccessTitle: 'Verification request submitted ✓',
    submitSuccessBody: 'The Maabar team will review it within 3-5 business days.',
    submitSuccessAction: 'Back to Account',
  },
  zh: {
    title: '认证申请',
    exitConfirmTitle: '退出认证？',
    exitConfirmBody: '已保存的进度会保留。您稍后可以回来继续填写。',
    exitConfirmCancel: '继续填写',
    exitConfirmAction: '退出',
    stepLabel: (n) => `第 ${n} 步 / 共 3 步`,
    stepProfile: '公司资料',
    stepDocuments: '文件',
    stepReview: '确认',

    s1Title: '公司基本资料',
    s1Sub: '此信息将在通过认证后展示给沙特买家。',
    companyName: '公司名称',
    city: '城市',
    country: '国家',
    specialty: '专业领域',
    businessType: '企业类型',
    wechat: 'WeChat',
    whatsapp: 'WhatsApp',
    tradeLink: '贸易页面链接',
    tradeLinkHint: '例如：alibaba.com/...',
    companyWebsite: '公司官网',
    companyDescription: '公司介绍',
    companyDescriptionHint: '可使用任意语言填写',
    bizManufacturer: '制造商',
    bizWholesaler: '批发商',
    bizTrading: '贸易公司',
    bizOther: '其他',
    bizPickerPlaceholder: '请选择企业类型',
    specialtyPickerPlaceholder: '请选择专业领域',

    s2Title: '认证文件',
    s2Sub: '文件以私密方式保存 — 仅 Maabar 团队可查看。',
    regNumber: '公司注册号',
    yearsExp: '从业年限',
    numEmployees: '员工人数',
    numEmployeesHint: '可选',
    docsHeader: '文件',
    license: '营业执照或企业证明',
    legalRepId: '法定代表人身份证',
    addressProof: '工厂或办公室地址证明',
    factoryPhotos: '工厂或仓库照片',
    factoryPhotosHint: (count, max) => `${count}/${max} · 最多 ${max} 张`,
    factoryVideo: '工厂视频',
    factoryVideoHint: '工厂参观视频 · MP4 · 最大 50MB',
    addImage: '+ 添加图片',
    uploadFile: '上传文件',
    uploadVideo: '上传视频',
    fileTypesHint: 'PDF 或图片 · 最大 10MB',
    uploading: '上传中...',
    uploaded: '已上传',
    view: '查看',
    replace: '更换',
    remove: '删除',
    privacyNote: '您的文件以私密方式保存，不会公开。银行信息在批准后再收集。',

    s3Title: '最终确认',
    s3Sub: '请确认信息无误后提交。Maabar 团队将在 3-5 个工作日内完成审核。',
    reviewCompany: '公司',
    reviewLocation: '所在地',
    reviewSpecialty: '专业领域',
    reviewWeChat: 'WeChat',
    reviewTradeLink: '贸易链接',

    next: '下一步 →',
    back: '返回',
    submit: '提交审核',
    submitting: '提交中...',
    saving: '保存中...',

    fillRequiredS1: '请完成公司资料的必填项。',
    fillRequiredS2: '请完成必填项并上传所需文件。',
    videoTooLarge: '视频文件必须小于 50MB。',
    permissionDenied: '请允许访问图库以完成上传。',
    uploadFailed: '上传失败，请重试。',
    saveFailed: '保存失败，请重试。',
    submitFailed: '提交失败，请重试。',

    submitSuccessTitle: '认证申请已提交 ✓',
    submitSuccessBody: 'Maabar 团队将在 3-5 个工作日内审核。',
    submitSuccessAction: '返回账户',
  },
};

const tx = (key, lang, ...args) => {
  const v = T[lang]?.[key] ?? T.en[key] ?? key;
  return typeof v === 'function' ? v(...args) : v;
};

const BIZ_LABELS = {
  ar: { manufacturer: 'مصنّع', wholesaler: 'تاجر جملة', trading: 'شركة تجارية', other: 'أخرى' },
  en: { manufacturer: 'Manufacturer', wholesaler: 'Wholesaler', trading: 'Trading Company', other: 'Other' },
  zh: { manufacturer: '制造商', wholesaler: '批发商', trading: '贸易公司', other: '其他' },
};

// ─── Storage helpers ─────────────────────────────────────────────────────────
async function uploadToSupplierDocs({ uri, mimeType, name, userId, type }) {
  // Match web path convention: <user.id>/<type>_<ts>_<rand>.<ext>
  const fallbackExt = (mimeType && mimeType.includes('pdf')) ? 'pdf' : 'jpg';
  const fromName = (name || uri).split('.').pop();
  const ext = (fromName && fromName.length <= 5 ? fromName : fallbackExt).toLowerCase();
  const path = `${userId}/${type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const arrayBuffer = await fetch(uri).then((r) => r.arrayBuffer());
  const { error } = await supabase.storage
    .from('supplier-docs')
    .upload(path, arrayBuffer, {
      contentType: mimeType || (ext === 'pdf' ? 'application/pdf' : 'image/jpeg'),
      upsert: true,
    });
  if (error) throw error;
  return path;
}

async function viewSupplierDoc(path) {
  if (!path) return;
  const { data, error } = await supabase.storage
    .from('supplier-docs')
    .createSignedUrl(path, 600);
  if (error || !data?.signedUrl) return;
  Linking.openURL(data.signedUrl);
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function SupplierVerificationScreen({ navigation }) {
  const lang = getLang();
  const isAr = lang === 'ar';
  const t = (k, ...a) => tx(k, lang, ...a);

  const [step, setStep] = useState(1);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingS1, setSavingS1] = useState(false);
  const [savingS2, setSavingS2] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  // Step 1
  const [s1, setS1] = useState({
    company_name: '', city: '', country: '', speciality: '', business_type: '',
    wechat: '', whatsapp: '', trade_link: '', company_website: '', company_description: '',
  });

  // Step 2 — text fields
  const [s2, setS2] = useState({
    reg_number: '', years_experience: '', num_employees: '',
  });

  // Step 2 — uploads
  const [licensePath, setLicensePath] = useState('');
  const [legalRepPath, setLegalRepPath] = useState('');
  const [addressProofPath, setAddressProofPath] = useState('');
  const [factoryImages, setFactoryImages] = useState([]);
  const [factoryVideo, setFactoryVideo] = useState('');
  const [uploading, setUploading] = useState({}); // { license, legal_rep_id, address_proof, images, video }

  // ── Initial load: hydrate state from existing profile row ────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (cancelled || !data) { setLoading(false); return; }
      setS1({
        company_name: data.company_name || '',
        city: data.city || '',
        country: data.country || '',
        speciality: data.speciality || '',
        business_type: data.business_type || '',
        wechat: data.wechat || '',
        whatsapp: data.whatsapp || '',
        trade_link: data.trade_link || '',
        company_website: data.company_website || '',
        company_description: data.company_description || '',
      });
      setS2({
        reg_number: data.reg_number || '',
        years_experience: data.years_experience != null ? String(data.years_experience) : '',
        num_employees: data.num_employees != null ? String(data.num_employees) : '',
      });
      setLicensePath(data.license_photo || '');
      setLegalRepPath(data.legal_rep_id_photo || '');
      setAddressProofPath(data.address_proof_photo || '');
      setFactoryImages(Array.isArray(data.factory_images) ? data.factory_images : []);
      setFactoryVideo(Array.isArray(data.factory_videos) && data.factory_videos[0] ? data.factory_videos[0] : '');
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Step 1 validation + save ─────────────────────────────────────────────
  const s1Valid = useMemo(() => (
    s1.company_name.trim() && s1.city.trim() && s1.country.trim()
    && s1.speciality.trim() && s1.wechat.trim() && s1.trade_link.trim()
  ), [s1]);

  async function saveStep1AndAdvance() {
    if (!s1Valid) { setError(t('fillRequiredS1')); return; }
    setError('');
    setSavingS1(true);
    const { error: err } = await supabase.from('profiles').update({
      company_name: s1.company_name.trim(),
      city: s1.city.trim(),
      country: s1.country.trim(),
      speciality: s1.speciality,
      business_type: s1.business_type || null,
      wechat: s1.wechat.trim(),
      whatsapp: s1.whatsapp.trim() || null,
      trade_link: s1.trade_link.trim(),
      company_website: s1.company_website.trim() || null,
      company_description: s1.company_description.trim() || null,
    }).eq('id', userId);
    setSavingS1(false);
    if (err) { setError(t('saveFailed')); return; }
    setStep(2);
  }

  // ── Step 2 file handlers ─────────────────────────────────────────────────
  async function pickAndUploadDoc(type, columnName, setter) {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ACCEPTED_DOC_MIMES,
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setUploading((u) => ({ ...u, [type]: true }));
      setError('');
      const path = await uploadToSupplierDocs({
        uri: asset.uri, mimeType: asset.mimeType, name: asset.name, userId, type,
      });
      await supabase.from('profiles').update({ [columnName]: path }).eq('id', userId);
      setter(path);
    } catch (e) {
      console.error('[verification] upload error:', e?.message || e);
      setError(t('uploadFailed'));
    } finally {
      setUploading((u) => ({ ...u, [type]: false }));
    }
  }

  async function pickAndUploadFactoryImages() {
    const remaining = FACTORY_IMAGE_LIMIT - factoryImages.length;
    if (remaining <= 0) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') { Alert.alert('', t('permissionDenied')); return; }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.85,
      });
      if (result.canceled || !result.assets?.length) return;
      setUploading((u) => ({ ...u, images: true }));
      setError('');
      const next = [...factoryImages];
      for (const asset of result.assets.slice(0, remaining)) {
        try {
          const path = await uploadToSupplierDocs({
            uri: asset.uri,
            mimeType: asset.mimeType || 'image/jpeg',
            name: asset.fileName || asset.uri,
            userId,
            type: 'verification_image',
          });
          next.push(path);
        } catch (e) {
          console.error('[verification] image upload error:', e?.message || e);
        }
      }
      await supabase.from('profiles').update({ factory_images: next }).eq('id', userId);
      setFactoryImages(next);
    } catch (e) {
      setError(t('uploadFailed'));
    } finally {
      setUploading((u) => ({ ...u, images: false }));
    }
  }

  async function removeFactoryImage(path) {
    const next = factoryImages.filter((p) => p !== path);
    await supabase.from('profiles').update({ factory_images: next }).eq('id', userId);
    setFactoryImages(next);
  }

  async function pickAndUploadVideo() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') { Alert.alert('', t('permissionDenied')); return; }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        videoMaxDuration: 90,
        quality: 0.85,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > VIDEO_MAX_BYTES) {
        Alert.alert('', t('videoTooLarge'));
        return;
      }
      setUploading((u) => ({ ...u, video: true }));
      setError('');
      const path = await uploadToSupplierDocs({
        uri: asset.uri,
        mimeType: asset.mimeType || 'video/mp4',
        name: asset.fileName || asset.uri,
        userId,
        type: 'verification_video',
      });
      await supabase.from('profiles').update({ factory_videos: [path] }).eq('id', userId);
      setFactoryVideo(path);
    } catch (e) {
      console.error('[verification] video upload error:', e?.message || e);
      setError(t('uploadFailed'));
    } finally {
      setUploading((u) => ({ ...u, video: false }));
    }
  }

  async function removeVideo() {
    await supabase.from('profiles').update({ factory_videos: [] }).eq('id', userId);
    setFactoryVideo('');
  }

  // ── Step 2 validation + advance ──────────────────────────────────────────
  const s2Valid = useMemo(() => (
    s2.reg_number.trim()
    && s2.years_experience.trim()
    && licensePath
    && legalRepPath
    && addressProofPath
    && factoryImages.length > 0
    && factoryVideo
  ), [s2, licensePath, legalRepPath, addressProofPath, factoryImages, factoryVideo]);

  async function saveStep2AndAdvance() {
    if (!s2Valid) { setError(t('fillRequiredS2')); return; }
    setError('');
    setSavingS2(true);
    const yearsNum = parseInt(s2.years_experience, 10);
    const empNum = s2.num_employees ? parseInt(s2.num_employees, 10) : null;
    const { error: err } = await supabase.from('profiles').update({
      reg_number: s2.reg_number.trim(),
      years_experience: Number.isFinite(yearsNum) ? yearsNum : null,
      num_employees: Number.isFinite(empNum) ? empNum : null,
    }).eq('id', userId);
    setSavingS2(false);
    if (err) { setError(t('saveFailed')); return; }
    setStep(3);
  }

  // ── Step 3 final submit ──────────────────────────────────────────────────
  async function submitForReview() {
    setSubmitting(true);
    setError('');
    const { error: err } = await supabase.rpc('submit_supplier_verification');
    setSubmitting(false);
    if (err) {
      console.error('[verification] submit error:', err?.message || err);
      setError(t('submitFailed'));
      return;
    }
    setSubmitted(true);
  }

  // ── Exit confirmation ────────────────────────────────────────────────────
  function confirmExit() {
    Alert.alert(t('exitConfirmTitle'), t('exitConfirmBody'), [
      { text: t('exitConfirmCancel'), style: 'cancel' },
      { text: t('exitConfirmAction'), style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}><ActivityIndicator color={C.textSecondary} size="large" /></View>
      </SafeAreaView>
    );
  }

  if (submitted) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.successWrap}>
          <Text style={[s.successTitle, isAr && s.rtl, { fontFamily: isAr ? F.arBold : F.enBold }]}>
            {t('submitSuccessTitle')}
          </Text>
          <Text style={[s.successBody, isAr && s.rtl, { fontFamily: isAr ? F.ar : F.en }]}>
            {t('submitSuccessBody')}
          </Text>
          <TouchableOpacity
            style={s.primaryBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
          >
            <Text style={s.primaryBtnText}>{t('submitSuccessAction')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top bar */}
        <View style={[s.topBar, isAr && s.rowRtl]}>
          <TouchableOpacity onPress={confirmExit} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={[s.topBarBack, { fontFamily: isAr ? F.ar : F.en }]}>
              {isAr ? '✕' : '✕'}
            </Text>
          </TouchableOpacity>
          <Text style={[s.topBarTitle, { fontFamily: isAr ? F.arSemi : F.enSemi }]}>
            {t('title')}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Step indicator */}
        <StepIndicator step={step} lang={lang} />

        <ScrollView
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ─── STEP 1 ─── */}
          {step === 1 && (
            <View>
              <Text style={[s.sectionTitle, isAr && s.rtl, { fontFamily: isAr ? F.arBold : F.enBold }]}>
                {t('s1Title')}
              </Text>
              <Text style={[s.sectionSub, isAr && s.rtl, { fontFamily: isAr ? F.ar : F.en }]}>
                {t('s1Sub')}
              </Text>

              <LField
                label={t('companyName')} required value={s1.company_name}
                onChangeText={(v) => setS1((f) => ({ ...f, company_name: v }))} isAr={isAr}
              />
              <LField
                label={t('city')} required value={s1.city}
                onChangeText={(v) => setS1((f) => ({ ...f, city: v }))} isAr={isAr}
              />
              <LField
                label={t('country')} required value={s1.country}
                onChangeText={(v) => setS1((f) => ({ ...f, country: v }))} isAr={isAr}
              />
              <PickerField
                label={t('specialty')} required value={s1.speciality}
                placeholder={t('specialtyPickerPlaceholder')}
                options={SPECIALTY_KEYS.map((k) => ({ val: k, label: getSpecialtyLabel(k, lang) }))}
                onChange={(v) => setS1((f) => ({ ...f, speciality: v }))} isAr={isAr} lang={lang}
              />
              <PickerField
                label={t('businessType')} value={s1.business_type}
                placeholder={t('bizPickerPlaceholder')}
                options={BUSINESS_TYPE_KEYS.map((k) => ({ val: k, label: BIZ_LABELS[lang]?.[k] || BIZ_LABELS.en[k] }))}
                onChange={(v) => setS1((f) => ({ ...f, business_type: v }))} isAr={isAr} lang={lang}
              />
              <LField
                label={t('wechat')} required value={s1.wechat}
                onChangeText={(v) => setS1((f) => ({ ...f, wechat: v }))} dirOverride="ltr"
              />
              <LField
                label={t('whatsapp')} value={s1.whatsapp}
                onChangeText={(v) => setS1((f) => ({ ...f, whatsapp: v }))}
                keyboardType="phone-pad" dirOverride="ltr"
                placeholder="+86..."
              />
              <LField
                label={t('tradeLink')} required value={s1.trade_link}
                onChangeText={(v) => setS1((f) => ({ ...f, trade_link: v }))}
                keyboardType="url" autoCapitalize="none" dirOverride="ltr"
                placeholder={t('tradeLinkHint')}
              />
              <LField
                label={t('companyWebsite')} value={s1.company_website}
                onChangeText={(v) => setS1((f) => ({ ...f, company_website: v }))}
                keyboardType="url" autoCapitalize="none" dirOverride="ltr"
                placeholder="https://..."
              />
              <LField
                label={t('companyDescription')} value={s1.company_description}
                onChangeText={(v) => setS1((f) => ({ ...f, company_description: v }))}
                multiline isAr={isAr} hint={t('companyDescriptionHint')}
              />
            </View>
          )}

          {/* ─── STEP 2 ─── */}
          {step === 2 && (
            <View>
              <Text style={[s.sectionTitle, isAr && s.rtl, { fontFamily: isAr ? F.arBold : F.enBold }]}>
                {t('s2Title')}
              </Text>
              <Text style={[s.sectionSub, isAr && s.rtl, { fontFamily: isAr ? F.ar : F.en }]}>
                {t('s2Sub')}
              </Text>

              <LField
                label={t('regNumber')} required value={s2.reg_number}
                onChangeText={(v) => setS2((f) => ({ ...f, reg_number: v }))} dirOverride="ltr"
              />
              <LField
                label={t('yearsExp')} required value={s2.years_experience}
                onChangeText={(v) => setS2((f) => ({ ...f, years_experience: v }))}
                keyboardType="numeric" dirOverride="ltr"
              />
              <LField
                label={t('numEmployees')} value={s2.num_employees}
                onChangeText={(v) => setS2((f) => ({ ...f, num_employees: v }))}
                keyboardType="numeric" dirOverride="ltr"
                placeholder={t('numEmployeesHint')}
              />

              <Text style={[s.divider, isAr && s.rtl, { fontFamily: isAr ? F.arSemi : F.enSemi }]}>
                {t('docsHeader')}
              </Text>

              <DocumentRow
                label={t('license')} required uploaded={!!licensePath}
                uploading={uploading.license}
                lang={lang} isAr={isAr}
                onUpload={() => pickAndUploadDoc('license', 'license_photo', setLicensePath)}
                onView={() => viewSupplierDoc(licensePath)}
              />
              <DocumentRow
                label={t('legalRepId')} required uploaded={!!legalRepPath}
                uploading={uploading.legal_rep_id}
                lang={lang} isAr={isAr}
                onUpload={() => pickAndUploadDoc('legal_rep_id', 'legal_rep_id_photo', setLegalRepPath)}
                onView={() => viewSupplierDoc(legalRepPath)}
              />
              <DocumentRow
                label={t('addressProof')} required uploaded={!!addressProofPath}
                uploading={uploading.address_proof}
                lang={lang} isAr={isAr}
                onUpload={() => pickAndUploadDoc('address_proof', 'address_proof_photo', setAddressProofPath)}
                onView={() => viewSupplierDoc(addressProofPath)}
              />

              <FactoryImagesBlock
                lang={lang} isAr={isAr}
                images={factoryImages}
                uploading={uploading.images}
                onAdd={pickAndUploadFactoryImages}
                onView={viewSupplierDoc}
                onRemove={removeFactoryImage}
              />

              <FactoryVideoRow
                lang={lang} isAr={isAr}
                videoPath={factoryVideo}
                uploading={uploading.video}
                onUpload={pickAndUploadVideo}
                onView={() => viewSupplierDoc(factoryVideo)}
                onRemove={removeVideo}
              />

              <View style={s.privacyNote}>
                <Text style={[s.privacyNoteText, isAr && s.rtl, { fontFamily: isAr ? F.ar : F.en }]}>
                  {t('privacyNote')}
                </Text>
              </View>
            </View>
          )}

          {/* ─── STEP 3 ─── */}
          {step === 3 && (
            <View>
              <Text style={[s.sectionTitle, isAr && s.rtl, { fontFamily: isAr ? F.arBold : F.enBold }]}>
                {t('s3Title')}
              </Text>
              <Text style={[s.sectionSub, isAr && s.rtl, { fontFamily: isAr ? F.ar : F.en }]}>
                {t('s3Sub')}
              </Text>

              <ReviewRow label={t('reviewCompany')} value={s1.company_name} isAr={isAr} />
              <ReviewRow
                label={t('reviewLocation')}
                value={[s1.city, s1.country].filter(Boolean).join(' · ')}
                isAr={isAr}
              />
              <ReviewRow
                label={t('reviewSpecialty')}
                value={getSpecialtyLabel(s1.speciality, lang) || '—'}
                isAr={isAr}
              />
              <ReviewRow label={t('reviewWeChat')} value={s1.wechat} isAr={isAr} />
              <ReviewRow label={t('reviewTradeLink')} value={s1.trade_link} isAr={isAr} />
            </View>
          )}

          {!!error && (
            <Text style={[s.errorText, isAr && s.rtl, { fontFamily: isAr ? F.ar : F.en }]}>
              {error}
            </Text>
          )}
        </ScrollView>

        {/* Sticky bottom action bar */}
        <View style={[s.bottomBar, isAr && s.rowRtl]}>
          {step > 1 && !submitting && (
            <TouchableOpacity
              style={s.secondaryBtn}
              onPress={() => { setError(''); setStep((p) => Math.max(1, p - 1)); }}
              activeOpacity={0.85}
            >
              <Text style={[s.secondaryBtnText, { fontFamily: isAr ? F.arSemi : F.enSemi }]}>
                {t('back')}
              </Text>
            </TouchableOpacity>
          )}
          {step < 3 && (
            <TouchableOpacity
              style={[s.primaryBtn, { flex: 1 }, (savingS1 || savingS2) && { opacity: 0.6 }]}
              onPress={step === 1 ? saveStep1AndAdvance : saveStep2AndAdvance}
              disabled={savingS1 || savingS2}
              activeOpacity={0.85}
            >
              {(savingS1 || savingS2)
                ? <ActivityIndicator color={C.btnPrimaryText} />
                : <Text style={[s.primaryBtnText, { fontFamily: isAr ? F.arSemi : F.enSemi }]}>
                    {t('next')}
                  </Text>}
            </TouchableOpacity>
          )}
          {step === 3 && (
            <TouchableOpacity
              style={[s.primaryBtn, { flex: 1 }, submitting && { opacity: 0.6 }]}
              onPress={submitForReview}
              disabled={submitting}
              activeOpacity={0.85}
            >
              {submitting
                ? <ActivityIndicator color={C.btnPrimaryText} />
                : <Text style={[s.primaryBtnText, { fontFamily: isAr ? F.arSemi : F.enSemi }]}>
                    {t('submit')}
                  </Text>}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function StepIndicator({ step, lang }) {
  const isAr = lang === 'ar';
  const labels = [
    tx('stepProfile', lang),
    tx('stepDocuments', lang),
    tx('stepReview', lang),
  ];
  return (
    <View style={[s.stepIndicator, isAr && s.rowRtl]}>
      {[1, 2, 3].map((n, i) => {
        const done = step > n;
        const cur = step === n;
        return (
          <View key={n} style={[s.stepCell, isAr && s.rowRtl]}>
            <View style={[s.stepDot, done && s.stepDotDone, cur && s.stepDotCur]}>
              <Text style={[s.stepDotText, (done || cur) && s.stepDotTextActive, { fontFamily: F.enSemi }]}>
                {done ? '✓' : n}
              </Text>
            </View>
            <Text
              style={[
                s.stepDotLabel,
                (done || cur) && s.stepDotLabelActive,
                { fontFamily: isAr ? F.ar : F.en },
              ]}
              numberOfLines={1}
            >
              {labels[i]}
            </Text>
            {n < 3 && <View style={[s.stepLine, done && s.stepLineDone]} />}
          </View>
        );
      })}
    </View>
  );
}

function LField({ label, required, hint, isAr, dirOverride, multiline, ...inputProps }) {
  const dir = dirOverride || (isAr ? 'rtl' : 'ltr');
  const writingDirection = dir;
  return (
    <View style={s.field}>
      <Text style={[s.fieldLabel, isAr && s.rtl, { fontFamily: isAr ? F.ar : F.en }]}>
        {label}{required ? <Text style={s.required}>{' *'}</Text> : null}
      </Text>
      <TextInput
        style={[
          s.fieldInput,
          multiline && s.fieldInputMulti,
          { textAlign: dir === 'rtl' ? 'right' : 'left', writingDirection, fontFamily: isAr ? F.ar : F.en },
        ]}
        placeholderTextColor={C.textDisabled}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        {...inputProps}
      />
      {!!hint && (
        <Text style={[s.fieldHint, isAr && s.rtl, { fontFamily: isAr ? F.ar : F.en }]}>{hint}</Text>
      )}
    </View>
  );
}

function PickerField({ label, required, value, placeholder, options, onChange, isAr, lang }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.val === value);
  return (
    <View style={s.field}>
      <Text style={[s.fieldLabel, isAr && s.rtl, { fontFamily: isAr ? F.ar : F.en }]}>
        {label}{required ? <Text style={s.required}>{' *'}</Text> : null}
      </Text>
      <TouchableOpacity
        style={[s.fieldInput, s.pickerBtn, isAr && s.rowRtl]}
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.8}
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
          {options.map((o) => (
            <TouchableOpacity
              key={o.val}
              style={[s.pickerItem, value === o.val && s.pickerItemActive]}
              onPress={() => { onChange(o.val); setOpen(false); }}
            >
              <Text
                style={[
                  s.pickerItemText,
                  value === o.val && { color: C.textPrimary },
                  { fontFamily: isAr ? F.ar : F.en, textAlign: isAr ? 'right' : 'left' },
                ]}
              >
                {o.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

function DocumentRow({ label, required, uploaded, uploading, lang, isAr, onUpload, onView }) {
  const t = (k) => tx(k, lang);
  return (
    <View style={s.docRow}>
      <Text style={[s.docLabel, isAr && s.rtl, { fontFamily: isAr ? F.ar : F.en }]}>
        {label}{required ? <Text style={s.required}>{' *'}</Text> : null}
      </Text>
      {uploaded ? (
        <View style={[s.uploadedBox, isAr && s.rowRtl]}>
          <Text style={[s.uploadedCheck, { fontFamily: F.enBold }]}>✓</Text>
          <Text style={[s.uploadedText, { fontFamily: isAr ? F.arSemi : F.enSemi }]}>
            {t('uploaded')}
          </Text>
          <View style={s.uploadedActions}>
            <TouchableOpacity onPress={onView} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[s.uploadedAction, { fontFamily: isAr ? F.ar : F.en }]}>{t('view')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onUpload} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[s.uploadedAction, { fontFamily: isAr ? F.ar : F.en }]}>{t('replace')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={s.uploadBox}
          onPress={onUpload}
          disabled={uploading}
          activeOpacity={0.85}
        >
          {uploading ? (
            <ActivityIndicator color={C.textSecondary} />
          ) : (
            <>
              <Text style={[s.uploadBoxTitle, { fontFamily: isAr ? F.arSemi : F.enSemi }]}>
                {t('uploadFile')}
              </Text>
              <Text style={[s.uploadBoxHint, { fontFamily: isAr ? F.ar : F.en }]}>
                {t('fileTypesHint')}
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

function FactoryImagesBlock({ lang, isAr, images, uploading, onAdd, onView, onRemove }) {
  const t = (k, ...a) => tx(k, lang, ...a);
  const remaining = FACTORY_IMAGE_LIMIT - images.length;
  return (
    <View style={s.docRow}>
      <View style={[s.docHeaderRow, isAr && s.rowRtl]}>
        <Text style={[s.docLabel, isAr && s.rtl, { fontFamily: isAr ? F.ar : F.en, flex: 1 }]}>
          {t('factoryPhotos')}<Text style={s.required}>{' *'}</Text>
        </Text>
        <Text style={[s.imageCounter, { fontFamily: F.en }]}>
          {t('factoryPhotosHint', images.length, FACTORY_IMAGE_LIMIT)}
        </Text>
      </View>

      {images.length > 0 && (
        <View style={{ gap: 6, marginBottom: 8 }}>
          {images.map((p, i) => (
            <View key={p} style={[s.uploadedBox, isAr && s.rowRtl]}>
              <Text style={[s.uploadedCheck, { fontFamily: F.enBold }]}>✓</Text>
              <Text style={[s.uploadedText, { fontFamily: isAr ? F.arSemi : F.enSemi }]}>
                {isAr ? `صورة ${i + 1}` : lang === 'zh' ? `图片 ${i + 1}` : `Image ${i + 1}`}
              </Text>
              <View style={s.uploadedActions}>
                <TouchableOpacity onPress={() => onView(p)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={[s.uploadedAction, { fontFamily: isAr ? F.ar : F.en }]}>{t('view')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => onRemove(p)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={[s.uploadedAction, { fontFamily: isAr ? F.ar : F.en }]}>{t('remove')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {remaining > 0 && (
        <TouchableOpacity
          style={[s.uploadBox, { paddingVertical: 16 }]}
          onPress={onAdd}
          disabled={uploading}
          activeOpacity={0.85}
        >
          {uploading
            ? <ActivityIndicator color={C.textSecondary} />
            : <Text style={[s.uploadBoxTitle, { fontFamily: isAr ? F.arSemi : F.enSemi }]}>
                {t('addImage')}
              </Text>}
        </TouchableOpacity>
      )}
    </View>
  );
}

function FactoryVideoRow({ lang, isAr, videoPath, uploading, onUpload, onView, onRemove }) {
  const t = (k) => tx(k, lang);
  return (
    <View style={s.docRow}>
      <Text style={[s.docLabel, isAr && s.rtl, { fontFamily: isAr ? F.ar : F.en }]}>
        {t('factoryVideo')}<Text style={s.required}>{' *'}</Text>
      </Text>
      {videoPath ? (
        <View style={[s.uploadedBox, isAr && s.rowRtl]}>
          <Text style={[s.uploadedCheck, { fontFamily: F.enBold }]}>▸</Text>
          <Text style={[s.uploadedText, { fontFamily: isAr ? F.arSemi : F.enSemi }]}>
            {t('uploaded')}
          </Text>
          <View style={s.uploadedActions}>
            <TouchableOpacity onPress={onView} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[s.uploadedAction, { fontFamily: isAr ? F.ar : F.en }]}>{t('view')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[s.uploadedAction, { fontFamily: isAr ? F.ar : F.en }]}>{t('remove')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={s.uploadBox}
          onPress={onUpload}
          disabled={uploading}
          activeOpacity={0.85}
        >
          {uploading ? (
            <ActivityIndicator color={C.textSecondary} />
          ) : (
            <>
              <Text style={[s.uploadBoxTitle, { fontFamily: isAr ? F.arSemi : F.enSemi }]}>
                {t('uploadVideo')}
              </Text>
              <Text style={[s.uploadBoxHint, { fontFamily: isAr ? F.ar : F.en }]}>
                {t('factoryVideoHint')}
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

function ReviewRow({ label, value, isAr }) {
  return (
    <View style={[s.reviewRow, isAr && s.rowRtl]}>
      <Text style={[s.reviewLabel, { fontFamily: isAr ? F.ar : F.en }]}>{label}</Text>
      <Text style={[s.reviewValue, { fontFamily: isAr ? F.arSemi : F.enSemi }]} numberOfLines={2}>
        {value || '—'}
      </Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bgBase },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  rtl: { textAlign: 'right', writingDirection: 'rtl' },
  rowRtl: { flexDirection: 'row-reverse' },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
    backgroundColor: C.bgBase,
  },
  topBarBack: { color: C.textSecondary, fontSize: 18 },
  topBarTitle: { color: C.textPrimary, fontSize: 16 },

  stepIndicator: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
    alignItems: 'center',
  },
  stepCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepDot: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.bgRaised,
    borderWidth: 1, borderColor: C.borderDefault,
    flexShrink: 0,
  },
  stepDotDone: { backgroundColor: C.green, borderColor: C.green },
  stepDotCur: { backgroundColor: C.btnPrimary, borderColor: C.btnPrimary },
  stepDotText: { fontSize: 11, color: C.textDisabled },
  stepDotTextActive: { color: C.btnPrimaryText },
  stepDotLabel: { fontSize: 10, color: C.textDisabled, flexShrink: 1 },
  stepDotLabelActive: { color: C.textPrimary },
  stepLine: {
    flex: 1, height: 1, backgroundColor: C.borderSubtle, marginHorizontal: 4,
  },
  stepLineDone: { backgroundColor: C.green },

  content: { padding: 24, paddingBottom: 100 },
  sectionTitle: { color: C.textPrimary, fontSize: 22, marginBottom: 6 },
  sectionSub: { color: C.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: 22 },
  divider: {
    color: C.textTertiary, fontSize: 12,
    letterSpacing: 0.5, marginTop: 18, marginBottom: 10,
  },

  field: { marginBottom: 16 },
  fieldLabel: { color: C.textSecondary, fontSize: 12, marginBottom: 6 },
  required: { color: C.red, fontSize: 12 },
  fieldInput: {
    backgroundColor: C.bgRaised, borderRadius: 12,
    borderWidth: 1, borderColor: C.borderMuted,
    paddingHorizontal: 16, paddingVertical: 12,
    color: C.textPrimary, fontSize: 15,
  },
  fieldInputMulti: { minHeight: 100, textAlignVertical: 'top' },
  fieldHint: { color: C.textDisabled, fontSize: 11, marginTop: 4 },

  pickerBtn: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerText: { color: C.textPrimary, fontSize: 15, flex: 1 },
  pickerCaret: { color: C.textSecondary, fontSize: 13, marginInlineStart: 10 },
  pickerList: {
    backgroundColor: C.bgRaised, borderRadius: 12,
    borderWidth: 1, borderColor: C.borderMuted,
    marginTop: 6, maxHeight: 280, overflow: 'hidden',
  },
  pickerItem: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },
  pickerItemActive: { backgroundColor: C.bgHover },
  pickerItemText: { color: C.textSecondary, fontSize: 14 },

  docRow: { marginBottom: 14 },
  docHeaderRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 6, gap: 8,
  },
  docLabel: { color: C.textSecondary, fontSize: 12, marginBottom: 6 },
  imageCounter: { color: C.textDisabled, fontSize: 11 },

  uploadBox: {
    backgroundColor: C.bgRaised, borderRadius: 12,
    borderWidth: 1, borderColor: C.borderMuted,
    paddingVertical: 22, paddingHorizontal: 16,
    alignItems: 'center', justifyContent: 'center',
    minHeight: 76,
  },
  uploadBoxTitle: { color: C.textPrimary, fontSize: 14, marginBottom: 4 },
  uploadBoxHint: { color: C.textDisabled, fontSize: 11 },

  uploadedBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.greenSoft,
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,100,0,0.2)',
    paddingHorizontal: 14, paddingVertical: 12,
  },
  uploadedCheck: { color: C.green, fontSize: 14 },
  uploadedText: { color: C.green, fontSize: 13, flex: 1 },
  uploadedActions: { flexDirection: 'row', gap: 14 },
  uploadedAction: { color: C.textSecondary, fontSize: 12 },

  privacyNote: {
    backgroundColor: C.bgRaised, borderRadius: 12,
    borderWidth: 1, borderColor: C.borderSubtle,
    padding: 14, marginTop: 18,
  },
  privacyNoteText: { color: C.textTertiary, fontSize: 12, lineHeight: 19 },

  reviewRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: C.bgRaised, borderRadius: 12,
    borderWidth: 1, borderColor: C.borderDefault,
    paddingHorizontal: 16, paddingVertical: 14,
    marginBottom: 8, gap: 12,
  },
  reviewLabel: { color: C.textSecondary, fontSize: 13 },
  reviewValue: { color: C.textPrimary, fontSize: 14, flex: 1, textAlign: 'right' },

  errorText: {
    color: C.red, fontSize: 13,
    textAlign: 'center', marginTop: 14,
  },

  bottomBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20, paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 14,
    borderTopWidth: 1, borderTopColor: C.borderSubtle,
    backgroundColor: C.bgBase,
  },
  primaryBtn: {
    backgroundColor: C.btnPrimary, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryBtnText: { color: C.btnPrimaryText, fontSize: 15 },
  secondaryBtn: {
    paddingVertical: 14, paddingHorizontal: 22,
    borderRadius: 14, borderWidth: 1, borderColor: C.borderDefault,
    backgroundColor: C.bgRaised,
    alignItems: 'center', justifyContent: 'center',
  },
  secondaryBtnText: { color: C.textPrimary, fontSize: 14 },

  successWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 32, gap: 18,
  },
  successTitle: { color: C.textPrimary, fontSize: 22, textAlign: 'center' },
  successBody: {
    color: C.textSecondary, fontSize: 14, lineHeight: 22,
    textAlign: 'center', maxWidth: 320,
  },
});
