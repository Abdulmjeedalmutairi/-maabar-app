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

const COPY = {
  ar: {
    title: 'الطلبات المطابقة',
    empty: 'لا توجد طلبات مطابقة حالياً',
    emptySub: 'فريق معبر يبحث عن طلبات تناسب تخصصك — ستظهر هنا عند توفرها.',
    category: 'التصنيف',
    statusLabel: 'الحالة',
    qty: 'الكمية المطلوبة',
    budget: 'الميزانية للوحدة',
    submitOffer: 'تقديم عرض',
    decline: 'رفض',
    confirmDecline: 'هل تريد رفض هذا الطلب المطابق؟',
    cancel: 'إلغاء',
    confirm: 'تأكيد',
    submitted: '✓ تم تقديم عرضك',
    offerTitle: 'تقديم عرض مطابق',
    close: 'إغلاق',
    unitPrice: 'سعر الوحدة (USD) *',
    shipping: 'تكلفة الشحن (USD) *',
    moq: 'MOQ *',
    productionDays: 'مدة الإنتاج (أيام) *',
    shippingDays: 'مدة الشحن (أيام) *',
    note: 'ملاحظة',
    submit: 'إرسال العرض',
    offerSent: 'تم إرسال عرضك لفريق معبر',
    errorForm: 'أدخل السعر والشحن وMOQ ومدة الإنتاج ومدة الشحن',
    errorGeneric: 'حدث خطأ، حاول مرة أخرى',
    privacy: 'يراه فريق معبر فقط — سعرك يبقى سرياً حتى إدراجك في القائمة القصيرة',
    urgent: 'عاجل',
    statuses: { new: 'جديد', viewed: 'تمت المشاهدة', quoted: 'تم التقديم', under_review: 'قيد المراجعة', declined: 'مرفوض', shortlisted: 'في القائمة المختصرة', selected_by_buyer: 'اختاره التاجر', dismissed: 'تم استبعاده', closed: 'مُغلق' },
    details: 'تفاصيل',
    detailsTitle: 'تفاصيل الطلب',
    fullDescription: 'الوصف الكامل',
    deadline: 'الموعد النهائي',
    brief: 'ملخص المورد من معبر',
    noBrief: 'لم يُنشأ ملخص بعد.',
    briefLoading: 'جارٍ التحميل…',
  },
  en: {
    title: 'Matched Requests',
    empty: 'No matched requests yet',
    emptySub: 'Maabar team is sourcing requests that match your specialty — they will appear here when ready.',
    category: 'Category',
    statusLabel: 'Status',
    qty: 'Quantity',
    budget: 'Budget/unit',
    submitOffer: 'Submit Offer',
    decline: 'Decline',
    confirmDecline: 'Decline this matched request?',
    cancel: 'Cancel',
    confirm: 'Confirm',
    submitted: '✓ Your offer has been submitted',
    offerTitle: 'Submit Matched Offer',
    close: 'Close',
    unitPrice: 'Unit Price (USD) *',
    shipping: 'Shipping Cost (USD) *',
    moq: 'MOQ *',
    productionDays: 'Production Days *',
    shippingDays: 'Shipping Days *',
    note: 'Note',
    submit: 'Send Offer',
    offerSent: 'Your offer was sent to the Maabar team',
    errorForm: 'Add unit price, shipping, MOQ, production days, and shipping days',
    errorGeneric: 'Something went wrong, please try again',
    privacy: 'Only the Maabar team sees this — your price stays private until you are shortlisted',
    urgent: 'URGENT',
    statuses: { new: 'New', viewed: 'Viewed', quoted: 'Submitted', under_review: 'Under review', declined: 'Declined', shortlisted: 'Shortlisted', selected_by_buyer: 'Buyer chose you', dismissed: 'Dismissed', closed: 'Closed' },
    details: 'Details',
    detailsTitle: 'Request Details',
    fullDescription: 'Full Description',
    deadline: 'Deadline',
    brief: 'Maabar Supplier Brief',
    noBrief: 'No AI brief available yet.',
    briefLoading: 'Loading…',
  },
  zh: {
    title: '匹配需求',
    empty: '暂无匹配需求',
    emptySub: 'Maabar 团队正在为您寻找匹配的需求，出现后会在此显示。',
    category: '类别',
    statusLabel: '状态',
    qty: '需求数量',
    budget: '单位预算',
    submitOffer: '提交报价',
    decline: '拒绝',
    confirmDecline: '确定拒绝此匹配需求吗？',
    cancel: '取消',
    confirm: '确认',
    submitted: '✓ 您的报价已提交',
    offerTitle: '提交匹配报价',
    close: '关闭',
    unitPrice: '单价 (USD) *',
    shipping: '运费 (USD) *',
    moq: '最小起订量 *',
    productionDays: '生产周期（天）*',
    shippingDays: '运输时效（天）*',
    note: '备注',
    submit: '发送报价',
    offerSent: '报价已发送给 Maabar 团队',
    errorForm: '请填写单价、运费、最小起订量、生产周期和运输时效',
    errorGeneric: '出现错误，请重试',
    privacy: '仅 Maabar 团队可见 — 在您被列入候选名单前，您的报价保密',
    urgent: '紧急',
    statuses: { new: '新', viewed: '已查看', quoted: '已提交', under_review: '审核中', declined: '已拒绝', shortlisted: '入围候选', selected_by_buyer: '买家已选择您', dismissed: '已排除', closed: '已关闭' },
    details: '详情',
    detailsTitle: '需求详情',
    fullDescription: '完整描述',
    deadline: '截止日期',
    brief: 'Maabar 供应商简报',
    noBrief: '暂无 AI 简报。',
    briefLoading: '加载中…',
  },
};

