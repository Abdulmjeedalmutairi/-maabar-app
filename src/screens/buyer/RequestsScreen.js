import React, { useEffect, useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
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

const SEND_EMAILS_URL = 'https://utzalmszfqfcofywfetv.supabase.co/functions/v1/send-email';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0emFsbXN6ZnFmY29meXdmZXR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NjE4NDAsImV4cCI6MjA4OTIzNzg0MH0.SSqFCeBRhKRIrS8oQasBkTsZxSv7uZGCT9pqfK-YmX8';

const tx = (ar, en, zh) => {
  const l = getLang();
  return l === 'ar' ? ar : l === 'zh' ? (zh || en) : en;
};

const STATUS_AR    = { open: 'مرفوع', offers_received: 'عروض وصلت', closed: 'عرض مقبول', supplier_confirmed: 'المورد جاهز', paid: 'تم الدفع', ready_to_ship: 'الشحنة جاهزة', shipping: 'قيد الشحن', arrived: 'وصل السعودية', delivered: 'تم التسليم' };
const STATUS_EN    = { open: 'Posted', offers_received: 'Offers In', closed: 'Accepted', supplier_confirmed: 'Supplier Ready', paid: 'Paid', ready_to_ship: 'Ready to Ship', shipping: 'Shipping', arrived: 'Arrived', delivered: 'Delivered' };
const STATUS_ZH    = { open: '已发布', offers_received: '报价已到', closed: '已接受', supplier_confirmed: '供应商已确认', paid: '已付款', ready_to_ship: '准备发货', shipping: '运输中', arrived: '已到达', delivered: '已交付' };
const STATUS_STEPS = ['open', 'offers_received', 'closed', 'supplier_confirmed', 'paid', 'ready_to_ship', 'shipping', 'arrived', 'delivered'];
const STATUS_COLOR = {
  open: C.blue, offers_received: C.green, closed: C.green,
  supplier_confirmed: C.green, paid: C.green, ready_to_ship: C.orange, shipping: C.orange,
  arrived: C.green, delivered: C.green,
};

const CATEGORIES = [
  { val: 'electronics', label: 'إلكترونيات' },
  { val: 'furniture',   label: 'أثاث' },
  { val: 'clothing',    label: 'ملابس' },
  { val: 'building',    label: 'مواد بناء' },
  { val: 'food',        label: 'غذاء' },
  { val: 'other',       label: 'أخرى' },
];
const CAT_LABELS = { electronics: 'إلكترونيات', furniture: 'أثاث', clothing: 'ملابس', building: 'مواد بناء', food: 'غذاء', other: 'أخرى' };
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

const MAIN_TABS = [
  { id: 'direct',  ar: 'طلب عادي',     en: 'Standard' },
  { id: 'managed', ar: 'الطلب المُدار', en: 'Managed'  },
  { id: 'idea',    ar: 'اصنع فكرتك',   en: 'Idea'     },
];

function getTrackingUrl(company, num) {
  const urls = { DHL: `https://www.dhl.com/track?tracking-id=${num}`, FedEx: `https://www.fedex.com/tracking?tracknumbers=${num}`, Aramex: `https://www.aramex.com/track/${num}`, UPS: `https://www.ups.com/track?tracknum=${num}`, SMSA: `https://www.smsaexpress.com/track?awbno=${num}` };
  return urls[company] || `https://t.17track.net/en#nums=${num}`;
}

function relativeTime(dateStr) {
  const lang = getLang();
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (lang === 'ar') {
    if (mins < 1)  return 'الآن';
    if (mins < 60) return `منذ ${mins} د`;
    if (hrs < 24)  return `منذ ${hrs} س`;
    if (days < 30) return `منذ ${days} يوم`;
    return new Date(dateStr).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' });
  }
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24)  return `${hrs}h ago`;
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ════════════════════════════════════════════════════════════ */
export default function RequestsScreen({ navigation, route }) {
/* ════════════════════════════════════════════════════════════ */
  const [userId, setUserId]         = useState(null);
  const [requests, setRequests]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mainTab, setMainTab]       = useState('direct');
  const [subFilter, setSubFilter]   = useState('all');

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

  /* ── Review modal ── */
  const [reviewModal, setReviewModal]         = useState(null);
  const [reviewRating, setReviewRating]       = useState(0);
  const [reviewComment, setReviewComment]     = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    if (route.params?.openNew) {
      setSourcingMode(route.params?.mode || 'direct');
      setShowNew(true);
    }
  }, [route.params?.openNew, route.params?.mode]);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); setRefreshing(false); return; }
    setUserId(user.id);

    const { data } = await supabase
      .from('requests')
      .select('*')
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false });

    const rows = data || [];

    if (rows.length > 0) {
      const requestIds = rows.map(r => r.id);
      const { data: offerRows } = await supabase
        .from('offers')
        .select('id, status, request_id, price, shipping_cost, shipping_method, moq, origin, note, currency, notes, delivery_time, supplier_id')
        .in('request_id', requestIds);

      const rawOffers = offerRows || [];
      const supplierUids = [...new Set(rawOffers.map(o => o.supplier_id).filter(Boolean))];
      let profileByUid = {};
      if (supplierUids.length > 0) {
        const { data: profRows } = await supabase
          .from('profiles')
          .select('id, full_name, company_name, maabar_supplier_id, status, rating, reviews_count')
          .in('id', supplierUids);
        profileByUid = (profRows || []).reduce((acc, p) => { acc[p.id] = p; return acc; }, {});
      }
      const mergedOffers = rawOffers.map(o => ({ ...o, profiles: profileByUid[o.supplier_id] || null }));

      const byReq = mergedOffers.reduce((acc, o) => {
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

  useFocusEffect(useCallback(() => {
    load();
    const channel = supabase
      .channel(`requests-rt-${Date.now()}-${Math.random()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'offers' },   () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]));

  /* ── Form helpers ── */
  function setField(k, v)     { setForm(f => ({ ...f, [k]: v })); }
  function setEditField(k, v) { setEditForm(f => ({ ...f, [k]: v })); }
  function openNew(mode = 'direct') { setSourcingMode(mode); setForm(EMPTY_FORM); setFormError(''); setShowNew(true); }
  function closeNew() { setShowNew(false); setForm(EMPTY_FORM); setFormError(''); }
  function handleNewRequest() {
    if (mainTab === 'idea') { navigation.navigate('IdeaToProduct'); return; }
    openNew(mainTab);
  }
  function openEdit(r) {
    setEditReq(r);
    setEditForm({ title_ar: r.title_ar || '', title_en: r.title_en || '', desc_ar: r.desc_ar || r.description || '', quantity: String(r.quantity || '') });
  }

  async function saveEdit() {
    if (!editReq) return;
    setSavingEdit(true);
    await supabase.from('requests').update({ title_ar: editForm.title_ar, title_en: editForm.title_en, desc_ar: editForm.desc_ar, quantity: editForm.quantity }).eq('id', editReq.id);
    setSavingEdit(false);
    setEditReq(null);
    load();
  }

  function deleteRequest(r) {
    if (r.status !== 'open') { Alert.alert(tx('تنبيه', 'Notice'), tx('لا يمكن حذف طلب غير مفتوح', 'Can only delete open requests')); return; }
    const pendingCount = (r.offers || []).filter(o => o.status === 'pending').length;
    Alert.alert(tx('حذف الطلب', 'Delete Request'), pendingCount > 0 ? tx(`يوجد ${pendingCount} عرض معلق سيُلغى. هل تريد الحذف؟`, `Delete with ${pendingCount} pending offer(s)?`) : tx('هل تريد حذف هذا الطلب؟', 'Delete this request?'),
      [{ text: tx('إلغاء', 'Cancel'), style: 'cancel' }, { text: tx('حذف', 'Delete'), style: 'destructive', onPress: async () => { await supabase.from('requests').delete().eq('id', r.id); load(); } }]);
  }

  /* ── Cancel request (web-exact) ── */
  async function handleCancelRequest(r) {
    Alert.alert(tx('إلغاء الطلب', 'Cancel Request'), tx('هل أنت متأكد من إلغاء هذا الطلب؟ الطلبات التي تم الدفع عليها لا يمكن ردّ مبالغها.', 'Are you sure you want to cancel? Paid orders are non-refundable.'),
      [{ text: tx('لا', 'No'), style: 'cancel' }, {
        text: tx('نعم، إلغاء', 'Yes, Cancel'), style: 'destructive',
        onPress: async () => {
          const acceptedOffer = (r.offers || []).find(o => o.status === 'accepted');
          await supabase.from('requests').update({ status: 'open' }).eq('id', r.id);
          if (acceptedOffer) {
            const reqNameAr = r.title_ar || r.title_en || '';
            const reqNameEn = r.title_en || r.title_ar || '';
            await supabase.from('offers').update({ status: 'rejected' }).eq('id', acceptedOffer.id);
            await supabase.from('notifications').insert({ user_id: acceptedOffer.supplier_id, type: 'request_cancelled', title_ar: `قام التاجر بإلغاء الطلب: ${reqNameAr}`, title_en: `The trader has cancelled the request: ${reqNameEn}`, title_zh: `采购商已取消请求: ${reqNameEn}`, ref_id: r.id, is_read: false });
            if (userId) await supabase.from('messages').insert({ sender_id: userId, receiver_id: acceptedOffer.supplier_id, content: `The trader has cancelled the request: ${reqNameEn}`, is_read: false });
          }
          load();
        },
      }]);
  }

  /* ── Confirm delivery (web-exact) ── */
  async function handleConfirmDelivery(r) {
    Alert.alert(tx('تأكيد الاستلام', 'Confirm Delivery'), tx('هل استلمت البضاعة كما هو متفق عليه؟', 'Did you receive the goods as agreed?'),
      [{ text: tx('إلغاء', 'Cancel'), style: 'cancel' }, {
        text: tx('نعم، تأكيد', 'Yes, Confirm'),
        onPress: async () => {
          const acceptedOffer = (r.offers || []).find(o => o.status === 'accepted');
          const supplierId   = acceptedOffer?.supplier_id;
          const supplierName = acceptedOffer?.profiles?.company_name || acceptedOffer?.profiles?.full_name || 'Supplier';
          await supabase.from('requests').update({ status: 'delivered', shipping_status: 'delivered' }).eq('id', r.id);
          const { data: paymentData } = await supabase.from('payments').select('id, amount').eq('request_id', r.id).eq('buyer_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle();
          if (paymentData) await supabase.from('payments').update({ status: 'completed' }).eq('id', paymentData.id);
          if (supplierId) {
            await supabase.from('notifications').insert({ user_id: supplierId, type: 'delivery_confirmed', title_ar: 'التاجر أكد الاستلام — سيتم تحويل المبلغ خلال 24 ساعة', title_en: 'Buyer confirmed delivery — payout will be processed within 24h', title_zh: '买家已确认收货 — 款项将在24小时内处理', ref_id: r.id, is_read: false });
            try {
              await fetch(SEND_EMAILS_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }, body: JSON.stringify({ type: 'payout_initiated', data: { recipientUserId: supplierId, name: supplierName, amount: paymentData?.amount || 0 } }) });
            } catch (e) { console.error('payout email error:', e); }
          }
          load();
          setReviewRating(0); setReviewComment('');
          setReviewModal({ supplierId, requestId: r.id, supplierName });
        },
      }]);
  }

  /* ── Mark as Arrived ── */
  async function handleMarkArrived(r) {
    Alert.alert(tx('تأكيد الوصول', 'Confirm Arrival'), tx('هل وصلت البضاعة إلى السعودية؟', 'Has the shipment arrived in Saudi Arabia?'),
      [{ text: tx('إلغاء', 'Cancel'), style: 'cancel' }, {
        text: tx('نعم، وصل', 'Yes, Arrived'),
        onPress: async () => {
          const { data, error } = await supabase
            .from('requests')
            .update({ status: 'arrived', shipping_status: 'arrived' })
            .eq('id', r.id);
          console.log('[RequestsScreen] markArrived:', data, error);
          load();
        },
      }]);
  }

  /* ── Accept offer with full cascade (web-exact) ── */
  async function handleAcceptOffer(offer, r) {
    Alert.alert(tx('قبول العرض', 'Accept Offer'), tx(`قبول العرض من ${offer.profiles?.company_name || 'المورد'}؟`, `Accept offer from ${offer.profiles?.company_name || 'supplier'}?`),
      [{ text: tx('إلغاء', 'Cancel'), style: 'cancel' }, {
        text: tx('قبول', 'Accept'),
        onPress: async () => {
          const reqTitle = r.title_ar || r.title_en || '';
          const { data: otherOffers } = await supabase.from('offers').select('id, supplier_id').eq('request_id', r.id).eq('status', 'pending').neq('id', offer.id);
          await supabase.from('offers').update({ status: 'accepted' }).eq('id', offer.id);
          await supabase.from('requests').update({ status: 'closed' }).eq('id', r.id);
          await supabase.from('offers').update({ status: 'rejected' }).eq('request_id', r.id).neq('id', offer.id);
          await supabase.from('notifications').insert({ user_id: offer.supplier_id, type: 'offer_accepted', title_ar: 'تم قبول عرضك', title_en: 'Your offer has been accepted', title_zh: '您的报价已被接受', ref_id: offer.id, is_read: false });
          try { await fetch(SEND_EMAILS_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }, body: JSON.stringify({ type: 'offer_accepted', data: { recipientUserId: offer.supplier_id, name: 'Supplier', requestTitle: reqTitle } }) }); } catch (e) {}
          if (otherOffers?.length) {
            await Promise.all(otherOffers.map(async o => {
              await supabase.from('notifications').insert({ user_id: o.supplier_id, type: 'offer_rejected', title_ar: `تم اختيار عرض آخر على الطلب: ${reqTitle}`, title_en: `Another offer was selected for: ${reqTitle}`, title_zh: `已选择其他报价: ${reqTitle}`, ref_id: r.id, is_read: false });
              try { await fetch(SEND_EMAILS_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }, body: JSON.stringify({ type: 'offer_rejected', data: { recipientUserId: o.supplier_id, name: 'Supplier', requestTitle: reqTitle } }) }); } catch (e) {}
            }));
          }
          load();
          const subtotal = (offer.price || 0) * (Number(r.quantity) || 1);
          const shipping = parseFloat(offer.shipping_cost) || 0;
          const total = subtotal + shipping;
          const pct = r.payment_pct > 0 ? r.payment_pct : 30;
          const firstAmt = total * pct / 100;
          navigation.navigate('Payment', { amount: firstAmt * 3.75, type: 'checkout', requestId: r.id, requestData: r, supplierId: offer.supplier_id, offerPriceUsd: total, paymentPct: pct });
        },
      }]);
  }

  /* ── Reject offer with notification ── */
  async function handleRejectOffer(offer, r) {
    Alert.alert(tx('رفض العرض', 'Reject Offer'), tx('هل تريد رفض هذا العرض؟', 'Reject this offer?'),
      [{ text: tx('إلغاء', 'Cancel'), style: 'cancel' }, {
        text: tx('رفض', 'Reject'), style: 'destructive',
        onPress: async () => {
          const reqTitle = r.title_ar || r.title_en || '';
          await supabase.from('offers').update({ status: 'rejected' }).eq('id', offer.id);
          await supabase.from('notifications').insert({ user_id: offer.supplier_id, type: 'offer_rejected', title_ar: `تم رفض عرضك على الطلب: ${reqTitle}`, title_en: `Your offer was rejected for: ${reqTitle}`, title_zh: `您的报价已被拒绝: ${reqTitle}`, ref_id: r.id, is_read: false });
          load();
        },
      }]);
  }

  /* ── Submit review ── */
  async function submitReview() {
    if (!reviewRating || !reviewModal) return;
    setSubmittingReview(true);
    const { data: existing } = await supabase.from('reviews').select('id').eq('supplier_id', reviewModal.supplierId).eq('buyer_id', userId).eq('request_id', reviewModal.requestId).maybeSingle();
    if (!existing) {
      await supabase.from('reviews').insert({ supplier_id: reviewModal.supplierId, buyer_id: userId, request_id: reviewModal.requestId, rating: reviewRating, comment: reviewComment || '' });
      const { data: reviews } = await supabase.from('reviews').select('rating').eq('supplier_id', reviewModal.supplierId);
      if (reviews?.length > 0) {
        const avg = reviews.reduce((sum, rv) => sum + rv.rating, 0) / reviews.length;
        await supabase.from('profiles').update({ rating: avg, reviews_count: reviews.length }).eq('id', reviewModal.supplierId);
      }
    }
    setSubmittingReview(false);
    setReviewModal(null);
    Alert.alert(tx('شكراً', 'Thank You'), tx('تم إرسال تقييمك بنجاح', 'Your review was submitted successfully'));
  }

  async function handleSubmit() {
    const title = form.titleAr.trim();
    const qty   = form.quantity.trim();
    if (!title || !qty) { setFormError(tx('يرجى تعبئة العنوان والكمية.', 'Please fill in title and quantity.')); return; }
    setSubmitting(true); setFormError('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSubmitting(false); return; }
    const isManaged = sourcingMode === 'managed';
    const { data: inserted, error } = await supabase.from('requests').insert({ buyer_id: user.id, title_ar: title, title_en: title, title_zh: title, description: form.description.trim(), quantity: qty, category: form.category || 'other', budget_per_unit: form.budgetPerUnit ? parseFloat(form.budgetPerUnit) : null, payment_plan: parseInt(form.paymentPlan, 10), sample_requirement: form.sampleReq, status: 'open', sourcing_mode: isManaged ? 'managed' : 'direct', managed_status: isManaged ? 'submitted' : null }).select('id').single();
    setSubmitting(false);
    if (error) { setFormError(tx('حدث خطأ، حاول مرة أخرى.', 'An error occurred, please try again.')); return; }
    closeNew(); load();
    if (isManaged && inserted?.id) navigation.navigate('ManagedRequest', { requestId: inserted.id, title });
  }

  /* ── Derived lists ── */
  const tabRequests = requests.filter(r => (r.sourcing_mode || 'direct') === mainTab);

  const filteredRequests = tabRequests.filter(r => {
    if (mainTab !== 'direct') return true;
    if (subFilter === 'open')      return ['open', 'offers_received'].includes(r.status);
    if (subFilter === 'active')    return ['closed', 'supplier_confirmed', 'paid', 'ready_to_ship', 'shipping', 'arrived'].includes(r.status);
    if (subFilter === 'completed') return r.status === 'delivered';
    return true;
  });
  const needsAction    = tabRequests.filter(r => ['offers_received', 'supplier_confirmed', 'arrived', 'ready_to_ship'].includes(r.status)).length;
  const activeCount    = tabRequests.filter(r => ['closed', 'supplier_confirmed', 'paid', 'ready_to_ship', 'shipping', 'arrived'].includes(r.status)).length;
  const completedCount = tabRequests.filter(r => r.status === 'delivered').length;

  const SUB_TABS = [
    { id: 'all',       ar: 'الكل',    en: 'All',       count: tabRequests.length },
    { id: 'open',      ar: 'مفتوح',   en: 'Open',      count: tabRequests.filter(r => ['open','offers_received'].includes(r.status)).length },
    { id: 'active',    ar: 'نشط',     en: 'Active',    count: activeCount },
    { id: 'completed', ar: 'مكتمل',   en: 'Completed', count: completedCount },
  ];

  return (
    <SafeAreaView style={s.safe}>
      {/* ── Top bar ── */}
      <View style={s.topBar}>
        <TouchableOpacity style={s.newBtn} onPress={handleNewRequest} activeOpacity={0.85}>
          <Text style={s.newBtnText}>+ {tx('طلب جديد', 'New Request')}</Text>
        </TouchableOpacity>
        <Text style={s.pageTitle}>{tx('طلباتي', 'My Requests')}</Text>
      </View>

      {/* ── Main tabs ── */}
      <View style={s.mainTabsRow}>
        {MAIN_TABS.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[s.mainTab, mainTab === tab.id && s.mainTabActive]}
            onPress={() => { setMainTab(tab.id); setSubFilter('all'); }}
            activeOpacity={0.75}
          >
            <Text style={[s.mainTabText, mainTab === tab.id && s.mainTabTextActive]}>
              {getLang() === 'ar' ? tab.ar : tab.en}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Sub-filter tabs (direct tab only) ── */}
      {mainTab === 'direct' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabsScroll} contentContainerStyle={s.tabsRow}>
          {SUB_TABS.map(tab => (
            <TouchableOpacity
              key={tab.id}
              style={[s.tab, subFilter === tab.id && s.tabActive]}
              onPress={() => setSubFilter(tab.id)}
              activeOpacity={0.75}
            >
              <Text style={[s.tabText, subFilter === tab.id && s.tabTextActive]}>
                {getLang() === 'ar' ? tab.ar : tab.en}
                {tab.count > 0 ? ` ${tab.count}` : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ── Mini stats strip (direct tab only) ── */}
      {mainTab === 'direct' && tabRequests.length > 0 && (
        <View style={s.statsStrip}>
          {[
            { label: tx('يحتاج إجراء', 'Needs Action'), value: needsAction, red: needsAction > 0 },
            { label: tx('نشط', 'Active'),                value: activeCount },
            { label: tx('مكتمل', 'Completed'),           value: completedCount },
          ].map((stat, i) => (
            <View key={i} style={[s.statCell, i < 2 && s.statCellBorder]}>
              <Text style={[s.statValue, stat.red && { color: C.red }]}>{stat.value}</Text>
              <Text style={s.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      )}

      {loading ? (
        <View style={s.center}><ActivityIndicator color={C.textDisabled} size="large" /></View>
      ) : (
        <ScrollView
          style={s.list}
          contentContainerStyle={s.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.textDisabled} />}
          showsVerticalScrollIndicator={false}
        >
          {filteredRequests.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyText}>{
                mainTab === 'idea'    ? tx('ما عندك أفكار بعد', 'No ideas yet') :
                mainTab === 'managed' ? tx('ما عندك طلبات مُدارة بعد', 'No managed requests yet') :
                tx('ما عندك طلبات بعد', 'No requests yet')
              }</Text>
              <TouchableOpacity style={s.emptyBtn} onPress={handleNewRequest}>
                <Text style={s.emptyBtnText}>{
                  mainTab === 'idea'    ? tx('ابدأ بفكرتك', 'Start with your idea') :
                  mainTab === 'managed' ? tx('ارفع طلباً مُداراً', 'Post Managed Request') :
                  tx('ارفع أول طلب', 'Post First Request')
                }</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredRequests.map(r => (
              <RequestCard
                key={r.id}
                r={r}
                navigation={navigation}
                onEdit={openEdit}
                onDelete={deleteRequest}
                onCancel={handleCancelRequest}
                onMarkArrived={handleMarkArrived}
                onConfirmDelivery={handleConfirmDelivery}
                onAcceptOffer={handleAcceptOffer}
                onRejectOffer={handleRejectOffer}
                onRateSupplier={(supplierId, supplierName, requestId) => {
                  setReviewRating(0); setReviewComment('');
                  setReviewModal({ supplierId, requestId, supplierName });
                }}
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
                <TouchableOpacity onPress={() => setEditReq(null)} hitSlop={8}><Text style={s.modalClose}>{tx('إلغاء', 'Cancel')}</Text></TouchableOpacity>
                <Text style={s.modalTitle}>{tx('تعديل الطلب', 'Edit Request')}</Text>
              </View>
              <Field label={tx('عنوان الطلب (عربي)', 'Title (Arabic)')} value={editForm.title_ar} onChangeText={v => setEditField('title_ar', v)} />
              <Field label={tx('عنوان الطلب (إنجليزي)', 'Title (English)')} value={editForm.title_en} onChangeText={v => setEditField('title_en', v)} />
              <Field label={tx('الوصف', 'Description')} value={editForm.desc_ar} onChangeText={v => setEditField('desc_ar', v)} multiline numberOfLines={4} style={{ minHeight: 100 }} />
              <Field label={tx('الكمية', 'Quantity')} value={editForm.quantity} onChangeText={v => setEditField('quantity', v)} />
              <TouchableOpacity style={[s.submitBtn, savingEdit && { opacity: 0.6 }]} onPress={saveEdit} disabled={savingEdit} activeOpacity={0.85}>
                {savingEdit ? <ActivityIndicator color={C.btnPrimaryText} /> : <Text style={s.submitBtnText}>{tx('حفظ التعديلات', 'Save Changes')}</Text>}
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
                <TouchableOpacity onPress={closeNew} hitSlop={8}><Text style={s.modalClose}>{tx('إغلاق', 'Close')}</Text></TouchableOpacity>
                <Text style={s.modalTitle}>{sourcingMode === 'managed' ? tx('طلب مُدار', 'Managed Request') : tx('طلب جديد', 'New Request')}</Text>
              </View>
              {sourcingMode === 'managed' && (
                <View style={s.managedBanner}><Text style={s.managedBannerText}>{tx('معبر سيتولى البحث ويعرض لك أفضل 3 خيارات من موردين مختارين.', 'Maabar will handle sourcing and present the top 3 offers from vetted suppliers.')}</Text></View>
              )}
              <Field label={tx('عنوان الطلب *', 'Request Title *')} value={form.titleAr} onChangeText={v => setField('titleAr', v)} />
              <Field label={tx('الوصف والمواصفات', 'Description & Specs')} value={form.description} onChangeText={v => setField('description', v)} multiline numberOfLines={4} style={{ minHeight: 100 }} />
              <Field label={tx('الكمية المطلوبة *', 'Quantity *')} value={form.quantity} onChangeText={v => setField('quantity', v)} />
              <Field label={tx('الميزانية للوحدة (اختياري)', 'Budget per Unit (optional)')} value={form.budgetPerUnit} onChangeText={v => setField('budgetPerUnit', v)} keyboardType="numeric" />
              <ChipField label={tx('الفئة', 'Category')} options={CATEGORIES} selected={form.category} onSelect={v => setField('category', v)} />
              <ChipField label={tx('خطة الدفع *', 'Payment Plan *')} options={PAYMENT_PLANS} selected={form.paymentPlan} onSelect={v => setField('paymentPlan', v)} />
              <ChipField label={tx('متطلبات العينة *', 'Sample Requirement *')} options={SAMPLE_REQS} selected={form.sampleReq} onSelect={v => setField('sampleReq', v)} />
              {!!formError && <Text style={s.error}>{formError}</Text>}
              <TouchableOpacity style={[s.submitBtn, submitting && { opacity: 0.6 }]} onPress={handleSubmit} disabled={submitting} activeOpacity={0.85}>
                {submitting ? <ActivityIndicator color={C.btnPrimaryText} /> : <Text style={s.submitBtnText}>{sourcingMode === 'managed' ? tx('إرسال الطلب المُدار', 'Submit Managed Request') : tx('رفع الطلب', 'Post Request')}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* ── Review Modal ── */}
      <Modal visible={!!reviewModal} transparent animationType="slide" onRequestClose={() => setReviewModal(null)}>
        <View style={s.reviewOverlay}>
          <View style={s.reviewSheet}>
            <View style={s.reviewHandle} />
            <Text style={s.reviewTitle}>{tx('قيّم المورد', 'Rate Supplier')}</Text>
            <Text style={s.reviewSub}>{reviewModal?.supplierName || ''}</Text>
            <View style={s.starsRow}>
              {[1,2,3,4,5].map(star => (
                <TouchableOpacity key={star} onPress={() => setReviewRating(star)} activeOpacity={0.7}>
                  <Text style={[s.star, reviewRating >= star && s.starFilled]}>★</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={s.reviewInput}
              placeholder={tx('تعليق (اختياري)', 'Comment (optional)')}
              placeholderTextColor={C.textDisabled}
              value={reviewComment}
              onChangeText={setReviewComment}
              multiline
              numberOfLines={3}
              textAlign="right"
            />
            <TouchableOpacity style={[s.submitBtn, (!reviewRating || submittingReview) && { opacity: 0.5 }]} onPress={submitReview} disabled={!reviewRating || submittingReview} activeOpacity={0.85}>
              {submittingReview ? <ActivityIndicator color={C.btnPrimaryText} /> : <Text style={s.submitBtnText}>{tx('إرسال التقييم', 'Submit Review')}</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setReviewModal(null)} activeOpacity={0.7} style={{ alignItems: 'center', marginTop: 12 }}>
              <Text style={{ color: C.textDisabled, fontFamily: F.ar, fontSize: 13 }}>{tx('تخطي', 'Skip')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ════════════════════════════════════════════════════════════ */
/* ── StatusTimeline (replaces ProgressBar) ── */
const TIMELINE_STEPS = [
  { key: 'posted',    ar: 'رفع الطلب',     en: 'Posted'      },
  { key: 'accepted',  ar: 'قبول العرض',    en: 'Accepted'    },
  { key: 'paid',      ar: 'الدفعة الأولى', en: '1st Pay'     },
  { key: 'producing', ar: 'الإنتاج',       en: 'Production'  },
  { key: 'shipping',  ar: 'الشحن',         en: 'Shipping'    },
  { key: 'received',  ar: 'الاستلام',      en: 'Received'    },
];

function timelineIndex(status, shippingStatus) {
  if (shippingStatus === 'delivered') return 5;
  if (shippingStatus === 'arrived' || shippingStatus === 'shipped') return 4;
  const map = { open: 0, offers_received: 0, closed: 1, paid: 2, supplier_confirmed: 3, ready_to_ship: 3, shipping: 4, arrived: 4, delivered: 5 };
  return map[status] ?? 0;
}

function StatusTimeline({ status, shippingStatus }) {
  const lang    = getLang();
  const current = timelineIndex(status, shippingStatus);
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        {TIMELINE_STEPS.map((step, i) => {
          const done   = i < current;
          const active = i === current;
          const isLast = i === TIMELINE_STEPS.length - 1;
          return (
            <React.Fragment key={step.key}>
              <View style={{ alignItems: 'center', minWidth: 32 }}>
                <View style={{
                  width: 10, height: 10, borderRadius: 5,
                  backgroundColor: done ? '#5a9a72' : active ? C.textPrimary : C.bgRaised,
                  borderWidth: 1.5,
                  borderColor: done ? '#5a9a72' : active ? C.textPrimary : C.borderDefault,
                }} />
                <Text style={{
                  fontSize: 8, textAlign: 'center', marginTop: 3,
                  color: done ? '#5a9a72' : active ? C.textPrimary : C.textDisabled,
                  fontFamily: lang === 'ar' ? F.ar : F.en,
                  fontWeight: active ? '600' : '400',
                  maxWidth: 40,
                  lineHeight: 11,
                }}>
                  {lang === 'ar' ? step.ar : step.en}
                </Text>
              </View>
              {!isLast && (
                <View style={{ flex: 1, height: 1.5, marginTop: 4, backgroundColor: i < current ? '#5a9a72' : C.borderSubtle }} />
              )}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

/* ── Payment Badge ── */
function PaymentBadge({ label, amount, currency, badgeState }) {
  const colors = {
    paid:    { bg: 'rgba(90,154,114,0.07)', border: 'rgba(90,154,114,0.3)',  text: '#5a9a72' },
    due:     { bg: 'rgba(180,120,30,0.07)', border: 'rgba(180,120,30,0.3)',  text: '#b4781e' },
    pending: { bg: C.bgOverlay,             border: C.borderSubtle,           text: C.textDisabled },
  };
  const c = colors[badgeState] || colors.pending;
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: c.border, backgroundColor: c.bg, minWidth: 100 }}>
      <Text style={{ fontSize: 9, letterSpacing: 0.8, color: c.text, marginBottom: 3, fontFamily: F.arSemi }}>{label}</Text>
      <Text style={{ fontSize: 15, color: c.text, fontFamily: F.en }}>
        {amount > 0 ? Number(amount).toFixed(0) : '—'}
        <Text style={{ fontSize: 9, color: C.textDisabled }}> {currency}</Text>
      </Text>
      {badgeState === 'paid'    && <Text style={{ fontSize: 9, color: c.text, marginTop: 2, fontFamily: F.ar }}>✓ مدفوع</Text>}
      {badgeState === 'due'     && <Text style={{ fontSize: 9, color: c.text, marginTop: 2, fontFamily: F.ar }}>مطلوبة الآن</Text>}
      {badgeState === 'pending' && <Text style={{ fontSize: 9, color: C.textDisabled, marginTop: 2, fontFamily: F.ar }}>بعد الشحن</Text>}
    </View>
  );
}

/* ── Payment Plan Row ── */
function PaymentPlanRow({ request, offer }) {
  if (!offer) return null;
  const showFrom = ['closed','supplier_confirmed','paid','ready_to_ship','shipping','arrived','delivered'];
  if (!showFrom.includes(request.status)) return null;
  const subtotal  = (offer.price || 0) * (Number(request.quantity) || 1);
  const shipping  = parseFloat(offer.shipping_cost) || 0;
  const total     = subtotal + shipping;
  const pct       = request.payment_pct > 0 ? request.payment_pct : 30;
  const firstAmt  = request.amount > 0 ? request.amount : parseFloat((total * pct / 100).toFixed(2));
  const secondAmt = request.payment_second > 0 ? request.payment_second : parseFloat((total * (100 - pct) / 100).toFixed(2));
  const currency  = offer.currency || 'USD';
  const isPaidFirst  = ['paid','ready_to_ship','shipping','arrived','delivered'].includes(request.status);
  const isPaidSecond = ['shipping','arrived','delivered'].includes(request.status) || !!request.payment_second_paid;
  const isDueSecond  = request.status === 'ready_to_ship';
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
      <PaymentBadge label={`دفعة أولى · ${pct}%`}        amount={firstAmt}  currency={currency} badgeState={isPaidFirst ? 'paid' : 'pending'} />
      <PaymentBadge label={`دفعة ثانية · ${100 - pct}%`} amount={secondAmt} currency={currency} badgeState={isPaidSecond ? 'paid' : isDueSecond ? 'due' : 'pending'} />
    </View>
  );
}

/* ════════════════════════════════════════════════════════════ */
/* ── Request Card ── */
function RequestCard({ r, navigation, onEdit, onDelete, onCancel, onMarkArrived, onConfirmDelivery, onAcceptOffer, onRejectOffer, onRateSupplier }) {
  const lang      = getLang();
  const isAr      = lang === 'ar';
  const isManaged = String(r.sourcing_mode || 'direct') === 'managed';
  const isIdea    = String(r.sourcing_mode || 'direct') === 'idea';
  const offers    = r.offers || [];
  const pending   = offers.filter(o => o.status === 'pending');
  const accepted  = offers.find(o => o.status === 'accepted');

  const statusColor = STATUS_COLOR[r.status] || C.blue;
  const statusLabel = lang === 'ar' ? (STATUS_AR[r.status] || r.status) : (STATUS_EN[r.status] || r.status);
  const title = lang === 'ar' ? (r.title_ar || r.title_en) : (r.title_en || r.title_ar);
  const catLabel = CAT_LABELS[r.category] || r.category || '';

  /* Supplier strip — shows when offer is accepted */
  const supplierName    = accepted?.profiles?.company_name || accepted?.profiles?.full_name || null;
  const supplierVerified = ['verified', 'active', 'approved'].includes(accepted?.profiles?.status);
  const supplierMaabarId = accepted?.profiles?.maabar_supplier_id || null;

  /* Next step copy */
  const nextStep = (() => {
    if (isIdea) return null;
    if (isManaged) {
      if (String(r.managed_status || '') === 'shortlist_ready') return { title: tx('الخطوة التالية: راجع العروض المختارة لك', 'Next step: review your selected offers'), body: tx('كل قرار في هذا الطلب المُدار يتم من نفس الصفحة.', 'Every decision for this managed request stays in the same page.'), onPress: () => navigation.navigate('ManagedRequest', { requestId: r.id, title: r.title_ar || r.title_en }) };
      return { title: tx('الطلب الآن داخل المسار المُدار', 'This request is now inside the managed flow'), body: tx('معبر يجهّز الـ brief ويطابق الموردين المناسبين.', 'Maabar is preparing the brief and matching suitable suppliers.') };
    }
    if (accepted && r.status === 'supplier_confirmed') return { title: tx('المورد جاهز للشحن — ادفع الآن', 'Supplier confirmed ready — pay now'), body: tx('أكمل الدفعة الأولى لبدء التجهيز.', 'Complete the 1st installment to start production.') };
    if (accepted && r.status === 'closed') return { title: tx('تم قبول العرض — أكمل الدفع', 'Offer accepted — complete payment'), body: tx('ادفع الدفعة الأولى لتأكيد الطلب مع المورد.', 'Pay the 1st installment to confirm the order with the supplier.') };
    if (r.status === 'ready_to_ship' && r.payment_second > 0) return { title: tx('الخطوة التالية: ادفع الدفعة الثانية', 'Next step: pay the second installment'), body: tx('المورد أكد جاهزية الشحنة.', 'The supplier confirmed shipment readiness.'), onPress: () => navigation.navigate('Payment', { amount: Number(r.payment_second) * 3.75, type: 'second_installment', requestId: r.id, supplierId: accepted?.supplier_id, offerPriceUsd: Number(r.payment_second) }) };
    if (r.status === 'shipping') return { title: tx('الخطوة التالية: تابع التتبع ثم أكد وصول الشحنة', 'Next step: follow tracking, then confirm arrival'), body: tx('بمجرد الوصول يمكنك تأكيد الاستلام.', 'Once arrived, confirm final delivery.') };
    if (r.status === 'arrived') return { title: tx('الخطوة التالية: أكد الاستلام لإغلاق الصفقة', 'Next step: confirm delivery to close the deal'), body: tx('إذا استلمت البضاعة كما هو متفق عليه، أكد الاستلام.', 'If goods arrived as agreed, confirm delivery.') };
    if (pending.length > 0) { const n = pending.length; return { title: tx(`الخطوة التالية: قارن ${n} عرض${n > 1 ? 'اً' : ''} واختر الأنسب`, `Next step: compare ${n} offer${n > 1 ? 's' : ''} and pick the best fit`), body: tx('راجع الإجمالي ومدة التجهيز قبل قبول العرض.', 'Review total cost and lead time before accepting an offer.') }; }
    if (offers.length > 0) return { title: tx('العروض موجودة داخل هذا الطلب', 'Offers are already attached to this request'), body: tx('كل قرار لاحق يتم من نفس البطاقة.', 'Every next decision stays inside this same card.') };
    return null;
  })();

  function handleCardPress() {
    if (isManaged || isIdea) return;
    const cardTitle = title || r.title_ar || r.title_en;
    // Pre-acceptance: open OffersScreen (may be empty for 'open' status)
    if (['open', 'offers_received'].includes(r.status)) {
      navigation.navigate('Offers', {
        requestId: r.id,
        title: cardTitle,
        quantity: r.quantity,
        paymentPct: r.payment_pct > 0 ? r.payment_pct : 30,
      });
    } else {
      // Post-acceptance: open OrderDetail for all remaining statuses
      navigation.navigate('OrderDetail', { requestId: r.id });
    }
  }

  return (
    <TouchableOpacity
      style={s.card}
      activeOpacity={0.92}
      onPress={handleCardPress}
    >
      {/* ── Title + Status Badge ── */}
      <View style={s.cardTitleRow}>
        <View style={[s.statusBadge, { backgroundColor: statusColor + '20' }]}>
          <Text style={[s.statusBadgeText, { color: statusColor }]}>
            {isManaged ? tx('مُدار', 'Managed') : statusLabel}
          </Text>
        </View>
        <Text style={s.cardTitle} numberOfLines={2}>{title}</Text>
      </View>

      {/* ── Category tag + supplier strip ── */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        {!!catLabel && (
          <View style={s.catChip}><Text style={s.catChipText}>{catLabel}</Text></View>
        )}
        {supplierName && (
          <View style={s.supplierStrip}>
            {supplierVerified && <Text style={s.verifiedDot}>✓ </Text>}
            <Text style={s.supplierName} numberOfLines={1}>{supplierName}</Text>
            {supplierMaabarId && <Text style={s.supplierMaabarId}> · {supplierMaabarId}</Text>}
          </View>
        )}
      </View>

      {/* ── Edit / Delete — only when status = 'open' ── */}
      {r.status === 'open' && (
        <View style={s.actionRow}>
          <TouchableOpacity style={s.editBtn} onPress={() => onEdit(r)} activeOpacity={0.8}><Text style={s.editBtnText}>{tx('تعديل', 'Edit')}</Text></TouchableOpacity>
          <TouchableOpacity style={s.deleteBtn} onPress={() => onDelete(r)} activeOpacity={0.8}><Text style={s.deleteBtnText}>{tx('حذف', 'Delete')}</Text></TouchableOpacity>
        </View>
      )}

      {/* ── StatusTimeline / sourcing note ── */}
      {isIdea
        ? <View style={s.managedNote}><Text style={s.managedNoteText}>{tx('فكرتك وصلت لمعبر — سيتواصل معك الموردون عبر الرسائل', 'Your idea reached Maabar — suppliers will contact you via chat')}</Text></View>
        : isManaged
        ? <View style={s.managedNote}><Text style={s.managedNoteText}>{tx('طلب مُدار — معبر يتابع لك', 'Managed request — Maabar handles sourcing')}</Text></View>
        : <StatusTimeline status={r.status} shippingStatus={r.shipping_status} />
      }

      {/* ── Payment Plan Row ── */}
      {!isManaged && !isIdea && <PaymentPlanRow request={r} offer={accepted} />}

      {/* ── Info chips: qty · offers count · relative date ── */}
      <View style={s.chipsRow}>
        <View style={s.chip}><Text style={s.chipText}>{tx('الكمية', 'Qty')}: {r.quantity || '—'}</Text></View>
        <View style={s.chip}><Text style={s.chipText}>{tx('العروض', 'Offers')}: {offers.length}</Text></View>
        {pending.length > 0 && (
          <View style={[s.chip, s.chipOrange]}><Text style={[s.chipText, { color: C.orange }]}>{pending.length} {tx('معلق', 'pending')}</Text></View>
        )}
        <View style={s.chip}>
          <Text style={[s.chipText, { fontFamily: F.en }]}>{relativeTime(r.created_at)}</Text>
        </View>
      </View>

      {/* ── Inline offer comparison (when offers_received) ── */}
      {!isManaged && !isIdea && r.status === 'offers_received' && pending.length > 0 && (
        <View style={{ marginBottom: 12 }}>
          <Text style={s.offersHeading}>{tx(`${pending.length} عرض ينتظرك`, `${pending.length} offer${pending.length > 1 ? 's' : ''} waiting`)}</Text>
          {(() => {
            const lowestTotal = Math.min(...pending.map(o => (parseFloat(o.price) || 0) + (parseFloat(o.shipping_cost) || 0)));
            return pending.slice(0, 3).map(offer => {
              const subtotal  = (offer.price || 0) * (Number(r.quantity) || 1);
              const shipping  = parseFloat(offer.shipping_cost) || 0;
              const total     = subtotal + shipping;
              const isLowest  = lowestTotal > 0 && total === lowestTotal;
              const sName     = offer.profiles?.company_name || offer.profiles?.full_name || '—';
              return (
                <View key={offer.id} style={s.offerRow}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                      {['verified', 'active', 'approved'].includes(offer.profiles?.status) && <Text style={s.offerVerified}>✓</Text>}
                      <Text style={s.offerSupplier} numberOfLines={1}>{sName}</Text>
                      {offer.profiles?.rating > 0 && <Text style={s.offerRating}>★ {Number(offer.profiles.rating).toFixed(1)}</Text>}
                      {isLowest && <Text style={s.offerLowestBadge}>{tx('الأقل سعراً', 'Lowest')}</Text>}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                      {total > 0 && <Text style={s.offerTotal}>{total.toFixed(0)} {offer.currency || 'USD'}</Text>}
                      {offer.price > 0 && <Text style={s.offerUnit}>{tx('الوحدة:', 'Unit:')} {offer.price}</Text>}
                      {shipping > 0 && <Text style={s.offerUnit}>{tx('شحن:', 'Ship:')} {shipping.toFixed(0)}</Text>}
                      {offer.delivery_time && <Text style={s.offerLead}>{offer.delivery_time}</Text>}
                    </View>
                    {(offer.shipping_method || offer.moq || offer.origin) && (
                      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                        {!!offer.shipping_method && <Text style={s.offerMeta}>{offer.shipping_method}</Text>}
                        {!!offer.moq && <Text style={s.offerMeta}>{tx('MOQ:', 'MOQ:')} {offer.moq}</Text>}
                        {!!offer.origin && <Text style={s.offerMeta}>{offer.origin}</Text>}
                      </View>
                    )}
                    {!!(offer.note || offer.notes) && (
                      <Text style={s.offerNote} numberOfLines={2}>{offer.note || offer.notes}</Text>
                    )}
                    <TouchableOpacity
                      onPress={e => { e.stopPropagation?.(); navigation.navigate('Inbox', { screen: 'Chat', params: { partnerId: offer.supplier_id } }); }}
                      activeOpacity={0.75}
                    >
                      <Text style={s.offerChatLink}>{tx('تواصل مع المورد', 'Chat with supplier')}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ gap: 6 }}>
                    <TouchableOpacity
                      style={s.acceptBtn}
                      onPress={e => { e.stopPropagation?.(); onAcceptOffer(offer, r); }}
                      activeOpacity={0.85}
                    >
                      <Text style={s.acceptBtnText}>{tx('قبول', 'Accept')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.rejectBtn}
                      onPress={e => { e.stopPropagation?.(); onRejectOffer(offer, r); }}
                      activeOpacity={0.85}
                    >
                      <Text style={s.rejectBtnText}>{tx('رفض', 'Reject')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            });
          })()}
          {pending.length > 3 && (
            <TouchableOpacity style={s.offersBtn} onPress={() => navigation.navigate('Offers', { requestId: r.id, title: title || r.title_ar || r.title_en })} activeOpacity={0.8}>
              <Text style={s.offersBtnText}>{tx(`عرض كل العروض (${pending.length}) →`, `View all offers (${pending.length}) →`)}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Next step banner ── */}
      {!!nextStep && (
        <TouchableOpacity style={s.nextBanner} activeOpacity={nextStep.onPress ? 0.75 : 1} onPress={nextStep.onPress || undefined}>
          <Text style={s.nextTitle}>{nextStep.title}</Text>
          <Text style={s.nextBody}>{nextStep.body}</Text>
          {!!nextStep.onPress && <Text style={s.nextCta}>{tx('اضغط للمتابعة ←', 'Tap to continue →')}</Text>}
        </TouchableOpacity>
      )}

      {/* ── Chat with supplier (when offer accepted) ── */}
      {!isManaged && !isIdea && accepted?.supplier_id && ['supplier_confirmed','paid','ready_to_ship','shipping','arrived'].includes(r.status) && (
        <TouchableOpacity
          style={s.chatBtn}
          onPress={() => navigation.navigate('Inbox', { screen: 'Chat', params: { partnerId: accepted.supplier_id } })}
          activeOpacity={0.8}
        >
          <Text style={s.chatBtnText}>{tx('تواصل مع المورد', 'Chat with Supplier')}</Text>
        </TouchableOpacity>
      )}

      {/* ── Tracking section ── */}
      {!isManaged && !isIdea && !!r.tracking_number && (
        <View style={s.trackBox}>
          <View style={s.trackRow}>
            <TouchableOpacity onPress={() => Linking.openURL(getTrackingUrl(r.shipping_company, r.tracking_number)).catch(() => {})} activeOpacity={0.8}>
              <Text style={s.trackLink}>{tx('تتبع ←', 'Track →')}</Text>
            </TouchableOpacity>
            <Text style={s.trackText} numberOfLines={2}>
              {r.shipping_company ? `${r.shipping_company} · ` : ''}
              {tx('رقم التتبع: ', 'Tracking: ')}
              <Text style={s.trackNum}>{r.tracking_number}</Text>
            </Text>
          </View>
          {!!r.estimated_delivery && (
            <Text style={s.trackETA}>{tx('التسليم المتوقع: ', 'Expected delivery: ')}{new Date(r.estimated_delivery).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US')}</Text>
          )}
        </View>
      )}

      {/* ── Inline action buttons (status-driven) ── */}
      {!isManaged && !isIdea && (() => {
        if (['open','offers_received'].includes(r.status)) {
          return (
            <TouchableOpacity style={s.cancelBtn} onPress={() => onCancel(r)} activeOpacity={0.85}>
              <Text style={s.cancelBtnText}>{tx('إلغاء الطلب', 'Cancel Request')}</Text>
            </TouchableOpacity>
          );
        }
        if ((r.status === 'closed' || r.status === 'supplier_confirmed') && accepted) {
          const subtotal  = (accepted.price || 0) * (Number(r.quantity) || 1);
          const shipping  = parseFloat(accepted.shipping_cost) || 0;
          const total     = subtotal + shipping;
          const pct       = r.payment_pct > 0 ? r.payment_pct : 30;
          const firstAmt  = r.amount > 0 ? r.amount : total * pct / 100;
          return (
            <View style={{ gap: 8 }}>
              <TouchableOpacity
                style={s.payBtn}
                onPress={() => navigation.navigate('Payment', { amount: firstAmt * 3.75, type: 'checkout', requestId: r.id, requestData: r, supplierId: accepted.supplier_id, offerPriceUsd: total, paymentPct: pct })}
                activeOpacity={0.85}
              >
                <Text style={s.payBtnText}>{tx(`ادفع الدفعة الأولى — ${firstAmt.toFixed(0)} ${accepted.currency || 'USD'}`, `Pay 1st Installment — ${firstAmt.toFixed(0)} ${accepted.currency || 'USD'}`)}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.cancelBtn} onPress={() => onCancel(r)} activeOpacity={0.85}>
                <Text style={s.cancelBtnText}>{tx('إلغاء الطلب', 'Cancel Request')}</Text>
              </TouchableOpacity>
            </View>
          );
        }
        if (r.status === 'ready_to_ship') {
          const secondAmt = r.payment_second > 0 ? r.payment_second : 0;
          return (
            <TouchableOpacity
              style={s.payBtn}
              onPress={() => navigation.navigate('Payment', { amount: secondAmt * 3.75, type: 'second_installment', requestId: r.id, supplierId: accepted?.supplier_id, offerPriceUsd: secondAmt })}
              activeOpacity={0.85}
            >
              <Text style={s.payBtnText}>{tx(`ادفع الدفعة الثانية${secondAmt > 0 ? ` — ${secondAmt.toFixed(0)}` : ''}`, `Pay 2nd Installment${secondAmt > 0 ? ` — ${secondAmt.toFixed(0)}` : ''}`)}</Text>
            </TouchableOpacity>
          );
        }
        if (r.status === 'shipping') {
          return (
            <TouchableOpacity style={s.payBtn} onPress={() => onMarkArrived(r)} activeOpacity={0.85}>
              <Text style={s.payBtnText}>{tx('أكد الوصول إلى السعودية', 'Mark as Arrived in KSA')}</Text>
            </TouchableOpacity>
          );
        }
        if (r.status === 'arrived') {
          return (
            <TouchableOpacity style={s.payBtn} onPress={() => onConfirmDelivery(r)} activeOpacity={0.85}>
              <Text style={s.payBtnText}>{tx('أكد الاستلام', 'Confirm Delivery')}</Text>
            </TouchableOpacity>
          );
        }
        if (r.status === 'delivered') {
          const supId   = accepted?.supplier_id;
          const supName = accepted?.profiles?.company_name || accepted?.profiles?.full_name || '';
          return (
            <View style={{ gap: 8 }}>
              {supId && (
                <TouchableOpacity
                  style={s.payBtn}
                  onPress={() => onRateSupplier(supId, supName, r.id)}
                  activeOpacity={0.85}
                >
                  <Text style={s.payBtnText}>{tx('قيّم المورد', 'Rate Supplier')}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={s.reportBtn}
                onPress={() => Linking.openURL('mailto:support@maabar.io').catch(() => {})}
                activeOpacity={0.8}
              >
                <Text style={s.reportBtnText}>{tx('تواصل مع الدعم', 'Contact Support')}</Text>
              </TouchableOpacity>
            </View>
          );
        }
        return null;
      })()}

    </TouchableOpacity>
  );
}

/* ════════════════════════════════════════════════════════════ */
function Field({ label, style: extraStyle, ...props }) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput style={[s.input, extraStyle]} placeholderTextColor={C.textDisabled} textAlignVertical={props.multiline ? 'top' : 'center'} textAlign="right" {...props} />
    </View>
  );
}

function ChipField({ label, options, selected, onSelect }) {
  return (
    <View style={s.chipSection}>
      <Text style={s.chipSectionLabel}>{label}</Text>
      <View style={s.chipSectionRow}>
        {options.map(opt => (
          <TouchableOpacity key={opt.val} style={[s.chipOption, selected === opt.val && s.chipOptionActive]} onPress={() => onSelect(opt.val)} activeOpacity={0.8}>
            <Text style={[s.chipOptionText, selected === opt.val && s.chipOptionTextActive]}>{opt.label}</Text>
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

  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.borderSubtle },
  pageTitle:  { color: C.textPrimary, fontFamily: F.arBold, fontSize: 18 },
  newBtn:     { backgroundColor: C.btnPrimary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8 },
  newBtnText: { color: C.btnPrimaryText, fontFamily: F.arBold, fontSize: 13 },

  /* Main tabs */
  mainTabsRow:      { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.borderSubtle },
  mainTab:          { flex: 1, paddingVertical: 13, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  mainTabActive:    { borderBottomColor: C.textPrimary },
  mainTabText:      { fontSize: 13, color: C.textSecondary, fontFamily: F.ar },
  mainTabTextActive:{ color: C.textPrimary, fontFamily: F.arBold },

  /* Sub-filter tabs */
  tabsScroll: { flexGrow: 0, flexShrink: 0, borderBottomWidth: 1, borderBottomColor: C.borderSubtle },
  tabsRow:    { paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  tab:        { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: C.borderSubtle, backgroundColor: C.bgBase },
  tabActive:  { borderColor: C.textPrimary, backgroundColor: C.textPrimary },
  tabText:    { fontSize: 12, color: C.textSecondary, fontFamily: F.ar },
  tabTextActive: { color: C.btnPrimaryText, fontFamily: F.arSemi },

  /* Mini stats strip */
  statsStrip:      { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.borderSubtle },
  statCell:        { flex: 1, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  statCellBorder:  { borderRightWidth: 1, borderRightColor: C.borderSubtle },
  statValue:       { fontSize: 24, fontFamily: F.en, color: C.textPrimary, lineHeight: 28 },
  statLabel:       { fontSize: 10, fontFamily: F.ar, color: C.textDisabled, marginTop: 2, letterSpacing: 0.5 },

  list:        { flex: 1 },
  listContent: { padding: 16, paddingBottom: 40 },
  emptyCard: { backgroundColor: C.bgRaised, borderRadius: 16, padding: 40, alignItems: 'center', borderWidth: 1, borderColor: C.borderDefault },
  emptyText:    { color: C.textSecondary, fontFamily: F.ar, fontSize: 15, marginBottom: 16 },
  emptyBtn:     { backgroundColor: C.btnPrimary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText: { color: C.btnPrimaryText, fontFamily: F.arBold },

  /* Request Card */
  card: { backgroundColor: C.bgRaised, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: C.borderDefault, marginBottom: 12 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  statusBadge:     { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, alignSelf: 'flex-start', flexShrink: 0 },
  statusBadgeText: { fontSize: 11, fontFamily: F.arSemi },
  cardTitle: { flex: 1, fontSize: 16, fontFamily: F.arSemi, color: C.textPrimary, textAlign: 'right', lineHeight: 24 },

  /* Category + supplier strip */
  catChip:     { backgroundColor: C.bgHover, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: C.borderSubtle },
  catChipText: { fontSize: 10, color: C.textTertiary, fontFamily: F.ar },
  supplierStrip:   { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  supplierName:    { fontSize: 11, color: C.textSecondary, fontFamily: F.arSemi, flexShrink: 1 },
  supplierMaabarId:{ fontSize: 10, color: C.textDisabled, fontFamily: F.en },
  verifiedDot:     { fontSize: 10, color: '#5a9a72', fontFamily: F.en },

  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginBottom: 12 },
  editBtn: { borderWidth: 1, borderColor: C.borderDefault, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },
  editBtnText: { fontSize: 12, color: C.textSecondary, fontFamily: F.ar },
  deleteBtn: { borderWidth: 1, borderColor: 'rgba(224,92,92,0.35)', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },
  deleteBtnText: { fontSize: 12, color: C.red, fontFamily: F.ar },

  managedNote: { backgroundColor: C.bgOverlay, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12, borderWidth: 1, borderColor: C.borderSubtle },
  managedNoteText: { fontSize: 12, color: C.textTertiary, fontFamily: F.ar, textAlign: 'right' },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12, justifyContent: 'flex-end' },
  chip: { backgroundColor: C.bgHover, borderRadius: 20, borderWidth: 1, borderColor: C.borderSubtle, paddingHorizontal: 10, paddingVertical: 5 },
  chipOrange: { borderColor: 'rgba(232,160,32,0.35)', backgroundColor: C.orangeSoft },
  chipText:   { fontSize: 11, color: C.textSecondary, fontFamily: F.ar },

  /* Inline offers comparison */
  offersHeading: { fontSize: 11, color: C.textTertiary, fontFamily: F.arSemi, textAlign: 'right', marginBottom: 8, letterSpacing: 0.5 },
  offerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.bgBase, borderRadius: 12, borderWidth: 1, borderColor: C.borderDefault, padding: 10, marginBottom: 8 },
  offerSupplier: { fontSize: 13, color: C.textPrimary, fontFamily: F.arSemi, flex: 1 },
  offerVerified: { fontSize: 10, color: '#5a9a72', fontFamily: F.en },
  offerRating:   { fontSize: 10, color: C.textTertiary, fontFamily: F.en },
  offerTotal:    { fontSize: 14, color: C.textPrimary, fontFamily: F.enSemi },
  offerUnit:     { fontSize: 11, color: C.textTertiary, fontFamily: F.ar },
  offerLead:     { fontSize: 10, color: C.textDisabled, fontFamily: F.ar },
  acceptBtn: { backgroundColor: C.btnPrimary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  acceptBtnText: { color: C.btnPrimaryText, fontFamily: F.arBold, fontSize: 12 },
  rejectBtn: { borderWidth: 1, borderColor: 'rgba(224,92,92,0.3)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  rejectBtnText: { color: C.red, fontFamily: F.ar, fontSize: 12 },

  nextBanner: { backgroundColor: C.bgHover, borderRadius: 12, borderWidth: 1, borderColor: C.borderDefault, padding: 12, marginBottom: 12 },
  nextTitle: { fontSize: 12, color: C.textSecondary, fontFamily: F.arSemi, textAlign: 'right', marginBottom: 5, lineHeight: 18 },
  nextBody:  { fontSize: 11, color: C.textTertiary, fontFamily: F.ar, textAlign: 'right', lineHeight: 18 },
  nextCta:   { fontSize: 11, color: C.textSecondary, fontFamily: F.arSemi, textAlign: 'right', marginTop: 6 },

  trackBox: { backgroundColor: C.bgOverlay, borderRadius: 12, borderWidth: 1, borderColor: C.borderSubtle, padding: 12, marginBottom: 12 },
  trackRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  trackText: { flex: 1, fontSize: 12, color: C.textSecondary, fontFamily: F.ar, textAlign: 'right' },
  trackNum:  { color: C.textPrimary, fontFamily: F.enSemi },
  trackLink: { fontSize: 11, color: C.textTertiary, fontFamily: F.en, letterSpacing: 0.5 },
  trackETA:  { fontSize: 11, color: C.textTertiary, fontFamily: F.ar, textAlign: 'right', marginTop: 6 },

  /* Inline action buttons */
  payBtn:     { backgroundColor: C.btnPrimary, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginBottom: 8 },
  payBtnText: { color: C.btnPrimaryText, fontFamily: F.arBold, fontSize: 14 },
  cancelBtn:     { borderWidth: 1, borderColor: 'rgba(224,92,92,0.25)', borderRadius: 12, paddingVertical: 10, alignItems: 'center', marginBottom: 4 },
  cancelBtnText: { color: C.red, fontFamily: F.arSemi, fontSize: 13 },
  reportBtn:     { backgroundColor: C.bgHover, borderRadius: 12, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: C.borderDefault },
  reportBtnText: { color: C.textSecondary, fontFamily: F.ar, fontSize: 13 },
  chatBtn:     { backgroundColor: C.bgHover, borderRadius: 12, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: C.borderDefault, marginBottom: 8 },
  chatBtnText: { color: C.textPrimary, fontFamily: F.arSemi, fontSize: 13 },

  offersBtn: { backgroundColor: C.bgHover, borderRadius: 12, paddingVertical: 11, alignItems: 'center', borderWidth: 1, borderColor: C.borderDefault, marginTop: 4 },
  offersBtnText: { color: C.textSecondary, fontFamily: F.arSemi, fontSize: 13 },
  offerLowestBadge: { fontSize: 9, color: '#5a9a72', fontFamily: F.arSemi, backgroundColor: 'rgba(90,154,114,0.1)', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(90,154,114,0.25)' },
  offerMeta:     { fontSize: 10, color: C.textTertiary, fontFamily: F.ar, backgroundColor: C.bgOverlay, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  offerNote:     { fontSize: 11, color: C.textSecondary, fontFamily: F.ar, textAlign: 'right', lineHeight: 16, marginBottom: 4 },
  offerChatLink: { fontSize: 11, color: C.textTertiary, fontFamily: F.arSemi, textAlign: 'right', marginTop: 2 },

  /* Review modal */
  reviewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  reviewSheet:   { backgroundColor: C.bgBase, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  reviewHandle:  { width: 40, height: 4, backgroundColor: C.borderDefault, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  reviewTitle:   { fontFamily: F.arBold, fontSize: 18, color: C.textPrimary, textAlign: 'center', marginBottom: 4 },
  reviewSub:     { fontFamily: F.ar, fontSize: 13, color: C.textTertiary, textAlign: 'center', marginBottom: 20 },
  starsRow:      { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 20 },
  star:          { fontSize: 36, color: C.borderDefault },
  starFilled:    { color: '#e8a020' },
  reviewInput:   { backgroundColor: C.bgRaised, borderRadius: 12, borderWidth: 1, borderColor: C.borderMuted, paddingHorizontal: 14, paddingVertical: 11, fontFamily: F.ar, fontSize: 14, color: C.textPrimary, textAlign: 'right', minHeight: 80, marginBottom: 16 },

  /* Modals */
  modalScroll: { padding: 20, paddingBottom: 60 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle:  { color: C.textPrimary, fontFamily: F.arBold, fontSize: 18 },
  modalClose:  { color: C.textSecondary, fontFamily: F.ar, fontSize: 15 },
  managedBanner:     { backgroundColor: C.bgHover, borderRadius: 12, borderWidth: 1, borderColor: C.borderDefault, padding: 14, marginBottom: 20 },
  managedBannerText: { color: C.textSecondary, fontFamily: F.ar, fontSize: 13, textAlign: 'right', lineHeight: 20 },

  fieldWrap:  { marginBottom: 16 },
  fieldLabel: { color: C.textSecondary, fontFamily: F.ar, fontSize: 12, textAlign: 'right', marginBottom: 6 },
  input: { backgroundColor: C.bgRaised, borderRadius: 12, borderWidth: 1, borderColor: C.borderMuted, paddingHorizontal: 16, paddingVertical: 12, fontFamily: F.ar, fontSize: 15, color: C.textPrimary, textAlign: 'right' },
  error: { color: C.red, fontFamily: F.ar, fontSize: 13, textAlign: 'right', marginBottom: 12 },

  submitBtn:     { backgroundColor: C.btnPrimary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  submitBtnText: { color: C.btnPrimaryText, fontFamily: F.arBold, fontSize: 15 },

  chipSection:    { marginBottom: 16 },
  chipSectionLabel: { color: C.textSecondary, fontFamily: F.ar, fontSize: 12, textAlign: 'right', marginBottom: 8 },
  chipSectionRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' },
  chipOption:       { borderWidth: 1, borderColor: C.borderDefault, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: C.bgBase },
  chipOptionActive: { borderColor: C.btnPrimary, backgroundColor: C.btnPrimary },
  chipOptionText:   { color: C.textSecondary, fontFamily: F.ar, fontSize: 13 },
  chipOptionTextActive: { color: C.btnPrimaryText, fontFamily: F.arSemi },
});
