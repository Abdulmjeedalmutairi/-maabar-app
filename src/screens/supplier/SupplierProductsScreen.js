// SupplierProductsScreen — supplier dashboard's Products tab.
//
// Lists my products with toggleActive + delete. The Add/Edit modal mirrors
// web/src/components/supplier/ProductComposer.jsx for the core fields:
//   Names         — name_zh + name_en required, name_ar optional
//   Descriptions  — desc_en required, desc_ar + desc_zh optional
//   Category      — 24-option list (SPECIALTY_CODES + getSpecialtyLabel)
//   Pricing       — currency pill (USD/SAR/CNY), price_from, moq (≥1)
//   Incoterms     — multi-select chips (FOB/CIF/EXW/DDP), ≥ 1 required
//   Media         — primary image + gallery (up to 8) → product-images bucket
//   Sample        — toggle + price + currency pill + max_qty (default 3) + note
//
// supplier_id is set to the auth user UUID (matches buildProductWritePayload
// in web). Inserts/updates retry without `sample_currency` if the products
// table doesn't have that column — web stores sample price in the product's
// main currency, so a separate sample_currency column is optional until a
// migration adds it.

import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Image,
  StyleSheet, ActivityIndicator, Modal, RefreshControl,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { getLang } from '../../lib/lang';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';
import { getSpecialtyLabel, SPECIALTY_CODES } from '../../lib/specialtyLabel';
import {
  formatPriceWithConversion,
  useDisplayCurrency,
} from '../../lib/displayCurrency';

const GALLERY_LIMIT = 8;
const CURRENCY_OPTIONS = ['USD', 'SAR', 'CNY'];
const INCOTERM_OPTIONS = ['FOB', 'CIF', 'EXW', 'DDP'];

const PRODUCT_SELECT_FULL =
  'id, name_ar, name_en, name_zh, desc_ar, desc_en, desc_zh, ' +
  'price_from, currency, moq, category, incoterms, ' +
  'image_url, gallery_images, ' +
  'sample_available, sample_price, sample_currency, sample_max_qty, sample_note, ' +
  'supplier_id, is_active, created_at';

const PRODUCT_SELECT_NO_SC =
  'id, name_ar, name_en, name_zh, desc_ar, desc_en, desc_zh, ' +
  'price_from, currency, moq, category, incoterms, ' +
  'image_url, gallery_images, ' +
  'sample_available, sample_price, sample_max_qty, sample_note, ' +
  'supplier_id, is_active, created_at';