export default function SupplierManagedMatchesScreen() {
  const lang = getLang();
  const t = COPY[lang] || COPY.ar;
  const isAr = lang === 'ar';

  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myId, setMyId] = useState(null);

  const [selectedMatch, setSelectedMatch] = useState(null);
  const [form, setForm] = useState({
    price: '', shippingCost: '', moq: '', productionDays: '', shippingDays: '', note: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const [detailsMatch, setDetailsMatch] = useState(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); setRefreshing(false); return; }
    setMyId(user.id);

    // Exact web loadManagedMatches() — filter by supplier, newest first.
    const { data, error } = await supabase
      .from('managed_supplier_matches')
      .select('*, requests(*)')
      .eq('supplier_id', user.id)
      .order('matched_at', { ascending: false });

    if (error) {
      console.error('[SupplierManagedMatches] load error:', error);
      setMatches([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    // Attach any existing offer this supplier has already submitted on the
    // matched request so the card can render the "submitted" summary. Also
    // attach the AI brief keyed by request_id for the Details modal.
    const requestIds = (data || []).map(m => m.request_id).filter(Boolean);
    let offerByRequest = {};
    let briefByRequest = {};
    if (requestIds.length > 0) {
      const [{ data: offers }, { data: briefs }] = await Promise.all([
        supabase
          .from('offers')
          .select('*')
          .eq('supplier_id', user.id)
          .in('request_id', requestIds),
        supabase
          .from('managed_request_briefs')
          .select('request_id, cleaned_description, supplier_brief, ai_output, ai_confidence')
          .in('request_id', requestIds),
      ]);
      offerByRequest = (offers || []).reduce((acc, o) => ({ ...acc, [o.request_id]: o }), {});
      briefByRequest = (briefs || []).reduce((acc, b) => ({ ...acc, [b.request_id]: b }), {});
    }

    setMatches((data || []).map(m => ({
      ...m,
      offer: offerByRequest[m.request_id] || null,
      brief: briefByRequest[m.request_id] || null,
    })));
    setLoading(false);
    setRefreshing(false);

    // Track "viewed" — mark any 'new' matches as seen so the admin gets signal.
    // Fire-and-forget; we don't want a slow update blocking UI.
    const unseenIds = (data || []).filter(m => m.status === 'new').map(m => m.id);
    if (unseenIds.length > 0) {
      supabase
        .from('managed_supplier_matches')
        .update({ status: 'viewed', viewed_at: new Date().toISOString() })
        .in('id', unseenIds)
        .then(({ error }) => {
          if (error) console.error('[SupplierManagedMatches] mark-viewed error:', error);
        });
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  function onRefresh() { setRefreshing(true); load(); }
  function setF(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function openOffer(match) {
    setSelectedMatch(match);
    setForm({ price: '', shippingCost: '', moq: '', productionDays: '', shippingDays: '', note: '' });
  }

  function getTitle(m) {
    const r = m.requests || {};
    if (lang === 'ar') return r.title_ar || r.title_en || r.title_zh || '—';
    if (lang === 'zh') return r.title_zh || r.title_en || r.title_ar || '—';
    return r.title_en || r.title_ar || r.title_zh || '—';
  }

  function getDesc(m) {
    const r = m.requests || {};
    const raw = r.description;
    if (!raw) return '';
    try {
      const obj = JSON.parse(raw);
      if (obj && typeof obj === 'object') return obj[lang] || obj.ar || obj.en || obj.zh || '';
    } catch {}
    return String(raw);
  }

  function pickBriefText(brief) {
    if (!brief) return null;
    const byLang = brief.ai_output?.supplier_brief_all;
    if (byLang && (byLang[lang] || byLang.en || byLang.ar || byLang.zh)) {
      return byLang[lang] || byLang.en || byLang.ar || byLang.zh;
    }
    return brief.supplier_brief || null;
  }

  function fmtDate(d) {
    if (!d) return '—';
    try {
      const locale = lang === 'ar' ? 'ar-SA' : lang === 'zh' ? 'zh-CN' : 'en-GB';
      return new Date(d).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return String(d);
    }
  }

  async function submitOffer() {
    const price = parseFloat(form.price);
    const shippingCost = parseFloat(form.shippingCost);
    const productionDays = parseInt(form.productionDays, 10);
    const shippingDays = parseInt(form.shippingDays, 10);
    const moq = String(form.moq || '').trim();

    if (!Number.isFinite(price) || price <= 0
        || !Number.isFinite(shippingCost) || shippingCost < 0
        || !moq
        || !Number.isFinite(productionDays) || productionDays <= 0
        || !Number.isFinite(shippingDays) || shippingDays <= 0) {
      Alert.alert('', t.errorForm);
      return;
    }

    setSubmitting(true);
    const match = selectedMatch;
    const existingOfferId = match.offer?.id || null;

    // Web-exact submitManagedMatchOffer payload. `origin` is intentionally
    // omitted because the PostgREST schema cache on this project has dropped
    // that column — see the earlier direct-offer insert fix.
    const shippingMethodText = shippingDays
      ? `${shippingDays} ${lang === 'ar' ? 'يوم شحن' : lang === 'zh' ? '天运输时效' : 'shipping days'}`
      : null;

    const payload = {
      request_id: match.request_id,
      supplier_id: myId,
      price,
      shipping_cost: shippingCost,
      shipping_method: shippingMethodText,
      moq,
      delivery_days: productionDays,
      note: form.note || null,
      status: 'pending',
      managed_match_id: match.id,
      managed_visibility: 'admin_only',
      negotiation_note: shippingDays ? `shipping_time_days:${shippingDays}` : null,
    };

    const { error } = existingOfferId
      ? await supabase.from('offers').update(payload).eq('id', existingOfferId)
      : await supabase.from('offers').insert(payload);

    if (error) {
      console.error('[SupplierManagedMatches] submit error:', error);
      setSubmitting(false);
      Alert.alert('', t.errorGeneric);
      return;
    }

    await supabase.from('managed_supplier_matches').update({
      status: 'quoted',
      supplier_note: form.note || null,
      supplier_response: 'quoted',
      supplier_responded_at: new Date().toISOString(),
    }).eq('id', match.id);

    // Notify every admin so someone can review the managed offer.
    try {
      const { data: admins } = await supabase
        .from('profiles').select('id').in('role', ['admin', 'super_admin']);
      if (admins?.length) {
        await supabase.from('notifications').insert(admins.map((a) => ({
          user_id: a.id,
          type: 'managed_offer_received',
          title_ar: 'وصل عرض مُدار جديد للمراجعة',
          title_en: 'A new managed offer is ready for review',
          title_zh: '收到新的托管报价待审核',
          ref_id: match.request_id,
          is_read: false,
        })));
      }
    } catch (e) { console.error('[SupplierManagedMatches] notify-admin error:', e); }

    setSubmitting(false);
    setSelectedMatch(null);
    load();
    Alert.alert('✓', t.offerSent);
  }

  function decline(match) {
    Alert.alert('', t.confirmDecline, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.confirm, style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('managed_supplier_matches').update({
            status: 'declined',
            supplier_response: 'declined',
            closed_at: new Date().toISOString(),
          }).eq('id', match.id);
          if (error) { console.error('[SupplierManagedMatches] decline error:', error); return; }
          load();
        },
      },
    ]);
  }

  const statusPill = (status) => {
    if (status === 'quoted' || status === 'selected') return { bg: C.greenSoft, border: C.green + '40', color: C.green };
    if (status === 'declined' || status === 'rejected') return { bg: C.redSoft, border: C.red + '40', color: C.red };
    if (status === 'under_review' || status === 'viewed') return { bg: C.blueSoft, border: C.blue + '40', color: C.blue };
    return { bg: C.orangeSoft, border: C.orange + '40', color: C.orange };
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.topBar}>
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
          {matches.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={[s.emptyText, isAr && s.rtl]}>{t.empty}</Text>
              <Text style={[s.emptySubText, isAr && s.rtl]}>{t.emptySub}</Text>
            </View>
          ) : matches.map(m => {
            const r = m.requests || {};
            const desc = getDesc(m);
            const pill = statusPill(m.status);
            const submitted = !!m.offer && m.status !== 'declined';
            const isDeclined = m.status === 'declined';
            const isUrgent = (r.managed_priority === 'urgent') || (r.response_deadline && new Date(r.response_deadline) - new Date() < 7 * 24 * 60 * 60 * 1000);

            return (
              <View key={m.id} style={s.card}>
                <View style={[s.cardHeader, isAr && s.rowRtl]}>
                  <View style={[s.statusBadge, { backgroundColor: pill.bg, borderColor: pill.border }]}>
                    <Text style={[s.statusText, { color: pill.color }]}>
                      {t.statuses[m.status] || m.status}
                    </Text>
                  </View>
                  {isUrgent && (
                    <View style={s.urgentBadge}>
                      <Text style={s.urgentText}>{t.urgent}</Text>
                    </View>
                  )}
                  <Text style={[s.cardTitle, isAr && s.rtl]} numberOfLines={2}>{getTitle(m)}</Text>
                </View>

                {!!desc && (
                  <Text style={[s.cardDesc, isAr && s.rtl]} numberOfLines={2}>{desc}</Text>
                )}

                <View style={[s.metaRow, isAr && s.rowRtl]}>
                  {!!r.category && (
                    <Text style={s.meta}>{t.category}: {r.category}</Text>
                  )}
                  {!!r.quantity && (
                    <Text style={s.meta}>{t.qty}: {r.quantity}</Text>
                  )}
                  {!!r.budget_per_unit && (
                    <Text style={s.meta}>{t.budget}: ${r.budget_per_unit}</Text>
                  )}
                </View>

                <TouchableOpacity
                  onPress={() => setDetailsMatch(m)}
                  activeOpacity={0.7}
                  style={s.detailsLinkWrap}
                >
                  <Text style={[s.detailsLink, isAr && s.rtl]}>
                    {t.details} {isAr ? '←' : '→'}
                  </Text>
                </TouchableOpacity>

                {submitted ? (
                  <View style={s.submittedBox}>
                    <Text style={[s.submittedText, isAr && s.rtl]}>{t.submitted}</Text>
                    <View style={[s.submittedMeta, isAr && s.rowRtl]}>
                      {m.offer?.price != null && <Text style={s.submittedMetaItem}>${m.offer.price}/u</Text>}
                      {!!m.offer?.moq && <Text style={s.submittedMetaItem}>MOQ {m.offer.moq}</Text>}
                      {m.offer?.delivery_days != null && <Text style={s.submittedMetaItem}>{m.offer.delivery_days}d</Text>}
                    </View>
                  </View>
                ) : isDeclined ? null : (
                  <View style={[s.cardBtns, isAr && s.rowRtl]}>
                    <TouchableOpacity
                      style={s.declineBtn}
                      onPress={() => decline(m)}
                      activeOpacity={0.85}
                    >
                      <Text style={s.declineBtnText}>{t.decline}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.offerBtn}
                      onPress={() => openOffer(m)}
                      activeOpacity={0.85}
                    >
                      <Text style={s.offerBtnText}>{t.submitOffer}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Offer modal */}
      <Modal visible={!!selectedMatch} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={s.safe}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={s.modalScroll} keyboardShouldPersistTaps="handled">
              <View style={[s.modalHeader, isAr && s.rowRtl]}>
                <TouchableOpacity onPress={() => setSelectedMatch(null)}>
                  <Text style={s.modalClose}>{t.close}</Text>
                </TouchableOpacity>
                <Text style={[s.modalTitle, isAr && s.rtl]}>{t.offerTitle}</Text>
              </View>

              {selectedMatch && (
                <View style={s.reqSummary}>
                  <Text style={[s.reqSummaryTitle, isAr && s.rtl]}>{getTitle(selectedMatch)}</Text>
                  {!!selectedMatch.requests?.quantity && (
                    <Text style={[s.reqSummaryQty, isAr && s.rtl]}>{t.qty}: {selectedMatch.requests.quantity}</Text>
                  )}
                </View>
              )}

              <RField label={t.unitPrice} value={form.price} onChangeText={v => setF('price', v)} keyboardType="numeric" isAr={isAr} />
              <RField label={t.shipping} value={form.shippingCost} onChangeText={v => setF('shippingCost', v)} keyboardType="numeric" isAr={isAr} />
              <RField label={t.moq} value={form.moq} onChangeText={v => setF('moq', v)} isAr={isAr} />
              <RField label={t.productionDays} value={form.productionDays} onChangeText={v => setF('productionDays', v)} keyboardType="numeric" isAr={isAr} />
              <RField label={t.shippingDays} value={form.shippingDays} onChangeText={v => setF('shippingDays', v)} keyboardType="numeric" isAr={isAr} />
              <RField label={t.note} value={form.note} onChangeText={v => setF('note', v)} multiline numberOfLines={3} isAr={isAr} />

              <Text style={[s.privacy, isAr && s.rtl]}>{t.privacy}</Text>

              <TouchableOpacity
                style={[s.submitBtn, submitting && { opacity: 0.6 }]}
                onPress={submitOffer}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting
                  ? <ActivityIndicator color={C.bgBase} />
                  : <Text style={s.submitBtnText}>{t.submit}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Details modal */}
      <Modal visible={!!detailsMatch} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDetailsMatch(null)}>
        <SafeAreaView style={s.safe}>
          <ScrollView contentContainerStyle={s.modalScroll}>
            <View style={[s.modalHeader, isAr && s.rowRtl]}>
              <TouchableOpacity onPress={() => setDetailsMatch(null)}>
                <Text style={s.modalClose}>{t.close}</Text>
              </TouchableOpacity>
              <Text style={[s.modalTitle, isAr && s.rtl]}>{t.detailsTitle}</Text>
            </View>

            {detailsMatch && (() => {
              const r = detailsMatch.requests || {};
              const desc = getDesc(detailsMatch);
              const briefText = pickBriefText(detailsMatch.brief);
              return (
                <>
                  <Text style={[s.detailsMainTitle, isAr && s.rtl]}>{getTitle(detailsMatch)}</Text>

                  <View style={s.detailsGrid}>
                    {!!r.category && <DetailRow label={t.category} value={r.category} isAr={isAr} />}
                    {!!r.quantity && <DetailRow label={t.qty} value={String(r.quantity)} isAr={isAr} />}
                    {!!r.budget_per_unit && <DetailRow label={t.budget} value={`$${r.budget_per_unit}`} isAr={isAr} />}
                    {!!r.response_deadline && <DetailRow label={t.deadline} value={fmtDate(r.response_deadline)} isAr={isAr} />}
                    <DetailRow label={t.statusLabel} value={t.statuses[detailsMatch.status] || detailsMatch.status} isAr={isAr} />
                  </View>

                  {!!desc && (
                    <View style={s.detailBlock}>
                      <Text style={[s.detailBlockLabel, isAr && s.rtl]}>{t.fullDescription}</Text>
                      <Text style={[s.detailBlockValue, isAr && s.rtl]}>{desc}</Text>
                    </View>
                  )}

                  <View style={s.briefBlock}>
                    <Text style={[s.briefLabel, isAr && s.rtl]}>{t.brief}</Text>
                    {briefText ? (
                      <Text style={[s.briefText, isAr && s.rtl]}>{briefText}</Text>
                    ) : (
                      <Text style={[s.briefEmpty, isAr && s.rtl]}>{t.noBrief}</Text>
                    )}
                  </View>
                </>
              );
            })()}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function DetailRow({ label, value, isAr }) {
  return (
    <View style={[sd.row, isAr && sd.rowRtl]}>
      <Text style={sd.label}>{label}</Text>
      <Text style={sd.value} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const sd = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' },
  rowRtl: { flexDirection: 'row-reverse' },
  label: { color: C.textTertiary, fontSize: 12, fontFamily: F.ar },
  value: { color: C.textPrimary, fontSize: 13, fontFamily: F.arSemi, maxWidth: '60%', textAlign: 'right' },
});

function RField({ label, isAr, multiline, ...props }) {
  return (
    <View style={s.fieldWrap}>
      <Text style={[s.fieldLabel, isAr && s.rtl]}>{label}</Text>
      <TextInput
        style={[s.input, isAr && s.rtl, multiline && { minHeight: 80, textAlignVertical: 'top' }]}
        placeholderTextColor={C.textDisabled}
        multiline={multiline}
        {...props}
      />
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bgBase },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  rtl: { textAlign: 'right', writingDirection: 'rtl' },
  rowRtl: { flexDirection: 'row-reverse' },

  topBar: {
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
  },
  pageTitle: { color: C.textPrimary, fontSize: 20, fontFamily: F.arSemi },

  list: { padding: 16, gap: 12, paddingBottom: 48 },

  card: {
    backgroundColor: C.bgRaised, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: C.borderDefault,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  cardTitle: { color: C.textPrimary, fontSize: 15, fontFamily: F.arSemi, flex: 1, lineHeight: 22 },
  cardDesc: { color: C.textSecondary, fontSize: 13, fontFamily: F.ar, marginBottom: 10, lineHeight: 20 },

  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  statusText: { fontSize: 11, fontFamily: F.arSemi },
  urgentBadge: {
    backgroundColor: C.redSoft, borderColor: C.red + '40',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1,
  },
  urgentText: { color: C.red, fontSize: 10, fontFamily: F.arBold, letterSpacing: 0.5 },

  metaRow: { flexDirection: 'row', gap: 14, marginBottom: 14, flexWrap: 'wrap' },
  meta: { color: C.textTertiary, fontSize: 12, fontFamily: F.en },

  detailsLinkWrap: { marginBottom: 12 },
  detailsLink: { color: C.textSecondary, fontSize: 12, fontFamily: F.arSemi, textDecorationLine: 'underline' },

  detailsMainTitle: { color: C.textPrimary, fontSize: 18, fontFamily: F.arSemi, marginBottom: 16, lineHeight: 26 },
  detailsGrid: {
    backgroundColor: C.bgRaised, borderRadius: 12,
    paddingHorizontal: 14, marginBottom: 14,
    borderWidth: 1, borderColor: C.borderDefault, overflow: 'hidden',
  },
  detailBlock: {
    backgroundColor: C.bgRaised, borderRadius: 12,
    padding: 14, marginBottom: 14,
    borderWidth: 1, borderColor: C.borderDefault,
  },
  detailBlockLabel: { color: C.textTertiary, fontSize: 11, fontFamily: F.arSemi, marginBottom: 6, letterSpacing: 0.5 },
  detailBlockValue: { color: C.textPrimary, fontSize: 14, fontFamily: F.ar, lineHeight: 22 },

  briefBlock: {
    backgroundColor: 'rgba(139,105,20,0.05)',
    borderRadius: 12, padding: 14, marginBottom: 14,
    borderWidth: 1, borderColor: 'rgba(139,105,20,0.22)',
  },
  briefLabel: { color: '#8B6914', fontSize: 11, fontFamily: F.arSemi, marginBottom: 6, letterSpacing: 0.5 },
  briefText: { color: C.textPrimary, fontSize: 14, fontFamily: F.ar, lineHeight: 22 },
  briefEmpty: { color: C.textTertiary, fontSize: 13, fontFamily: F.ar, lineHeight: 20 },

  cardBtns: { flexDirection: 'row', gap: 8 },
  offerBtn: {
    flex: 1, backgroundColor: C.btnPrimary, borderRadius: 12,
    paddingVertical: 10, alignItems: 'center',
  },
  offerBtnText: { color: C.btnPrimaryText, fontFamily: F.arSemi, fontSize: 14 },
  declineBtn: {
    flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center',
    borderWidth: 1, borderColor: C.red + '40', backgroundColor: C.redSoft,
  },
  declineBtnText: { color: C.red, fontFamily: F.arSemi, fontSize: 14 },

  submittedBox: {
    backgroundColor: C.greenSoft, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: C.green + '40',
  },
  submittedText: { color: C.green, fontFamily: F.arSemi, fontSize: 13, marginBottom: 6 },
  submittedMeta: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  submittedMetaItem: { color: C.green, fontSize: 12, fontFamily: F.en },

  emptyCard: {
    backgroundColor: C.bgRaised, borderRadius: 16,
    padding: 40, alignItems: 'center',
    borderWidth: 1, borderColor: C.borderDefault, marginTop: 16,
  },
  emptyText: { color: C.textPrimary, fontSize: 15, fontFamily: F.arSemi, marginBottom: 8, textAlign: 'center' },
  emptySubText: { color: C.textSecondary, fontSize: 13, fontFamily: F.ar, textAlign: 'center', lineHeight: 20 },

  modalScroll: { padding: 20, paddingBottom: 60 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 0, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle, marginBottom: 20,
  },
  modalTitle: { color: C.textPrimary, fontSize: 18, fontFamily: F.arSemi },
  modalClose: { color: C.textSecondary, fontSize: 15, fontFamily: F.ar },

  reqSummary: {
    backgroundColor: C.bgOverlay, borderRadius: 12,
    padding: 14, marginBottom: 20,
    borderWidth: 1, borderColor: C.borderSubtle,
  },
  reqSummaryTitle: { color: C.textPrimary, fontSize: 14, fontFamily: F.arSemi },
  reqSummaryQty: { color: C.textSecondary, fontSize: 13, fontFamily: F.ar, marginTop: 4 },

  fieldWrap: { marginBottom: 16 },
  fieldLabel: { color: C.textSecondary, fontSize: 12, fontFamily: F.ar, marginBottom: 6 },
  input: {
    backgroundColor: C.bgRaised, borderRadius: 12,
    borderWidth: 1, borderColor: C.borderMuted,
    paddingHorizontal: 16, paddingVertical: 12,
    color: C.textPrimary, fontSize: 15, fontFamily: F.ar,
  },
  privacy: {
    color: C.textTertiary, fontSize: 11, fontFamily: F.ar,
    marginTop: 4, marginBottom: 12, lineHeight: 18,
  },
  submitBtn: {
    backgroundColor: C.btnPrimary, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginTop: 4,
  },
  submitBtnText: { color: C.btnPrimaryText, fontFamily: F.arSemi, fontSize: 16 },
});
