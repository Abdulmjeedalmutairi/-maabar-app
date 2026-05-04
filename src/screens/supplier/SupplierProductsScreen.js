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
  LayoutAnimation, UIManager,
} from 'react-native';

// Android requires an experimental opt-in for LayoutAnimation. Safe to call
// once at module load — it's a no-op on iOS and on subsequent calls.
if (Platform.OS === 'android' && UIManager?.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
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

// Quality certifications — mirror web/src/lib/productCertifications.js
const CERT_TYPES     = ['SASO', 'CE', 'FCC', 'RoHS', 'ISO', 'FDA', 'HALAL', 'OTHER'];
const CERT_MAX_COUNT = 10;
const CERT_MAX_BYTES = 10 * 1024 * 1024;
const CERT_BUCKET    = 'product-certifications';

const B2B_COLUMNS =
  'hs_code, country_of_origin, port_of_loading, ' +
  'units_per_carton, cbm, gross_weight_kg, net_weight_kg, ' +
  'unit_weight_kg, package_dimensions, ' +
  'lead_time_min_days, lead_time_max_days, lead_time_negotiable, ' +
  'price_validity_days, ' +
  'oem_available, odm_available, oem_lead_time_min_days, oem_lead_time_max_days, ' +
  'spec_material, spec_dimensions, spec_color_options, ' +
  'spec_packaging_details, spec_customization';

// price_from was dropped from public.products in Phase 4 of the web app
// — pricing now lives entirely in product_pricing_tiers (loaded separately
// via loadTiers). Selecting it here returned 400 from PostgREST.
const PRODUCT_SELECT_FULL =
  'id, name_ar, name_en, name_zh, desc_ar, desc_en, desc_zh, ' +
  'currency, moq, category, incoterms, has_variants, ' +
  'image_url, gallery_images, video_url, ' +
  'sample_available, sample_price, sample_currency, sample_max_qty, sample_note, ' +
  B2B_COLUMNS + ', ' +
  'supplier_id, is_active, created_at';

const PRODUCT_SELECT_NO_SC =
  'id, name_ar, name_en, name_zh, desc_ar, desc_en, desc_zh, ' +
  'currency, moq, category, incoterms, has_variants, ' +
  'image_url, gallery_images, video_url, ' +
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
    sectionCerts: 'شهادات الجودة',
    sectionMedia: 'الصور',
    sectionVariants: 'الخيارات والمتغيرات',
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
    videoLabel: 'الفيديو (اختياري)',
    videoPickBtn: '+ رفع فيديو',
    videoUploadedLabel: 'تم رفع الفيديو',

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

    certsHint: 'أضف شهادات الجودة لمنتجك (حتى ١٠ شهادات).',
    certNoneYet: 'لم تُضف شهادات بعد.',
    certAddBtn: '+ إضافة شهادة',
    certTypeLabel: 'نوع الشهادة',
    certLabelLabel: 'اسم الشهادة',
    certLabelHint: 'مثال: ISO 9001:2015',
    certLabelOtherHint: 'مطلوب عند اختيار "أخرى"',
    certIssuedLabel: 'تاريخ الإصدار (اختياري)',
    certExpiryLabel: 'تاريخ الانتهاء (اختياري)',
    certUploadFile: 'رفع ملف (PDF أو صورة)',
    certReplaceFile: 'استبدال الملف',
    certUploadedLabel: 'تم الرفع',
    certPendingLabel: 'بانتظار الحفظ',
    certUploadingLabel: 'جاري الرفع...',
    certMaxReached: 'تم الوصول إلى الحد الأقصى للشهادات.',
    certTooLarge: 'الملف كبير جدًا. الحد الأقصى 10 ميجا.',
    certWrongType: 'النوع غير مدعوم. الرجاء PDF أو صورة.',
    certUploadFailed: 'فشل رفع الملف.',
    errorCertSave: 'تم حفظ المنتج، لكن فشل حفظ الشهادات',

    hasVariantsOn:  '✓ هذا المنتج له خيارات / متغيرات',
    hasVariantsOff: 'هذا المنتج له خيارات / متغيرات',
    hasVariantsHint: 'فعّل هذا الخيار إذا كان منتجك متوفرًا بألوان أو مقاسات أو إصدارات مختلفة. سيتم إخفاء الشرائح السعرية الموحدة أعلاه.',
    addOption: '+ إضافة خيار',
    optionLabelN: 'الخيار {n}',
    optionName: 'اسم الخيار (مثال: اللون، المقاس)',
    optionValuesLabel: 'القيم',
    optionValuesPlaceholder: 'اكتب قيمة ثم اضغط Enter',
    addValueBtn: '+ إضافة قيمة',
    removeOptionBtn: 'حذف',
    variantsMatrixTitle: 'مصفوفة المتغيرات',
    variantsAutoNote: 'تُولّد المتغيرات تلقائيًا من جميع التركيبات الممكنة لقيم الخيارات.',
    noVariantsYet: 'أضف خيارًا واحدًا على الأقل مع قيم لتوليد المصفوفة.',
    variantSku: 'SKU',
    variantStock: 'المخزون (فارغ = ∞)',
    variantImage: 'صورة المتغير',
    variantPickImage: 'اختر صورة',
    variantChangeImage: 'تغيير الصورة',
    variantRemoveImage: 'إزالة',

    errorVariantNoOptions: 'فعّلت "خيارات" لكن لم تُضف أي متغيرات. أضف خيارًا واحدًا على الأقل مع قيم.',
    errorVariantNoSku: '{label}: SKU مطلوب',
    errorVariantsSave: 'تم حفظ المنتج، لكن فشل حفظ المتغيرات',
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
    sectionCerts: 'Quality Certifications',
    sectionMedia: 'Images',
    sectionVariants: 'Options & Variants',
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
    videoLabel: 'Video (optional)',
    videoPickBtn: '+ Upload video',
    videoUploadedLabel: 'Video uploaded',

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

    certsHint: 'Add quality certifications for your product (up to 10).',
    certNoneYet: 'No certifications added yet.',
    certAddBtn: '+ Add certification',
    certTypeLabel: 'Cert type',
    certLabelLabel: 'Cert name',
    certLabelHint: 'e.g. ISO 9001:2015',
    certLabelOtherHint: 'Required when "Other" is selected',
    certIssuedLabel: 'Issued date (optional)',
    certExpiryLabel: 'Expiry date (optional)',
    certUploadFile: 'Upload file (PDF or image)',
    certReplaceFile: 'Replace file',
    certUploadedLabel: 'Uploaded',
    certPendingLabel: 'Pending save',
    certUploadingLabel: 'Uploading...',
    certMaxReached: 'Certification limit reached.',
    certTooLarge: 'File too large. Max 10 MB.',
    certWrongType: 'Unsupported type. Please pick a PDF or image.',
    certUploadFailed: 'Upload failed.',
    errorCertSave: 'Product saved, but certifications failed to save',

    hasVariantsOn:  '✓ This product has options / variants',
    hasVariantsOff: 'This product has options / variants',
    hasVariantsHint: 'Turn this on if your product comes in different colors, sizes, or versions. The single pricing tiers above will be hidden.',
    addOption: '+ Add option',
    optionLabelN: 'Option {n}',
    optionName: 'Option name (e.g. Color, Size)',
    optionValuesLabel: 'Values',
    optionValuesPlaceholder: 'Type a value, press Enter',
    addValueBtn: '+ Add value',
    removeOptionBtn: 'Delete',
    variantsMatrixTitle: 'Variant Matrix',
    variantsAutoNote: 'Variants are auto-generated from every combination of option values.',
    noVariantsYet: 'Add at least one option with values to generate the matrix.',
    variantSku: 'SKU',
    variantStock: 'Stock (blank = ∞)',
    variantImage: 'Variant image',
    variantPickImage: 'Pick image',
    variantChangeImage: 'Change image',
    variantRemoveImage: 'Remove',

    errorVariantNoOptions: 'You turned on options but no variants were generated. Add at least one option with values.',
    errorVariantNoSku: '{label}: SKU is required',
    errorVariantsSave: 'Product saved, but variants failed to save',
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
    sectionCerts: '质量认证',
    sectionMedia: '产品图片',
    sectionVariants: '选项与规格',
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
    videoLabel: '视频（可选）',
    videoPickBtn: '+ 上传视频',
    videoUploadedLabel: '视频已上传',

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

    certsHint: '为您的产品添加质量认证（最多 10 项）。',
    certNoneYet: '尚未添加认证。',
    certAddBtn: '+ 添加认证',
    certTypeLabel: '认证类型',
    certLabelLabel: '认证名称',
    certLabelHint: '例：ISO 9001:2015',
    certLabelOtherHint: '选择「其他」时必填',
    certIssuedLabel: '颁发日期（可选）',
    certExpiryLabel: '有效期至（可选）',
    certUploadFile: '上传文件（PDF 或图片）',
    certReplaceFile: '替换文件',
    certUploadedLabel: '已上传',
    certPendingLabel: '待保存',
    certUploadingLabel: '上传中...',
    certMaxReached: '已达认证数量上限。',
    certTooLarge: '文件过大，上限 10 MB。',
    certWrongType: '不支持该文件类型，请选择 PDF 或图片。',
    certUploadFailed: '文件上传失败。',
    errorCertSave: '产品已保存，但认证保存失败',

    hasVariantsOn:  '✓ 此产品有选项 / 多规格',
    hasVariantsOff: '此产品有选项 / 多规格',
    hasVariantsHint: '如果产品有不同颜色、尺码或版本，请打开此项。上方的统一阶梯定价将隐藏。',
    addOption: '+ 添加选项',
    optionLabelN: '选项 {n}',
    optionName: '选项名（例：颜色、尺寸）',
    optionValuesLabel: '取值',
    optionValuesPlaceholder: '输入值，按 Enter',
    addValueBtn: '+ 添加值',
    removeOptionBtn: '删除',
    variantsMatrixTitle: '规格矩阵',
    variantsAutoNote: '规格根据所有选项取值的组合自动生成。',
    noVariantsYet: '请先添加至少一个带取值的选项以生成矩阵。',
    variantSku: 'SKU',
    variantStock: '库存（空 = ∞）',
    variantImage: '规格图片',
    variantPickImage: '选择图片',
    variantChangeImage: '更换图片',
    variantRemoveImage: '移除',

    errorVariantNoOptions: '已开启「选项」但未生成规格。请添加至少一个带取值的选项。',
    errorVariantNoSku: '{label}：SKU 必填',
    errorVariantsSave: '产品已保存，但规格保存失败',
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
  video_url: null,
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
  // Variants subsystem — when has_variants is true, the product-level
  // tiers above are ignored and per-variant tiers (in varVariants) are
  // used instead. varVariants is regenerated from varOptions whenever
  // options/values change.
  has_variants: false,
  varOptions: [],
  varVariants: [],
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

async function uploadProductVideo(uri, mimeType, userId, ext) {
  const e = (ext || (mimeType?.includes('quicktime') ? 'mov' : 'mp4')).toLowerCase();
  const path = `${userId}/video_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${e}`;
  const ab = await fetch(uri).then((r) => r.arrayBuffer());
  const { error } = await supabase.storage.from('product-images').upload(path, ab, {
    contentType: mimeType || 'video/mp4',
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

// ── Quality certifications ─────────────────────────────────────────────
//
// Ported from web/src/lib/productCertifications.js. Form holds an array
// of cert rows — each new row carries `_pendingFile` (the picked
// uri/mime/name) until save, then we upload and insert. Existing rows
// keep their `id` so the diff phase can compute deletions. Storage path:
//   product-certifications/<userId>/<productId>/<TYPE>_<timestamp>.<ext>

let _certKeyCounter = 0;
const certKey = () => `c${++_certKeyCounter}_${Date.now()}`;

function emptyCertRow() {
  return {
    _key: certKey(),
    cert_type: '',
    cert_label: '',
    cert_file_url: '',
    issued_date: '',
    expiry_date: '',
    _pendingFile: null,
    _uploading: false,
    _error: null,
  };
}

async function loadProductCertifications(productId) {
  if (!productId) return [];
  const { data, error } = await supabase
    .from('product_certifications')
    .select('id, cert_type, cert_label, cert_file_url, issued_date, expiry_date, created_at')
    .eq('product_id', productId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('[SupplierProducts] load certs error:', error);
    return [];
  }
  return (data || []).map((r) => ({
    _key: r.id,
    id: r.id,
    cert_type: r.cert_type || '',
    cert_label: r.cert_label || '',
    cert_file_url: r.cert_file_url || '',
    issued_date: r.issued_date || '',
    expiry_date: r.expiry_date || '',
    _pendingFile: null,
    _uploading: false,
    _error: null,
  }));
}

async function uploadCertFile(file, { userId, productId, certType }) {
  const safeType = String(certType || 'OTHER').replace(/[^A-Za-z0-9_-]/g, '');
  const rawExt   = (file.ext || file.name?.split('.').pop() || '').toLowerCase();
  const ext      = /^[a-z0-9]{1,6}$/.test(rawExt)
    ? rawExt
    : (file.mimeType?.includes('pdf') ? 'pdf' : 'jpg');
  const path = `${userId}/${productId}/${safeType}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
  const ab   = await fetch(file.uri).then((r) => r.arrayBuffer());
  const { error } = await supabase.storage.from(CERT_BUCKET).upload(path, ab, {
    contentType: file.mimeType || 'application/octet-stream',
    upsert: true,
  });
  if (error) {
    console.error('[SupplierProducts] cert upload error:', error);
    return { error };
  }
  const { data } = supabase.storage.from(CERT_BUCKET).getPublicUrl(path);
  return { url: data?.publicUrl || null };
}

// Derive the path-inside-bucket from a public URL so we can call
// storage.remove(). Returns null when the URL doesn't belong to our bucket
// (e.g. legacy / external URL) — caller skips the delete in that case.
function pathInCertBucket(url) {
  if (!url) return null;
  try {
    const u = new URL(String(url));
    const marker = `/storage/v1/object/public/${CERT_BUCKET}/`;
    const idx = u.pathname.indexOf(marker);
    if (idx < 0) return null;
    const rest = u.pathname.slice(idx + marker.length);
    return rest ? decodeURIComponent(rest) : null;
  } catch (_e) {
    return null;
  }
}

async function removeCertObject(url) {
  const path = pathInCertBucket(url);
  if (!path) return;
  try {
    const { error } = await supabase.storage.from(CERT_BUCKET).remove([path]);
    if (error) console.warn('[SupplierProducts] cert object remove:', error.message);
  } catch (e) {
    console.warn('[SupplierProducts] cert object remove exception:', e?.message || e);
  }
}

// Diff-based save:
//   • prev rows missing from next → delete (DB row + storage object)
//   • next rows without id        → upload _pendingFile (if any) + insert
//   • saved rows whose file was cleared in the form → delete the storage
//     object and null out cert_file_url on the existing DB row
async function saveProductCertifications({ productId, userId, nextCerts, prevCerts }) {
  if (!productId || !userId) return new Error('productId and userId required');
  const safeNext = Array.isArray(nextCerts) ? nextCerts : [];
  const safePrev = Array.isArray(prevCerts) ? prevCerts : [];

  // Removed rows
  const nextIds = new Set(safeNext.filter((c) => c?.id).map((c) => c.id));
  const removed = safePrev.filter((p) => p?.id && !nextIds.has(p.id));
  for (const r of removed) {
    if (r.cert_file_url) await removeCertObject(r.cert_file_url);
    const { error: delErr } = await supabase
      .from('product_certifications').delete().eq('id', r.id);
    if (delErr) console.error('[SupplierProducts] cert delete error:', delErr);
  }

  // File-only changes on already-saved rows
  for (const cert of safeNext) {
    if (!cert.id) continue;
    const prev = safePrev.find((p) => p?.id === cert.id);
    if (!prev) continue;
    if (prev.cert_file_url && !cert.cert_file_url) {
      await removeCertObject(prev.cert_file_url);
      const { error: updErr } = await supabase
        .from('product_certifications')
        .update({ cert_file_url: null })
        .eq('id', cert.id);
      if (updErr) console.error('[SupplierProducts] cert file-clear error:', updErr);
    }
  }

  // Insert new rows (no id). Skip silently when type is missing or OTHER
  // is missing a label — matches web's saveProductCertifications.
  for (const cert of safeNext) {
    if (cert.id) continue;
    const certType = String(cert.cert_type || '').toUpperCase();
    if (!CERT_TYPES.includes(certType)) continue;
    if (certType === 'OTHER' && !String(cert.cert_label || '').trim()) continue;

    let fileUrl = cert.cert_file_url || null;
    if (cert._pendingFile) {
      const uploaded = await uploadCertFile(cert._pendingFile, { userId, productId, certType });
      if (uploaded?.error) continue;
      fileUrl = uploaded.url;
    }

    const row = {
      product_id: productId,
      cert_type: certType,
      cert_label: cert.cert_label ? String(cert.cert_label).trim() || null : null,
      cert_file_url: fileUrl,
      issued_date: cert.issued_date || null,
      expiry_date: cert.expiry_date || null,
    };
    const { error: insErr } = await supabase.from('product_certifications').insert(row);
    if (insErr) {
      console.error('[SupplierProducts] cert insert error:', insErr);
      // Cleanup orphan storage object so we don't leak files.
      if (fileUrl && !cert.cert_file_url) await removeCertObject(fileUrl);
    }
  }

  return null;
}

// ── Variants subsystem ────────────────────────────────────────────────
//
// Form shape:
//   form.has_variants    : boolean — when true, replaces product-level
//                          tiers with per-variant tiers
//   form.varOptions      : array of { _key, name, values: [{_key, value}] }
//   form.varVariants     : array of { _key, combo, sku, stock, image_url,
//                                     tiers: [{qty_from,qty_to,unit_price}*3] }
//                          regenerated whenever options/values change so
//                          the cartesian product stays in sync.
//
// DB shape (matches 20260420000001_product_variants_system.sql):
//   product_options.name_zh is NOT NULL — the form's single `name` is
//   written to BOTH name_zh AND name_en so buyer-side rendering sees a
//   useful label regardless of language. Same for option_values.value_zh /
//   value_en. (Web maintains separate trilingual fields; the user spec for
//   this PR is single-string per option/value.)
//
// Save is delete-and-rewrite, mirroring the tiers helpers. ON DELETE
// CASCADE on product_options → product_option_values means we only need
// to delete options + variants — the values + variant tiers fall away.

let _varKeyCounter = 0;
const varKey = () => `v${++_varKeyCounter}_${Date.now()}`;

function emptyOptionRow()       { return { _key: varKey(), name: '', values: [] }; }
function emptyOptionValue()     { return { _key: varKey(), value: '' }; }
function emptyVariantTier()     { return { qty_from: '', qty_to: '', unit_price: '' }; }
function emptyVariantTiers()    { return [emptyVariantTier(), emptyVariantTier(), emptyVariantTier()]; }

function variantComboKey(combo) {
  return combo.map((c) => `${c.optionKey}:${c.valueKey}`).join('|');
}

function emptyVariant(combo) {
  return {
    _key: variantComboKey(combo),
    combo,
    sku: '',
    stock: '',
    image_url: null,
    tiers: emptyVariantTiers(),
  };
}

function cartesian(arrays) {
  if (!arrays.length) return [];
  return arrays.reduce(
    (acc, arr) => acc.flatMap((x) => arr.map((y) => [...x, y])),
    [[]],
  );
}

// Given the current options array and existing variants, regenerate the
// variants list so it matches the cartesian product of all option values.
// Existing variant data (sku, stock, tiers, image) is preserved by combo
// key — switching a value's order or adding a new value won't wipe out
// the user's input on unaffected combos.
function regenerateVariants(options, existingVariants) {
  const activeOptions = (options || []).filter((o) =>
    Array.isArray(o.values)
    && o.values.some((v) => String(v.value || '').trim()),
  );
  if (!activeOptions.length) return [];

  const axes = activeOptions.map((o) =>
    o.values
      .filter((v) => String(v.value || '').trim())
      .map((v) => ({ optionKey: o._key, valueKey: v._key })),
  );
  const combos = cartesian(axes);

  const existingMap = new Map();
  for (const v of (existingVariants || [])) existingMap.set(v._key, v);

  return combos.map((combo) => {
    const key  = variantComboKey(combo);
    const prev = existingMap.get(key);
    return prev ? { ...prev, _key: key, combo } : emptyVariant(combo);
  });
}

// Resolve a variant's combo into a human label using the user's option
// names — e.g. ["Red / S"]. Used for rendering each variant card header.
function variantLabel(combo, options) {
  return combo.map(({ optionKey, valueKey }) => {
    const opt = options.find((o) => o._key === optionKey);
    const val = opt?.values.find((v) => v._key === valueKey);
    return String(val?.value || '').trim() || '?';
  }).join(' / ');
}

// Validate the variants subsystem when has_variants is on. Returns a
// localized error string or null. Does NOT validate product-level tiers
// (those are skipped when has_variants is on).
function validateVariantsSubsystem(options, variants, t) {
  const validOpts = (options || []).filter(
    (o) => String(o.name || '').trim()
        && Array.isArray(o.values)
        && o.values.some((v) => String(v.value || '').trim()),
  );
  if (!validOpts.length) return t.errorVariantNoOptions;
  if (!Array.isArray(variants) || !variants.length) return t.errorVariantNoOptions;

  for (let i = 0; i < variants.length; i++) {
    const v = variants[i];
    const label = variantLabel(v.combo, options) || `#${i + 1}`;
    if (!String(v.sku || '').trim()) {
      return t.errorVariantNoSku.replace('{label}', label);
    }
    // Reuse the product-tier validator. moqInt is not bound here — pass
    // 1 so tier 1 qty_from must just be ≥ 1, which the validator already
    // enforces via tierValidationQtyFromMin.
    const tierErr = validateTiers(v.tiers, 1, t);
    if (tierErr) {
      return `${label} — ${tierErr}`;
    }
  }
  return null;
}

async function loadVariantsSubsystem(productId) {
  if (!productId) return { options: [], variants: [] };

  const [optsRes, varsRes, tiersRes] = await Promise.all([
    supabase.from('product_options')
      .select('id, name_zh, name_en, display_order')
      .eq('product_id', productId)
      .order('display_order', { ascending: true }),
    supabase.from('product_variants')
      .select('id, sku, option_values, stock, image_url')
      .eq('product_id', productId)
      .order('created_at', { ascending: true }),
    supabase.from('product_pricing_tiers')
      .select('variant_id, qty_from, qty_to, unit_price')
      .eq('product_id', productId)
      .not('variant_id', 'is', null)
      .order('qty_from', { ascending: true }),
  ]);

  if (optsRes.error || varsRes.error || tiersRes.error) {
    console.error('[SupplierProducts] load variants error:',
      optsRes.error || varsRes.error || tiersRes.error);
    return { options: [], variants: [] };
  }

  // Need each option's values too. Pull them in one fetch.
  const optionIds = (optsRes.data || []).map((o) => o.id);
  let valuesByOption = new Map();
  if (optionIds.length) {
    const { data: valRows, error: valErr } = await supabase
      .from('product_option_values')
      .select('id, option_id, value_zh, value_en, display_order')
      .in('option_id', optionIds)
      .order('display_order', { ascending: true });
    if (valErr) {
      console.error('[SupplierProducts] load option values error:', valErr);
    } else {
      for (const row of (valRows || [])) {
        const list = valuesByOption.get(row.option_id) || [];
        list.push({
          _key: row.id, // stable key from DB so combo keys match below
          dbId: row.id,
          value: row.value_en || row.value_zh || '',
        });
        valuesByOption.set(row.option_id, list);
      }
    }
  }

  const options = (optsRes.data || []).map((o) => ({
    _key: o.id,
    dbId: o.id,
    name: o.name_en || o.name_zh || '',
    values: valuesByOption.get(o.id) || [],
  }));

  // Group tiers by variant_id and pad to 3.
  const tiersByVariant = new Map();
  for (const t of (tiersRes.data || [])) {
    if (!t.variant_id) continue;
    const list = tiersByVariant.get(t.variant_id) || [];
    list.push({
      qty_from:   t.qty_from   != null ? String(t.qty_from)   : '',
      qty_to:     t.qty_to     != null ? String(t.qty_to)     : '',
      unit_price: t.unit_price != null ? String(t.unit_price) : '',
    });
    tiersByVariant.set(t.variant_id, list);
  }

  const variants = (varsRes.data || []).map((v) => {
    // option_values is a jsonb [{option_id, value_id}, …] — translate to
    // our combo shape using the DB ids as our local _keys.
    const ovList = Array.isArray(v.option_values) ? v.option_values : [];
    const combo  = ovList.map((ov) => ({
      optionKey: ov.option_id,
      valueKey:  ov.value_id,
    }));
    const tiers  = tiersByVariant.get(v.id) || [];
    while (tiers.length < 3) tiers.push(emptyVariantTier());
    return {
      _key: variantComboKey(combo),
      combo,
      sku: v.sku || '',
      stock: v.stock != null ? String(v.stock) : '',
      image_url: v.image_url || null,
      tiers: tiers.slice(0, 3),
    };
  });

  return { options, variants };
}

// Delete-and-rewrite the variants subsystem. Cascades:
//   delete product_options → product_option_values
//   delete product_variants → product_pricing_tiers (variant rows)
// We also explicitly delete product-level tiers so toggling has_variants
// across saves doesn't leave orphans of either flavor.
async function saveVariantsSubsystem(productId, options, variants) {
  if (!productId) return new Error('saveVariantsSubsystem: productId required');

  // Wipe everything first.
  const { error: delTiers } = await supabase
    .from('product_pricing_tiers').delete().eq('product_id', productId);
  if (delTiers) {
    console.error('[SupplierProducts] variant tiers delete:', delTiers);
    return delTiers;
  }
  const { error: delVars } = await supabase
    .from('product_variants').delete().eq('product_id', productId);
  if (delVars) {
    console.error('[SupplierProducts] variants delete:', delVars);
    return delVars;
  }
  const { error: delOpts } = await supabase
    .from('product_options').delete().eq('product_id', productId);
  if (delOpts) {
    console.error('[SupplierProducts] options delete:', delOpts);
    return delOpts;
  }

  // Filter out empty options (no name OR no usable values) — silently,
  // the form-level validator already rejected these for has_variants on.
  const cleanOpts = (options || []).filter((o) =>
    String(o.name || '').trim()
    && Array.isArray(o.values)
    && o.values.some((v) => String(v.value || '').trim()),
  );
  if (!cleanOpts.length) return null;

  // 1) Insert options. Use Promise.all so we get back ids in form order.
  const optionDbIds = new Map(); // form _key → db id
  for (let i = 0; i < cleanOpts.length; i++) {
    const o = cleanOpts[i];
    const name = String(o.name).trim();
    const { data, error } = await supabase
      .from('product_options')
      .insert({
        product_id: productId,
        name_zh: name,
        name_en: name, // mirror so buyers see a label regardless of lang
        display_order: i,
        input_type: 'select',
      })
      .select('id').single();
    if (error) {
      console.error('[SupplierProducts] option insert:', error);
      return error;
    }
    optionDbIds.set(o._key, data.id);
  }

  // 2) Insert option values per option.
  const valueDbIds = new Map(); // form value _key → db id
  for (const o of cleanOpts) {
    const optionId = optionDbIds.get(o._key);
    const cleanValues = o.values.filter((v) => String(v.value || '').trim());
    for (let j = 0; j < cleanValues.length; j++) {
      const v = cleanValues[j];
      const value = String(v.value).trim();
      const { data, error } = await supabase
        .from('product_option_values')
        .insert({
          option_id: optionId,
          value_zh: value,
          value_en: value,
          display_order: j,
        })
        .select('id').single();
      if (error) {
        console.error('[SupplierProducts] option_value insert:', error);
        return error;
      }
      valueDbIds.set(v._key, data.id);
    }
  }

  // 3) Insert variants — translate combo to {option_id, value_id} pairs.
  for (const v of (variants || [])) {
    const optionValuesJson = (v.combo || []).map((c) => ({
      option_id: optionDbIds.get(c.optionKey),
      value_id:  valueDbIds.get(c.valueKey),
    })).filter((p) => p.option_id && p.value_id);

    if (!optionValuesJson.length) continue;

    const stockInt = (() => {
      if (v.stock === '' || v.stock === null || v.stock === undefined) return null;
      const n = parseInt(v.stock, 10);
      return Number.isFinite(n) && n >= 0 ? n : null;
    })();

    const { data: vRow, error: vErr } = await supabase
      .from('product_variants')
      .insert({
        product_id: productId,
        sku: String(v.sku || '').trim() || null,
        option_values: optionValuesJson,
        stock: stockInt,
        image_url: v.image_url || null,
        is_active: true,
      })
      .select('id').single();
    if (vErr) {
      console.error('[SupplierProducts] variant insert:', vErr);
      return vErr;
    }
    const variantId = vRow.id;

    // 4) Insert this variant's pricing tiers.
    const tierRows = (Array.isArray(v.tiers) ? v.tiers : []).slice(0, 3).map((r) => {
      const qty_from   = tierIntOrNaN(r?.qty_from);
      const qty_to     = tierIntOrNaN(r?.qty_to);
      const unit_price = tierNumOrNaN(r?.unit_price);
      return { product_id: productId, variant_id: variantId, qty_from, qty_to, unit_price };
    }).filter((r) =>
      Number.isFinite(r.qty_from) && r.qty_from >= 1 &&
      Number.isFinite(r.unit_price) && r.unit_price > 0,
    );
    if (tierRows.length) {
      const { error: tErr } = await supabase.from('product_pricing_tiers').insert(tierRows);
      if (tErr) {
        console.error('[SupplierProducts] variant tier insert:', tErr);
        return tErr;
      }
    }
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
  const [uploadingVideo, setUploadingVideo]     = useState(false);
  const [certs, setCerts]                       = useState([]);
  const [prevCerts, setPrevCerts]               = useState([]);

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
    setCerts([]);
    setPrevCerts([]);
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
      video_url: p.video_url || null,
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
    // Reset certs synchronously; they hydrate below alongside tiers.
    setCerts([]);
    setPrevCerts([]);
    setShowForm(true);

    // Load existing pricing tiers and certifications in parallel. Use the
    // functional setForm so we don't clobber edits the user makes between
    // open and load. prevCerts captures the original DB state so the diff
    // save can compute deletions.
    const [tiers, loadedCerts, variantData] = await Promise.all([
      loadTiers(p.id),
      loadProductCertifications(p.id),
      loadVariantsSubsystem(p.id),
    ]);
    setForm((f) => ({
      ...f,
      tiers,
      has_variants: !!p.has_variants,
      varOptions:  variantData.options,
      varVariants: variantData.variants,
    }));
    setCerts(loadedCerts);
    setPrevCerts(loadedCerts);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setCerts([]);
    setPrevCerts([]);
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

  // ── Variants subsystem handlers ──────────────────────────────────────
  // Whenever options/values change, regenerate the variants array so the
  // matrix reflects the current cartesian product. Existing per-variant
  // data is preserved by combo key (see regenerateVariants).
  function setVarOptions(updater) {
    setForm((f) => {
      const newOptions  = typeof updater === 'function' ? updater(f.varOptions) : updater;
      const newVariants = regenerateVariants(newOptions, f.varVariants);
      return { ...f, varOptions: newOptions, varVariants: newVariants };
    });
  }

  function toggleHasVariants() {
    setForm((f) => {
      const next = !f.has_variants;
      // Toggling ON: leave product-level tiers in state but they're
      // ignored at save. Toggling OFF: clear options/variants so user
      // doesn't accidentally re-save stale data.
      if (!next) {
        return { ...f, has_variants: false, varOptions: [], varVariants: [] };
      }
      return { ...f, has_variants: true };
    });
  }

  function addVarOption() {
    setVarOptions((opts) => [...opts, emptyOptionRow()]);
  }
  function removeVarOption(optionKey) {
    setVarOptions((opts) => opts.filter((o) => o._key !== optionKey));
  }
  function setVarOptionName(optionKey, name) {
    setVarOptions((opts) =>
      opts.map((o) => (o._key === optionKey ? { ...o, name } : o)),
    );
  }
  function addVarOptionValue(optionKey, raw) {
    const value = String(raw || '').trim();
    if (!value) return;
    setVarOptions((opts) => opts.map((o) => {
      if (o._key !== optionKey) return o;
      // Skip duplicates (case-insensitive) so the matrix doesn't get
      // confused by visually-identical combos.
      const already = o.values.some(
        (v) => String(v.value || '').trim().toLowerCase() === value.toLowerCase(),
      );
      if (already) return o;
      return { ...o, values: [...o.values, { ...emptyOptionValue(), value }] };
    }));
  }
  function removeVarOptionValue(optionKey, valueKey) {
    setVarOptions((opts) => opts.map((o) =>
      o._key === optionKey
        ? { ...o, values: o.values.filter((v) => v._key !== valueKey) }
        : o,
    ));
  }

  function updateVariant(variantKey, patch) {
    setForm((f) => ({
      ...f,
      varVariants: f.varVariants.map((v) =>
        v._key === variantKey ? { ...v, ...patch } : v,
      ),
    }));
  }
  function setVariantTierField(variantKey, tierIdx, field, value) {
    setForm((f) => ({
      ...f,
      varVariants: f.varVariants.map((v) => {
        if (v._key !== variantKey) return v;
        const newTiers = (v.tiers || emptyVariantTiers()).map((row, i) =>
          i === tierIdx ? { ...row, [field]: value } : row,
        );
        return { ...v, tiers: newTiers };
      }),
    }));
  }

  async function pickVariantImage(variantKey) {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') { Alert.alert('', t.permissionDenied); return; }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.85,
    });
    if (r.canceled || !r.assets?.[0]) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const a = r.assets[0];
      const ext = (a.fileName?.split('.').pop() || 'jpg').toLowerCase();
      const url = await uploadProductImage(a.uri, a.mimeType || 'image/jpeg', user.id, ext);
      updateVariant(variantKey, { image_url: url });
    } catch (e) {
      console.error('[SupplierProducts] variant image upload error:', e?.message || e);
      Alert.alert('', t.uploadFailed);
    }
  }
  function clearVariantImage(variantKey) {
    updateVariant(variantKey, { image_url: null });
  }

  // ── Certifications ────────────────────────────────────────────────────
  function addCert() {
    if (certs.length >= CERT_MAX_COUNT) {
      Alert.alert('', t.certMaxReached);
      return;
    }
    setCerts((cs) => [...cs, emptyCertRow()]);
  }
  function removeCert(key) {
    setCerts((cs) => cs.filter((c) => c._key !== key));
  }
  function updateCert(key, patch) {
    setCerts((cs) => cs.map((c) => (c._key === key ? { ...c, ...patch } : c)));
  }
  function clearCertFile(key) {
    // Drop both the local pending file and the saved URL. The diff phase
    // at save time handles deleting the storage object for already-saved
    // certs whose file was cleared here.
    updateCert(key, { _pendingFile: null, cert_file_url: '', _error: null });
  }

  async function pickCertFile(key) {
    try {
      const r = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (r.canceled || !r.assets?.[0]) return;
      const asset = r.assets[0];

      if (asset.size && asset.size > CERT_MAX_BYTES) {
        updateCert(key, { _error: t.certTooLarge });
        return;
      }
      const mime = asset.mimeType || '';
      const looksOk = mime === 'application/pdf' || mime.startsWith('image/');
      if (mime && !looksOk) {
        updateCert(key, { _error: t.certWrongType });
        return;
      }

      const ext = (asset.name?.split('.').pop() || '').toLowerCase();
      updateCert(key, {
        _pendingFile: { uri: asset.uri, mimeType: mime, name: asset.name, size: asset.size, ext },
        _error: null,
      });
    } catch (e) {
      console.error('[SupplierProducts] cert pick error:', e?.message || e);
      updateCert(key, { _error: t.certUploadFailed });
    }
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

  async function pickVideo() {
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
      const url = await uploadProductVideo(a.uri, a.mimeType || 'video/mp4', user.id, ext);
      set('video_url', url);
    } catch (e) {
      console.error('[SupplierProducts] video upload error:', e?.message || e);
      Alert.alert('', t.uploadFailed);
    } finally {
      setUploadingVideo(false);
    }
  }
  function clearVideo() { set('video_url', null); }

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

    if (form.has_variants) {
      // Variants on: per-variant tiers replace product-level tiers.
      const vErr = validateVariantsSubsystem(form.varOptions, form.varVariants, t);
      if (vErr) return vErr;
    } else {
      // Variants off: product-level tiers required.
      const tierErr = validateTiers(form.tiers, moqInt, t);
      if (tierErr) return tierErr;
    }

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
      video_url: form.video_url || null,
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
      has_variants: !!form.has_variants,
      is_active: editing ? !!editing.is_active : true,
    };

    const { error, id: productId } = await writeProduct(payload, editing?.id);

    if (error) {
      setSubmitting(false);
      console.error('[SupplierProducts] save error:', error);
      Alert.alert('', t.errorGeneric);
      return;
    }

    // Tiers / variants / certifications are saved AFTER the product so
    // we have a stable productId. Failures surface as separate alerts
    // but do not block closing — the product itself was saved.
    let tierErr = null;
    let certErr = null;
    let varErr  = null;
    if (productId) {
      if (form.has_variants) {
        // Variants own pricing — saveVariantsSubsystem also wipes any
        // product-level tiers left over from a prior save.
        varErr = await saveVariantsSubsystem(productId, form.varOptions, form.varVariants);
      } else {
        // No variants — write product-level tiers and clear any stale
        // variants subsystem from a prior save (in case has_variants
        // was toggled off this round).
        tierErr = await saveTiers(productId, form.tiers, moqInt);
        await saveVariantsSubsystem(productId, [], []);
      }
      certErr = await saveProductCertifications({
        productId,
        userId: myId,
        nextCerts: certs,
        prevCerts,
      });
    }
    setSubmitting(false);

    if (tierErr) {
      console.error('[SupplierProducts] tier save error:', tierErr);
      Alert.alert('', t.errorTierSave);
    }
    if (varErr) {
      console.error('[SupplierProducts] variants save error:', varErr);
      Alert.alert('', t.errorVariantsSave);
    }
    if (certErr) {
      console.error('[SupplierProducts] cert save error:', certErr);
      Alert.alert('', t.errorCertSave);
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
              <Section title={t.sectionNames} isAr={isAr} defaultExpanded>
                <PField label={t.nameZh} value={form.name_zh} onChangeText={(v) => set('name_zh', v)} isAr={false} />
                <PField label={t.nameEn} value={form.name_en} onChangeText={(v) => set('name_en', v)} isAr={false} />
                <PField label={t.nameAr} value={form.name_ar} onChangeText={(v) => set('name_ar', v)} isAr />
              </Section>

              {/* ── Descriptions ── */}
              <Section title={t.sectionDescriptions} isAr={isAr} defaultExpanded={false}>
                <PField label={t.descEn} value={form.desc_en} onChangeText={(v) => set('desc_en', v)} multiline numberOfLines={4} isAr={false} />
                <PField label={t.descAr} value={form.desc_ar} onChangeText={(v) => set('desc_ar', v)} multiline numberOfLines={3} isAr />
                <PField label={t.descZh} value={form.desc_zh} onChangeText={(v) => set('desc_zh', v)} multiline numberOfLines={3} isAr={false} />
              </Section>

              {/* ── Category ── */}
              <Section title={t.sectionCategory} isAr={isAr} defaultExpanded>
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
              <Section title={t.sectionPricing} isAr={isAr} defaultExpanded>
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

              {/* ── Pricing Tiers ── (hidden when variants own pricing) */}
              {!form.has_variants && (
              <Section title={t.sectionTiers} isAr={isAr} defaultExpanded={false}>
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
              )}

              {/* ── Incoterms ── */}
              <Section title={t.sectionIncoterms} isAr={isAr} defaultExpanded>
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
              <Section title={t.sectionB2B} isAr={isAr} defaultExpanded={false}>

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

              {/* ── Quality Certifications ── */}
              <Section title={t.sectionCerts} isAr={isAr} defaultExpanded={false}>
                <Text style={[s.fieldHint, isAr && s.rtl, { marginBottom: 10 }]}>
                  {t.certsHint}
                </Text>

                {certs.length === 0 && (
                  <Text style={[s.fieldHint, isAr && s.rtl, { marginBottom: 12 }]}>
                    {t.certNoneYet}
                  </Text>
                )}

                {certs.map((cert) => {
                  const certType = String(cert.cert_type || '').toUpperCase();
                  const isOther  = certType === 'OTHER';
                  const hasFile  = !!(cert._pendingFile || cert.cert_file_url);
                  const isPending = !!cert._pendingFile;

                  return (
                    <View key={cert._key} style={s.certCard}>
                      {/* Row × delete (absolutely positioned, swaps side for RTL) */}
                      <TouchableOpacity
                        style={[s.certCardRemove, isAr ? s.certCardRemoveLeft : s.certCardRemoveRight]}
                        onPress={() => removeCert(cert._key)}
                        activeOpacity={0.85}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={s.certCardRemoveText}>×</Text>
                      </TouchableOpacity>

                      {/* Cert type chips */}
                      <Text style={[s.fieldLabel, isAr && s.rtl, { marginTop: 0, paddingRight: 30 }]}>
                        {t.certTypeLabel}
                      </Text>
                      <View style={[s.chipRow, isAr && s.chipRowRtl, { marginBottom: 12 }]}>
                        {CERT_TYPES.map((typeOpt) => {
                          const active = certType === typeOpt;
                          return (
                            <TouchableOpacity
                              key={typeOpt}
                              style={[s.chip, active && s.chipActive]}
                              onPress={() => updateCert(cert._key, { cert_type: typeOpt })}
                              activeOpacity={0.85}
                            >
                              <Text style={[s.chipText, active && s.chipTextActive]}>{typeOpt}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      {/* Cert label/name */}
                      <View style={s.fieldWrap}>
                        <Text style={[s.fieldLabel, isAr && s.rtl]}>{t.certLabelLabel}</Text>
                        <TextInput
                          style={[s.input, isAr && s.rtl]}
                          placeholder={t.certLabelHint}
                          placeholderTextColor={C.textDisabled}
                          value={cert.cert_label}
                          onChangeText={(v) => updateCert(cert._key, { cert_label: v })}
                        />
                        {isOther && (
                          <Text style={[s.fieldHint, isAr && s.rtl]}>{t.certLabelOtherHint}</Text>
                        )}
                      </View>

                      {/* Issued / Expiry — text inputs (date pickers would be nicer but text keeps the form light) */}
                      <View style={{ flexDirection: isAr ? 'row-reverse' : 'row', gap: 10 }}>
                        <View style={[s.fieldWrap, { flex: 1 }]}>
                          <Text style={[s.fieldLabel, isAr && s.rtl]}>{t.certIssuedLabel}</Text>
                          <TextInput
                            style={[s.input, isAr && s.rtl]}
                            placeholder="YYYY-MM-DD"
                            placeholderTextColor={C.textDisabled}
                            value={cert.issued_date}
                            onChangeText={(v) => updateCert(cert._key, { issued_date: v })}
                          />
                        </View>
                        <View style={[s.fieldWrap, { flex: 1 }]}>
                          <Text style={[s.fieldLabel, isAr && s.rtl]}>{t.certExpiryLabel}</Text>
                          <TextInput
                            style={[s.input, isAr && s.rtl]}
                            placeholder="YYYY-MM-DD"
                            placeholderTextColor={C.textDisabled}
                            value={cert.expiry_date}
                            onChangeText={(v) => updateCert(cert._key, { expiry_date: v })}
                          />
                        </View>
                      </View>

                      {/* File: upload button when empty, sage pill when present */}
                      {hasFile ? (
                        <View style={[s.certPill, isAr && s.rowRtl]}>
                          <Text style={s.certPillCheck}>✓</Text>
                          <Text style={s.certPillText} numberOfLines={1}>
                            {isPending
                              ? (cert._pendingFile?.name
                                  ? `${t.certPendingLabel} — ${cert._pendingFile.name}`
                                  : t.certPendingLabel)
                              : t.certUploadedLabel}
                          </Text>
                          <TouchableOpacity
                            onPress={() => clearCertFile(cert._key)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Text style={s.certPillRemove}>×</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={s.certUploadBtn}
                          onPress={() => pickCertFile(cert._key)}
                          activeOpacity={0.85}
                        >
                          <Text style={s.certUploadText}>{t.certUploadFile}</Text>
                        </TouchableOpacity>
                      )}

                      {!!cert._error && (
                        <Text style={[s.certErrorText, isAr && s.rtl]}>{cert._error}</Text>
                      )}
                    </View>
                  );
                })}

                {certs.length < CERT_MAX_COUNT && (
                  <TouchableOpacity
                    style={s.certAddBtn}
                    onPress={addCert}
                    activeOpacity={0.85}
                  >
                    <Text style={s.certAddBtnText}>{t.certAddBtn}</Text>
                  </TouchableOpacity>
                )}
              </Section>

              {/* ── Media ── */}
              <Section title={t.sectionMedia} isAr={isAr} defaultExpanded>
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

                {/* Video upload (single file, optional) */}
                <View style={{ height: 16 }} />
                <View style={[s.galleryHeader, isAr && s.rowRtl]}>
                  <Text style={[s.fieldLabel, isAr && s.rtl, { marginBottom: 0 }]}>
                    {t.videoLabel}
                  </Text>
                  {!form.video_url && (
                    <TouchableOpacity
                      style={s.smallBtn}
                      onPress={pickVideo}
                      disabled={uploadingVideo}
                      activeOpacity={0.85}
                    >
                      {uploadingVideo
                        ? <ActivityIndicator color={C.textSecondary} />
                        : <Text style={s.smallBtnText}>{t.videoPickBtn}</Text>}
                    </TouchableOpacity>
                  )}
                </View>
                {!!form.video_url && (
                  <View style={[s.certPill, isAr && s.rowRtl, { marginTop: 8 }]}>
                    <Text style={s.certPillCheck}>✓</Text>
                    <Text style={s.certPillText} numberOfLines={1}>
                      {t.videoUploadedLabel}
                    </Text>
                    <TouchableOpacity
                      onPress={clearVideo}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={s.certPillRemove}>×</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </Section>

              {/* ── Options & Variants ── */}
              <Section title={t.sectionVariants} isAr={isAr} defaultExpanded={false}>
                <TouchableOpacity
                  style={[s.toggleRow, form.has_variants && s.toggleRowActive]}
                  onPress={toggleHasVariants}
                  activeOpacity={0.85}
                >
                  <Text style={[s.toggleRowText, form.has_variants && s.toggleRowTextActive]}>
                    {form.has_variants ? t.hasVariantsOn : t.hasVariantsOff}
                  </Text>
                </TouchableOpacity>

                <Text style={[s.fieldHint, isAr && s.rtl, { marginTop: 8 }]}>
                  {t.hasVariantsHint}
                </Text>

                {form.has_variants && (
                  <View style={{ marginTop: 14 }}>
                    {/* Options */}
                    {form.varOptions.map((opt, oi) => (
                      <OptionEditor
                        key={opt._key}
                        option={opt}
                        index={oi}
                        isAr={isAr}
                        t={t}
                        onChangeName={(v) => setVarOptionName(opt._key, v)}
                        onAddValue={(v) => addVarOptionValue(opt._key, v)}
                        onRemoveValue={(vk) => removeVarOptionValue(opt._key, vk)}
                        onRemoveOption={() => removeVarOption(opt._key)}
                      />
                    ))}

                    <TouchableOpacity
                      style={[s.smallBtn, { alignSelf: 'flex-start', marginTop: 4 }]}
                      onPress={addVarOption}
                      activeOpacity={0.85}
                    >
                      <Text style={s.smallBtnText}>{t.addOption}</Text>
                    </TouchableOpacity>

                    {/* Variant matrix */}
                    <View style={{ marginTop: 18 }}>
                      <Text style={[s.subLabel, isAr && s.rtl, { marginBottom: 6 }]}>
                        {t.variantsMatrixTitle}
                      </Text>
                      <Text style={[s.fieldHint, isAr && s.rtl, { marginBottom: 12 }]}>
                        {t.variantsAutoNote}
                      </Text>

                      {form.varVariants.length === 0 ? (
                        <Text style={[s.fieldHint, isAr && s.rtl]}>
                          {t.noVariantsYet}
                        </Text>
                      ) : (
                        form.varVariants.map((v) => {
                          const label = variantLabel(v.combo, form.varOptions) || '—';
                          return (
                            <View key={v._key} style={s.variantCard}>
                              <Text style={[s.variantCardTitle, isAr && s.rtl]} numberOfLines={2}>
                                {label}
                              </Text>

                              {/* Image */}
                              <Text style={[s.fieldLabel, isAr && s.rtl]}>{t.variantImage}</Text>
                              {v.image_url ? (
                                <View style={[s.primaryWrap, { marginBottom: 12 }]}>
                                  <Image source={{ uri: v.image_url }} style={s.variantImg} />
                                  <View style={[s.primaryActions, isAr && s.rowRtl]}>
                                    <TouchableOpacity
                                      style={s.smallBtn}
                                      onPress={() => pickVariantImage(v._key)}
                                      activeOpacity={0.85}
                                    >
                                      <Text style={s.smallBtnText}>{t.variantChangeImage}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                      style={[s.smallBtn, s.smallBtnDanger]}
                                      onPress={() => clearVariantImage(v._key)}
                                      activeOpacity={0.85}
                                    >
                                      <Text style={[s.smallBtnText, { color: C.red }]}>
                                        {t.variantRemoveImage}
                                      </Text>
                                    </TouchableOpacity>
                                  </View>
                                </View>
                              ) : (
                                <TouchableOpacity
                                  style={[s.uploadBtn, { marginBottom: 12 }]}
                                  onPress={() => pickVariantImage(v._key)}
                                  activeOpacity={0.85}
                                >
                                  <Text style={s.uploadBtnText}>{t.variantPickImage}</Text>
                                </TouchableOpacity>
                              )}

                              {/* SKU + Stock */}
                              <PField
                                label={t.variantSku}
                                value={v.sku}
                                onChangeText={(val) => updateVariant(v._key, { sku: val })}
                                isAr={false}
                              />
                              <PField
                                label={t.variantStock}
                                value={v.stock}
                                onChangeText={(val) => updateVariant(v._key, { stock: val.replace(/[^0-9]/g, '') })}
                                keyboardType="numeric"
                                isAr={isAr}
                              />

                              {/* Tier headers */}
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

                              {/* 3 tier rows */}
                              {(v.tiers || emptyVariantTiers()).map((row, ti) => {
                                const isLast = ti === 2;
                                return (
                                  <View key={ti} style={[s.tierRow, isAr && s.rowRtl]}>
                                    <View style={s.tierLabelCell}>
                                      <Text style={s.tierRowLabel}>
                                        {t.tierLabel.replace('{n}', String(ti + 1))}
                                      </Text>
                                    </View>
                                    <TextInput
                                      style={[s.tierInput, { flex: 1 }]}
                                      keyboardType="numeric"
                                      value={row.qty_from}
                                      onChangeText={(val) =>
                                        setVariantTierField(v._key, ti, 'qty_from', val.replace(/[^0-9]/g, ''))
                                      }
                                      placeholderTextColor={C.textDisabled}
                                    />
                                    <TextInput
                                      style={[s.tierInput, { flex: 1 }]}
                                      keyboardType="numeric"
                                      value={row.qty_to}
                                      onChangeText={(val) =>
                                        setVariantTierField(v._key, ti, 'qty_to', val.replace(/[^0-9]/g, ''))
                                      }
                                      placeholder={isLast ? t.tierMaxQtyUnlimited : ''}
                                      placeholderTextColor={C.textDisabled}
                                    />
                                    <TextInput
                                      style={[s.tierInput, { flex: 1.3 }]}
                                      keyboardType="decimal-pad"
                                      value={row.unit_price}
                                      onChangeText={(val) =>
                                        setVariantTierField(v._key, ti, 'unit_price', val)
                                      }
                                      placeholder="0.00"
                                      placeholderTextColor={C.textDisabled}
                                    />
                                  </View>
                                );
                              })}
                            </View>
                          );
                        })
                      )}
                    </View>
                  </View>
                )}
              </Section>

              {/* ── Sample ── */}
              <Section title={t.sectionSample} isAr={isAr} defaultExpanded={false}>
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

// Collapsible section card. Header row (title + chevron) is always
// rendered and tappable; children mount only when expanded so we don't
// pay the layout cost for collapsed-by-default sections like Variants
// or B2B Logistics. State is local — opening a fresh modal resets to
// the per-section default. Animation uses LayoutAnimation when the
// platform supports it (iOS always; Android needs an experimental opt-in
// that we enable once at module load below).
function Section({ title, isAr, defaultExpanded = true, children }) {
  const [expanded, setExpanded] = React.useState(!!defaultExpanded);
  const onPress = () => {
    if (LayoutAnimation && typeof LayoutAnimation.configureNext === 'function') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setExpanded((v) => !v);
  };
  return (
    <View style={s.section}>
      <TouchableOpacity
        style={[s.sectionHeader, isAr && s.rowRtl]}
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <Text style={[s.sectionTitle, isAr && s.rtl, { marginBottom: 0, flex: 1 }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={s.sectionChevron}>{expanded ? '▼' : (isAr ? '◀' : '▶')}</Text>
      </TouchableOpacity>
      {expanded && (
        <View style={{ marginTop: 12 }}>
          {children}
        </View>
      )}
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

// One option card (name + tag-input list of values + remove). Local state
// holds the in-progress "new value" text so each card has its own input.
function OptionEditor({ option, index, isAr, t, onChangeName, onAddValue, onRemoveValue, onRemoveOption }) {
  const [draft, setDraft] = React.useState('');

  const commit = () => {
    const v = draft.trim();
    if (!v) return;
    onAddValue(v);
    setDraft('');
  };

  return (
    <View style={s.optionCard}>
      <View style={[s.optionCardHeader, isAr && s.rowRtl]}>
        <Text style={s.optionCardLabel}>
          {t.optionLabelN.replace('{n}', String(index + 1))}
        </Text>
        <TouchableOpacity onPress={onRemoveOption} style={s.smallBtn} activeOpacity={0.85}>
          <Text style={[s.smallBtnText, { color: C.red }]}>{t.removeOptionBtn}</Text>
        </TouchableOpacity>
      </View>

      <View style={s.fieldWrap}>
        <Text style={[s.fieldLabel, isAr && s.rtl]}>{t.optionName}</Text>
        <TextInput
          style={[s.input, isAr && s.rtl]}
          value={option.name}
          onChangeText={onChangeName}
          placeholderTextColor={C.textDisabled}
        />
      </View>

      <Text style={[s.fieldLabel, isAr && s.rtl]}>{t.optionValuesLabel}</Text>

      {/* Existing value tags */}
      {option.values.length > 0 && (
        <View style={[s.chipRow, isAr && s.chipRowRtl, { marginBottom: 10 }]}>
          {option.values.map((v) => (
            <View key={v._key} style={[s.tagChip, isAr && s.rowRtl]}>
              <Text style={s.tagChipText} numberOfLines={1}>
                {v.value || ''}
              </Text>
              <TouchableOpacity
                onPress={() => onRemoveValue(v._key)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Text style={s.tagChipRemove}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Add-value row */}
      <View style={[{ flexDirection: isAr ? 'row-reverse' : 'row', gap: 8, alignItems: 'center' }]}>
        <TextInput
          style={[s.input, isAr && s.rtl, { flex: 1 }]}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={commit}
          placeholder={t.optionValuesPlaceholder}
          placeholderTextColor={C.textDisabled}
          returnKeyType="done"
        />
        <TouchableOpacity onPress={commit} style={s.smallBtn} activeOpacity={0.85}>
          <Text style={s.smallBtnText}>{t.addValueBtn}</Text>
        </TouchableOpacity>
      </View>
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
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 2,
  },
  sectionChevron: {
    color: C.textTertiary, fontSize: 13, fontFamily: F.numSemi,
    paddingHorizontal: 8,
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

  // Quality certifications — one card per row
  certCard: {
    backgroundColor: C.bgBase, borderRadius: 12,
    borderWidth: 1, borderColor: C.borderMuted,
    padding: 14, marginBottom: 12, position: 'relative',
  },
  certCardRemove: {
    position: 'absolute', top: 6,
    width: 30, height: 30,
    alignItems: 'center', justifyContent: 'center',
  },
  certCardRemoveRight: { right: 6 },
  certCardRemoveLeft:  { left: 6 },
  certCardRemoveText: {
    color: C.textTertiary, fontSize: 22, lineHeight: 22, fontFamily: F.enBold,
  },
  certPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999, backgroundColor: C.greenSoft,
    borderWidth: 1, borderColor: 'rgba(0,100,0,0.22)',
    marginTop: 4, marginBottom: 4, maxWidth: '100%',
  },
  certPillCheck: { color: C.green, fontSize: 11, fontFamily: F.enBold },
  certPillText:  { color: C.green, fontSize: 11, fontFamily: F.enSemi, flexShrink: 1 },
  certPillRemove: {
    color: C.green, fontSize: 16, lineHeight: 16,
    fontFamily: F.enBold, paddingHorizontal: 2,
  },
  certUploadBtn: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1, borderColor: C.borderDefault,
    backgroundColor: C.bgRaised, alignSelf: 'flex-start',
    marginTop: 4,
  },
  certUploadText: { color: C.textSecondary, fontSize: 13, fontFamily: F.arSemi },
  certErrorText:  { color: C.red, fontSize: 11, marginTop: 6, fontFamily: F.ar },
  certAddBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1, borderColor: C.borderDefault,
    backgroundColor: C.bgRaised, marginTop: 4,
  },
  certAddBtnText: { color: C.textSecondary, fontSize: 13, fontFamily: F.arSemi },

  // Variants subsystem — option cards + tag chips + variant cards
  optionCard: {
    backgroundColor: C.bgBase, borderRadius: 12,
    borderWidth: 1, borderColor: C.borderMuted,
    padding: 14, marginBottom: 12,
  },
  optionCardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  optionCardLabel: {
    color: C.textTertiary, fontSize: 11, fontFamily: F.arSemi,
    letterSpacing: 0.5,
  },
  tagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, backgroundColor: C.bgRaised,
    borderWidth: 1, borderColor: C.borderDefault,
  },
  tagChipText: {
    color: C.textPrimary, fontSize: 12, fontFamily: F.ar, maxWidth: 140,
  },
  tagChipRemove: {
    color: C.textTertiary, fontSize: 14, lineHeight: 14,
    fontFamily: F.enBold, paddingHorizontal: 2,
  },

  variantCard: {
    backgroundColor: C.bgBase, borderRadius: 12,
    borderWidth: 1, borderColor: C.borderMuted,
    padding: 14, marginBottom: 12,
  },
  variantCardTitle: {
    color: C.textPrimary, fontSize: 14, fontFamily: F.arSemi,
    marginBottom: 10,
  },
  variantImg: {
    width: '100%', height: 140, borderRadius: 10, resizeMode: 'cover',
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