const COPY = {
  ar: {
    title: 'منتجاتي',
    add: '+ إضافة',
    noProducts: 'لم تضف منتجات بعد',
    addFirst: 'أضف منتجك الأول',
    active: 'نشط', inactive: 'مخفي',
    edit: 'تعديل',
    delete: 'حذف',
    cancel: 'إلغاء',
    confirmDelete: 'حذف المنتج؟ لا يمكن التراجع عن هذا الإجراء.',
    newProduct: 'منتج جديد',
    editProduct: 'تعديل المنتج',
    close: 'إغلاق',
    save: 'حفظ',
    saving: 'جاري الحفظ...',

    sectionNames: 'أسماء المنتج',
    sectionDescriptions: 'الوصف',
    sectionCategory: 'التصنيف',
    sectionPricing: 'السعر والكمية',
    sectionIncoterms: 'شروط الشحن (Incoterms)',
    sectionMedia: 'الصور',
    sectionSample: 'العينات',

    nameZh: 'الاسم بالصينية *',
    nameEn: 'الاسم بالإنجليزية *',
    nameAr: 'الاسم بالعربية',
    descEn: 'الوصف بالإنجليزية *',
    descAr: 'الوصف بالعربية',
    descZh: 'الوصف بالصينية',

    category: 'التصنيف',
    currency: 'العملة',
    priceFrom: 'السعر من',
    priceFromHint: 'اختياري — السعر الابتدائي للعرض',
    moq: 'الحد الأدنى للكمية (MOQ) *',
    moqHint: 'رقم صحيح لا يقل عن 1',

    incotermsHint: 'اختر شرطًا واحدًا على الأقل',

    primaryImage: 'الصورة الرئيسية',
    pickPrimary: 'اختر صورة',
    changePrimary: 'تغيير الصورة',
    removePrimary: 'إزالة',
    gallery: 'معرض الصور',
    galleryHint: 'حتى 8 صور',
    addGallery: '+ إضافة صور',
    galleryFull: 'وصلت إلى الحد الأقصى للصور',

    sampleAvailable: '✓ العينات متاحة',
    sampleUnavailable: 'العينات غير متاحة',
    samplePrice: 'سعر العينة',
    sampleCurrency: 'عملة العينة',
    sampleMaxQty: 'الحد الأقصى للعينات لكل مشتري',
    sampleNote: 'ملاحظة العينة',
    sampleNoteHint: 'مثال: العينة تُخصم من الطلب الكبير',

    errorNameZh: 'الاسم بالصينية مطلوب',
    errorNameEn: 'الاسم بالإنجليزية مطلوب',
    errorDescEn: 'الوصف بالإنجليزية مطلوب',
    errorMoq: 'يجب أن يكون MOQ رقمًا صحيحًا أكبر من أو يساوي 1',
    errorIncoterms: 'اختر شرط شحن واحدًا على الأقل',
    errorGeneric: 'حدث خطأ، حاول مرة أخرى',
    permissionDenied: 'تم رفض إذن الصور',
    uploadFailed: 'فشل رفع الصورة',
  },
  en: {
    title: 'My Products',
    add: '+ Add',
    noProducts: 'No products yet',
    addFirst: 'Add your first product',
    active: 'Active', inactive: 'Hidden',
    edit: 'Edit',
    delete: 'Delete',
    cancel: 'Cancel',
    confirmDelete: 'Delete this product? This cannot be undone.',
    newProduct: 'New Product',
    editProduct: 'Edit Product',
    close: 'Close',
    save: 'Save',
    saving: 'Saving...',

    sectionNames: 'Product Names',
    sectionDescriptions: 'Descriptions',
    sectionCategory: 'Category',
    sectionPricing: 'Price & Quantity',
    sectionIncoterms: 'Incoterms',
    sectionMedia: 'Images',
    sectionSample: 'Samples',

    nameZh: 'Chinese Name *',
    nameEn: 'English Name *',
    nameAr: 'Arabic Name',
    descEn: 'English Description *',
    descAr: 'Arabic Description',
    descZh: 'Chinese Description',

    category: 'Category',
    currency: 'Currency',
    priceFrom: 'Starting Price',
    priceFromHint: 'Optional — display starting price',
    moq: 'MOQ *',
    moqHint: 'Whole number ≥ 1',

    incotermsHint: 'Select at least one',

    primaryImage: 'Primary Image',
    pickPrimary: 'Pick image',
    changePrimary: 'Change image',
    removePrimary: 'Remove',
    gallery: 'Gallery',
    galleryHint: 'Up to 8 images',
    addGallery: '+ Add images',
    galleryFull: 'Gallery limit reached',

    sampleAvailable: '✓ Samples Available',
    sampleUnavailable: 'Samples Unavailable',
    samplePrice: 'Sample price',
    sampleCurrency: 'Sample currency',
    sampleMaxQty: 'Max samples per buyer',
    sampleNote: 'Sample note',
    sampleNoteHint: 'e.g. sample cost deducted from bulk order',

    errorNameZh: 'Chinese name is required',
    errorNameEn: 'English name is required',
    errorDescEn: 'English description is required',
    errorMoq: 'MOQ must be a whole number ≥ 1',
    errorIncoterms: 'Select at least one Incoterm',
    errorGeneric: 'Something went wrong, please try again',
    permissionDenied: 'Photo permission denied',
    uploadFailed: 'Image upload failed',
  },
  zh: {
    title: '我的产品',
    add: '+ 添加',
    noProducts: '暂无产品',
    addFirst: '添加第一个产品',
    active: '上架', inactive: '下架',
    edit: '编辑',
    delete: '删除',
    cancel: '取消',
    confirmDelete: '删除此产品？此操作不可撤销。',
    newProduct: '新产品',
    editProduct: '编辑产品',
    close: '关闭',
    save: '保存',
    saving: '保存中...',

    sectionNames: '产品名称',
    sectionDescriptions: '产品描述',
    sectionCategory: '产品类别',
    sectionPricing: '价格与数量',
    sectionIncoterms: '贸易术语 (Incoterms)',
    sectionMedia: '产品图片',
    sectionSample: '样品',

    nameZh: '中文名称 *',
    nameEn: '英文名称 *',
    nameAr: '阿拉伯语名称',
    descEn: '英文描述 *',
    descAr: '阿拉伯语描述',
    descZh: '中文描述',

    category: '类别',
    currency: '币种',
    priceFrom: '起始价格',
    priceFromHint: '可选 — 用于展示的起始价',
    moq: '最小起订量 (MOQ) *',
    moqHint: '正整数（≥ 1）',

    incotermsHint: '至少选择一项',

    primaryImage: '主图',
    pickPrimary: '选择图片',
    changePrimary: '更换图片',
    removePrimary: '移除',
    gallery: '图片库',
    galleryHint: '最多 8 张',
    addGallery: '+ 添加图片',
    galleryFull: '已达图片上限',

    sampleAvailable: '✓ 可提供样品',
    sampleUnavailable: '不提供样品',
    samplePrice: '样品价格',
    sampleCurrency: '样品币种',
    sampleMaxQty: '每位买家最多样品数',
    sampleNote: '样品说明',
    sampleNoteHint: '例：大货下单可返还样品费',

    errorNameZh: '请填写中文产品名称',
    errorNameEn: '请填写英文产品名称',
    errorDescEn: '请填写英文描述',
    errorMoq: 'MOQ 必须为不小于 1 的整数',
    errorIncoterms: '请至少选择一个贸易术语',
    errorGeneric: '出现错误，请重试',
    permissionDenied: '相册权限被拒绝',
    uploadFailed: '图片上传失败',
  },
};

