import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Modal, RefreshControl,
  KeyboardAvoidingView, Platform, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';
import { getLang } from '../../lib/lang';

/* ── Translation helper ── */
const tx = (ar, en, zh) => {
  const l = getLang();
  return l === 'ar' ? ar : l === 'zh' ? zh : en;
};

/* ── Status maps (exact from web DashboardBuyer.jsx) ── */
const STATUS_AR    = { open: 'مرفوع', offers_received: 'عروض وصلت', closed: 'عرض مقبول', supplier_confirmed: 'المورد جاهز', paid: 'تم الدفع', ready_to_ship: 'الشحنة جاهزة', shipping: 'قيد الشحن', arrived: 'وصل السعودية', delivered: 'تم التسليم' };
const STATUS_EN    = { open: 'Posted', offers_received: 'Offers In', closed: 'Accepted', supplier_confirmed: 'Supplier Ready', paid: 'Paid', ready_to_ship: 'Ready to Ship', shipping: 'Shipping', arrived: 'Arrived', delivered: 'Delivered' };
const STATUS_ZH    = { open: '已发布', offers_received: '报价已到', closed: '已接受', supplier_confirmed: '供应商已确认', paid: '已付款', ready_to_ship: '准备发货', shipping: '运输中', arrived: '已到达', delivered: '已交付' };
const STATUS_STEPS = ['open', 'offers_received', 'closed', 'supplier_confirmed', 'paid', 'ready_to_ship', 'shipping', 'arrived', 'delivered'];
const STATUS_COLOR = {
  open: C.blue, offers_received: C.green, closed: C.green,
  supplier_confirmed: C.green, paid: C.green, ready_to_ship: C.orange, shipping: C.orange,
  arrived: C.green, delivered: C.green,
};

/* ── Tracking URL helper (exact from web) ── */
function getTrackingUrl(company, num) {
  const urls = {
    DHL:    `https://www.dhl.com/track?tracking-id=${num}`,
    FedEx:  `https://www.fedex.com/tracking?tracknumbers=${num}`,
    Aramex: `https://www.aramex.com/track/${num}`,
    UPS:    `https://www.ups.com/track?tracknum=${num}`,
    SMSA:   `https://www.smsaexpress.com/track?awbno=${num}`,
  };
  return urls[company] || `https://t.17track.net/en#nums=${num}`;
}

/* ── New-request form constants (kept from existing RequestsScreen) ── */
const CATEGORIES = [
  { val: 'electronics', label: 'إلكترونيات' },
  { val: 'furniture',   label: 'أثاث' },
  { val: 'clothing',    label: 'ملابس' },
  { val: 'building',    label: 'مواد بناء' },
  { val: 'food',        label: 'غذاء' },
  { val: 'other',       label: 'أخرى' },
];
const PAYMENT_PLANS = [
  { val: '30',  label: '30% مقدماً' },
  { val: '50',  label: '50% مقدماً' },
  { val: '100', label: '100% مقدماً' },
];
const SAMPLE_REQS = [
  { val: 'none',      label: 'لا حاجة لعينة' },
  { val: 'preferred', label: 'عينة مفضلة' },
  { val: 'required',  label: 'عينة إلزامية' },
];
const EMPTY_FORM = {
  titleAr: '', description: '', quantity: '', category: 'other',
  budgetPerUnit: '', paymentPlan: '30', sampleReq: 'preferred',
};

