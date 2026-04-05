import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Modal, RefreshControl,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { C } from '../../lib/colors';

const STATUS_AR = {
  open: 'مرفوع',
  offers_received: 'عروض وصلت',
  closed: 'عرض مقبول',
  paid: 'تم الدفع',
  ready_to_ship: 'الشحنة جاهزة',
  shipping: 'قيد الشحن',
  arrived: 'وصل السعودية',
  delivered: 'تم التسليم',
};

const STATUS_COLOR = {
  open: C.blue, offers_received: C.green,
  closed: C.accent, paid: C.green,
  ready_to_ship: C.orange, shipping: C.orange,
  arrived: C.green, delivered: C.green,
};

const CATEGORIES = ['إلكترونيات', 'أثاث', 'ملابس', 'مواد بناء', 'غذاء', 'أخرى'];

export default function RequestsScreen({ navigation, route }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNew, setShowNew] = useState(route.params?.openNew || false);

  const [form, setForm] = useState({
    titleAr: '', description: '', quantity: '',
    category: '', budgetPerUnit: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('requests')
      .select('id, title_ar, title_en, quantity, status, created_at, mode')
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false });
    setRequests(data || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit() {
    if (!form.titleAr || !form.quantity) {
      setFormError('يرجى تعبئة العنوان والكمية.'); return;
    }
    setSubmitting(true);
    setFormError('');
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('requests').insert({
      buyer_id: user.id,
      title_ar: form.titleAr,
      description: form.description,
      quantity: form.quantity,
      category: form.category,
      budget_per_unit: form.budgetPerUnit ? parseFloat(form.budgetPerUnit) : null,
      status: 'open',
      mode: 'direct',
    });
    setSubmitting(false);
    if (error) { setFormError('حدث خطأ، حاول مرة أخرى.'); return; }
    setShowNew(false);
    setForm({ titleAr: '', description: '', quantity: '', category: '', budgetPerUnit: '' });
    load();
  }

  function onRefresh() { setRefreshing(true); load(); }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.topBar}>
        <TouchableOpacity style={s.newBtn} onPress={() => setShowNew(true)} activeOpacity={0.85}>
          <Text style={s.newBtnText}>+ طلب جديد</Text>
        </TouchableOpacity>
        <Text style={s.pageTitle}>طلباتي</Text>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={C.accent} size="large" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
        >
          {requests.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyText}>لا توجد طلبات بعد</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => setShowNew(true)}>
                <Text style={s.emptyBtnText}>ارفع طلبك الأول</Text>
              </TouchableOpacity>
            </View>
          ) : (
            requests.map(r => (
              <TouchableOpacity
                key={r.id}
                style={s.card}
                activeOpacity={0.75}
                onPress={() => navigation.navigate('Offers', { requestId: r.id, title: r.title_ar || r.title_en })}
              >
                <View style={s.cardTop}>
                  <StatusBadge status={r.status} />
                  <View style={s.cardInfo}>
                    <Text style={s.cardTitle} numberOfLines={2}>{r.title_ar || r.title_en}</Text>
                    <Text style={s.cardQty}>{r.quantity}</Text>
                  </View>
                </View>
                <View style={s.cardFooter}>
                  <Text style={s.cardDate}>
                    {new Date(r.created_at).toLocaleDateString('ar-SA')}
                  </Text>
                  <Text style={[s.cardMode, { color: r.mode === 'managed' ? C.accent : C.textTertiary }]}>
                    {r.mode === 'managed' ? 'مُدار' : 'مباشر'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      {/* New Request Modal */}
      <Modal visible={showNew} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={s.safe}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView contentContainerStyle={s.modalScroll} keyboardShouldPersistTaps="handled">
              <View style={s.modalHeader}>
                <TouchableOpacity onPress={() => setShowNew(false)}>
                  <Text style={s.modalClose}>إغلاق</Text>
                </TouchableOpacity>
                <Text style={s.modalTitle}>طلب جديد</Text>
              </View>

              <Field label="عنوان الطلب *" value={form.titleAr}
                onChangeText={v => set('titleAr', v)} />
              <Field label="الوصف والمواصفات" value={form.description}
                onChangeText={v => set('description', v)}
                multiline numberOfLines={4} style={{ minHeight: 100 }} />
              <Field label="الكمية المطلوبة *" value={form.quantity}
                onChangeText={v => set('quantity', v)} />
              <Field label="الميزانية للوحدة (اختياري)" value={form.budgetPerUnit}
                onChangeText={v => set('budgetPerUnit', v)} keyboardType="numeric" />

              <Text style={s.catLabel}>الفئة</Text>
              <View style={s.catRow}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[s.catChip, form.category === cat && s.catChipActive]}
                    onPress={() => set('category', cat)}
                  >
                    <Text style={[s.catChipText, form.category === cat && { color: C.accent }]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {!!formError && <Text style={s.error}>{formError}</Text>}

              <TouchableOpacity
                style={[s.submitBtn, submitting && { opacity: 0.6 }]}
                onPress={handleSubmit}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={s.submitBtnText}>رفع الطلب</Text>}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function StatusBadge({ status }) {
  const color = STATUS_COLOR[status] || C.blue;
  const label = STATUS_AR[status] || STATUS_AR.open;
  return (
    <View style={[s.badge, { backgroundColor: color + '20' }]}>
      <Text style={[s.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

function Field({ label, style, ...props }) {
  return (
    <View style={s.fieldWrap}>
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
  newBtn: {
    backgroundColor: C.accent, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  newBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  list: { padding: 16, gap: 10, paddingBottom: 40 },

  card: {
    backgroundColor: C.bgRaised, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: C.borderDefault,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardInfo: { flex: 1, alignItems: 'flex-end' },
  cardTitle: { fontSize: 15, fontWeight: '600', color: C.textPrimary, textAlign: 'right' },
  cardQty: { fontSize: 12, color: C.textSecondary, marginTop: 4, textAlign: 'right' },
  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: 12, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: C.borderSubtle,
  },
  cardDate: { fontSize: 11, color: C.textTertiary },
  cardMode: { fontSize: 11, fontWeight: '600' },

  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700' },

  emptyCard: {
    backgroundColor: C.bgRaised, borderRadius: 16,
    padding: 40, alignItems: 'center',
    borderWidth: 1, borderColor: C.borderDefault,
  },
  emptyText: { color: C.textSecondary, fontSize: 15, marginBottom: 16 },
  emptyBtn: {
    backgroundColor: C.accent, borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  emptyBtnText: { color: '#fff', fontWeight: '700' },

  // Modal
  modalScroll: { padding: 20, paddingBottom: 60 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 24,
  },
  modalTitle: { color: C.textPrimary, fontSize: 18, fontWeight: '700' },
  modalClose: { color: C.accent, fontSize: 15 },

  fieldWrap: { marginBottom: 16 },
  fieldLabel: { color: C.textSecondary, fontSize: 12, textAlign: 'right', marginBottom: 6 },
  input: {
    backgroundColor: C.bgRaised, borderRadius: 12,
    borderWidth: 1, borderColor: C.borderMuted,
    paddingHorizontal: 16, paddingVertical: 12,
    color: C.textPrimary, fontSize: 15, textAlign: 'right',
  },

  catLabel: { color: C.textSecondary, fontSize: 12, textAlign: 'right', marginBottom: 8 },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20, justifyContent: 'flex-end' },
  catChip: {
    borderWidth: 1, borderColor: C.borderDefault,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: C.bgRaised,
  },
  catChipActive: { borderColor: C.accent, backgroundColor: C.accentSoft },
  catChipText: { color: C.textSecondary, fontSize: 13 },

  error: { color: C.red, fontSize: 13, textAlign: 'right', marginBottom: 12 },
  submitBtn: {
    backgroundColor: C.accent, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginTop: 8,
  },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
