// Ported from maabar web: src/lib/productMedia.js
// Handles gallery images and spec localisation.

export const PRODUCT_GALLERY_LIMIT = 8;

export function getProductGalleryImages(product) {
  const gallery = Array.isArray(product?.gallery_images) ? product.gallery_images : [];
  const legacy  = product?.image_url ? [product.image_url] : [];
  return [...new Set([...gallery, ...legacy].filter(Boolean))].slice(0, PRODUCT_GALLERY_LIMIT);
}

export function getPrimaryProductImage(product) {
  return getProductGalleryImages(product)[0] || null;
}

/* ── Spec localisation (mirrors web exactly) ── */

function localizeSpecLabel(key, lang = 'en') {
  const labels = {
    spec_material:          { ar: 'الخامة / المادة',     zh: '材质',        en: 'Material' },
    spec_dimensions:        { ar: 'الأبعاد / المقاس',    zh: '尺寸 / 规格', en: 'Dimensions' },
    spec_unit_weight:       { ar: 'وزن القطعة',           zh: '单件重量',    en: 'Unit Weight' },
    spec_color_options:     { ar: 'الألوان / الخيارات',  zh: '颜色 / 款式', en: 'Colors / Variants' },
    spec_packaging_details: { ar: 'تفاصيل التغليف',       zh: '包装信息',    en: 'Packaging' },
    spec_customization:     { ar: 'التخصيص / OEM',        zh: '定制 / OEM',  en: 'Customization / OEM' },
    spec_lead_time_days:    { ar: 'مدة التجهيز',           zh: '交期（天）',  en: 'Lead Time (days)' },
  };
  return labels[key]?.[lang] || labels[key]?.en || key;
}

function localizeSpecValue(key, value, lang = 'en') {
  if (value === null || value === undefined) return value;
  let text = String(value).trim();
  if (!text) return text;

  if (lang === 'ar') {
    const canned = {
      'China': 'الصين',
      'Standard export dimensions available': 'أبعاد تصديرية قياسية متاحة',
      'Standard export assortment': 'تشكيلة تصديرية قياسية',
      'Master carton export packing with inner protection and barcode-ready labels.':
        'تغليف كرتوني تصديري مع حماية داخلية وملصقات جاهزة للباركود.',
      'Private label packaging, custom firmware presets, logo printing, and bundled accessory kits.':
        'تغليف علامة خاصة، وإعدادات مخصصة للبرمجة، وطباعة الشعار، مع أطقم ملحقات مرفقة.',
      'ABS / steel / engineered components': 'ABS / فولاذ / مكونات هندسية',
    };
    if (canned[text]) return canned[text];
    if (key === 'spec_unit_weight') {
      const m = text.match(/^(?:kg\s*)?(\d+(?:\.\d+)?)/i) || text.match(/(\d+(?:\.\d+)?)\s*kg/i);
      if (m) return `${Number(m[1]).toFixed(2).replace(/\.00$/, '')} كجم`;
    }
    if (key === 'spec_lead_time_days' && /^\d+$/.test(text)) return `${text} يوم`;
    text = text
      .replace(/\bChina\b/g, 'الصين')
      .replace(/\bMOQ\b/g, 'الحد الأدنى للطلب')
      .replace(/\bPrivate label\b/gi, 'علامة خاصة')
      .replace(/\bcustom packaging\b/gi, 'تغليف مخصص')
      .replace(/\blogo printing\b/gi, 'طباعة الشعار');
  }
  return text;
}

export function buildProductSpecs(product, lang = 'en') {
  const fields = [
    'spec_material',
    'spec_dimensions',
    'spec_unit_weight',
    'spec_color_options',
    'spec_packaging_details',
    'spec_customization',
    'spec_lead_time_days',
  ];
  return fields
    .map(key => ({
      key,
      label: localizeSpecLabel(key, lang),
      value: localizeSpecValue(key, product?.[key], lang),
    }))
    .filter(item => item.value !== null && item.value !== undefined && String(item.value).trim() !== '');
}
