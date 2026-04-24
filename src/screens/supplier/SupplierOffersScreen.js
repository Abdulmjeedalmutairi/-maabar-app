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
    title: 'عروضي',
    noOffers: 'لم تقدم عروضاً بعد',
    browseRequests: 'تصفح الطلبات',
    status: { pending: 'قيد المراجعة', accepted: 'مقبول', rejected: 'مرفوض', cancelled: 'ملغي' },
    price: 'سعر الوحدة', shipping: 'تكلفة الشحن', moq: 'MOQ',
    days: 'مدة التسليم (يوم)', note: 'ملاحظة', origin: 'بلد المنشأ',
    shippingMethod: 'طريقة الشحن',
    edit: 'تعديل', delete: 'حذف', cancel: 'إلغاء العرض',
    dismiss: 'إخفاء',
    save: 'حفظ', close: 'إغلاق', editOffer: 'تعديل العرض',
    addTracking: 'إضافة رقم التتبع', trackingNum: 'رقم التتبع', send: 'إرسال',
    confirmDelete: 'هل تريد حذف هذا العرض؟',
    confirmDismiss: 'إخفاء هذا العرض المرفوض؟',
    confirmCancel: 'هل تريد إلغاء هذا العرض؟',
    confirmCancelAccepted: 'هل تريد سحب العرض المقبول وإعادة الطلب للتاجر؟',
    cantDelete: 'لا يمكن حذف عرض مقبول أو مرفوض',
    errorSave: 'تأكد من سعر الوحدة وتكلفة الشحن و MOQ ومدة التسليم',
    errorGeneric: 'حدث خطأ، حاول مرة أخرى',
    trackingSent: 'تم إرسال رقم التتبع',
    confirm: 'تأكيد', cancelBtn: 'إلغاء',
    rejectionReason: 'سبب الرفض',
    notifyReady: 'جاهز — أبلغ التاجر',
    notifiedReady: 'تم إبلاغ التاجر',
    awaitingPayment: 'في انتظار دفع التاجر',
    contactTrader: 'تواصل مع التاجر',
  },
  en: {
    title: 'My Offers',
    noOffers: 'No offers submitted yet',
    browseRequests: 'Browse Requests',
    status: { pending: 'Pending', accepted: 'Accepted', rejected: 'Rejected', cancelled: 'Cancelled' },
    price: 'Unit Price', shipping: 'Shipping Cost', moq: 'MOQ',
    days: 'Delivery Days', note: 'Note', origin: 'Origin',
    shippingMethod: 'Shipping Method',
    edit: 'Edit', delete: 'Delete', cancel: 'Cancel Offer',
    dismiss: 'Dismiss',
    save: 'Save', close: 'Close', editOffer: 'Edit Offer',
    addTracking: 'Add Tracking Number', trackingNum: 'Tracking Number', send: 'Send',
    confirmDelete: 'Delete this offer?',
    confirmDismiss: 'Dismiss this rejected offer?',
    confirmCancel: 'Cancel this offer?',
    confirmCancelAccepted: 'Withdraw accepted offer and reopen the request for the trader?',
    cantDelete: 'Cannot delete an accepted or rejected offer',
    errorSave: 'Check unit price, shipping cost, MOQ, and delivery days before saving',
    errorGeneric: 'Something went wrong, please try again',
    trackingSent: 'Tracking number sent',
    confirm: 'Confirm', cancelBtn: 'Cancel',
    rejectionReason: 'Rejection reason',
    notifyReady: 'Ready — notify buyer',
    notifiedReady: 'Buyer notified',
    awaitingPayment: 'Awaiting buyer payment',
    contactTrader: 'Contact Trader',
  },
  zh: {
    title: '我的报价',
    noOffers: '尚未提交报价',
    browseRequests: '浏览询盘',
    status: { pending: '待审核', accepted: '已接受', rejected: '已拒绝', cancelled: '已取消' },
    price: '单价', shipping: '运费', moq: '最小起订量',
    days: '交期（天）', note: '备注', origin: '原产地',
    shippingMethod: '运输方式',
    edit: '编辑', delete: '删除', cancel: '取消报价',
    dismiss: '忽略',
    save: '保存', close: '关闭', editOffer: '编辑报价',
    addTracking: '添加物流单号', trackingNum: '物流单号', send: '发送',
    confirmDelete: '确认删除这个报价吗？',
    confirmDismiss: '忽略此被拒绝的报价？',
    confirmCancel: '确认取消这个报价吗？',
    confirmCancelAccepted: '确认撤回已接受报价并让需求重新开放给买家吗？',
    cantDelete: '已接受或已拒绝的报价无法删除',
    errorSave: '请先确认单价、运费、起订量和交期是否正确',
    errorGeneric: '出现错误，请重试',
    trackingSent: '物流单号已发送',
    confirm: '确认', cancelBtn: '取消',
    rejectionReason: '拒绝原因',
    notifyReady: '准备好了，通知买家',
    notifiedReady: '已通知买家',
    awaitingPayment: '等待买家付款',
    contactTrader: '联系买家',
  },
};

