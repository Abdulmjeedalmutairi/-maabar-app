// Supplier specialty (category) translation table.
// Ported verbatim from web/src/lib/supplierDashboardConstants.js so the
// mobile app translates raw category codes (e.g. 'outdoor_furniture') into
// localized labels using the same canonical list.
//
// Falls back to the raw code when an entry is missing — keeps brand-new or
// custom values readable instead of returning blank.

const CATEGORIES = {
  ar: [
    { val: 'all', label: 'الكل' },
    { val: 'electronics', label: 'إلكترونيات' },
    { val: 'home_appliances', label: 'أجهزة منزلية' },
    { val: 'furniture', label: 'أثاث' },
    { val: 'office_furniture', label: 'أثاث مكتبي' },
    { val: 'bedroom_furniture', label: 'أثاث غرف النوم' },
    { val: 'kitchen_furniture', label: 'أثاث المطبخ' },
    { val: 'outdoor_furniture', label: 'أثاث خارجي' },
    { val: 'home_decor', label: 'ديكور منزلي' },
    { val: 'clothing', label: 'ملابس' },
    { val: 'building', label: 'مواد بناء' },
    { val: 'food', label: 'غذاء' },
    { val: 'beauty', label: 'عناية وتجميل' },
    { val: 'sports', label: 'رياضة' },
    { val: 'toys', label: 'ألعاب' },
    { val: 'auto_parts', label: 'قطع غيار' },
    { val: 'car_accessories', label: 'إكسسوارات سيارات' },
    { val: 'tires', label: 'إطارات' },
    { val: 'lubricants', label: 'زيوت ومواد تشحيم' },
    { val: 'health', label: 'صحة وطب' },
    { val: 'packaging', label: 'تعبئة وتغليف' },
    { val: 'gifts', label: 'هدايا' },
    { val: 'agriculture', label: 'زراعة' },
    { val: 'other', label: 'أخرى' },
  ],
  en: [
    { val: 'all', label: 'All' },
    { val: 'electronics', label: 'Electronics' },
    { val: 'home_appliances', label: 'Home Appliances' },
    { val: 'furniture', label: 'Furniture' },
    { val: 'office_furniture', label: 'Office Furniture' },
    { val: 'bedroom_furniture', label: 'Bedroom Furniture' },
    { val: 'kitchen_furniture', label: 'Kitchen Furniture' },
    { val: 'outdoor_furniture', label: 'Outdoor Furniture' },
    { val: 'home_decor', label: 'Home Décor' },
    { val: 'clothing', label: 'Clothing' },
    { val: 'building', label: 'Building Materials' },
    { val: 'food', label: 'Food' },
    { val: 'beauty', label: 'Beauty & Personal Care' },
    { val: 'sports', label: 'Sports' },
    { val: 'toys', label: 'Toys' },
    { val: 'auto_parts', label: 'Auto Parts' },
    { val: 'car_accessories', label: 'Car Accessories' },
    { val: 'tires', label: 'Tires' },
    { val: 'lubricants', label: 'Lubricants & Oils' },
    { val: 'health', label: 'Health & Medical' },
    { val: 'packaging', label: 'Packaging' },
    { val: 'gifts', label: 'Gifts' },
    { val: 'agriculture', label: 'Agriculture' },
    { val: 'other', label: 'Other' },
  ],
  zh: [
    { val: 'all', label: '全部' },
    { val: 'electronics', label: '电子产品' },
    { val: 'home_appliances', label: '家用电器' },
    { val: 'furniture', label: '家具' },
    { val: 'office_furniture', label: '办公家具' },
    { val: 'bedroom_furniture', label: '卧室家具' },
    { val: 'kitchen_furniture', label: '厨房家具' },
    { val: 'outdoor_furniture', label: '户外家具' },
    { val: 'home_decor', label: '家居装饰' },
    { val: 'clothing', label: '服装' },
    { val: 'building', label: '建材' },
    { val: 'food', label: '食品' },
    { val: 'beauty', label: '美容护肤' },
    { val: 'sports', label: '运动' },
    { val: 'toys', label: '玩具' },
    { val: 'auto_parts', label: '汽车配件' },
    { val: 'car_accessories', label: '汽车周边' },
    { val: 'tires', label: '轮胎' },
    { val: 'lubricants', label: '润滑油' },
    { val: 'health', label: '健康医疗' },
    { val: 'packaging', label: '包装材料' },
    { val: 'gifts', label: '礼品' },
    { val: 'agriculture', label: '农业' },
    { val: 'other', label: '其他' },
  ],
};

export function getSpecialtyLabel(rawCode, lang = 'en') {
  const code = String(rawCode || '').trim();
  if (!code) return '';
  const list = CATEGORIES[lang] || CATEGORIES.en;
  const found = list.find((c) => c.val === code);
  return found ? found.label : code;
}

// Codes only — for forms that need the full 24-category list without the
// synthetic 'all' filter row.
export const SPECIALTY_CODES = CATEGORIES.en
  .map((c) => c.val)
  .filter((v) => v !== 'all');