const EMPTY_FORM = {
  name_zh: '', name_en: '', name_ar: '',
  desc_en: '', desc_ar: '', desc_zh: '',
  category: 'other',
  currency: 'USD',
  price_from: '',
  moq: '',
  incoterms: [],
  image_url: null,
  gallery_images: [],
  sample_available: false,
  sample_price: '',
  sample_currency: 'USD',
  sample_max_qty: '3',
  sample_note: '',
};

async function uploadProductImage(uri, mimeType, userId, ext) {
  const e = (ext || (mimeType?.includes('png') ? 'png' : 'jpg')).toLowerCase();
  const path = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${e}`;
  const ab = await fetch(uri).then((r) => r.arrayBuffer());
  const { error } = await supabase.storage.from('product-images').upload(path, ab, {
    contentType: mimeType || 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(path);
  return publicUrl;
}

// Insert or update with sample_currency, retrying without it if the column
// is missing on the products table.
async function writeProduct(payload, productId) {
  const op = (p) => productId
    ? supabase.from('products').update(p).eq('id', productId)
    : supabase.from('products').insert(p);
  let { error } = await op(payload);
  if (error && /sample_currency/i.test(error.message || '')) {
    const { sample_currency: _drop, ...rest } = payload;
    ({ error } = await op(rest));
  }
  return error;
}

export default function SupplierProductsScreen({ navigation, route }) {
  const lang = getLang();
  const t = COPY[lang] || COPY.ar;
  const isAr = lang === 'ar';
  const { displayCurrency: viewerCurrency, rates: exchangeRates } = useDisplayCurrency();

  const [products, setProducts]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState(null);
  const [myId, setMyId]           = useState(null);

  const [form, setForm]                     = useState(EMPTY_FORM);
  const [submitting, setSubmitting]         = useState(false);
  const [uploadingPrimary, setUploadingPrimary] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); setRefreshing(false); return; }
    setMyId(user.id);

    let { data, error } = await supabase
      .from('products')
      .select(PRODUCT_SELECT_FULL)
      .eq('supplier_id', user.id)
      .order('created_at', { ascending: false });

    if (error && /sample_currency/i.test(error.message || '')) {
      // Retry without sample_currency for older schemas.
      const retry = await supabase
        .from('products')
        .select(PRODUCT_SELECT_NO_SC)
        .eq('supplier_id', user.id)
        .order('created_at', { ascending: false });
      data  = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error('[SupplierProducts] fetch error:', error);
      Alert.alert('', t.errorGeneric);
      setProducts([]);
    } else {
      setProducts(data || []);
    }
    setLoading(false);
    setRefreshing(false);
  }, [t]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (route?.params?.openAdd) {
      openAdd();
      navigation?.setParams?.({ openAdd: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.params?.openAdd]);

  function onRefresh() { setRefreshing(true); load(); }
  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(p) {
    setEditing(p);
    setForm({
      name_zh: p.name_zh || '',
      name_en: p.name_en || '',
      name_ar: p.name_ar || '',
      desc_en: p.desc_en || '',
      desc_ar: p.desc_ar || '',
      desc_zh: p.desc_zh || '',
      category: p.category || 'other',
      currency: CURRENCY_OPTIONS.includes(p.currency) ? p.currency : 'USD',
      price_from: p.price_from != null ? String(p.price_from) : '',
      moq: p.moq != null ? String(p.moq) : '',
      incoterms: Array.isArray(p.incoterms)
        ? p.incoterms.filter((x) => INCOTERM_OPTIONS.includes(x))
        : [],
      image_url: p.image_url || null,
      gallery_images: Array.isArray(p.gallery_images)
        ? p.gallery_images.filter(Boolean).slice(0, GALLERY_LIMIT)
        : [],
      sample_available: !!p.sample_available,
      sample_price: p.sample_price != null ? String(p.sample_price) : '',
      sample_currency: CURRENCY_OPTIONS.includes(p.sample_currency)
        ? p.sample_currency
        : (CURRENCY_OPTIONS.includes(p.currency) ? p.currency : 'USD'),
      sample_max_qty: p.sample_max_qty != null ? String(p.sample_max_qty) : '3',
      sample_note: p.sample_note || '',
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  }

  function toggleIncoterm(code) {
    setForm((f) => {
      const has = f.incoterms.includes(code);
      return {
        ...f,
        incoterms: has ? f.incoterms.filter((x) => x !== code) : [...f.incoterms, code],
      };
    });
  }

  async function pickPrimary() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') { Alert.alert('', t.permissionDenied); return; }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.85,
    });
    if (r.canceled || !r.assets?.[0]) return;
    setUploadingPrimary(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const a = r.assets[0];
      const ext = (a.fileName?.split('.').pop() || 'jpg').toLowerCase();
      const url = await uploadProductImage(a.uri, a.mimeType || 'image/jpeg', user.id, ext);
      set('image_url', url);
    } catch (e) {
      console.error('[SupplierProducts] primary upload error:', e?.message || e);
      Alert.alert('', t.uploadFailed);
    } finally {
      setUploadingPrimary(false);
    }
  }

  async function pickGallery() {
    const remaining = GALLERY_LIMIT - form.gallery_images.length;
    if (remaining <= 0) { Alert.alert('', t.galleryFull); return; }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') { Alert.alert('', t.permissionDenied); return; }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.85,
    });
    if (r.canceled || !r.assets?.length) return;
    setUploadingGallery(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const newUrls = [];
      for (const a of r.assets.slice(0, remaining)) {
        try {
          const ext = (a.fileName?.split('.').pop() || 'jpg').toLowerCase();
          const url = await uploadProductImage(a.uri, a.mimeType || 'image/jpeg', user.id, ext);
          newUrls.push(url);
        } catch (e) {
          console.error('[SupplierProducts] gallery upload error:', e?.message || e);
        }
      }
      setForm((f) => ({
        ...f,
        gallery_images: [...f.gallery_images, ...newUrls].slice(0, GALLERY_LIMIT),
      }));
    } finally {
      setUploadingGallery(false);
    }
  }

  function removeGalleryAt(idx) {
    setForm((f) => ({
      ...f,
      gallery_images: f.gallery_images.filter((_, i) => i !== idx),
    }));
  }

  function validate() {
    if (!form.name_zh.trim()) return t.errorNameZh;
    if (!form.name_en.trim()) return t.errorNameEn;
    if (!form.desc_en.trim()) return t.errorDescEn;
    const moqInt = parseInt(form.moq, 10);
    if (!Number.isFinite(moqInt) || moqInt < 1 || String(moqInt) !== String(form.moq).trim()) {
      return t.errorMoq;
    }
    if (!form.incoterms.length) return t.errorIncoterms;
    return null;
  }

  async function handleSave() {
    const errMsg = validate();
    if (errMsg) { Alert.alert('', errMsg); return; }
    if (!myId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { Alert.alert('', t.errorGeneric); return; }
      setMyId(user.id);
    }

    setSubmitting(true);

    const moqInt          = parseInt(form.moq, 10);
    const priceFromNum    = form.price_from !== '' ? Number(form.price_from) : null;
    const samplePriceNum  = form.sample_available && form.sample_price !== ''
      ? Number(form.sample_price) : null;
    const sampleMaxQtyInt = form.sample_available
      ? (parseInt(form.sample_max_qty, 10) || 3)
      : null;

    const payload = {
      supplier_id: myId,
      name_zh: form.name_zh.trim(),
      name_en: form.name_en.trim(),
      name_ar: form.name_ar.trim() || null,
      desc_en: form.desc_en.trim(),
      desc_ar: form.desc_ar.trim() || null,
      desc_zh: form.desc_zh.trim() || null,
      category: form.category || 'other',
      currency: form.currency || 'USD',
      price_from: Number.isFinite(priceFromNum) ? priceFromNum : null,
      moq: moqInt,
      incoterms: form.incoterms,
      image_url: form.image_url || form.gallery_images[0] || null,
      gallery_images: form.gallery_images,
      sample_available: !!form.sample_available,
      sample_price: Number.isFinite(samplePriceNum) ? samplePriceNum : null,
      sample_currency: form.sample_available ? form.sample_currency : null,
      sample_max_qty: sampleMaxQtyInt,
      sample_note: form.sample_available ? (form.sample_note.trim() || null) : null,
      is_active: editing ? !!editing.is_active : true,
    };

    const error = await writeProduct(payload, editing?.id);
    setSubmitting(false);

    if (error) {
      console.error('[SupplierProducts] save error:', error);
      Alert.alert('', t.errorGeneric);
      return;
    }
    closeForm();
    load();
  }

  async function toggleActive(id, current) {
    const { error } = await supabase.from('products').update({ is_active: !current }).eq('id', id);
    if (error) console.error('[SupplierProducts] toggle error:', error);
    load();
  }

  function handleDelete(p) {
    Alert.alert(
      '',
      t.confirmDelete,
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.delete,
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('products').delete().eq('id', p.id);
            if (error) {
              console.error('[SupplierProducts] delete error:', error);
              Alert.alert('', t.errorGeneric);
              return;
            }
            load();
          },
        },
      ],
    );
  }

  const getProductName = (p) => {
    if (lang === 'ar') return p.name_ar || p.name_en || p.name_zh || '—';
    if (lang === 'zh') return p.name_zh || p.name_en || p.name_ar || '—';
    return p.name_en || p.name_ar || p.name_zh || '—';
  };

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.topBar}>
        <TouchableOpacity style={s.addBtn} onPress={openAdd} activeOpacity={0.85}>
          <Text style={s.addBtnText}>{t.add}</Text>
        </TouchableOpacity>
        <Text style={[s.pageTitle, isAr && s.rtl]}>{t.title}</Text>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={C.textSecondary} size="large" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.textSecondary} />}
        >
          {products.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={[s.emptyText, isAr && s.rtl]}>{t.noProducts}</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={openAdd} activeOpacity={0.85}>
                <Text style={s.emptyBtnText}>{t.addFirst}</Text>
              </TouchableOpacity>
            </View>
          ) : products.map((p) => {
            const primary = p.image_url || (Array.isArray(p.gallery_images) ? p.gallery_images[0] : null);
            return (
              <TouchableOpacity
                key={p.id}
                style={[s.card, !p.is_active && s.cardInactive]}
                onPress={() => openEdit(p)}
                activeOpacity={0.85}
              >
                <View style={[s.cardTop, isAr && s.rowRtl]}>
                  {primary ? (
                    <Image source={{ uri: primary }} style={s.cardThumb} />
                  ) : (
                    <View style={[s.cardThumb, s.cardThumbEmpty]} />
                  )}
                  <View style={{ flex: 1, marginHorizontal: 10 }}>
                    <Text style={[s.productName, isAr && s.rtl]} numberOfLines={2}>
                      {getProductName(p)}
                    </Text>
                    <View style={[s.cardMeta, isAr && s.rowRtl]}>
                      {!!p.price_from && (
                        <Text style={s.metaItem}>
                          {formatPriceWithConversion({
                            amount: Number(p.price_from),
                            sourceCurrency: p.currency || 'USD',
                            displayCurrency: viewerCurrency,
                            rates: exchangeRates,
                            lang,
                            options: {
                              minimumFractionDigits: Number(p.price_from) % 1 === 0 ? 0 : 2,
                              maximumFractionDigits: 2,
                            },
                          })}
                        </Text>
                      )}
                      {p.moq != null && <Text style={s.metaItem}>MOQ: {p.moq}</Text>}
                      {!!p.category && (
                        <Text style={s.metaItem}>{getSpecialtyLabel(p.category, lang)}</Text>
                      )}
                    </View>
                  </View>
                </View>

                <View style={[s.cardActions, isAr && s.rowRtl]}>
                  <TouchableOpacity
                    style={[s.toggleBtn, { backgroundColor: p.is_active ? C.greenSoft : C.bgOverlay }]}
                    onPress={() => toggleActive(p.id, p.is_active)}
                    activeOpacity={0.85}
                  >
                    <Text style={[s.toggleText, { color: p.is_active ? C.green : C.textDisabled }]}>
                      {p.is_active ? t.active : t.inactive}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.editBtn} onPress={() => openEdit(p)} activeOpacity={0.85}>
                    <Text style={s.editBtnText}>{t.edit}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.deleteBtn} onPress={() => handleDelete(p)} activeOpacity={0.85}>
                    <Text style={s.deleteBtnText}>{t.delete}</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* ── Add/Edit Product Modal ── */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={s.safe}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={s.modalScroll} keyboardShouldPersistTaps="handled">
              <View style={[s.modalHeader, isAr && s.rowRtl]}>
                <TouchableOpacity onPress={closeForm}>
                  <Text style={s.modalClose}>{t.close}</Text>
                </TouchableOpacity>
                <Text style={[s.modalTitle, isAr && s.rtl]}>
                  {editing ? t.editProduct : t.newProduct}
                </Text>
              </View>

              {/* ── Names ── */}
              <Section title={t.sectionNames} isAr={isAr}>
                <PField label={t.nameZh} value={form.name_zh} onChangeText={(v) => set('name_zh', v)} isAr={false} />
                <PField label={t.nameEn} value={form.name_en} onChangeText={(v) => set('name_en', v)} isAr={false} />
                <PField label={t.nameAr} value={form.name_ar} onChangeText={(v) => set('name_ar', v)} isAr />
              </Section>

              {/* ── Descriptions ── */}
              <Section title={t.sectionDescriptions} isAr={isAr}>
                <PField label={t.descEn} value={form.desc_en} onChangeText={(v) => set('desc_en', v)} multiline numberOfLines={4} isAr={false} />
                <PField label={t.descAr} value={form.desc_ar} onChangeText={(v) => set('desc_ar', v)} multiline numberOfLines={3} isAr />
                <PField label={t.descZh} value={form.desc_zh} onChangeText={(v) => set('desc_zh', v)} multiline numberOfLines={3} isAr={false} />
              </Section>

              {/* ── Category ── */}
              <Section title={t.sectionCategory} isAr={isAr}>
                <View style={[s.chipRow, isAr && s.chipRowRtl]}>
                  {SPECIALTY_CODES.map((code) => {
                    const active = form.category === code;
                    return (
                      <TouchableOpacity
                        key={code}
                        style={[s.chip, active && s.chipActive]}
                        onPress={() => set('category', code)}
                        activeOpacity={0.85}
                      >
                        <Text style={[s.chipText, active && s.chipTextActive]}>
                          {getSpecialtyLabel(code, lang)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Section>

              {/* ── Pricing ── */}
              <Section title={t.sectionPricing} isAr={isAr}>
                <Text style={[s.fieldLabel, isAr && s.rtl]}>{t.currency}</Text>
                <View style={[s.pillRow, isAr && s.chipRowRtl]}>
                  {CURRENCY_OPTIONS.map((cur) => {
                    const active = form.currency === cur;
                    return (
                      <TouchableOpacity
                        key={cur}
                        style={[s.pill, active && s.pillActive]}
                        onPress={() => set('currency', cur)}
                        activeOpacity={0.85}
                      >
                        <Text style={[s.pillText, active && s.pillTextActive]}>{cur}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <PField
                  label={t.priceFrom}
                  value={form.price_from}
                  onChangeText={(v) => set('price_from', v)}
                  keyboardType="numeric"
                  hint={t.priceFromHint}
                  isAr={isAr}
                />
                <PField
                  label={t.moq}
                  value={form.moq}
                  onChangeText={(v) => set('moq', v.replace(/[^0-9]/g, ''))}
                  keyboardType="numeric"
                  hint={t.moqHint}
                  isAr={isAr}
                />
              </Section>

              {/* ── Incoterms ── */}
              <Section title={t.sectionIncoterms} isAr={isAr}>
                <Text style={[s.fieldHint, isAr && s.rtl, { marginBottom: 8 }]}>{t.incotermsHint}</Text>
                <View style={[s.pillRow, isAr && s.chipRowRtl]}>
                  {INCOTERM_OPTIONS.map((code) => {
                    const active = form.incoterms.includes(code);
                    return (
                      <TouchableOpacity
                        key={code}
                        style={[s.pill, active && s.pillActive]}
                        onPress={() => toggleIncoterm(code)}
                        activeOpacity={0.85}
                      >
                        <Text style={[s.pillText, active && s.pillTextActive]}>{code}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Section>

              {/* ── Media ── */}
              <Section title={t.sectionMedia} isAr={isAr}>
                <Text style={[s.fieldLabel, isAr && s.rtl]}>{t.primaryImage}</Text>
                {form.image_url ? (
                  <View style={s.primaryWrap}>
                    <Image source={{ uri: form.image_url }} style={s.primaryImg} />
                    <View style={[s.primaryActions, isAr && s.rowRtl]}>
                      <TouchableOpacity
                        style={s.smallBtn}
                        onPress={pickPrimary}
                        disabled={uploadingPrimary}
                        activeOpacity={0.85}
                      >
                        {uploadingPrimary
                          ? <ActivityIndicator color={C.textSecondary} />
                          : <Text style={s.smallBtnText}>{t.changePrimary}</Text>}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.smallBtn, s.smallBtnDanger]}
                        onPress={() => set('image_url', null)}
                        activeOpacity={0.85}
                      >
                        <Text style={[s.smallBtnText, { color: C.red }]}>{t.removePrimary}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={s.uploadBtn}
                    onPress={pickPrimary}
                    disabled={uploadingPrimary}
                    activeOpacity={0.85}
                  >
                    {uploadingPrimary
                      ? <ActivityIndicator color={C.textSecondary} />
                      : <Text style={s.uploadBtnText}>{t.pickPrimary}</Text>}
                  </TouchableOpacity>
                )}

                <View style={{ height: 16 }} />

                <View style={[s.galleryHeader, isAr && s.rowRtl]}>
                  <Text style={[s.fieldLabel, isAr && s.rtl, { marginBottom: 0 }]}>
                    {t.gallery} <Text style={s.fieldHint}>({form.gallery_images.length}/{GALLERY_LIMIT})</Text>
                  </Text>
                  <TouchableOpacity
                    style={s.smallBtn}
                    onPress={pickGallery}
                    disabled={uploadingGallery || form.gallery_images.length >= GALLERY_LIMIT}
                    activeOpacity={0.85}
                  >
                    {uploadingGallery
                      ? <ActivityIndicator color={C.textSecondary} />
                      : <Text style={s.smallBtnText}>{t.addGallery}</Text>}
                  </TouchableOpacity>
                </View>
                {form.gallery_images.length > 0 && (
                  <View style={s.galleryGrid}>
                    {form.gallery_images.map((url, idx) => (
                      <View key={`${url}-${idx}`} style={s.galleryItem}>
                        <Image source={{ uri: url }} style={s.galleryImg} />
                        <TouchableOpacity
                          style={s.galleryRemove}
                          onPress={() => removeGalleryAt(idx)}
                          activeOpacity={0.85}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={s.galleryRemoveText}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </Section>

              {/* ── Sample ── */}
              <Section title={t.sectionSample} isAr={isAr}>
                <TouchableOpacity
                  style={[s.toggleRow, form.sample_available && s.toggleRowActive]}
                  onPress={() => set('sample_available', !form.sample_available)}
                  activeOpacity={0.85}
                >
                  <Text style={[s.toggleRowText, form.sample_available && s.toggleRowTextActive]}>
                    {form.sample_available ? t.sampleAvailable : t.sampleUnavailable}
                  </Text>
                </TouchableOpacity>

                {form.sample_available && (
                  <View style={{ marginTop: 14 }}>
                    <PField
                      label={t.samplePrice}
                      value={form.sample_price}
                      onChangeText={(v) => set('sample_price', v)}
                      keyboardType="numeric"
                      isAr={isAr}
                    />

                    <Text style={[s.fieldLabel, isAr && s.rtl]}>{t.sampleCurrency}</Text>
                    <View style={[s.pillRow, isAr && s.chipRowRtl, { marginBottom: 16 }]}>
                      {CURRENCY_OPTIONS.map((cur) => {
                        const active = form.sample_currency === cur;
                        return (
                          <TouchableOpacity
                            key={cur}
                            style={[s.pill, active && s.pillActive]}
                            onPress={() => set('sample_currency', cur)}
                            activeOpacity={0.85}
                          >
                            <Text style={[s.pillText, active && s.pillTextActive]}>{cur}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <PField
                      label={t.sampleMaxQty}
                      value={form.sample_max_qty}
                      onChangeText={(v) => set('sample_max_qty', v.replace(/[^0-9]/g, ''))}
                      keyboardType="numeric"
                      isAr={isAr}
                    />
                    <PField
                      label={t.sampleNote}
                      value={form.sample_note}
                      onChangeText={(v) => set('sample_note', v)}
                      multiline
                      numberOfLines={2}
                      hint={t.sampleNoteHint}
                      isAr={isAr}
                    />
                  </View>
                )}
              </Section>

              <TouchableOpacity
                style={[s.submitBtn, submitting && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting
                  ? <ActivityIndicator color={C.btnPrimaryText} />
                  : <Text style={s.submitBtnText}>{t.save}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function Section({ title, isAr, children }) {
  return (
    <View style={s.section}>
      <Text style={[s.sectionTitle, isAr && s.rtl]}>{title}</Text>
      {children}
    </View>
  );
}

function PField({ label, isAr, multiline, hint, ...props }) {
  return (
    <View style={s.fieldWrap}>
      <Text style={[s.fieldLabel, isAr && s.rtl]}>{label}</Text>
      <TextInput
        style={[s.input, isAr && s.rtl, multiline && { minHeight: 80, textAlignVertical: 'top' }]}
        placeholderTextColor={C.textDisabled}
        multiline={multiline}
        {...props}
      />
      {!!hint && <Text style={[s.fieldHint, isAr && s.rtl]}>{hint}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bgBase },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  rtl: { textAlign: 'right', writingDirection: 'rtl' },
  rowRtl: { flexDirection: 'row-reverse' },

  topBar: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },
  pageTitle: { color: C.textPrimary, fontSize: 20, fontFamily: F.arSemi },
  addBtn: {
    backgroundColor: C.btnPrimary, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  addBtnText: { color: C.btnPrimaryText, fontFamily: F.arSemi, fontSize: 13 },
  list: { padding: 16, gap: 10, paddingBottom: 48 },

  card: {
    backgroundColor: C.bgRaised, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: C.borderDefault,
  },
  cardInactive: { opacity: 0.55 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  cardThumb: { width: 56, height: 56, borderRadius: 10, backgroundColor: C.bgOverlay },
  cardThumbEmpty: { borderWidth: 1, borderColor: C.borderDefault, borderStyle: 'dashed' },
  productName: { color: C.textPrimary, fontSize: 14, fontFamily: F.arSemi, lineHeight: 20 },
  cardMeta: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', marginTop: 6 },
  metaItem: { color: C.textTertiary, fontSize: 12, fontFamily: F.num },

  cardActions: {
    flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap',
  },
  toggleBtn: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  toggleText: { fontSize: 11, fontFamily: F.arSemi },
  editBtn: {
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: C.bgOverlay,
  },
  editBtnText: { color: C.textSecondary, fontSize: 11, fontFamily: F.arSemi },
  deleteBtn: {
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: C.redSoft,
  },
  deleteBtnText: { color: C.red, fontSize: 11, fontFamily: F.arSemi },

  emptyCard: {
    backgroundColor: C.bgRaised, borderRadius: 16,
    padding: 40, alignItems: 'center',
    borderWidth: 1, borderColor: C.borderDefault, marginTop: 16,
  },
  emptyText: { color: C.textSecondary, fontSize: 14, fontFamily: F.ar, marginBottom: 16 },
  emptyBtn: {
    backgroundColor: C.btnPrimary, borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  emptyBtnText: { color: C.btnPrimaryText, fontFamily: F.arSemi },

  // Modal
  modalScroll: { padding: 20, paddingBottom: 60 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },
  modalTitle: { color: C.textPrimary, fontSize: 18, fontFamily: F.arSemi },
  modalClose: { color: C.textSecondary, fontSize: 15, fontFamily: F.ar },

  // Section card
  section: {
    backgroundColor: C.bgRaised, borderRadius: 16,
    borderWidth: 1, borderColor: C.borderDefault,
    padding: 16, marginBottom: 14,
  },
  sectionTitle: {
    color: C.textPrimary, fontSize: 14, fontFamily: F.arSemi,
    marginBottom: 12,
  },

  // Field
  fieldWrap: { marginBottom: 14 },
  fieldLabel: {
    color: C.textSecondary, fontSize: 12, fontFamily: F.ar,
    marginBottom: 6,
  },
  fieldHint: {
    color: C.textDisabled, fontSize: 11, fontFamily: F.ar,
    marginTop: 4,
  },
  input: {
    backgroundColor: C.bgBase, borderRadius: 12,
    borderWidth: 1, borderColor: C.borderMuted,
    paddingHorizontal: 14, paddingVertical: 12,
    color: C.textPrimary, fontSize: 15, fontFamily: F.ar,
  },

  // Chips (categories)
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipRowRtl: { flexDirection: 'row-reverse' },
  chip: {
    borderWidth: 1, borderColor: C.borderDefault,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: C.bgBase,
  },
  chipActive: { borderColor: C.borderStrong, backgroundColor: C.bgHover },
  chipText: { color: C.textSecondary, fontSize: 12, fontFamily: F.ar },
  chipTextActive: { color: C.textPrimary, fontFamily: F.arSemi },

  // Pills (currency, incoterms)
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  pill: {
    borderWidth: 1, borderColor: C.borderDefault,
    borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: C.bgBase, minWidth: 64, alignItems: 'center',
  },
  pillActive: { backgroundColor: C.btnPrimary, borderColor: C.btnPrimary },
  pillText: { color: C.textSecondary, fontSize: 12, fontFamily: F.numSemi },
  pillTextActive: { color: C.btnPrimaryText },

  // Media
  primaryWrap: {
    backgroundColor: C.bgBase, borderRadius: 12,
    borderWidth: 1, borderColor: C.borderMuted,
    padding: 10, alignItems: 'center',
  },
  primaryImg: { width: '100%', height: 200, borderRadius: 10, resizeMode: 'cover' },
  primaryActions: { flexDirection: 'row', gap: 8, marginTop: 10 },

  uploadBtn: {
    borderWidth: 1, borderColor: C.borderDefault,
    borderRadius: 12, paddingVertical: 16, alignItems: 'center',
    backgroundColor: C.bgBase, borderStyle: 'dashed',
  },
  uploadBtnText: { color: C.textSecondary, fontSize: 13, fontFamily: F.arSemi },

  smallBtn: {
    borderWidth: 1, borderColor: C.borderDefault,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: C.bgRaised,
  },
  smallBtnDanger: { borderColor: C.redSoft },
  smallBtnText: { color: C.textSecondary, fontSize: 12, fontFamily: F.arSemi },

  galleryHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  galleryGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6,
  },
  galleryItem: { width: 76, height: 76, position: 'relative' },
  galleryImg: { width: '100%', height: '100%', borderRadius: 10, resizeMode: 'cover' },
  galleryRemove: {
    position: 'absolute', top: -6, right: -6,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: C.bgRaised, borderWidth: 1, borderColor: C.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  galleryRemoveText: {
    color: C.textPrimary, fontSize: 14, lineHeight: 16, fontFamily: F.arSemi,
  },

  // Sample toggle row
  toggleRow: {
    borderWidth: 1, borderColor: C.borderDefault,
    borderRadius: 12, paddingVertical: 12, alignItems: 'center',
    backgroundColor: C.bgBase,
  },
  toggleRowActive: { borderColor: C.borderStrong, backgroundColor: C.bgHover },
  toggleRowText: { color: C.textSecondary, fontSize: 14, fontFamily: F.arSemi },
  toggleRowTextActive: { color: C.textPrimary },

  submitBtn: {
    backgroundColor: C.btnPrimary, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginTop: 8,
  },
  submitBtnText: { color: C.btnPrimaryText, fontFamily: F.arSemi, fontSize: 16 },
});
