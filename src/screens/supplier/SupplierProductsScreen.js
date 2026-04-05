import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Modal, RefreshControl,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { C } from '../../lib/colors';

const CATEGORIES = ['إلكترونيات', 'أثاث', 'ملابس', 'مواد بناء', 'غذاء', 'أخرى'];

export default function SupplierProductsScreen() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [myId, setMyId] = useState(null);

  const [form, setForm] = useState({
    nameAr: '', nameEn: '', nameZh: '',
    descAr: '', priceFrom: '', currency: 'USD',
    moq: '', category: '', sampleAvailable: false,
    specLeadTimeDays: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMyId(user.id);

    const { data } = await supabase
      .from('products')
      .select('id, name_ar, name_en, price_from, currency, moq, category, is_active, created_at')
      .eq('supplier_id', user.id)
      .order('created_at', { ascending: false });

    setProducts(data || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  function onRefresh() { setRefreshing(true); load(); }
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleAdd() {
    if (!form.nameAr) { Alert.alert('', 'أدخل اسم المنتج بالعربية'); return; }
    setSubmitting(true);
    const { error } = await supabase.from('products').insert({
      supplier_id: myId,
      name_ar: form.nameAr,
      name_en: form.nameEn || null,
      name_zh: form.nameZh || null,
      desc_ar: form.descAr || null,
      price_from: form.priceFrom ? parseFloat(form.priceFrom) : null,
      currency: form.currency,
      moq: form.moq || null,
      category: form.category || null,
      sample_available: form.sampleAvailable,
      spec_lead_time_days: form.specLeadTimeDays ? parseInt(form.specLeadTimeDays) : null,
      is_active: true,
    });
    setSubmitting(false);
    if (error) { Alert.alert('خطأ', 'حدث خطأ، حاول مرة أخرى'); return; }
    setShowAdd(false);
    setForm({ nameAr: '', nameEn: '', nameZh: '', descAr: '', priceFrom: '', currency: 'USD', moq: '', category: '', sampleAvailable: false, specLeadTimeDays: '' });
    load();
  }

  async function toggleActive(id, current) {
    await supabase.from('products').update({ is_active: !current }).eq('id', id);
    load();
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.topBar}>
        <TouchableOpacity style={s.addBtn} onPress={() => setShowAdd(true)} activeOpacity={0.85}>
          <Text style={s.addBtnText}>+ إضافة</Text>
        </TouchableOpacity>
        <Text style={s.pageTitle}>منتجاتي</Text>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={C.accent} size="large" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
        >
          {products.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyText}>لا توجد منتجات بعد</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => setShowAdd(true)}>
                <Text style={s.emptyBtnText}>أضف منتجك الأول</Text>
              </TouchableOpacity>
            </View>
          ) : (
            products.map(p => (
              <View key={p.id} style={[s.card, !p.is_active && s.cardInactive]}>
                <View style={s.cardTop}>
                  <TouchableOpacity
                    style={[s.toggleBtn, { backgroundColor: p.is_active ? C.greenSoft : C.bgOverlay }]}
                    onPress={() => toggleActive(p.id, p.is_active)}
                  >
                    <Text style={[s.toggleText, { color: p.is_active ? C.green : C.textDisabled }]}>
                      {p.is_active ? 'نشط' : 'مخفي'}
                    </Text>
                  </TouchableOpacity>
                  <Text style={s.productName} numberOfLines={2}>{p.name_ar || p.name_en}</Text>
                </View>
                <View style={s.cardMeta}>
                  {p.price_from && (
                    <Text style={s.metaItem}>{p.price_from} {p.currency}</Text>
                  )}
                  {p.moq && <Text style={s.metaItem}>MOQ: {p.moq}</Text>}
                  {p.category && <Text style={s.metaItem}>{p.category}</Text>}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Add Product Modal */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={s.safe}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView contentContainerStyle={s.modalScroll} keyboardShouldPersistTaps="handled">
              <View style={s.modalHeader}>
                <TouchableOpacity onPress={() => setShowAdd(false)}>
                  <Text style={s.modalClose}>إغلاق</Text>
                </TouchableOpacity>
                <Text style={s.modalTitle}>منتج جديد</Text>
              </View>

              <PField label="اسم المنتج بالعربية *" value={form.nameAr} onChangeText={v => set('nameAr', v)} />
              <PField label="اسم المنتج بالإنجليزية" value={form.nameEn} onChangeText={v => set('nameEn', v)} />
              <PField label="اسم المنتج بالصينية" value={form.nameZh} onChangeText={v => set('nameZh', v)} />
              <PField label="الوصف" value={form.descAr} onChangeText={v => set('descAr', v)}
                multiline numberOfLines={3} style={{ minHeight: 80 }} />

              <View style={s.row}>
                <PField label="السعر من" value={form.priceFrom}
                  onChangeText={v => set('priceFrom', v)} keyboardType="numeric" style={{ flex: 1 }} />
                <PField label="العملة" value={form.currency}
                  onChangeText={v => set('currency', v)} style={{ flex: 0.6 }} />
              </View>

              <PField label="الحد الأدنى للطلب (MOQ)" value={form.moq}
                onChangeText={v => set('moq', v)} />
              <PField label="مدة التصنيع (بالأيام)" value={form.specLeadTimeDays}
                onChangeText={v => set('specLeadTimeDays', v)} keyboardType="numeric" />

              <Text style={s.catLabel}>الفئة</Text>
              <View style={s.catRow}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[s.catChip, form.category === cat && s.catChipActive]}
                    onPress={() => set('category', cat)}
                  >
                    <Text style={[s.catChipText, form.category === cat && { color: C.accent }]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[s.sampleToggle, form.sampleAvailable && s.sampleToggleActive]}
                onPress={() => set('sampleAvailable', !form.sampleAvailable)}
              >
                <Text style={[s.sampleText, form.sampleAvailable && { color: C.accent }]}>
                  {form.sampleAvailable ? '✓ عينات متاحة' : 'عينات غير متاحة'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.submitBtn, submitting && { opacity: 0.6 }]}
                onPress={handleAdd}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.submitBtnText}>إضافة المنتج</Text>}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function PField({ label, style, ...props }) {
  return (
    <View style={[s.fieldWrap, style && { marginBottom: 0 }]}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={[s.input, style]}
        placeholderTextColor={C.textDisabled}
        textAlignVertical={props.multiline ? 'top' : 'center'}
        {...props}
      />
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bgBase },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },
  pageTitle: { color: C.textPrimary, fontSize: 18, fontWeight: '700' },
  addBtn: {
    backgroundColor: C.accent, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  list: { padding: 16, gap: 10, paddingBottom: 40 },

  card: {
    backgroundColor: C.bgRaised, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: C.borderDefault,
  },
  cardInactive: { opacity: 0.6 },
  cardTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 8,
  },
  productName: { color: C.textPrimary, fontSize: 14, fontWeight: '600', textAlign: 'right', flex: 1 },
  toggleBtn: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8 },
  toggleText: { fontSize: 11, fontWeight: '700' },
  cardMeta: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
  metaItem: { color: C.textTertiary, fontSize: 12 },

  emptyCard: {
    backgroundColor: C.bgRaised, borderRadius: 16,
    padding: 40, alignItems: 'center', borderWidth: 1, borderColor: C.borderDefault,
  },
  emptyText: { color: C.textSecondary, fontSize: 14, marginBottom: 16 },
  emptyBtn: {
    backgroundColor: C.accent, borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  emptyBtnText: { color: '#fff', fontWeight: '700' },

  modalScroll: { padding: 20, paddingBottom: 60 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },
  modalTitle: { color: C.textPrimary, fontSize: 18, fontWeight: '700' },
  modalClose: { color: C.accent, fontSize: 15 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  fieldWrap: { marginBottom: 16 },
  fieldLabel: { color: C.textSecondary, fontSize: 12, textAlign: 'right', marginBottom: 6 },
  input: {
    backgroundColor: C.bgRaised, borderRadius: 12,
    borderWidth: 1, borderColor: C.borderMuted,
    paddingHorizontal: 16, paddingVertical: 12,
    color: C.textPrimary, fontSize: 15, textAlign: 'right',
  },
  catLabel: { color: C.textSecondary, fontSize: 12, textAlign: 'right', marginBottom: 8 },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16, justifyContent: 'flex-end' },
  catChip: {
    borderWidth: 1, borderColor: C.borderDefault,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: C.bgRaised,
  },
  catChipActive: { borderColor: C.accent, backgroundColor: C.accentSoft },
  catChipText: { color: C.textSecondary, fontSize: 12 },
  sampleToggle: {
    borderWidth: 1, borderColor: C.borderDefault,
    borderRadius: 12, paddingVertical: 12, alignItems: 'center',
    marginBottom: 16, backgroundColor: C.bgRaised,
  },
  sampleToggleActive: { borderColor: C.accent, backgroundColor: C.accentSoft },
  sampleText: { color: C.textSecondary, fontSize: 14, fontWeight: '600' },
  submitBtn: {
    backgroundColor: C.accent, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginTop: 8,
  },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
