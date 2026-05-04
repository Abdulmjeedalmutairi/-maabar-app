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
const COUNTRY_OPTIONS = ['China', 'Vietnam', 'Turkey', 'India', 'Pakistan', 'Bangladesh', 'Indonesia'];
const PORT_OPTIONS = ['Shanghai', 'Shenzhen', 'Ningbo', 'Guangzhou', 'Qingdao', 'Tianjin'];
const PRICE_VALIDITY_OPTIONS = [30, 60, 90];
// Sentinel value for "Other (free text)" — mirrors web's resolveSelectOrOther
// so country/port can store either a known option or any free-text value.
const OTHER_SENTINEL = '__other__';

const B2B_COLUMNS =
  'hs_code, country_of_origin, port_of_loading, ' +
  'units_per_carton, cbm, gross_weight_kg, net_weight_kg, ' +
  'unit_weight_kg, package_dimensions, ' +
  'lead_time_min_days, lead_time_max_days, lead_time_negotiable, ' +
  'price_validity_days, ' +
  'oem_available, odm_available, oem_lead_time_min_days, oem_lead_time_max_days, ' +
  'spec_material, spec_dimensions, spec_color_options, ' +
  'spec_packaging_details, spec_customization';

const PRODUCT_SELECT_FULL =
  'id, name_ar, name_en, name_zh, desc_ar, desc_en, desc_zh, ' +
  'price_from, currency, moq, category, incoterms, ' +
  'image_url, gallery_images, ' +
  'sample_available, sample_price, sample_currency, sample_max_qty, sample_note, ' +
  B2B_COLUMNS + ', ' +
  'supplier_id, is_active, created_at';