export default function SupplierOffersScreen({ navigation }) {
  const lang = getLang();
  const t = COPY[lang] || COPY.ar;
  const isAr = lang === 'ar';

  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [editOffer, setEditOffer] = useState(null);
  const [editForm, setEditForm] = useState({
    price: '', shippingCost: '', shippingMethod: '', moq: '', days: '', origin: 'China', note: '',
  });
  const [saving, setSaving] = useState(false);

  const [trackingOffer, setTrackingOffer] = useState(null);
  const [trackingInput, setTrackingInput] = useState('');
  const [sendingTracking, setSendingTracking] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Exact web query from DashboardSupplier.jsx loadMyOffers()
    const { data } = await supabase
      .from('offers')
      .select('*,requests(title_ar,title_en,title_zh,buyer_id,status,tracking_number,shipping_status,quantity,description,payment_plan)')
      .eq('supplier_id', user.id)
      .order('created_at', { ascending: false });

    console.log('[SupplierOffers] offers:', data?.length, data);
    setOffers(data || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  function onRefresh() { setRefreshing(true); load(); }

  function setEF(k, v) { setEditForm(f => ({ ...f, [k]: v })); }

  function openEdit(offer) {
    setEditOffer(offer);
    setEditForm({
      price: String(offer.price ?? ''),
      shippingCost: String(offer.shipping_cost ?? ''),
      shippingMethod: offer.shipping_method || '',
      moq: String(offer.moq ?? ''),
      days: String(offer.delivery_days ?? ''),
      origin: offer.origin || 'China',
      note: offer.note || '',
    });
  }

  async function saveEdit() {
    const price = parseFloat(editForm.price);
    const shippingCost = parseFloat(editForm.shippingCost);
    const days = parseInt(editForm.days, 10);
    const moq = String(editForm.moq || '').trim();

    if (!Number.isFinite(price) || price <= 0 ||
        !Number.isFinite(shippingCost) || shippingCost < 0 ||
        !Number.isFinite(days) || days <= 0 || !moq) {
      Alert.alert('', t.errorSave);
      return;
    }

    setSaving(true);
    // Exact web saveEditOffer() payload
    const { error } = await supabase.from('offers').update({
      price,
      shipping_cost: shippingCost,
      shipping_method: editForm.shippingMethod || null,
      moq,
      delivery_days: days,
      origin: editForm.origin || 'China',
      note: editForm.note || null,
    }).eq('id', editOffer.id);
    setSaving(false);

    if (error) { console.error('[SupplierOffers] saveEdit error:', error); Alert.alert('', t.errorGeneric); return; }
    setEditOffer(null);
    load();
  }

  function deleteOffer(o) {
    if (o.status !== 'pending') { Alert.alert('', t.cantDelete); return; }
    Alert.alert('', t.confirmDelete, [
      { text: t.cancelBtn, style: 'cancel' },
      {
        text: t.delete, style: 'destructive',
        onPress: async () => {
          await supabase.from('offers').delete().eq('id', o.id);
          load();
        },
      },
    ]);
  }

  function dismissOffer(o) {
    Alert.alert('', t.confirmDismiss, [
      { text: t.cancelBtn, style: 'cancel' },
      {
        text: t.dismiss, style: 'destructive',
        onPress: async () => {
          await supabase.from('offers').delete().eq('id', o.id);
          load();
        },
      },
    ]);
  }

  function cancelOffer(o) {
    const requestStatus = o.requests?.status || '';
    const isAcceptedBeforePayment = o.status === 'accepted' &&
      !['paid', 'ready_to_ship', 'shipping', 'arrived', 'delivered'].includes(requestStatus);

    Alert.alert('', isAcceptedBeforePayment ? t.confirmCancelAccepted : t.confirmCancel, [
      { text: t.cancelBtn, style: 'cancel' },
      {
        text: t.confirm, style: 'destructive',
        onPress: async () => {
          // Exact web cancelOffer() logic
          await supabase.from('offers').update({ status: 'cancelled' }).eq('id', o.id);
          if (isAcceptedBeforePayment) {
            await supabase.from('requests').update({ status: 'open', shipping_status: 'open' }).eq('id', o.request_id);
          }
          const buyerId = o.requests?.buyer_id;
          if (buyerId) {
            await supabase.from('notifications').insert({
              user_id: buyerId,
              type: 'offer_cancelled',
              title_ar: isAcceptedBeforePayment
                ? `قام المورد بسحب العرض المقبول على طلبك`
                : `قام المورد بسحب عرضه على طلبك`,
              title_en: isAcceptedBeforePayment
                ? `Supplier withdrew the accepted offer on your request`
                : `Supplier withdrew their offer on your request`,
              title_zh: isAcceptedBeforePayment
                ? `供应商撤回了已接受的报价`
                : `供应商撤回了报价`,
              ref_id: o.request_id,
              is_read: false,
            });
          }
          load();
        },
      },
    ]);
  }

  async function sendTracking() {
    const num = trackingInput.trim();
    if (!num) return;
    setSendingTracking(true);

    const buyerId = trackingOffer?.requests?.buyer_id;
    const requestId = trackingOffer?.request_id;

    // Exact web submitTracking() query
    await supabase.from('requests').update({
      tracking_number: num,
      status: 'shipping',
      shipping_status: 'shipping',
    }).eq('id', requestId);

    if (buyerId) {
      await supabase.from('notifications').insert({
        user_id: buyerId,
        type: 'shipped',
        title_ar: 'طلبك في الطريق — رقم التتبع: ' + num,
        title_en: 'Your order is on the way — Tracking: ' + num,
        title_zh: '您的订单已发货 — 跟踪号：' + num,
        ref_id: requestId,
        is_read: false,
      });
    }

    setSendingTracking(false);
    setTrackingOffer(null);
    setTrackingInput('');
    load();
    Alert.alert('✓', t.trackingSent);
  }

  // Exact web DashboardSupplier flow: supplier confirms readiness → request
  // transitions from 'closed' to 'supplier_confirmed' and the buyer gets an
  // in-app notification that payment is now unlocked.
  async function notifyReady(o) {
    const buyerId = o.requests?.buyer_id;
    const requestId = o.request_id;

    const { error } = await supabase
      .from('requests')
      .update({ status: 'supplier_confirmed' })
      .eq('id', requestId);

    if (error) {
      console.error('[SupplierOffers] notifyReady error:', error);
      Alert.alert('', t.errorGeneric);
      return;
    }

    if (buyerId) {
      await supabase.from('notifications').insert({
        user_id: buyerId,
        type: 'supplier_confirmed',
        title_ar: 'المورد جاهز — يمكنك الآن إتمام الدفع',
        title_en: 'Supplier is ready — you can now complete payment',
        title_zh: '供应商已准备好 — 您现在可以付款',
        ref_id: requestId,
        is_read: false,
      });
    }

    load();
    Alert.alert('✓', t.notifiedReady);
  }

  function openChat(buyerId) {
    if (!buyerId) return;
    navigation.navigate('SInbox', { screen: 'Chat', params: { partnerId: buyerId } });
  }

  const getTitle = (o) => {
    const r = o.requests;
    if (!r) return '—';
    if (lang === 'ar') return r.title_ar || r.title_en || r.title_zh || '—';
    if (lang === 'zh') return r.title_zh || r.title_en || r.title_ar || '—';
    return r.title_en || r.title_ar || r.title_zh || '—';
  };

  const statusStyle = (status) => {
    if (status === 'accepted') return { bg: C.greenSoft, border: C.green + '40', color: C.green };
    if (status === 'rejected') return { bg: C.redSoft, border: C.red + '40', color: C.red };
    if (status === 'cancelled') return { bg: C.bgOverlay, border: C.borderDefault, color: C.textDisabled };
    return { bg: C.orangeSoft, border: C.orange + '40', color: C.orange };
  };

  const canEdit = (o) => o.status === 'pending';
  const canDelete = (o) => o.status === 'pending';
  const canCancel = (o) => ['pending', 'accepted'].includes(o.status) &&
    !['paid', 'ready_to_ship', 'shipping', 'arrived', 'delivered'].includes(o.requests?.status || '');
  // Web-exact: tracking input only appears after the buyer pays the first
  // installment. Before that (closed / supplier_confirmed) the supplier sees
  // notify-ready / awaiting-payment instead.
  const canAddTracking = (o) => o.status === 'accepted' &&
    ['paid', 'ready_to_ship'].includes(o.requests?.status || '');
  const canNotifyReady = (o) => o.status === 'accepted' && o.requests?.status === 'closed';
  const isAwaitingPayment = (o) => o.status === 'accepted' && o.requests?.status === 'supplier_confirmed';
  const canContactTrader = (o) => o.status === 'accepted' && !!o.requests?.buyer_id &&
    ['closed', 'supplier_confirmed', 'paid', 'ready_to_ship'].includes(o.requests?.status || '');

  const fmtDate = (d) => {
    if (!d) return '';
    const diff = Math.floor((Date.now() - new Date(d)) / 1000);
    if (lang === 'ar') {
      if (diff < 3600) return Math.floor(diff / 60) + ' د';
      if (diff < 86400) return Math.floor(diff / 3600) + ' س';
      return Math.floor(diff / 86400) + ' ي';
    }
    if (lang === 'zh') {
      if (diff < 3600) return Math.floor(diff / 60) + '分';
      if (diff < 86400) return Math.floor(diff / 3600) + '时';
      return Math.floor(diff / 86400) + '天';
    }
    if (diff < 3600) return Math.floor(diff / 60) + 'm';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h';
    return Math.floor(diff / 86400) + 'd';
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}><ActivityIndicator color={C.textSecondary} size="large" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.topBar}>
        <Text style={[s.pageTitle, isAr && s.rtl]}>{t.title}</Text>
      </View>

      <ScrollView
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.textSecondary} />}
      >
        {offers.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={[s.emptyText, isAr && s.rtl]}>{t.noOffers}</Text>
            <TouchableOpacity
              style={s.emptyBtn}
              onPress={() => navigation.navigate('SRequests')}
              activeOpacity={0.85}
            >
              <Text style={s.emptyBtnText}>{t.browseRequests}</Text>
            </TouchableOpacity>
          </View>
        ) : offers.map(o => {
          const bd = statusStyle(o.status);
          return (
            <View key={o.id} style={s.card}>
              <View style={[s.cardTop, isAr && s.rowRtl]}>
                <View style={[s.badge, { backgroundColor: bd.bg, borderColor: bd.border }]}>
                  <Text style={[s.badgeText, { color: bd.color }]}>
                    {t.status[o.status] || o.status}
                  </Text>
                </View>
                <Text style={[s.cardTitle, isAr && s.rtl]} numberOfLines={2}>
                  {getTitle(o)}
                </Text>
              </View>

              <View style={[s.metaRow, isAr && s.rowRtl]}>
                {!!o.price && <Text style={s.meta}>{o.price} USD</Text>}
                {!!o.shipping_cost && <Text style={s.meta}>{t.shipping}: {o.shipping_cost}</Text>}
                {!!o.moq && <Text style={s.meta}>MOQ: {o.moq}</Text>}
                {!!o.delivery_days && (
                  <Text style={s.meta}>
                    {o.delivery_days} {lang === 'ar' ? 'يوم' : lang === 'zh' ? '天' : 'days'}
                  </Text>
                )}
              </View>

              <Text style={[s.dateText, isAr && s.rtl]}>{fmtDate(o.created_at)}</Text>

              {o.status === 'rejected' && !!o.rejection_reason && (
                <View style={s.rejectionBox}>
                  <Text style={[s.rejectionLabel, isAr && s.rtl]}>{t.rejectionReason}</Text>
                  <Text style={[s.rejectionText, isAr && s.rtl]}>{o.rejection_reason}</Text>
                </View>
              )}

              {isAwaitingPayment(o) && (
                <View style={s.awaitingNote}>
                  <Text style={[s.awaitingNoteText, isAr && s.rtl]}>{t.awaitingPayment}</Text>
                </View>
              )}

              <View style={[s.actionsRow, isAr && s.rowRtl]}>
                {canEdit(o) && (
                  <TouchableOpacity style={s.actionBtn} onPress={() => openEdit(o)} activeOpacity={0.85}>
                    <Text style={s.actionBtnText}>{t.edit}</Text>
                  </TouchableOpacity>
                )}
                {canNotifyReady(o) && (
                  <TouchableOpacity
                    style={[s.actionBtn, s.actionBtnPrimary]}
                    onPress={() => notifyReady(o)}
                    activeOpacity={0.85}
                  >
                    <Text style={s.actionBtnPrimaryText}>{t.notifyReady}</Text>
                  </TouchableOpacity>
                )}
                {canAddTracking(o) && (
                  <TouchableOpacity
                    style={[s.actionBtn, s.actionBtnPrimary]}
                    onPress={() => { setTrackingOffer(o); setTrackingInput(''); }}
                    activeOpacity={0.85}
                  >
                    <Text style={s.actionBtnPrimaryText}>{t.addTracking}</Text>
                  </TouchableOpacity>
                )}
                {canContactTrader(o) && (
                  <TouchableOpacity
                    style={s.actionBtn}
                    onPress={() => openChat(o.requests.buyer_id)}
                    activeOpacity={0.85}
                  >
                    <Text style={s.actionBtnText}>{t.contactTrader}</Text>
                  </TouchableOpacity>
                )}
                {canCancel(o) && (
                  <TouchableOpacity style={[s.actionBtn, s.actionBtnDanger]} onPress={() => cancelOffer(o)} activeOpacity={0.85}>
                    <Text style={s.actionBtnDangerText}>{t.cancel}</Text>
                  </TouchableOpacity>
                )}
                {canDelete(o) && (
                  <TouchableOpacity style={[s.actionBtn, s.actionBtnDanger]} onPress={() => deleteOffer(o)} activeOpacity={0.85}>
                    <Text style={s.actionBtnDangerText}>{t.delete}</Text>
                  </TouchableOpacity>
                )}
                {o.status === 'rejected' && (
                  <TouchableOpacity style={[s.actionBtn, s.actionBtnDanger]} onPress={() => dismissOffer(o)} activeOpacity={0.85}>
                    <Text style={s.actionBtnDangerText}>{t.dismiss}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* ── Edit Offer Modal ── */}
      <Modal visible={!!editOffer} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={s.safe}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={s.modalScroll} keyboardShouldPersistTaps="handled">
              <View style={[s.modalHeader, isAr && s.rowRtl]}>
                <TouchableOpacity onPress={() => setEditOffer(null)}>
                  <Text style={s.modalClose}>{t.close}</Text>
                </TouchableOpacity>
                <Text style={[s.modalTitle, isAr && s.rtl]}>{t.editOffer}</Text>
              </View>

              <OField label={`${t.price} (USD) *`} value={editForm.price} onChangeText={v => setEF('price', v)} keyboardType="numeric" isAr={isAr} />
              <OField label={`${t.shipping} (USD) *`} value={editForm.shippingCost} onChangeText={v => setEF('shippingCost', v)} keyboardType="numeric" isAr={isAr} />
              <OField label={t.shippingMethod} value={editForm.shippingMethod} onChangeText={v => setEF('shippingMethod', v)} isAr={isAr} />
              <OField label={`${t.moq} *`} value={editForm.moq} onChangeText={v => setEF('moq', v)} isAr={isAr} />
              <OField label={`${t.days} *`} value={editForm.days} onChangeText={v => setEF('days', v)} keyboardType="numeric" isAr={isAr} />
              <OField label={t.origin} value={editForm.origin} onChangeText={v => setEF('origin', v)} isAr={isAr} />
              <OField label={t.note} value={editForm.note} onChangeText={v => setEF('note', v)} multiline numberOfLines={3} isAr={isAr} />

              <TouchableOpacity
                style={[s.submitBtn, saving && { opacity: 0.6 }]}
                onPress={saveEdit}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving
                  ? <ActivityIndicator color={C.bgBase} />
                  : <Text style={s.submitBtnText}>{t.save}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* ── Tracking Modal ── */}
      <Modal visible={!!trackingOffer} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={s.safe}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={s.modalScroll} keyboardShouldPersistTaps="handled">
              <View style={[s.modalHeader, isAr && s.rowRtl]}>
                <TouchableOpacity onPress={() => setTrackingOffer(null)}>
                  <Text style={s.modalClose}>{t.close}</Text>
                </TouchableOpacity>
                <Text style={[s.modalTitle, isAr && s.rtl]}>{t.addTracking}</Text>
              </View>

              <OField
                label={t.trackingNum}
                value={trackingInput}
                onChangeText={setTrackingInput}
                autoCapitalize="none"
                autoCorrect={false}
                isAr={isAr}
              />

              <TouchableOpacity
                style={[s.submitBtn, sendingTracking && { opacity: 0.6 }]}
                onPress={sendTracking}
                disabled={sendingTracking}
                activeOpacity={0.85}
              >
                {sendingTracking
                  ? <ActivityIndicator color={C.bgBase} />
                  : <Text style={s.submitBtnText}>{t.send}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function OField({ label, isAr, multiline, ...props }) {
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

  list: { padding: 16, gap: 10, paddingBottom: 48 },

  card: {
    backgroundColor: C.bgRaised, borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: C.borderDefault,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  badge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  badgeText: { fontSize: 10, fontFamily: F.arSemi },
  cardTitle: { flex: 1, color: C.textPrimary, fontSize: 14, fontFamily: F.ar, lineHeight: 20 },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 6 },
  meta: { color: C.textSecondary, fontSize: 12, fontFamily: F.en },
  dateText: { color: C.textDisabled, fontSize: 11, fontFamily: F.en, marginBottom: 10 },

  rejectionBox: {
    backgroundColor: C.redSoft, borderRadius: 8,
    padding: 10, marginBottom: 8,
    borderWidth: 1, borderColor: C.red + '30',
  },
  rejectionLabel: { color: C.red, fontSize: 10, fontFamily: F.arSemi, marginBottom: 4, letterSpacing: 0.5 },
  rejectionText: { color: C.red, fontSize: 13, fontFamily: F.ar, lineHeight: 18 },
  awaitingNote: {
    backgroundColor: C.bgOverlay, borderRadius: 10,
    borderWidth: 1, borderColor: C.borderSubtle,
    paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8,
  },
  awaitingNoteText: { color: C.textSecondary, fontFamily: F.arSemi, fontSize: 12, textAlign: 'center' },

  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  actionBtn: {
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: C.borderDefault, backgroundColor: C.bgOverlay,
  },
  actionBtnText: { color: C.textSecondary, fontSize: 12, fontFamily: F.arSemi },
  actionBtnPrimary: { backgroundColor: C.btnPrimary, borderColor: C.btnPrimary },
  actionBtnPrimaryText: { color: C.btnPrimaryText, fontSize: 12, fontFamily: F.arSemi },
  actionBtnDanger: { backgroundColor: C.redSoft, borderColor: C.red + '40' },
  actionBtnDangerText: { color: C.red, fontSize: 12, fontFamily: F.arSemi },

  emptyCard: {
    backgroundColor: C.bgRaised, borderRadius: 16,
    padding: 40, alignItems: 'center',
    borderWidth: 1, borderColor: C.borderDefault, marginTop: 16,
  },
  emptyText: { color: C.textSecondary, fontSize: 14, fontFamily: F.ar, marginBottom: 14 },
  emptyBtn: {
    backgroundColor: C.btnPrimary, borderRadius: 12,
    paddingHorizontal: 18, paddingVertical: 10,
  },
  emptyBtnText: { color: C.btnPrimaryText, fontSize: 13, fontFamily: F.arSemi },

  modalScroll: { padding: 20, paddingBottom: 60 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },
  modalTitle: { color: C.textPrimary, fontSize: 18, fontFamily: F.arSemi },
  modalClose: { color: C.textSecondary, fontSize: 15, fontFamily: F.ar },

  fieldWrap: { marginBottom: 16 },
  fieldLabel: { color: C.textSecondary, fontSize: 12, fontFamily: F.ar, marginBottom: 6 },
  input: {
    backgroundColor: C.bgRaised, borderRadius: 12,
    borderWidth: 1, borderColor: C.borderMuted,
    paddingHorizontal: 16, paddingVertical: 12,
    color: C.textPrimary, fontSize: 15, fontFamily: F.ar,
  },
  submitBtn: {
    backgroundColor: C.btnPrimary, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginTop: 8,
  },
  submitBtnText: { color: C.btnPrimaryText, fontFamily: F.arSemi, fontSize: 16 },
});
