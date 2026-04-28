// Shared utility for rendering buyer-facing offer details.
// Opt-in whitelist + per-field formatters, so admin/internal columns
// (managed_visibility, admin_internal_note, negotiation_note, etc.) never
// leak to buyers — even when future migrations add more columns.

export const BUYER_OFFER_FIELDS = [
  'price',
  'shipping_cost',
  'shipping_method',
  'moq',
  'delivery_days',
  'origin',
  'sample_available',
  'note',
];

const LABELS = {
  price:            { ar: 'سعر الوحدة',              en: 'Unit Price',           zh: '单价' },
  shipping_cost:    { ar: 'تكلفة الشحن',             en: 'Shipping Cost',        zh: '运费' },
  shipping_method:  { ar: 'طريقة الشحن',             en: 'Shipping Method',      zh: '运输方式' },
  moq:              { ar: 'الحد الأدنى للطلب (MOQ)',  en: 'Min. Order Qty (MOQ)', zh: '最小起订量 (MOQ)' },
  delivery_days:    { ar: 'مدة التجهيز',              en: 'Lead Time',            zh: '交货时间' },
  origin:           { ar: 'بلد المنشأ',               en: 'Origin',               zh: '原产地' },
  sample_available: { ar: 'عينة متاحة',              en: 'Sample Available',     zh: '样品可用' },
  note:             { ar: 'ملاحظة تجارية',            en: 'Commercial Note',      zh: '商业备注' },
};

const YES_NO = {
  true:  { ar: 'نعم', en: 'Yes', zh: '是' },
  false: { ar: 'لا',  en: 'No',  zh: '否' },
};

const DAYS_UNIT = { ar: 'يوم', en: 'days', zh: '天' };

function pickLang(dict, lang) {
  return dict[lang] || dict.en;
}

function isEmpty(val) {
  if (val == null) return true;
  if (typeof val === 'string' && val.trim() === '') return true;
  return false;
}

// Silent fallback: current lang → legacy `note` → en → ar → zh.
// Buyer always sees whatever the supplier provided, even if not in their language.
function pickNote(offer, lang) {
  const candidates = [
    offer[`note_${lang}`],
    offer.note,
    offer.note_en,
    offer.note_ar,
    offer.note_zh,
  ];
  for (const c of candidates) {
    if (!isEmpty(c)) return String(c).trim();
  }
  return '';
}

export function getOfferFieldLabel(key, lang) {
  const entry = LABELS[key];
  return entry ? pickLang(entry, lang) : key;
}

// Returns a formatted display string, or null to skip the row.
// `fmtPrice` is injected by the caller (USD→SAR conversion lives at the UI layer).
export function getOfferFieldValue(offer, key, lang, { fmtPrice }) {
  switch (key) {
    case 'price':
    case 'shipping_cost': {
      if (isEmpty(offer[key])) return null;
      return fmtPrice(offer[key], offer.currency);
    }
    case 'sample_available': {
      if (offer[key] == null) return null;
      return pickLang(YES_NO[Boolean(offer[key])], lang);
    }
    case 'delivery_days': {
      const n = Number(offer[key]);
      if (!Number.isFinite(n) || n <= 0) return null;
      return `${n} ${pickLang(DAYS_UNIT, lang)}`;
    }
    case 'shipping_method': {
      // Canonical shape after the supplier write fix is a pure numeric string
      // (number of shipping days). Format with the viewer's lang. Free-form
      // / legacy lang-baked values pass through unchanged.
      const raw = String(offer[key] || '').trim();
      if (!raw) return null;
      const numeric = parseInt(raw, 10);
      if (Number.isFinite(numeric) && String(numeric) === raw) {
        return `${numeric} ${pickLang(DAYS_UNIT, lang)}`;
      }
      return raw;
    }
    case 'moq': {
      // Strip CJK characters/punctuation so the numeric portion is visible
      // to non-Chinese viewers. If everything was CJK, fall back to original.
      if (isEmpty(offer[key])) return null;
      const raw = String(offer[key]).trim();
      const stripped = raw
        .replace(/[一-鿿　-〿＀-￯]+/g, '')
        .trim();
      return stripped || raw;
    }
    case 'note': {
      const s = pickNote(offer, lang);
      return s || null;
    }
    default: {
      const v = offer[key];
      if (isEmpty(v)) return null;
      return String(v).trim();
    }
  }
}

export function buildOfferDetailRows(offer, lang, { fmtPrice }) {
  return BUYER_OFFER_FIELDS
    .map((key) => {
      const value = getOfferFieldValue(offer, key, lang, { fmtPrice });
      if (value == null) return null;
      return { key, label: getOfferFieldLabel(key, lang), value };
    })
    .filter(Boolean);
}