const PRODUCT_SELECT_NO_SC =
  'id, name_ar, name_en, name_zh, desc_ar, desc_en, desc_zh, ' +
  'price_from, currency, moq, category, incoterms, ' +
  'image_url, gallery_images, ' +
  'sample_available, sample_price, sample_max_qty, sample_note, ' +
  B2B_COLUMNS + ', ' +
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
    sectionTiers: 'الشرائح السعرية',
    sectionIncoterms: 'شروط الشحن (Incoterms)',
    sectionB2B: 'الخدمات اللوجستية B2B',
    sectionMedia: 'الصور',
    sectionSample: 'العينات',

    subShipping: 'الشحن والمنشأ',
    subCarton: 'تفاصيل الكرتون',
    subLeadTime: 'مدة التصنيع وصلاحية السعر',
    subOemOdm: 'OEM / ODM',
    subSpecs: 'المواصفات',

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

    countryOfOrigin: 'بلد المنشأ',
    portOfLoading: 'ميناء الشحن',
    otherOption: 'أخرى',
    countryOtherPlaceholder: 'أدخل بلد المنشأ',
    portOtherPlaceholder: 'أدخل ميناء الشحن',
    hsCode: 'رمز التعريفة الجمركية (HS)',

    unitsPerCarton: 'عدد الوحدات في الكرتون',
    cbm: 'الحجم (CBM م³)',
    grossWeightKg: 'الوزن الإجمالي (كجم)',
    netWeightKg: 'الوزن الصافي (كجم)',
    unitWeightKg: 'وزن الوحدة (كجم)',
    packageDimensions: 'أبعاد العبوة',

    leadTimeMin: 'الحد الأدنى لمدة التصنيع (أيام)',
    leadTimeMax: 'الحد الأقصى لمدة التصنيع (أيام)',
    leadTimeNegotiable: 'مدة التصنيع قابلة للتفاوض',
    priceValidityDays: 'صلاحية السعر',
    priceValidityUnit: 'يومًا',

    oemAvailable: 'OEM متاح',
    odmAvailable: 'ODM متاح',
    oemLeadTimeMin: 'الحد الأدنى لمدة OEM (أيام)',
    oemLeadTimeMax: 'الحد الأقصى لمدة OEM (أيام)',

    specMaterial: 'المادة',
    specDimensions: 'الأبعاد',
    specColorOptions: 'الألوان / الخيارات',
    specPackagingDetails: 'تفاصيل التغليف',
    specCustomization: 'التخصيص / OEM',

    tiersHint: 'أدخل ٣ شرائح سعرية. الشريحة 1 مرتبطة بـ MOQ، والأسعار تنازلية.',
    tierLabel: 'الشريحة {n}',
    tierColMinQty: 'الكمية الدنيا',
    tierColMaxQty: 'الكمية القصوى',
    tierColUnitPrice: 'سعر الوحدة',
    tierMaxQtyUnlimited: '∞ وما فوق',
    tierMoqAutoNote: 'تُملأ الكمية الدنيا للشريحة 1 تلقائيًا من MOQ.',

    errorNameZh: 'الاسم بالصينية مطلوب',
    errorNameEn: 'الاسم بالإنجليزية مطلوب',
    errorDescEn: 'الوصف بالإنجليزية مطلوب',
    errorMoq: 'يجب أن يكون MOQ رقمًا صحيحًا أكبر من أو يساوي 1',
    errorIncoterms: 'اختر شرط شحن واحدًا على الأقل',
    errorTierMissing: 'الشريحة {n}: حقول مفقودة',
    errorTierNumeric: 'الشريحة {n}: قيم غير رقمية',
    errorTierQtyFromMin: 'الشريحة {n}: الكمية الدنيا يجب أن تكون 1 أو أكثر',
    errorTierPricePositive: 'الشريحة {n}: السعر يجب أن يكون أكبر من 0',
    errorTierQtyOrder: 'الشريحة {n}: الكمية الدنيا يجب أن تكون أقل من الكمية القصوى',
    errorTierOverlap: 'الشريحة {n}: تتداخل مع الشريحة السابقة',
    errorTierDescending: 'الشريحة {n}: السعر يجب أن يكون أقل من الشريحة السابقة',
    errorTierSave: 'تم حفظ المنتج، لكن فشل حفظ الشرائح السعرية',
    errorLeadTimeOrder: 'الحد الأقصى لمدة التصنيع يجب أن يكون أكبر من أو يساوي الحد الأدنى',
    errorOemLeadTimeOrder: 'الحد الأقصى لمدة OEM يجب أن يكون أكبر من أو يساوي الحد الأدنى',
    errorCbmPositive: 'يجب أن يكون CBM أكبر من 0',
    errorWeightPositive: 'يجب أن يكون الوزن أكبر من 0',
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
    sectionTiers: 'Pricing Tiers',
    sectionIncoterms: 'Incoterms',
    sectionB2B: 'B2B Logistics',
    sectionMedia: 'Images',
    sectionSample: 'Samples',

    subShipping: 'Shipping & Origin',
    subCarton: 'Carton Details',
    subLeadTime: 'Lead Time & Price Validity',
    subOemOdm: 'OEM / ODM',
    subSpecs: 'Specs',

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

    countryOfOrigin: 'Country of Origin',
    portOfLoading: 'Port of Loading',
    otherOption: 'Other',
    countryOtherPlaceholder: 'Enter country of origin',
    portOtherPlaceholder: 'Enter port of loading',
    hsCode: 'HS Code',

    unitsPerCarton: 'Units per carton',
    cbm: 'Carton Volume (CBM m³)',
    grossWeightKg: 'Gross weight (kg)',
    netWeightKg: 'Net weight (kg)',
    unitWeightKg: 'Unit weight (kg)',
    packageDimensions: 'Package dimensions',

    leadTimeMin: 'Lead time min (days)',
    leadTimeMax: 'Lead time max (days)',
    leadTimeNegotiable: 'Lead time negotiable',
    priceValidityDays: 'Price validity',
    priceValidityUnit: 'days',

    oemAvailable: 'OEM available',
    odmAvailable: 'ODM available',
    oemLeadTimeMin: 'OEM lead time min (days)',
    oemLeadTimeMax: 'OEM lead time max (days)',

    specMaterial: 'Material',
    specDimensions: 'Dimensions',
    specColorOptions: 'Colors / variants',
    specPackagingDetails: 'Packaging details',
    specCustomization: 'Customization / OEM',

    tiersHint: 'Enter 3 pricing tiers. Tier 1 is bound to MOQ; prices must be in descending order.',
    tierLabel: 'Tier {n}',
    tierColMinQty: 'Min Qty',
    tierColMaxQty: 'Max Qty',
    tierColUnitPrice: 'Unit Price',
    tierMaxQtyUnlimited: '∞ and above',
    tierMoqAutoNote: 'Tier 1 min qty is auto-filled from MOQ.',

    errorNameZh: 'Chinese name is required',
    errorNameEn: 'English name is required',
    errorDescEn: 'English description is required',
    errorMoq: 'MOQ must be a whole number ≥ 1',
    errorIncoterms: 'Select at least one Incoterm',
    errorTierMissing: 'Tier {n}: missing fields',
    errorTierNumeric: 'Tier {n}: non-numeric values',
    errorTierQtyFromMin: 'Tier {n}: min qty must be ≥ 1',
    errorTierPricePositive: 'Tier {n}: unit price must be greater than 0',
    errorTierQtyOrder: 'Tier {n}: min qty must be less than max qty',
    errorTierOverlap: 'Tier {n}: overlaps with the previous tier',
    errorTierDescending: 'Tier {n}: price must be lower than the previous tier',
    errorTierSave: 'Product saved, but pricing tiers failed to save',
    errorLeadTimeOrder: 'Lead time max must be ≥ lead time min',
    errorOemLeadTimeOrder: 'OEM lead time max must be ≥ OEM lead time min',
    errorCbmPositive: 'CBM must be greater than 0',
    errorWeightPositive: 'Weight must be greater than 0',
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
    sectionTiers: '阶梯定价',
    sectionIncoterms: '贸易术语 (Incoterms)',
    sectionB2B: 'B2B 物流',
    sectionMedia: '产品图片',
    sectionSample: '样品',

    subShipping: '装运与原产地',
    subCarton: '装箱信息',
    subLeadTime: '生产交期与价格有效期',
    subOemOdm: 'OEM / ODM',
    subSpecs: '规格',

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

    countryOfOrigin: '原产国',
    portOfLoading: '装运港',
    otherOption: '其他',
    countryOtherPlaceholder: '请输入原产国',
    portOtherPlaceholder: '请输入装运港',
    hsCode: '海关编码 (HS Code)',

    unitsPerCarton: '每箱数量',
    cbm: '装箱体积 (CBM m³)',
    grossWeightKg: '毛重 (kg)',
    netWeightKg: '净重 (kg)',
    unitWeightKg: '单件重量 (kg)',
    packageDimensions: '包装尺寸',

    leadTimeMin: '生产交期最短（天）',
    leadTimeMax: '生产交期最长（天）',
    leadTimeNegotiable: '生产交期可议',
    priceValidityDays: '价格有效期',
    priceValidityUnit: '天',

    oemAvailable: '可提供 OEM',
    odmAvailable: '可提供 ODM',
    oemLeadTimeMin: 'OEM 交期最短（天）',
    oemLeadTimeMax: 'OEM 交期最长（天）',

    specMaterial: '材质',
    specDimensions: '尺寸 / 规格',
    specColorOptions: '颜色 / 款式',
    specPackagingDetails: '包装信息',
    specCustomization: '定制 / OEM',

    tiersHint: '请输入 3 阶价格。第 1 阶绑定 MOQ；价格必须按降序排列。',
    tierLabel: '第 {n} 阶',
    tierColMinQty: '最小数量',
    tierColMaxQty: '最大数量',
    tierColUnitPrice: '单价',
    tierMaxQtyUnlimited: '∞ 及以上',
    tierMoqAutoNote: '第 1 阶最小数量自动等于 MOQ。',

    errorNameZh: '请填写中文产品名称',
    errorNameEn: '请填写英文产品名称',
    errorDescEn: '请填写英文描述',
    errorMoq: 'MOQ 必须为不小于 1 的整数',
    errorIncoterms: '请至少选择一个贸易术语',
    errorTierMissing: '第 {n} 阶：缺少字段',
    errorTierNumeric: '第 {n} 阶：非数字值',
    errorTierQtyFromMin: '第 {n} 阶：最小数量必须 ≥ 1',
    errorTierPricePositive: '第 {n} 阶：单价必须大于 0',
    errorTierQtyOrder: '第 {n} 阶：最小数量必须小于最大数量',
    errorTierOverlap: '第 {n} 阶：与上一阶重叠',
    errorTierDescending: '第 {n} 阶：价格必须低于上一阶',
    errorTierSave: '产品已保存，但阶梯价格保存失败',
    errorLeadTimeOrder: '生产交期最长不得小于最短',
    errorOemLeadTimeOrder: 'OEM 交期最长不得小于最短',
    errorCbmPositive: 'CBM 必须大于 0',
    errorWeightPositive: '重量必须大于 0',
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
  // 3 mandatory pricing tiers — see Phase 2 spec.
  // Tier 1's qty_from is bound to MOQ (read-only in UI; coerced at save).
  // Tier 3's qty_to may be blank (= unlimited).
  tiers: [
    { qty_from: '', qty_to: '', unit_price: '' },
    { qty_from: '', qty_to: '', unit_price: '' },
    { qty_from: '', qty_to: '', unit_price: '' },
  ],
  // B2B Logistics — Shipping & Origin
  // country_of_origin holds either a known option, '__other__' (paired with
  // country_of_origin_other), or '' for unset. Mirrors the dual-state model
  // in web/src/components/supplier/ProductComposer.jsx.
  country_of_origin: 'China',
  country_of_origin_other: '',
  port_of_loading: '',
  port_of_loading_other: '',
  hs_code: '',
  // Carton
  units_per_carton: '',
  cbm: '',
  gross_weight_kg: '',
  net_weight_kg: '',
  unit_weight_kg: '',
  package_dimensions: '',
  // Lead time
  lead_time_min_days: '',
  lead_time_max_days: '',
  lead_time_negotiable: false,
  price_validity_days: 30,
  // OEM / ODM
  oem_available: false,
  odm_available: false,
  oem_lead_time_min_days: '',
  oem_lead_time_max_days: '',
  // Specs
  spec_material: '',
  spec_dimensions: '',
  spec_color_options: '',
  spec_packaging_details: '',
  spec_customization: '',
};