/* ════════════════════════════════════════════════════════════ */
export default function RequestsScreen({ navigation, route }) {
/* ════════════════════════════════════════════════════════════ */
  const [requests, setRequests]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /* ── New request modal ── */
  const [showNew, setShowNew]           = useState(route.params?.openNew || false);
  const [sourcingMode, setSourcingMode] = useState(route.params?.mode || 'direct');
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [submitting, setSubmitting]     = useState(false);
  const [formError, setFormError]       = useState('');

  /* ── Edit modal ── */
  const [editReq, setEditReq]       = useState(null);
  const [editForm, setEditForm]     = useState({ title_ar: '', title_en: '', desc_ar: '', quantity: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  /* Re-read route params when tab is re-navigated */
  useEffect(() => {
    if (route.params?.openNew) {
      setSourcingMode(route.params?.mode || 'direct');
      setShowNew(true);
    }
  }, [route.params?.openNew, route.params?.mode]);

  /* ── Load requests + offer rows ── */
  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); setRefreshing(false); return; }

    const { data } = await supabase
      .from('requests')
      .select('*')
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false });

    console.log('[RequestsScreen] loadRequests:', data);

    const rows = data || [];

    if (rows.length > 0) {
      const requestIds = rows.map(r => r.id);
      const { data: offerRows } = await supabase
        .from('offers')
        .select('id, status, request_id')
        .in('request_id', requestIds);

      console.log('[RequestsScreen] loadOffers:', offerRows);

      const byReq = (offerRows || []).reduce((acc, o) => {
        (acc[o.request_id] = acc[o.request_id] || []).push(o);
        return acc;
      }, {});

      setRequests(rows.map(r => ({ ...r, offers: byReq[r.id] || [] })));
    } else {
      setRequests([]);
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Realtime: refresh when offers or requests change ── */
  useEffect(() => {
    const channel = supabase.channel('requests-screen-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'offers' },   () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  /* ── Form helpers ── */
  function setField(k, v)     { setForm(f => ({ ...f, [k]: v })); }
  function setEditField(k, v) { setEditForm(f => ({ ...f, [k]: v })); }

  function openNew(mode = 'direct') {
    setSourcingMode(mode);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowNew(true);
  }
  function closeNew() { setShowNew(false); setForm(EMPTY_FORM); setFormError(''); }

  function openEdit(r) {
    setEditReq(r);
    setEditForm({
      title_ar: r.title_ar || '',
      title_en: r.title_en || '',
      desc_ar:  r.desc_ar  || r.description || '',
      quantity: String(r.quantity || ''),
    });
  }

  /* ── Save edit (exact web columns: title_ar, title_en, desc_ar, quantity) ── */
  async function saveEdit() {
    if (!editReq) return;
    setSavingEdit(true);
    await supabase.from('requests').update({
      title_ar: editForm.title_ar,
      title_en: editForm.title_en,
      desc_ar:  editForm.desc_ar,
      quantity: editForm.quantity,
    }).eq('id', editReq.id);
    setSavingEdit(false);
    setEditReq(null);
    load();
  }

  /* ── Delete (exact web logic) ── */
  function deleteRequest(r) {
    if (r.status !== 'open') {
      Alert.alert(
        tx('تنبيه', 'Notice', '提示'),
        tx('لا يمكن حذف طلب غير مفتوح', 'Can only delete open requests', '只能删除未开放的需求')
      );
      return;
    }
    const pendingCount = (r.offers || []).filter(o => o.status === 'pending').length;
    const msg = pendingCount > 0
      ? tx(
          `هل تريد حذف هذا الطلب؟ يوجد ${pendingCount} عرض معلق سيُلغى`,
          `Delete this request? ${pendingCount} pending offer(s) will be cancelled.`,
          `确定删除？有 ${pendingCount} 个待处理报价将被取消`
        )
      : tx('هل تريد حذف هذا الطلب؟', 'Delete this request?', '确定删除此需求？');

    Alert.alert(
      tx('حذف الطلب', 'Delete Request', '删除需求'),
      msg,
      [
        { text: tx('إلغاء', 'Cancel', '取消'), style: 'cancel' },
        {
          text: tx('حذف', 'Delete', '删除'), style: 'destructive',
          onPress: async () => {
            await supabase.from('requests').delete().eq('id', r.id);
            load();
          },
        },
      ]
    );
  }

  /* ── Submit new request (exact web insert) ── */
  async function handleSubmit() {
    const title = form.titleAr.trim();
    const qty   = form.quantity.trim();
    if (!title || !qty) {
      setFormError(tx('يرجى تعبئة العنوان والكمية.', 'Please fill in title and quantity.', '请填写标题和数量。'));
      return;
    }
    setSubmitting(true);
    setFormError('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSubmitting(false); return; }
    const isManaged = sourcingMode === 'managed';
    const { data: inserted, error } = await supabase.from('requests').insert({
      buyer_id:           user.id,
      title_ar:           title,
      title_en:           title,
      title_zh:           title,
      description:        form.description.trim(),
      quantity:           qty,
      category:           form.category || 'other',
      budget_per_unit:    form.budgetPerUnit ? parseFloat(form.budgetPerUnit) : null,
      payment_plan:       parseInt(form.paymentPlan, 10),
      sample_requirement: form.sampleReq,
      status:             'open',
      sourcing_mode:      isManaged ? 'managed' : 'direct',
      managed_status:     isManaged ? 'submitted' : null,
    }).select('id').single();
    setSubmitting(false);
    if (error) {
      setFormError(tx('حدث خطأ، حاول مرة أخرى.', 'An error occurred, please try again.', '发生错误，请重试。'));
      return;
    }
    closeNew();
    load();
    if (isManaged && inserted?.id) {
      navigation.navigate('Offers', { requestId: inserted.id, title });
    }
  }

  /* ── Render ── */
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.topBar}>
        <TouchableOpacity style={s.newBtn} onPress={() => openNew('direct')} activeOpacity={0.85}>
          <Text style={s.newBtnText}>+ {tx('طلب جديد', 'New Request', '新需求')}</Text>
        </TouchableOpacity>
        <Text style={s.pageTitle}>{tx('طلباتي', 'My Requests', '我的需求')}</Text>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={C.textDisabled} size="large" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={C.textDisabled}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {requests.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyText}>{tx('ما عندك طلبات بعد', 'No requests yet', '暂无需求')}</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={() => openNew('direct')}>
                <Text style={s.emptyBtnText}>{tx('ارفع أول طلب', 'Post First Request', '发布第一个需求')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            requests.map(r => (
              <RequestCard
                key={r.id}
                r={r}
                navigation={navigation}
                onEdit={openEdit}
                onDelete={deleteRequest}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* ── Edit Request Modal ── */}
      <Modal visible={!!editReq} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={s.safe}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={s.modalScroll} keyboardShouldPersistTaps="handled">
              <View style={s.modalHeader}>
                <TouchableOpacity onPress={() => setEditReq(null)} hitSlop={8}>
                  <Text style={s.modalClose}>{tx('إلغاء', 'Cancel', '取消')}</Text>
                </TouchableOpacity>
                <Text style={s.modalTitle}>{tx('تعديل الطلب', 'Edit Request', '编辑需求')}</Text>
              </View>
              <Field
                label={tx('عنوان الطلب (عربي)', 'Title (Arabic)', '标题（阿拉伯语）')}
                value={editForm.title_ar}
                onChangeText={v => setEditField('title_ar', v)}
              />
              <Field
                label={tx('عنوان الطلب (إنجليزي)', 'Title (English)', '标题（英语）')}
                value={editForm.title_en}
                onChangeText={v => setEditField('title_en', v)}
              />
              <Field
                label={tx('الوصف', 'Description', '描述')}
                value={editForm.desc_ar}
                onChangeText={v => setEditField('desc_ar', v)}
                multiline
                numberOfLines={4}
                style={{ minHeight: 100 }}
              />
              <Field
                label={tx('الكمية', 'Quantity', '数量')}
                value={editForm.quantity}
                onChangeText={v => setEditField('quantity', v)}
              />
              <TouchableOpacity
                style={[s.submitBtn, savingEdit && { opacity: 0.6 }]}
                onPress={saveEdit}
                disabled={savingEdit}
                activeOpacity={0.85}
              >
                {savingEdit
                  ? <ActivityIndicator color={C.btnPrimaryText} />
                  : <Text style={s.submitBtnText}>{tx('حفظ التعديلات', 'Save Changes', '保存更改')}</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* ── New Request Modal ── */}
      <Modal visible={showNew} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={s.safe}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={s.modalScroll} keyboardShouldPersistTaps="handled">
              <View style={s.modalHeader}>
                <TouchableOpacity onPress={closeNew} hitSlop={8}>
                  <Text style={s.modalClose}>{tx('إغلاق', 'Close', '关闭')}</Text>
                </TouchableOpacity>
                <Text style={s.modalTitle}>
                  {sourcingMode === 'managed'
                    ? tx('طلب مُدار', 'Managed Request', '托管需求')
                    : tx('طلب جديد', 'New Request', '新需求')}
                </Text>
              </View>

              {sourcingMode === 'managed' && (
                <View style={s.managedBanner}>
                  <Text style={s.managedBannerText}>
                    {tx(
                      'معبر سيتولى البحث ويعرض لك أفضل 3 خيارات من موردين مختارين.',
                      'Maabar will handle sourcing and present the top 3 offers from vetted suppliers.',
                      'Maabar 将负责采购，并从经过审核的供应商中提供前3个报价。'
                    )}
                  </Text>
                </View>
              )}

              <Field label={tx('عنوان الطلب *', 'Request Title *', '需求标题 *')} value={form.titleAr} onChangeText={v => setField('titleAr', v)} />
              <Field label={tx('الوصف والمواصفات', 'Description & Specs', '描述和规格')} value={form.description} onChangeText={v => setField('description', v)} multiline numberOfLines={4} style={{ minHeight: 100 }} />
              <Field label={tx('الكمية المطلوبة *', 'Quantity *', '所需数量 *')} value={form.quantity} onChangeText={v => setField('quantity', v)} />
              <Field label={tx('الميزانية للوحدة (اختياري)', 'Budget per Unit (optional)', '单位预算（可选）')} value={form.budgetPerUnit} onChangeText={v => setField('budgetPerUnit', v)} keyboardType="numeric" />

              <ChipField label={tx('الفئة', 'Category', '类别')} options={CATEGORIES} selected={form.category} onSelect={v => setField('category', v)} />
              <ChipField label={tx('خطة الدفع *', 'Payment Plan *', '付款计划 *')} options={PAYMENT_PLANS} selected={form.paymentPlan} onSelect={v => setField('paymentPlan', v)} />
              <ChipField label={tx('متطلبات العينة *', 'Sample Requirement *', '样品要求 *')} options={SAMPLE_REQS} selected={form.sampleReq} onSelect={v => setField('sampleReq', v)} />

              {!!formError && <Text style={s.error}>{formError}</Text>}

              <TouchableOpacity
                style={[s.submitBtn, submitting && { opacity: 0.6 }]}
                onPress={handleSubmit}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting
                  ? <ActivityIndicator color={C.btnPrimaryText} />
                  : <Text style={s.submitBtnText}>
                      {sourcingMode === 'managed'
                        ? tx('إرسال الطلب المُدار', 'Submit Managed Request', '提交托管需求')
                        : tx('رفع الطلب', 'Post Request', '发布需求')}
                    </Text>
                }
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

/* ════════════════════════════════════════════════════════════ */
/* ── Progress Bar (8-step, exact web StatusBar logic) ── */
function ProgressBar({ status }) {
  const lang = getLang();
  const idx  = STATUS_STEPS.indexOf(status);
  const cur  = idx === -1 ? 0 : idx;
  const label = lang === 'ar' ? (STATUS_AR[status] || STATUS_AR.open)
    : lang === 'zh' ? (STATUS_ZH[status] || STATUS_ZH.open)
    : (STATUS_EN[status] || STATUS_EN.open);
  return (
    <View style={s.progressWrap}>
      <View style={s.progressTrack}>
        {STATUS_STEPS.map((_, i) => (
          <View
            key={i}
            style={[s.progressSeg, { backgroundColor: i <= cur ? C.textTertiary : C.borderSubtle }]}
          />
        ))}
      </View>
      <Text style={s.progressLabel}>{label}</Text>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════ */
/* ── Request Card ── */
function RequestCard({ r, navigation, onEdit, onDelete }) {
  const lang      = getLang();
  const isManaged = String(r.sourcing_mode || 'direct') === 'managed';
  const offers    = r.offers || [];
  const pending   = offers.filter(o => o.status === 'pending');
  const accepted  = offers.find(o => o.status === 'accepted');

  const statusColor = STATUS_COLOR[r.status] || C.blue;
  const statusLabel = lang === 'ar' ? (STATUS_AR[r.status] || r.status)
    : lang === 'zh' ? (STATUS_ZH[r.status] || r.status)
    : (STATUS_EN[r.status] || r.status);

  const title = lang === 'ar' ? (r.title_ar || r.title_en)
    : lang === 'zh' ? (r.title_zh || r.title_en || r.title_ar)
    : (r.title_en || r.title_ar);

  /* ── Next step copy (mirrors web logic exactly) ── */
  const nextStep = (() => {
    if (isManaged) {
      if (String(r.managed_status || '') === 'shortlist_ready') {
        return {
          title: tx('الخطوة التالية: راجع العروض المختارة لك', 'Next step: review your selected offers', '下一步：查看为您选择的报价'),
          body:  tx('كل قرار في هذا الطلب المُدار يتم من نفس الصفحة.', 'Every decision for this managed request stays in the same page.', '此托管需求的所有决策都在同一页面完成。'),
          onPress: () => navigation.navigate('ManagedRequest', {
            requestId: r.id,
            title: r.title_ar || r.title_en,
          }),
        };
      }
      return {
        title: tx('الطلب الآن داخل المسار المُدار', 'This request is now inside the managed flow', '此需求已进入托管流程'),
        body:  tx('معبر يجهّز الـ brief ويطابق الموردين المناسبين.', 'Maabar is preparing the brief and matching suitable suppliers.', 'Maabar 正在准备摘要并匹配合适的供应商。'),
      };
    }
    if (accepted && !['paid', 'ready_to_ship', 'shipping', 'arrived', 'delivered'].includes(r.status)) {
      return {
        title: tx('الخطوة التالية: راجع العرض المقبول وادفع بأمان', 'Next step: review the accepted offer and pay securely', '下一步：查看已接受的报价并安全付款'),
        body:  tx('أكمل الدفع من نفس الطلب.', 'Complete checkout from this request.', '从此需求完成结账。'),
      };
    }
    if (r.status === 'ready_to_ship' && r.payment_second > 0) {
      return {
        title: tx('الخطوة التالية: ادفع الدفعة الثانية', 'Next step: pay the second installment', '下一步：支付第二期款'),
        body:  tx('المورد أكد جاهزية الشحنة.', 'The supplier confirmed shipment readiness.', '供应商已确认货物准备就绪。'),
        onPress: () => navigation.navigate('Payment', {
          amount: Number(r.payment_second) * 3.75,
          type: 'second_installment',
          requestId: r.id,
        }),
      };
    }
    if (r.status === 'shipping') {
      return {
        title: tx('الخطوة التالية: تابع التتبع ثم أكد وصول الشحنة', 'Next step: follow tracking, then confirm arrival', '下一步：跟踪物流，确认到达'),
        body:  tx('بمجرد الوصول يمكنك تأكيد الاستلام.', 'Once arrived, confirm final delivery.', '货物到达后，确认最终交货。'),
      };
    }
    if (r.status === 'arrived') {
      return {
        title: tx('الخطوة التالية: أكد الاستلام لإغلاق الصفقة', 'Next step: confirm delivery to close the deal', '下一步：确认收货以完成交易'),
        body:  tx('إذا استلمت البضاعة كما هو متفق عليه، أكد الاستلام.', 'If goods arrived as agreed, confirm delivery.', '如果货物按约定到达，请确认收货。'),
      };
    }
    if (pending.length > 0) {
      const n = pending.length;
      return {
        title: tx(
          `الخطوة التالية: قارن ${n} عرض${n > 1 ? 'اً' : ''} واختر الأنسب`,
          `Next step: compare ${n} offer${n > 1 ? 's' : ''} and pick the best fit`,
          `下一步：比较 ${n} 个报价并选择最合适的`
        ),
        body: tx(
          'راجع الإجمالي ومدة التجهيز قبل قبول العرض.',
          'Review total cost and lead time before accepting an offer.',
          '接受报价前，请检查总费用和交货期。'
        ),
      };
    }
    if (offers.length > 0) {
      return {
        title: tx('العروض موجودة داخل هذا الطلب', 'Offers are already attached to this request', '此需求已有报价'),
        body:  tx('كل قرار لاحق يتم من نفس البطاقة.', 'Every next decision stays inside this same card.', '所有后续决策都在同一卡片中完成。'),
      };
    }
    return null;
  })();

  return (
    <TouchableOpacity
      style={s.card}
      activeOpacity={0.92}
      onPress={() => navigation.navigate('Offers', {
        requestId: r.id,
        title: title || r.title_ar || r.title_en,
      })}
    >

      {/* ── Title + Status Badge ── */}
      <View style={s.cardTitleRow}>
        <View style={[s.statusBadge, { backgroundColor: statusColor + '20' }]}>
          <Text style={[s.statusBadgeText, { color: statusColor }]}>
            {isManaged ? tx('مُدار', 'Managed', '托管') : statusLabel}
          </Text>
        </View>
        <Text style={s.cardTitle} numberOfLines={2}>{title}</Text>
      </View>

      {/* ── Edit / Delete — only when status = 'open' ── */}
      {r.status === 'open' && (
        <View style={s.actionRow}>
          <TouchableOpacity style={s.editBtn} onPress={() => onEdit(r)} activeOpacity={0.8}>
            <Text style={s.editBtnText}>{tx('تعديل', 'Edit', '编辑')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.deleteBtn} onPress={() => onDelete(r)} activeOpacity={0.8}>
            <Text style={s.deleteBtnText}>{tx('حذف', 'Delete', '删除')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Progress bar / Managed simple note ── */}
      {!isManaged
        ? <ProgressBar status={r.shipping_status || r.status} />
        : (
          <View style={s.managedNote}>
            <Text style={s.managedNoteText}>
              {tx('طلب مُدار — معبر يتابع لك', 'Managed request — Maabar handles sourcing', '托管需求 — Maabar 负责采购')}
            </Text>
          </View>
        )
      }

      {/* ── Info chips: qty · offers count · date ── */}
      <View style={s.chipsRow}>
        <View style={s.chip}>
          <Text style={s.chipText}>{tx('الكمية', 'Qty', '数量')}: {r.quantity || '—'}</Text>
        </View>
        <View style={s.chip}>
          <Text style={s.chipText}>{tx('العروض', 'Offers', '报价')}: {offers.length}</Text>
        </View>
        {pending.length > 0 && (
          <View style={[s.chip, s.chipOrange]}>
            <Text style={[s.chipText, { color: C.orange }]}>
              {pending.length} {tx('معلق', 'pending', '待处理')}
            </Text>
          </View>
        )}
        <View style={s.chip}>
          <Text style={[s.chipText, { fontFamily: lang === 'ar' ? F.ar : F.en }]}>
            {new Date(r.created_at).toLocaleDateString(
              lang === 'ar' ? 'ar-SA' : lang === 'zh' ? 'zh-CN' : 'en-US'
            )}
          </Text>
        </View>
      </View>

      {/* ── Next step banner (neutral gray — no purple) ── */}
      {!!nextStep && (
        <TouchableOpacity
          style={s.nextBanner}
          activeOpacity={nextStep.onPress ? 0.75 : 1}
          onPress={nextStep.onPress || undefined}
        >
          <Text style={s.nextTitle}>{nextStep.title}</Text>
          <Text style={s.nextBody}>{nextStep.body}</Text>
          {!!nextStep.onPress && (
            <Text style={s.nextCta}>{tx('اضغط للمتابعة ←', 'Tap to continue →', '点击继续 →')}</Text>
          )}
        </TouchableOpacity>
      )}

      {/* ── Tracking section ── */}
      {!isManaged && !!r.tracking_number && (
        <View style={s.trackBox}>
          <View style={s.trackRow}>
            <TouchableOpacity
              onPress={() => Linking.openURL(getTrackingUrl(r.shipping_company, r.tracking_number)).catch(() => {})}
              activeOpacity={0.8}
            >
              <Text style={s.trackLink}>{tx('تتبع ←', 'Track →', '追踪 →')}</Text>
            </TouchableOpacity>
            <Text style={s.trackText} numberOfLines={2}>
              {r.shipping_company ? `${r.shipping_company} · ` : ''}
              {tx('رقم التتبع: ', 'Tracking: ', '运单号：')}
              <Text style={s.trackNum}>{r.tracking_number}</Text>
            </Text>
          </View>
          {!!r.estimated_delivery && (
            <Text style={s.trackETA}>
              {tx('التسليم المتوقع: ', 'Expected delivery: ', '预计交货：')}
              {new Date(r.estimated_delivery).toLocaleDateString(
                lang === 'ar' ? 'ar-SA' : lang === 'zh' ? 'zh-CN' : 'en-US'
              )}
            </Text>
          )}
        </View>
      )}

    </TouchableOpacity>
  );
}

/* ════════════════════════════════════════════════════════════ */
/* ── Shared form sub-components ── */

function Field({ label, style: extraStyle, ...props }) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={[s.input, extraStyle]}
        placeholderTextColor={C.textDisabled}
        textAlignVertical={props.multiline ? 'top' : 'center'}
        color={C.textPrimary}
        textAlign="right"
        {...props}
      />
    </View>
  );
}

function ChipField({ label, options, selected, onSelect }) {
  return (
    <View style={s.chipSection}>
      <Text style={s.chipSectionLabel}>{label}</Text>
      <View style={s.chipSectionRow}>
        {options.map(opt => (
          <TouchableOpacity
            key={opt.val}
            style={[s.chipOption, selected === opt.val && s.chipOptionActive]}
            onPress={() => onSelect(opt.val)}
            activeOpacity={0.8}
          >
            <Text style={[s.chipOptionText, selected === opt.val && s.chipOptionTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════ */
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bgBase },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  /* ── Top bar ── */
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
  },
  pageTitle:  { color: C.textPrimary, fontFamily: F.arBold, fontSize: 18 },
  newBtn:     { backgroundColor: C.btnPrimary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8 },
  newBtnText: { color: C.btnPrimaryText, fontFamily: F.arBold, fontSize: 13 },

  /* ── List ── */
  list: { padding: 16, paddingBottom: 40 },

  /* ── Empty state ── */
  emptyCard: {
    backgroundColor: C.bgRaised,
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.borderDefault,
  },
  emptyText:    { color: C.textSecondary, fontFamily: F.ar, fontSize: 15, marginBottom: 16 },
  emptyBtn:     { backgroundColor: C.btnPrimary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText: { color: C.btnPrimaryText, fontFamily: F.arBold },

  /* ── Request Card ── */
  card: {
    backgroundColor: C.bgRaised,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: C.borderDefault,
    marginBottom: 12,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  statusBadge:     { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, alignSelf: 'flex-start', flexShrink: 0 },
  statusBadgeText: { fontSize: 11, fontFamily: F.arSemi },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontFamily: F.arSemi,
    color: C.textPrimary,
    textAlign: 'right',
    lineHeight: 24,
  },

  /* ── Edit / Delete buttons ── */
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginBottom: 12 },
  editBtn: {
    borderWidth: 1,
    borderColor: C.borderDefault,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  editBtnText: { fontSize: 12, color: C.textSecondary, fontFamily: F.ar },
  deleteBtn: {
    borderWidth: 1,
    borderColor: 'rgba(224,92,92,0.35)',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  deleteBtnText: { fontSize: 12, color: C.red, fontFamily: F.ar },

  /* ── Progress bar ── */
  progressWrap:  { marginBottom: 14 },
  progressTrack: { flexDirection: 'row', gap: 2, marginBottom: 5 },
  progressSeg:   { flex: 1, height: 2, borderRadius: 1 },
  progressLabel: {
    fontSize: 10,
    color: C.textSecondary,
    fontFamily: F.enSemi,
    letterSpacing: 1.5,
    textAlign: 'right',
    textTransform: 'uppercase',
  },

  /* ── Managed note ── */
  managedNote: {
    backgroundColor: C.bgOverlay,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  managedNoteText: { fontSize: 12, color: C.textTertiary, fontFamily: F.ar, textAlign: 'right' },

  /* ── Info chips ── */
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
    justifyContent: 'flex-end',
  },
  chip: {
    backgroundColor: C.bgHover,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipOrange: { borderColor: 'rgba(232,160,32,0.35)', backgroundColor: C.orangeSoft },
  chipText:   { fontSize: 11, color: C.textSecondary, fontFamily: F.ar },

  /* ── Next step banner (neutral gray) ── */
  nextBanner: {
    backgroundColor: C.bgHover,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.borderDefault,
    padding: 12,
    marginBottom: 12,
  },
  nextTitle: {
    fontSize: 12,
    color: C.textSecondary,
    fontFamily: F.arSemi,
    textAlign: 'right',
    marginBottom: 5,
    lineHeight: 18,
  },
  nextBody: {
    fontSize: 11,
    color: C.textTertiary,
    fontFamily: F.ar,
    textAlign: 'right',
    lineHeight: 18,
  },
  nextCta: {
    fontSize: 11,
    color: C.textSecondary,
    fontFamily: F.arSemi,
    textAlign: 'right',
    marginTop: 6,
  },

  /* ── Tracking section ── */
  trackBox: {
    backgroundColor: C.bgOverlay,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    padding: 12,
    marginBottom: 12,
  },
  trackRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  trackText: { flex: 1, fontSize: 12, color: C.textSecondary, fontFamily: F.ar, textAlign: 'right' },
  trackNum:  { color: C.textPrimary, fontFamily: F.enSemi },
  trackLink: { fontSize: 11, color: C.textTertiary, fontFamily: F.en, letterSpacing: 0.5 },
  trackETA:  { fontSize: 11, color: C.textTertiary, fontFamily: F.ar, textAlign: 'right', marginTop: 6 },

  /* ── View Offers footer button ── */
  offersBtn: {
    backgroundColor: C.bgHover,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.borderDefault,
    marginTop: 4,
  },
  offersBtnText: { color: C.textSecondary, fontFamily: F.arSemi, fontSize: 14 },

  /* ── Modals ── */
  modalScroll: { padding: 20, paddingBottom: 60 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { color: C.textPrimary, fontFamily: F.arBold, fontSize: 18 },
  modalClose: { color: C.textSecondary, fontFamily: F.ar, fontSize: 15 },

  /* Managed banner — neutral gray, no purple */
  managedBanner: {
    backgroundColor: C.bgHover,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.borderDefault,
    padding: 14,
    marginBottom: 20,
  },
  managedBannerText: {
    color: C.textSecondary, fontFamily: F.ar, fontSize: 13, textAlign: 'right', lineHeight: 20,
  },

  /* Field */
  fieldWrap:  { marginBottom: 16 },
  fieldLabel: { color: C.textSecondary, fontFamily: F.ar, fontSize: 12, textAlign: 'right', marginBottom: 6 },
  input: {
    backgroundColor: C.bgRaised,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.borderMuted,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: F.ar,
    fontSize: 15,
    color: C.textPrimary,
    textAlign: 'right',
  },

  /* ChipField */
  chipSection:      { marginBottom: 18 },
  chipSectionLabel: { color: C.textSecondary, fontFamily: F.ar, fontSize: 12, textAlign: 'right', marginBottom: 8 },
  chipSectionRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' },
  chipOption: {
    borderWidth: 1, borderColor: C.borderDefault, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7, backgroundColor: C.bgRaised,
  },
  chipOptionActive:     { borderColor: C.btnPrimary, backgroundColor: C.btnPrimary },
  chipOptionText:       { color: C.textSecondary, fontFamily: F.ar, fontSize: 13 },
  chipOptionTextActive: { color: C.btnPrimaryText, fontFamily: F.arSemi },

  /* Error + Submit */
  error: { color: C.red, fontFamily: F.ar, fontSize: 13, textAlign: 'right', marginBottom: 12 },
  submitBtn:     { backgroundColor: C.btnPrimary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  submitBtnText: { color: C.btnPrimaryText, fontFamily: F.arBold, fontSize: 16 },
});
