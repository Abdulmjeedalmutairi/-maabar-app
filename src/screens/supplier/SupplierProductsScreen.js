import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Modal, RefreshControl,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { getLang } from '../../lib/lang';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';

// Category keys stored in DB match the web (English vals)
const CATEGORIES = {
  ar: [
    { val: 'electronics', label: 'إلكترونيات' },
    { val: 'furniture', label: 'أثاث' },
    { val: 'clothing', label: 'ملابس' },
    { val: 'building', label: 'مواد بناء' },
    { val: 'food', label: 'غذاء' },
    { val: 'other', label: 'أخرى' },
  ],
  en: [
    { val: 'electronics', label: 'Electronics' },
    { val: 'furniture', label: 'Furniture' },
    { val: 'clothing', label: 'Clothing' },
    { val: 'building', label: 'Building Materials' },
    { val: 'food', label: 'Food' },
    { val: 'other', label: 'Other' },
  ],
  zh: [
    { val: 'electronics', label: '电子产品' },
    { val: 'furniture', label: '家具' },
    { val: 'clothing', label: '服装' },
    { val: 'building', label: '建材' },
    { val: 'food', label: '食品' },
    { val: 'other', label: '其他' },
  ],
};

const COPY = {
  ar: {
    title: 'منتجاتي',
    add: '+ إضافة',
    noProducts: 'لم تضف منتجات بعد',
    addFirst: 'أضف منتجك الأول',
    active: 'نشط', inactive: 'مخفي',
    newProduct: 'منتج جديد',
    close: 'إغلاق',
    nameAr: 'اسم المنتج بالعربية *',
    nameEn: 'اسم المنتج بالإنجليزية',
    nameZh: 'اسم المنتج بالصينية',
    descAr: 'الوصف',
    priceFrom: 'السعر من',
    moq: 'الحد الأدنى للكمية (MOQ)',
    leadTime: 'مدة التصنيع (بالأيام)',
    category: 'التصنيف',
    colors: 'الألوان المتاحة',
    colorsHint: 'مثال: أحمر، أزرق، أسود',
    sizes: 'المقاسات / الأبعاد',
    sizesHint: 'مثال: S، M، L، XL أو 10×20 سم',
    material: 'المادة / نوع القماش',
    materialHint: 'مثال: قطن 100٪، بوليستر، ألومنيوم',
    sampleOff: 'عينات غير متاحة',
    sampleOn: '✓ عينات متاحة',
    addProduct: 'إضافة المنتج',
    errorName: 'أدخل اسم المنتج بالعربية',
    errorGeneric: 'حدث خطأ، حاول مرة أخرى',
  },
  en: {
    title: 'My Products',
    add: '+ Add',
    noProducts: 'No products yet',
    addFirst: 'Add your first product',
    active: 'Active', inactive: 'Hidden',
    newProduct: 'New Product',
    close: 'Close',
    nameAr: 'Arabic Name *',
    nameEn: 'English Name',
    nameZh: 'Chinese Name',
    descAr: 'Description',
    priceFrom: 'Starting Price (USD)',
    moq: 'MOQ',
    leadTime: 'Lead Time (days)',
    category: 'Category',
    colors: 'Available Colors',
    colorsHint: 'e.g. Red, Blue, Black',
    sizes: 'Sizes / Dimensions',
    sizesHint: 'e.g. S, M, L, XL or 10×20 cm',
    material: 'Material / Fabric Type',
    materialHint: 'e.g. 100% Cotton, Polyester, Aluminium',
    sampleOff: 'Samples Unavailable',
    sampleOn: '✓ Samples Available',
    addProduct: 'Add Product',
    errorName: 'Enter the Arabic product name',
    errorGeneric: 'Something went wrong, please try again',
  },
  zh: {
    title: '我的产品',
    add: '+ 添加',
    noProducts: '暂无产品',
    addFirst: '添加第一个产品',
    active: '上架', inactive: '下架',
    newProduct: '新产品',
    close: '关闭',
    nameAr: '阿拉伯语名称 *',
    nameEn: '英文名称',
    nameZh: '中文名称',
    descAr: '描述',
    priceFrom: '起始价格 (USD)',
    moq: '最小起订量',
    leadTime: '生产周期（天）',
    category: '产品类别',
    colors: '可选颜色',
    colorsHint: '例如：红色、蓝色、黑色',
    sizes: '尺寸 / 规格',
    sizesHint: '例如：S、M、L、XL 或 10×20 厘米',
    material: '材质 / 面料',
    materialHint: '例如：100%棉、涤纶、铝合金',
    sampleOff: '不提供样品',
    sampleOn: '✓ 可提供样品',
    addProduct: '添加产品',
    errorName: '请输入阿拉伯语产品名称',
    errorGeneric: '出现错误，请重试',
  },
};