// Resolve a "select OR other" pair into a single column value. If the user
// picked '__other__', returns the trimmed free-text; otherwise returns the
// known option (or null when nothing chosen). Mirrors web's helper of the
// same name in ProductComposer.jsx.
function resolveSelectOrOther(selectValue, otherValue) {
  const sel = String(selectValue || '').trim();
  if (sel === OTHER_SENTINEL) {
    const other = String(otherValue || '').trim();
    return other || null;
  }
  if (!sel) return null;
  return sel;
}

// Expand a DB-stored value into the form's { selectValue, otherValue } pair
// so the dropdown reflects the stored value (or flips to "Other" + free text
// when the value isn't in knownOptions).
function expandStoredSelect(stored, knownOptions) {
  const v = String(stored || '').trim();
  if (!v) return { selectValue: '', otherValue: '' };
  if (knownOptions.includes(v)) return { selectValue: v, otherValue: '' };
  return { selectValue: OTHER_SENTINEL, otherValue: v };
}

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
// is missing on the products table. Returns { error, id } so the caller can
// chain a saveTiers() write against the new product.
async function writeProduct(payload, productId) {
  const isUpdate = !!productId;
  const op = (p) => isUpdate
    ? supabase.from('products').update(p).eq('id', productId).select('id').single()
    : supabase.from('products').insert(p).select('id').single();

  let { data, error } = await op(payload);
  if (error && /sample_currency/i.test(error.message || '')) {
    const { sample_currency: _drop, ...rest } = payload;
    ({ data, error } = await op(rest));
  }
  return { error, id: data?.id || (isUpdate ? productId : null) };
}

// ── Pricing tiers ──────────────────────────────────────────────────────
//
// Ported from web/src/lib/productPricingTiers.js. Three mandatory rows are
// stored in product_pricing_tiers with variant_id = NULL. Tier 1's qty_from
// is bound to MOQ (read-only in the UI); tier 3's qty_to is nullable
// (= unlimited / "∞"). Save uses delete-and-rewrite so reordering or
// removing tiers is straightforward.

const TIER_COUNT = 3;

function emptyTier() { return { qty_from: '', qty_to: '', unit_price: '' }; }
function emptyTiers() { return Array.from({ length: TIER_COUNT }, emptyTier); }
function padTiers(tiers) {
  const out = Array.isArray(tiers) ? tiers.slice(0, TIER_COUNT) : [];
  while (out.length < TIER_COUNT) out.push(emptyTier());
  return out;
}

function tierIntOrNaN(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) && Number.isInteger(n) ? n : NaN;
}
function tierNumOrNaN(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

// Returns null when valid, otherwise a localized error string.
function validateTiers(tiers, moqInt, t) {
  const rows = padTiers(tiers);
  const parsed = rows.map((r) => ({
    qty_from:   tierIntOrNaN(r?.qty_from),
    qty_to:     tierIntOrNaN(r?.qty_to),
    unit_price: tierNumOrNaN(r?.unit_price),
  }));

  // Tier 1's qty_from is bound to MOQ. The UI keeps its input read-only and
  // the form pre-fills it from MOQ; coerce here so blank/typed-other resolves
  // to MOQ at validation time.
  if (Number.isFinite(moqInt) && moqInt >= 1) parsed[0].qty_from = moqInt;

  for (let i = 0; i < TIER_COUNT; i++) {
    const p = parsed[i];
    const n = i + 1;
    if (Number.isNaN(p.qty_from) || Number.isNaN(p.qty_to) || Number.isNaN(p.unit_price)) {
      return t.errorTierNumeric.replace('{n}', String(n));
    }
    if (p.qty_from === null || p.unit_price === null) {
      return t.errorTierMissing.replace('{n}', String(n));
    }
    if (i < TIER_COUNT - 1 && p.qty_to === null) {
      return t.errorTierMissing.replace('{n}', String(n));
    }
    if (p.qty_from < 1) return t.errorTierQtyFromMin.replace('{n}', String(n));
    if (p.unit_price <= 0) return t.errorTierPricePositive.replace('{n}', String(n));
    if (p.qty_to !== null && p.qty_from >= p.qty_to) {
      return t.errorTierQtyOrder.replace('{n}', String(n));
    }
  }

  for (let i = 1; i < TIER_COUNT; i++) {
    const prev = parsed[i - 1];
    const curr = parsed[i];
    if (prev.qty_to !== null && curr.qty_from <= prev.qty_to) {
      return t.errorTierOverlap.replace('{n}', String(i + 1));
    }
  }

  for (let i = 1; i < TIER_COUNT; i++) {
    if (parsed[i].unit_price >= parsed[i - 1].unit_price) {
      return t.errorTierDescending.replace('{n}', String(i + 1));
    }
  }

  return null;
}

async function loadTiers(productId) {
  const { data, error } = await supabase
    .from('product_pricing_tiers')
    .select('qty_from, qty_to, unit_price')
    .eq('product_id', productId)
    .is('variant_id', null)
    .order('qty_from', { ascending: true });
  if (error) {
    console.error('[SupplierProducts] load tiers error:', error);
    return emptyTiers();
  }
  return padTiers((data || []).map((r) => ({
    qty_from:   r.qty_from   != null ? String(r.qty_from)   : '',
    qty_to:     r.qty_to     != null ? String(r.qty_to)     : '',
    unit_price: r.unit_price != null ? String(r.unit_price) : '',
  })));
}

// Delete-and-rewrite. Validation should already have passed before calling
// this. Tier 1's qty_from is coerced to moqInt.
async function saveTiers(productId, tiers, moqInt) {
  if (!productId) return new Error('saveTiers: productId is required');

  const { error: delErr } = await supabase
    .from('product_pricing_tiers')
    .delete()
    .eq('product_id', productId)
    .is('variant_id', null);
  if (delErr) {
    console.error('[SupplierProducts] tier delete error:', delErr);
    return delErr;
  }

  const moqLocked = Number.isFinite(moqInt) && moqInt >= 1;
  const rows = padTiers(tiers).map((r, idx) => {
    let qty_from = tierIntOrNaN(r?.qty_from);
    if (idx === 0 && moqLocked) qty_from = moqInt;
    const qty_to     = tierIntOrNaN(r?.qty_to);
    const unit_price = tierNumOrNaN(r?.unit_price);
    return { product_id: productId, variant_id: null, qty_from, qty_to, unit_price };
  }).filter((r) =>
    Number.isFinite(r.qty_from) && r.qty_from >= 1 &&
    Number.isFinite(r.unit_price) && r.unit_price > 0
  );

  if (!rows.length) return null;

  const { error: insErr } = await supabase.from('product_pricing_tiers').insert(rows);
  if (insErr) {
    console.error('[SupplierProducts] tier insert error:', insErr);
    return insErr;
  }
  return null;
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

  async function openEdit(p) {
    setEditing(p);
    const country = expandStoredSelect(p.country_of_origin, COUNTRY_OPTIONS);
    const port    = expandStoredSelect(p.port_of_loading, PORT_OPTIONS);
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
      // B2B
      country_of_origin: country.selectValue,
      country_of_origin_other: country.otherValue,
      port_of_loading: port.selectValue,
      port_of_loading_other: port.otherValue,
      hs_code: p.hs_code || '',
      units_per_carton: p.units_per_carton != null ? String(p.units_per_carton) : '',
      cbm: p.cbm != null ? String(p.cbm) : '',
      gross_weight_kg: p.gross_weight_kg != null ? String(p.gross_weight_kg) : '',
      net_weight_kg: p.net_weight_kg != null ? String(p.net_weight_kg) : '',
      unit_weight_kg: p.unit_weight_kg != null ? String(p.unit_weight_kg) : '',
      package_dimensions: p.package_dimensions || '',
      lead_time_min_days: p.lead_time_min_days != null ? String(p.lead_time_min_days) : '',
      lead_time_max_days: p.lead_time_max_days != null ? String(p.lead_time_max_days) : '',
      lead_time_negotiable: !!p.lead_time_negotiable,
      price_validity_days: PRICE_VALIDITY_OPTIONS.includes(Number(p.price_validity_days))
        ? Number(p.price_validity_days)
        : 30,
      oem_available: !!p.oem_available,
      odm_available: !!p.odm_available,
      oem_lead_time_min_days: p.oem_lead_time_min_days != null ? String(p.oem_lead_time_min_days) : '',
      oem_lead_time_max_days: p.oem_lead_time_max_days != null ? String(p.oem_lead_time_max_days) : '',
      spec_material: p.spec_material || '',
      spec_dimensions: p.spec_dimensions || '',
      spec_color_options: p.spec_color_options || '',
      spec_packaging_details: p.spec_packaging_details || '',
      spec_customization: p.spec_customization || '',
      // Tiers hydrate asynchronously below; start with empties so the form
      // renders immediately.
      tiers: emptyTiers(),
    });
    setShowForm(true);

    // Load existing pricing tiers in the background. Use the functional
    // setForm so we don't clobber edits the user makes between open and
    // load. We also gate by editing-id to ignore late responses for a
    // closed/changed editor.
    const tiers = await loadTiers(p.id);
    setForm((f) => ({ ...f, tiers }));
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

  function setTier(idx, field, value) {
    setForm((f) => ({
      ...f,
      tiers: f.tiers.map((row, i) => (i === idx ? { ...row, [field]: value } : row)),
    }));
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

    // Lead-time order check (only when both are filled)
    const lmin = parseInt(form.lead_time_min_days, 10);
    const lmax = parseInt(form.lead_time_max_days, 10);
    if (Number.isFinite(lmin) && Number.isFinite(lmax) && lmax < lmin) {
      return t.errorLeadTimeOrder;
    }
    // OEM lead-time order check (only when both are filled, OEM enabled)
    const omin = parseInt(form.oem_lead_time_min_days, 10);
    const omax = parseInt(form.oem_lead_time_max_days, 10);
    if (Number.isFinite(omin) && Number.isFinite(omax) && omax < omin) {
      return t.errorOemLeadTimeOrder;
    }
    // Positive-only checks for filled numeric packaging fields.
    const positive = (raw) => {
      if (raw === '' || raw === null || raw === undefined) return true;
      const n = Number(raw);
      return Number.isFinite(n) && n > 0;
    };
    if (!positive(form.cbm)) return t.errorCbmPositive;
    if (!positive(form.gross_weight_kg) || !positive(form.net_weight_kg)) {
      return t.errorWeightPositive;
    }

    // Pricing tiers — moqInt was checked above, safe to reuse.
    const tierErr = validateTiers(form.tiers, moqInt, t);
    if (tierErr) return tierErr;

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

    // B2B coercion helpers
    const intOrNull = (raw, min = 0) => {
      const n = parseInt(raw, 10);
      return Number.isFinite(n) && n >= min ? n : null;
    };
    const numOrNull = (raw) => {
      if (raw === '' || raw === null || raw === undefined) return null;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    };
    const strOrNull = (raw) => {
      const s = String(raw || '').trim();
      return s ? s : null;
    };

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
      // B2B Logistics
      country_of_origin: resolveSelectOrOther(form.country_of_origin, form.country_of_origin_other),
      port_of_loading:   resolveSelectOrOther(form.port_of_loading, form.port_of_loading_other),
      hs_code: strOrNull(form.hs_code),
      units_per_carton:  intOrNull(form.units_per_carton, 1),
      cbm:               numOrNull(form.cbm),
      gross_weight_kg:   numOrNull(form.gross_weight_kg),
      net_weight_kg:     numOrNull(form.net_weight_kg),
      unit_weight_kg:    numOrNull(form.unit_weight_kg),
      package_dimensions: strOrNull(form.package_dimensions),
      lead_time_min_days: intOrNull(form.lead_time_min_days, 0),
      lead_time_max_days: intOrNull(form.lead_time_max_days, 0),
      lead_time_negotiable: !!form.lead_time_negotiable,
      price_validity_days: PRICE_VALIDITY_OPTIONS.includes(Number(form.price_validity_days))
        ? Number(form.price_validity_days)
        : 30,
      oem_available: !!form.oem_available,
      odm_available: !!form.odm_available,
      oem_lead_time_min_days: form.oem_available ? intOrNull(form.oem_lead_time_min_days, 0) : null,
      oem_lead_time_max_days: form.oem_available ? intOrNull(form.oem_lead_time_max_days, 0) : null,
      spec_material:          strOrNull(form.spec_material),
      spec_dimensions:        strOrNull(form.spec_dimensions),
      spec_color_options:     strOrNull(form.spec_color_options),
      spec_packaging_details: strOrNull(form.spec_packaging_details),
      spec_customization:     strOrNull(form.spec_customization),
      is_active: editing ? !!editing.is_active : true,
    };

    const { error, id: productId } = await writeProduct(payload, editing?.id);

    if (error) {
      setSubmitting(false);
      console.error('[SupplierProducts] save error:', error);
      Alert.alert('', t.errorGeneric);
      return;
    }

    // Tiers are saved AFTER the product so we have a stable productId to
    // attach them to. A tier-save failure surfaces a separate alert but
    // does not block closing — the product itself was saved.
    let tierErr = null;
    if (productId) {
      tierErr = await saveTiers(productId, form.tiers, moqInt);
    }
    setSubmitting(false);

    if (tierErr) {
      console.error('[SupplierProducts] tier save error:', tierErr);
      Alert.alert('', t.errorTierSave);
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

              {/* ── Pricing Tiers ── */}
              <Section title={t.sectionTiers} isAr={isAr}>
                <Text style={[s.fieldHint, isAr && s.rtl, { marginBottom: 12 }]}>
                  {t.tiersHint}
                </Text>

                {/* Column headers */}
                <View style={[s.tierHeaderRow, isAr && s.rowRtl]}>
                  <View style={s.tierLabelCell} />
                  <Text style={[s.tierColLabel, { flex: 1 }]} numberOfLines={1}>
                    {t.tierColMinQty}
                  </Text>
                  <Text style={[s.tierColLabel, { flex: 1 }]} numberOfLines={1}>
                    {t.tierColMaxQty}
                  </Text>
                  <Text style={[s.tierColLabel, { flex: 1.3 }]} numberOfLines={1}>
                    {t.tierColUnitPrice} ({form.currency})
                  </Text>
                </View>

                {form.tiers.map((row, idx) => {
                  const isFirst = idx === 0;
                  const isLast  = idx === form.tiers.length - 1;
                  const moqDisplay = String(form.moq || '').trim();
                  return (
                    <View key={idx} style={[s.tierRow, isAr && s.rowRtl]}>
                      <View style={s.tierLabelCell}>
                        <Text style={s.tierRowLabel} numberOfLines={1}>
                          {t.tierLabel.replace('{n}', String(idx + 1))}
                        </Text>
                      </View>

                      {/* qty_from — tier 1 is bound to MOQ (read-only) */}
                      {isFirst ? (
                        <View style={[s.tierInputDisabled, { flex: 1 }]}>
                          <Text style={s.tierInputDisabledText} numberOfLines={1}>
                            {moqDisplay || '—'}
                          </Text>
                        </View>
                      ) : (
                        <TextInput
                          style={[s.tierInput, { flex: 1 }]}
                          keyboardType="numeric"
                          value={row.qty_from}
                          onChangeText={(v) => setTier(idx, 'qty_from', v.replace(/[^0-9]/g, ''))}
                          placeholderTextColor={C.textDisabled}
                        />
                      )}

                      {/* qty_to — last tier may be blank (∞) */}
                      <TextInput
                        style={[s.tierInput, { flex: 1 }]}
                        keyboardType="numeric"
                        value={row.qty_to}
                        onChangeText={(v) => setTier(idx, 'qty_to', v.replace(/[^0-9]/g, ''))}
                        placeholder={isLast ? t.tierMaxQtyUnlimited : ''}
                        placeholderTextColor={C.textDisabled}
                      />

                      {/* unit_price */}
                      <TextInput
                        style={[s.tierInput, { flex: 1.3 }]}
                        keyboardType="decimal-pad"
                        value={row.unit_price}
                        onChangeText={(v) => setTier(idx, 'unit_price', v)}
                        placeholder="0.00"
                        placeholderTextColor={C.textDisabled}
                      />
                    </View>
                  );
                })}

                <Text style={[s.fieldHint, isAr && s.rtl, { marginTop: 10 }]}>
                  {t.tierMoqAutoNote}
                </Text>
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

              {/* ── B2B Logistics ── */}
              <Section title={t.sectionB2B} isAr={isAr}>

                {/* Shipping & Origin */}
                <SubLabel isAr={isAr}>{t.subShipping}</SubLabel>

                <Text style={[s.fieldLabel, isAr && s.rtl]}>{t.countryOfOrigin}</Text>
                <View style={[s.chipRow, isAr && s.chipRowRtl]}>
                  {COUNTRY_OPTIONS.map((opt) => {
                    const active = form.country_of_origin === opt;
                    return (
                      <TouchableOpacity
                        key={opt}
                        style={[s.chip, active && s.chipActive]}
                        onPress={() => set('country_of_origin', opt)}
                        activeOpacity={0.85}
                      >
                        <Text style={[s.chipText, active && s.chipTextActive]}>{opt}</Text>
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity
                    style={[s.chip, form.country_of_origin === OTHER_SENTINEL && s.chipActive]}
                    onPress={() => set('country_of_origin', OTHER_SENTINEL)}
                    activeOpacity={0.85}
                  >
                    <Text style={[s.chipText, form.country_of_origin === OTHER_SENTINEL && s.chipTextActive]}>
                      {t.otherOption}
                    </Text>
                  </TouchableOpacity>
                </View>
                {form.country_of_origin === OTHER_SENTINEL && (
                  <View style={{ marginTop: 8, marginBottom: 8 }}>
                    <TextInput
                      style={[s.input, isAr && s.rtl]}
                      placeholder={t.countryOtherPlaceholder}
                      placeholderTextColor={C.textDisabled}
                      value={form.country_of_origin_other}
                      onChangeText={(v) => set('country_of_origin_other', v)}
                    />
                  </View>
                )}

                <View style={{ height: 14 }} />

                <Text style={[s.fieldLabel, isAr && s.rtl]}>{t.portOfLoading}</Text>
                <View style={[s.chipRow, isAr && s.chipRowRtl]}>
                  {PORT_OPTIONS.map((opt) => {
                    const active = form.port_of_loading === opt;
                    return (
                      <TouchableOpacity
                        key={opt}
                        style={[s.chip, active && s.chipActive]}
                        onPress={() => set('port_of_loading', opt)}
                        activeOpacity={0.85}
                      >
                        <Text style={[s.chipText, active && s.chipTextActive]}>{opt}</Text>
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity
                    style={[s.chip, form.port_of_loading === OTHER_SENTINEL && s.chipActive]}
                    onPress={() => set('port_of_loading', OTHER_SENTINEL)}
                    activeOpacity={0.85}
                  >
                    <Text style={[s.chipText, form.port_of_loading === OTHER_SENTINEL && s.chipTextActive]}>
                      {t.otherOption}
                    </Text>
                  </TouchableOpacity>
                </View>
                {form.port_of_loading === OTHER_SENTINEL && (
                  <View style={{ marginTop: 8, marginBottom: 8 }}>
                    <TextInput
                      style={[s.input, isAr && s.rtl]}
                      placeholder={t.portOtherPlaceholder}
                      placeholderTextColor={C.textDisabled}
                      value={form.port_of_loading_other}
                      onChangeText={(v) => set('port_of_loading_other', v)}
                    />
                  </View>
                )}

                <View style={{ height: 14 }} />

                <PField
                  label={t.hsCode}
                  value={form.hs_code}
                  onChangeText={(v) => set('hs_code', v)}
                  isAr={isAr}
                />

                {/* Carton */}
                <SubLabel isAr={isAr}>{t.subCarton}</SubLabel>

                <PField
                  label={t.unitsPerCarton}
                  value={form.units_per_carton}
                  onChangeText={(v) => set('units_per_carton', v.replace(/[^0-9]/g, ''))}
                  keyboardType="numeric"
                  isAr={isAr}
                />
                <PField
                  label={t.cbm}
                  value={form.cbm}
                  onChangeText={(v) => set('cbm', v)}
                  keyboardType="decimal-pad"
                  isAr={isAr}
                />
                <PField
                  label={t.grossWeightKg}
                  value={form.gross_weight_kg}
                  onChangeText={(v) => set('gross_weight_kg', v)}
                  keyboardType="decimal-pad"
                  isAr={isAr}
                />
                <PField
                  label={t.netWeightKg}
                  value={form.net_weight_kg}
                  onChangeText={(v) => set('net_weight_kg', v)}
                  keyboardType="decimal-pad"
                  isAr={isAr}
                />
                <PField
                  label={t.unitWeightKg}
                  value={form.unit_weight_kg}
                  onChangeText={(v) => set('unit_weight_kg', v)}
                  keyboardType="decimal-pad"
                  isAr={isAr}
                />
                <PField
                  label={t.packageDimensions}
                  value={form.package_dimensions}
                  onChangeText={(v) => set('package_dimensions', v)}
                  isAr={isAr}
                />

                {/* Lead Time + Price Validity */}
                <SubLabel isAr={isAr}>{t.subLeadTime}</SubLabel>

                <PField
                  label={t.leadTimeMin}
                  value={form.lead_time_min_days}
                  onChangeText={(v) => set('lead_time_min_days', v.replace(/[^0-9]/g, ''))}
                  keyboardType="numeric"
                  isAr={isAr}
                />
                <PField
                  label={t.leadTimeMax}
                  value={form.lead_time_max_days}
                  onChangeText={(v) => set('lead_time_max_days', v.replace(/[^0-9]/g, ''))}
                  keyboardType="numeric"
                  isAr={isAr}
                />

                <TouchableOpacity
                  style={[s.toggleRow, form.lead_time_negotiable && s.toggleRowActive, { marginBottom: 14 }]}
                  onPress={() => set('lead_time_negotiable', !form.lead_time_negotiable)}
                  activeOpacity={0.85}
                >
                  <Text style={[s.toggleRowText, form.lead_time_negotiable && s.toggleRowTextActive]}>
                    {form.lead_time_negotiable ? `✓ ${t.leadTimeNegotiable}` : t.leadTimeNegotiable}
                  </Text>
                </TouchableOpacity>

                <Text style={[s.fieldLabel, isAr && s.rtl]}>{t.priceValidityDays}</Text>
                <View style={[s.pillRow, isAr && s.chipRowRtl]}>
                  {PRICE_VALIDITY_OPTIONS.map((days) => {
                    const active = Number(form.price_validity_days) === days;
                    return (
                      <TouchableOpacity
                        key={days}
                        style={[s.pill, active && s.pillActive]}
                        onPress={() => set('price_validity_days', days)}
                        activeOpacity={0.85}
                      >
                        <Text style={[s.pillText, active && s.pillTextActive]}>
                          {days} {t.priceValidityUnit}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* OEM / ODM */}
                <SubLabel isAr={isAr}>{t.subOemOdm}</SubLabel>

                <View style={{ flexDirection: isAr ? 'row-reverse' : 'row', gap: 10, marginBottom: 14 }}>
                  <TouchableOpacity
                    style={[s.toggleRow, { flex: 1 }, form.oem_available && s.toggleRowActive]}
                    onPress={() => set('oem_available', !form.oem_available)}
                    activeOpacity={0.85}
                  >
                    <Text style={[s.toggleRowText, form.oem_available && s.toggleRowTextActive]}>
                      {form.oem_available ? `✓ ${t.oemAvailable}` : t.oemAvailable}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.toggleRow, { flex: 1 }, form.odm_available && s.toggleRowActive]}
                    onPress={() => set('odm_available', !form.odm_available)}
                    activeOpacity={0.85}
                  >
                    <Text style={[s.toggleRowText, form.odm_available && s.toggleRowTextActive]}>
                      {form.odm_available ? `✓ ${t.odmAvailable}` : t.odmAvailable}
                    </Text>
                  </TouchableOpacity>
                </View>

                {form.oem_available && (
                  <>
                    <PField
                      label={t.oemLeadTimeMin}
                      value={form.oem_lead_time_min_days}
                      onChangeText={(v) => set('oem_lead_time_min_days', v.replace(/[^0-9]/g, ''))}
                      keyboardType="numeric"
                      isAr={isAr}
                    />
                    <PField
                      label={t.oemLeadTimeMax}
                      value={form.oem_lead_time_max_days}
                      onChangeText={(v) => set('oem_lead_time_max_days', v.replace(/[^0-9]/g, ''))}
                      keyboardType="numeric"
                      isAr={isAr}
                    />
                  </>
                )}

                {/* Specs */}
                <SubLabel isAr={isAr}>{t.subSpecs}</SubLabel>

                <PField
                  label={t.specMaterial}
                  value={form.spec_material}
                  onChangeText={(v) => set('spec_material', v)}
                  isAr={isAr}
                />
                <PField
                  label={t.specDimensions}
                  value={form.spec_dimensions}
                  onChangeText={(v) => set('spec_dimensions', v)}
                  isAr={isAr}
                />
                <PField
                  label={t.specColorOptions}
                  value={form.spec_color_options}
                  onChangeText={(v) => set('spec_color_options', v)}
                  isAr={isAr}
                />
                <PField
                  label={t.specPackagingDetails}
                  value={form.spec_packaging_details}
                  onChangeText={(v) => set('spec_packaging_details', v)}
                  multiline
                  numberOfLines={2}
                  isAr={isAr}
                />
                <PField
                  label={t.specCustomization}
                  value={form.spec_customization}
                  onChangeText={(v) => set('spec_customization', v)}
                  multiline
                  numberOfLines={2}
                  isAr={isAr}
                />
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

function SubLabel({ isAr, children }) {
  return (
    <View style={s.subLabelWrap}>
      <Text style={[s.subLabel, isAr && s.rtl]}>{children}</Text>
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
  subLabelWrap: {
    marginTop: 6, marginBottom: 10,
    paddingTop: 10,
    borderTopWidth: 1, borderTopColor: C.borderSubtle,
  },
  subLabel: {
    color: C.textSecondary, fontSize: 12, fontFamily: F.arSemi,
    letterSpacing: 0.3,
  },

  // Pricing tiers — compact 3-input row per tier
  tierHeaderRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 6, paddingHorizontal: 4, marginBottom: 6,
  },
  tierLabelCell: { width: 56 },
  tierColLabel: {
    color: C.textTertiary, fontSize: 11, fontFamily: F.ar,
    textAlign: 'center',
  },
  tierRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 6, marginBottom: 8,
  },
  tierRowLabel: {
    color: C.textSecondary, fontSize: 12, fontFamily: F.arSemi,
  },
  tierInput: {
    backgroundColor: C.bgBase, borderRadius: 10,
    borderWidth: 1, borderColor: C.borderMuted,
    paddingHorizontal: 8, paddingVertical: 10,
    color: C.textPrimary, fontSize: 14, fontFamily: F.num,
    textAlign: 'center',
  },
  tierInputDisabled: {
    backgroundColor: C.bgOverlay, borderRadius: 10,
    borderWidth: 1, borderColor: C.borderMuted,
    paddingHorizontal: 8, paddingVertical: 10,
    alignItems: 'center', justifyContent: 'center',
    minHeight: 42,
  },
  tierInputDisabledText: {
    color: C.textTertiary, fontSize: 14, fontFamily: F.num,
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