export default function SupplierProductsScreen() {
  const lang = getLang();
  const t = COPY[lang] || COPY.ar;
  const isAr = lang === 'ar';
  const cats = CATEGORIES[lang] || CATEGORIES.en;

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [myId, setMyId] = useState(null);

  const [form, setForm] = useState({
    nameAr: '', nameEn: '', nameZh: '',
    descAr: '', priceFrom: '',
    moq: '', category: '', sampleAvailable: false,
    specLeadTimeDays: '', colors: '', sizes: '', material: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMyId(user.id);

    // Exact web query from loadMyProducts()
    const { data } = await supabase
      .from('products')
      .select('id, name_ar, name_en, name_zh, price_from, currency, moq, category, is_active, created_at')
      .eq('supplier_id', user.id)
      .order('created_at', { ascending: false });

    console.log('[SupplierProducts] products:', data?.length, data);
    setProducts(data || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  function onRefresh() { setRefreshing(true); load(); }
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function resetForm() {
    setForm({
      nameAr: '', nameEn: '', nameZh: '',
      descAr: '', priceFrom: '',
      moq: '', category: '', sampleAvailable: false,
      specLeadTimeDays: '', colors: '', sizes: '', material: '',
    });
  }

  async function handleAdd() {
    if (!form.nameAr) { Alert.alert('', t.errorName); return; }
    setSubmitting(true);

    const { error } = await supabase.from('products').insert({
      supplier_id: myId,
      name_ar: form.nameAr,
      name_en: form.nameEn || null,
      name_zh: form.nameZh || null,
      desc_ar: form.descAr || null,
      price_from: form.priceFrom ? parseFloat(form.priceFrom) : null,
      currency: 'USD',
      moq: form.moq || null,
      category: form.category || null,
      sample_available: form.sampleAvailable,
      spec_lead_time_days: form.specLeadTimeDays ? parseInt(form.specLeadTimeDays, 10) : null,
      colors: form.colors || null,
      sizes: form.sizes || null,
      material: form.material || null,
      is_active: true,
    });

    setSubmitting(false);
    if (error) { console.error('[SupplierProducts] handleAdd error:', error); Alert.alert('', t.errorGeneric); return; }
    setShowAdd(false);
    resetForm();
    load();
  }

  async function toggleActive(id, current) {
    await supabase.from('products').update({ is_active: !current }).eq('id', id);
    load();
  }

  const getProductName = (p) => {
    if (lang === 'ar') return p.name_ar || p.name_en || p.name_zh || '—';
    if (lang === 'zh') return p.name_zh || p.name_en || p.name_ar || '—';
    return p.name_en || p.name_ar || p.name_zh || '—';
  };

  const getCatLabel = (val) => {
    const found = cats.find(c => c.val === val);
    return found ? found.label : val;
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.topBar}>
        <TouchableOpacity style={s.addBtn} onPress={() => setShowAdd(true)} activeOpacity={0.85}>
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
              <TouchableOpacity style={s.emptyBtn} onPress={() => setShowAdd(true)} activeOpacity={0.85}>
                <Text style={s.emptyBtnText}>{t.addFirst}</Text>
              </TouchableOpacity>
            </View>
          ) : products.map(p => (
            <View key={p.id} style={[s.card, !p.is_active && s.cardInactive]}>
              <View style={[s.cardTop, isAr && s.rowRtl]}>
                <TouchableOpacity
                  style={[s.toggleBtn, { backgroundColor: p.is_active ? C.greenSoft : C.bgOverlay }]}
                  onPress={() => toggleActive(p.id, p.is_active)}
                  activeOpacity={0.85}
                >
                  <Text style={[s.toggleText, { color: p.is_active ? C.green : C.textDisabled }]}>
                    {p.is_active ? t.active : t.inactive}
                  </Text>
                </TouchableOpacity>
                <Text style={[s.productName, isAr && s.rtl]} numberOfLines={2}>
                  {getProductName(p)}
                </Text>
              </View>
              <View style={[s.cardMeta, isAr && s.rowRtl]}>
                {!!p.price_from && <Text style={s.metaItem}>{p.price_from} {p.currency}</Text>}
                {!!p.moq && <Text style={s.metaItem}>MOQ: {p.moq}</Text>}
                {!!p.category && <Text style={s.metaItem}>{getCatLabel(p.category)}</Text>}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* ── Add Product Modal ── */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={s.safe}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={s.modalScroll} keyboardShouldPersistTaps="handled">
              <View style={[s.modalHeader, isAr && s.rowRtl]}>
                <TouchableOpacity onPress={() => { setShowAdd(false); resetForm(); }}>
                  <Text style={s.modalClose}>{t.close}</Text>
                </TouchableOpacity>
                <Text style={[s.modalTitle, isAr && s.rtl]}>{t.newProduct}</Text>
              </View>

              <PField label={t.nameAr} value={form.nameAr} onChangeText={v => set('nameAr', v)} isAr={isAr} />
              <PField label={t.nameEn} value={form.nameEn} onChangeText={v => set('nameEn', v)} isAr={false} />
              <PField label={t.nameZh} value={form.nameZh} onChangeText={v => set('nameZh', v)} isAr={false} />
              <PField label={t.descAr} value={form.descAr} onChangeText={v => set('descAr', v)} multiline numberOfLines={3} isAr={isAr} />

              <PField label={t.priceFrom} value={form.priceFrom} onChangeText={v => set('priceFrom', v)} keyboardType="numeric" isAr={isAr} />
              <PField label={t.moq} value={form.moq} onChangeText={v => set('moq', v)} isAr={isAr} />
              <PField label={t.leadTime} value={form.specLeadTimeDays} onChangeText={v => set('specLeadTimeDays', v)} keyboardType="numeric" isAr={isAr} />

              <PField label={t.colors} value={form.colors} onChangeText={v => set('colors', v)} placeholder={t.colorsHint} isAr={isAr} />
              <PField label={t.sizes} value={form.sizes} onChangeText={v => set('sizes', v)} placeholder={t.sizesHint} isAr={isAr} />
              <PField label={t.material} value={form.material} onChangeText={v => set('material', v)} placeholder={t.materialHint} isAr={isAr} />

              <Text style={[s.catLabel, isAr && s.rtl]}>{t.category}</Text>
              <View style={[s.catRow, isAr && s.catRowRtl]}>
                {cats.map(cat => (
                  <TouchableOpacity
                    key={cat.val}
                    style={[s.catChip, form.category === cat.val && s.catChipActive]}
                    onPress={() => set('category', form.category === cat.val ? '' : cat.val)}
                    activeOpacity={0.85}
                  >
                    <Text style={[s.catChipText, form.category === cat.val && s.catChipTextActive]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[s.sampleToggle, form.sampleAvailable && s.sampleToggleActive]}
                onPress={() => set('sampleAvailable', !form.sampleAvailable)}
                activeOpacity={0.85}
              >
                <Text style={[s.sampleText, form.sampleAvailable && s.sampleTextActive]}>
                  {form.sampleAvailable ? t.sampleOn : t.sampleOff}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.submitBtn, submitting && { opacity: 0.6 }]}
                onPress={handleAdd}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting
                  ? <ActivityIndicator color={C.bgBase} />
                  : <Text style={s.submitBtnText}>{t.addProduct}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
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
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  productName: { color: C.textPrimary, fontSize: 14, fontFamily: F.arSemi, flex: 1, lineHeight: 20 },
  toggleBtn: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8 },
  toggleText: { fontSize: 11, fontFamily: F.arSemi },
  cardMeta: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  metaItem: { color: C.textTertiary, fontSize: 12, fontFamily: F.en },

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

  modalScroll: { padding: 20, paddingBottom: 60 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },
  modalTitle: { color: C.textPrimary, fontSize: 18, fontFamily: F.arSemi },
  modalClose: { color: C.textSecondary, fontSize: 15, fontFamily: F.ar },

  fieldWrap: { marginBottom: 16 },
  fieldLabel: { color: C.textSecondary, fontSize: 12, fontFamily: F.ar, marginBottom: 6 },
  fieldHint: { color: C.textDisabled, fontSize: 11, fontFamily: F.ar, marginTop: 4 },
  input: {
    backgroundColor: C.bgRaised, borderRadius: 12,
    borderWidth: 1, borderColor: C.borderMuted,
    paddingHorizontal: 16, paddingVertical: 12,
    color: C.textPrimary, fontSize: 15, fontFamily: F.ar,
  },

  catLabel: { color: C.textSecondary, fontSize: 12, fontFamily: F.ar, marginBottom: 8 },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  catRowRtl: { flexDirection: 'row-reverse' },
  catChip: {
    borderWidth: 1, borderColor: C.borderDefault,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: C.bgRaised,
  },
  catChipActive: { borderColor: C.borderStrong, backgroundColor: C.bgHover },
  catChipText: { color: C.textSecondary, fontSize: 12, fontFamily: F.ar },
  catChipTextActive: { color: C.textPrimary, fontFamily: F.arSemi },

  sampleToggle: {
    borderWidth: 1, borderColor: C.borderDefault,
    borderRadius: 12, paddingVertical: 12, alignItems: 'center',
    marginBottom: 16, backgroundColor: C.bgRaised,
  },
  sampleToggleActive: { borderColor: C.borderStrong, backgroundColor: C.bgHover },
  sampleText: { color: C.textSecondary, fontSize: 14, fontFamily: F.arSemi },
  sampleTextActive: { color: C.textPrimary },

  submitBtn: {
    backgroundColor: C.btnPrimary, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginTop: 8,
  },
  submitBtnText: { color: C.btnPrimaryText, fontFamily: F.arSemi, fontSize: 16 },
});
