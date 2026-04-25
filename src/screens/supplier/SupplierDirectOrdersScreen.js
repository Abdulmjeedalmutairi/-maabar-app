/**
 * SupplierDirectOrdersScreen — mobile mirror of the web Direct Purchase Orders
 * tab on src/pages/DashboardSupplier.jsx.
 *
 * Four sections in one tab (top-down lifecycle):
 *   1. Pending  — status='pending_supplier_confirmation' · Confirm / Reject + 24h countdown
 *   2. Paid     — status='paid' · upload tracking number with carrier picker
 *   3. Active   — status IN ('shipping','arrived') · read-only with carrier + tracking link
 *   4. Completed — status='delivered' · read-only with delivery date + payment amount
 *
 * RFQ flows (offers, RFQ requests, samples) are NOT touched.
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, RefreshControl, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase, SUPABASE_ANON_KEY, SEND_EMAIL_URL } from '../../lib/supabase';
import { getLang } from '../../lib/lang';
import { getTrackingUrl, CARRIERS } from '../../lib/tracking';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';

/* ─────────────────────────────────────────────────────────────────── */
/* Copy                                                                */
/* ─────────────────────────────────────────────────────────────────── */
const COPY = {
  ar: {
    title: 'طلبات الشراء المباشر',
    intro: 'طلبات شراء مباشرة من تجار اختاروا منتجاتك.',

    secPending:    'بانتظار تأكيدك',
    secPendingHint:'أكد أو ارفض خلال 24 ساعة، وإلا تم إلغاء الطلب تلقائياً.',
    emptyPending:  'لا توجد طلبات شراء مباشرة جديدة',

    secPaid:       'مدفوع — أضف رقم التتبع',
    secPaidHint:   'أكمل التاجر الدفع — جهّز الشحنة وارفع رقم التتبع.',
    emptyPaid:     'لا توجد طلبات مدفوعة في انتظار الشحن',

    secActive:     'الشحنات النشطة',
    secActiveHint: 'الطلبات التي شحنتها وفي انتظار تأكيد التاجر بالاستلام.',
    emptyActive:   'لا توجد شحنات نشطة',

    secDone:       'الطلبات المكتملة',
    secDoneHint:   'أكد التاجر استلامها — تم تحرير المبالغ.',
    emptyDone:     'لا توجد طلبات مكتملة بعد',

    badge: { direct: 'شراء مباشر', paid: 'مدفوع — جاهز للشحن', inTransit: 'في الطريق', arrived: 'وصلت — التاجر يفحص', completed: 'مكتمل ✓' },

    buyer: 'التاجر',
    qty: 'الكمية',
    price: 'السعر',
    paymentDate: 'تاريخ الدفع',
    deliveryDate: 'تاريخ التسليم',
    window24h: 'مهلة 24 ساعة',
    expired: 'انتهت المهلة',
    remaining: (h, m) => `متبقّي ${h} ساعة ${m} دقيقة`,

    carrier: 'شركة الشحن',
    trackingNum: 'رقم التتبع',
    enterTracking: 'أدخل رقم التتبع',
    trackBtn: 'تتبع الشحنة ↗',
    sendTracking: 'إرسال رقم التتبع',

    confirmOrder: 'تأكيد الطلب',
    rejectOrder: 'رفض الطلب',
    chatBuyer: 'تواصل مع التاجر',

    rejectConfirmTitle: 'رفض الطلب؟',
    rejectConfirmBody:  'لن يتمكن التاجر من المتابعة على هذا الطلب.',
    yesReject: 'نعم، ارفض',
    cancelBtn: 'إلغاء',

    errorAction: 'تعذّر تنفيذ العملية — حاول مرة أخرى',
    errorTrackingEmpty: 'أدخل رقم التتبع أولاً',
    errorTrackingFailed: 'تعذّر إرسال رقم التتبع — حاول مرة أخرى',
  },
  en: {
    title: 'Direct Purchase Orders',
    intro: 'Direct purchase orders from buyers who picked your products.',

    secPending:    'Awaiting your confirmation',
    secPendingHint:'Confirm or reject within 24 hours — orders are auto-cancelled after that.',
    emptyPending:  'No new direct purchase orders',

    secPaid:       'Paid — add tracking',
    secPaidHint:   'The buyer has paid — prepare the shipment and upload the tracking number.',
    emptyPaid:     'No paid orders awaiting tracking',

    secActive:     'Active shipments',
    secActiveHint: 'Orders you have shipped — awaiting the buyer to confirm receipt.',
    emptyActive:   'No active shipments',

    secDone:       'Completed orders',
    secDoneHint:   'Buyer has confirmed delivery — payouts have been released.',
    emptyDone:     'No completed orders yet',

    badge: { direct: 'Direct Purchase', paid: 'Paid — Ready to Ship', inTransit: 'In Transit', arrived: 'Arrived — Buyer Inspecting', completed: 'Completed ✓' },

    buyer: 'Buyer',
    qty: 'Qty',
    price: 'Price',
    paymentDate: 'Payment date',
    deliveryDate: 'Delivered',
    window24h: '24h Window',
    expired: 'Expired',
    remaining: (h, m) => `${h}h ${m}m left`,

    carrier: 'Carrier',
    trackingNum: 'Tracking #',
    enterTracking: 'Enter tracking number',
    trackBtn: 'Track Shipment ↗',
    sendTracking: 'Send Tracking',

    confirmOrder: 'Confirm Order',
    rejectOrder: 'Reject Order',
    chatBuyer: 'Chat with Buyer',

    rejectConfirmTitle: 'Reject this order?',
    rejectConfirmBody:  'The buyer will be unable to proceed on this order.',
    yesReject: 'Yes, reject',
    cancelBtn: 'Cancel',

    errorAction: 'Could not perform this action — try again',
    errorTrackingEmpty: 'Enter the tracking number first',
    errorTrackingFailed: 'Could not save tracking — try again',
  },
  zh: {
    title: '直接采购订单',
    intro: '买家直接下单的采购订单。',

    secPending:    '等待您确认',
    secPendingHint:'请在 24 小时内确认或拒绝，否则订单将自动取消。',
    emptyPending:  '暂无直接采购订单',

    secPaid:       '已付款 — 添加物流单号',
    secPaidHint:   '买家已付款 — 请准备发货并上传物流单号。',
    emptyPaid:     '暂无等待发货的已付款订单',

    secActive:     '运输中的订单',
    secActiveHint: '已发货的订单，等待买家确认收货。',
    emptyActive:   '暂无运输中的订单',

    secDone:       '已完成订单',
    secDoneHint:   '买家已确认收货 — 款项已放给您。',
    emptyDone:     '暂无已完成订单',

    badge: { direct: '直接采购', paid: '已付款 — 准备发货', inTransit: '运输中', arrived: '已到货 — 买家正在验收', completed: '已完成 ✓' },

    buyer: '买家',
    qty: '数量',
    price: '价格',
    paymentDate: '付款日期',
    deliveryDate: '交付日期',
    window24h: '24 小时窗口',
    expired: '已超时',
    remaining: (h, m) => `剩余 ${h} 小时 ${m} 分钟`,

    carrier: '承运商',
    trackingNum: '物流单号',
    enterTracking: '输入物流单号',
    trackBtn: '查看跟踪 ↗',
    sendTracking: '提交物流单号',

    confirmOrder: '确认订单',
    rejectOrder: '拒绝订单',
    chatBuyer: '联系买家',

    rejectConfirmTitle: '确认拒绝此订单？',
    rejectConfirmBody:  '买家将无法在此订单上继续。',
    yesReject: '确认拒绝',
    cancelBtn: '取消',

    errorAction: '无法完成操作 — 请重试',
    errorTrackingEmpty: '请先输入物流单号',
    errorTrackingFailed: '无法保存物流信息 — 请重试',
  },
};

/* ─────────────────────────────────────────────────────────────────── */
/* Helpers                                                             */
/* ─────────────────────────────────────────────────────────────────── */

function pickProductName(product, lang) {
  if (!product) return '';
  if (lang === 'zh') return product.name_zh || product.name_en || product.name_ar || '';
  if (lang === 'en') return product.name_en || product.name_ar || product.name_zh || '';
  return product.name_ar || product.name_en || product.name_zh || '';
}

function pickBuyerName(profiles, fallback) {
  return profiles?.company_name || profiles?.full_name || fallback || '';
}

function fmtCountdown(createdAt, nowMs, copy) {
  if (!createdAt) return { expired: true, label: copy.expired, color: C.red };
  const expiresAt = new Date(createdAt).getTime() + 24 * 60 * 60 * 1000;
  const remaining = expiresAt - nowMs;
  if (remaining <= 0) return { expired: true, label: copy.expired, color: C.red };
  const hours = Math.floor(remaining / (60 * 60 * 1000));
  const mins = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  const color = hours < 4 ? C.orange : C.green;
  return { expired: false, label: copy.remaining(hours, mins), color };
}

function fmtRelative(dateStr, lang) {
  if (!dateStr) return '—';
  const diffSec = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diffSec < 60) return lang === 'ar' ? 'الآن' : lang === 'zh' ? '刚刚' : 'just now';
  if (diffSec < 3600) {
    const m = Math.floor(diffSec / 60);
    return lang === 'ar' ? `${m} د` : lang === 'zh' ? `${m} 分钟前` : `${m}m`;
  }
  if (diffSec < 86400) {
    const h = Math.floor(diffSec / 3600);
    return lang === 'ar' ? `${h} س` : lang === 'zh' ? `${h} 小时前` : `${h}h`;
  }
  const d = Math.floor(diffSec / 86400);
  return lang === 'ar' ? `${d} ي` : lang === 'zh' ? `${d} 天前` : `${d}d`;
}

/* ─────────────────────────────────────────────────────────────────── */
/* Screen                                                              */
/* ─────────────────────────────────────────────────────────────────── */

export default function SupplierDirectOrdersScreen({ navigation }) {
  const lang = getLang();
  const t = COPY[lang] || COPY.ar;
  const isAr = lang === 'ar';

  const [pendingOrders, setPendingOrders]     = useState([]);
  const [paidOrders, setPaidOrders]           = useState([]);
  const [shippingOrders, setShippingOrders]   = useState([]);
  const [completedOrders, setCompletedOrders] = useState([]);

  const [loadingPending, setLoadingPending] = useState(true);
  const [loadingPaid, setLoadingPaid]       = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [refreshing, setRefreshing]         = useState(false);

  // Per-row in-flight flags so the right button shows a spinner.
  const [actioning, setActioning] = useState({});

  // Per-row tracking input + carrier picker state.
  const [trackingInputs, setTrackingInputs]   = useState({});
  const [carrierPicks, setCarrierPicks]       = useState({});

  // Live-updating "now" so countdowns recompute every minute.
  const [nowMs, setNowMs] = useState(() => Date.now());

  /* ── Loaders ─────────────────────────────────────────────────────── */

  const loadDirectOrders = useCallback(async () => {
    const userRes = await supabase.auth.getUser();
    console.log('[SDirectOrders.loadDirectOrders] auth.getUser response:', userRes);
    const user = userRes.data?.user;
    if (!user) { setPendingOrders([]); setLoadingPending(false); return; }

    const productsRes = await supabase.from('products').select('id').eq('supplier_id', user.id);
    console.log('[SDirectOrders.loadDirectOrders] products query response:', productsRes);
    const myProductIds = (productsRes.data || []).map(p => p.id);
    if (myProductIds.length === 0) { setPendingOrders([]); setLoadingPending(false); return; }

    const ordersRes = await supabase
      .from('requests')
      .select('*, profiles!requests_buyer_id_fkey(full_name, company_name)')
      .eq('status', 'pending_supplier_confirmation')
      .in('product_ref', myProductIds)
      .order('created_at', { ascending: false });
    console.log('[SDirectOrders.loadDirectOrders] requests query response:', ordersRes);

    const refIds = [...new Set((ordersRes.data || []).map(r => r.product_ref).filter(Boolean))];
    const productsByIdRes = refIds.length
      ? await supabase.from('products').select('id, name_ar, name_en, name_zh, price_from, currency').in('id', refIds)
      : { data: [], error: null };
    console.log('[SDirectOrders.loadDirectOrders] product details response:', productsByIdRes);
    const productsById = (productsByIdRes.data || []).reduce((acc, p) => { acc[p.id] = p; return acc; }, {});

    setPendingOrders((ordersRes.data || []).map(r => ({ ...r, product: productsById[r.product_ref] || null })));
    setLoadingPending(false);
  }, []);

  const loadPaidDirectOrders = useCallback(async () => {
    const userRes = await supabase.auth.getUser();
    const user = userRes.data?.user;
    if (!user) { setPaidOrders([]); setLoadingPaid(false); return; }

    const productsRes = await supabase.from('products').select('id').eq('supplier_id', user.id);
    console.log('[SDirectOrders.loadPaidDirectOrders] products query response:', productsRes);
    const myProductIds = (productsRes.data || []).map(p => p.id);
    if (myProductIds.length === 0) { setPaidOrders([]); setLoadingPaid(false); return; }

    const ordersRes = await supabase
      .from('requests')
      .select('*, profiles!requests_buyer_id_fkey(full_name, company_name)')
      .eq('status', 'paid')
      .in('product_ref', myProductIds)
      .order('created_at', { ascending: false });
    console.log('[SDirectOrders.loadPaidDirectOrders] requests query response:', ordersRes);

    const rows = ordersRes.data || [];
    if (rows.length === 0) { setPaidOrders([]); setLoadingPaid(false); return; }

    const refIds = [...new Set(rows.map(r => r.product_ref).filter(Boolean))];
    const productsByIdRes = refIds.length
      ? await supabase.from('products').select('id, name_ar, name_en, name_zh, price_from, currency, spec_lead_time_days').in('id', refIds)
      : { data: [], error: null };
    console.log('[SDirectOrders.loadPaidDirectOrders] product details response:', productsByIdRes);
    const productsById = (productsByIdRes.data || []).reduce((acc, p) => { acc[p.id] = p; return acc; }, {});

    const reqIds = rows.map(r => r.id);
    const paymentsRes = reqIds.length
      ? await supabase.from('payments').select('id, request_id, amount, status, created_at').eq('supplier_id', user.id).in('request_id', reqIds).order('created_at', { ascending: false })
      : { data: [], error: null };
    console.log('[SDirectOrders.loadPaidDirectOrders] payments query response:', paymentsRes);
    const paymentByRequest = (paymentsRes.data || []).reduce((acc, p) => {
      if (!acc[p.request_id]) acc[p.request_id] = p;
      return acc;
    }, {});

    setPaidOrders(rows.map(r => ({
      ...r,
      product: productsById[r.product_ref] || null,
      payment: paymentByRequest[r.id] || null,
    })));
    setLoadingPaid(false);
  }, []);

  const loadDirectOrdersHistory = useCallback(async () => {
    const userRes = await supabase.auth.getUser();
    const user = userRes.data?.user;
    if (!user) { setShippingOrders([]); setCompletedOrders([]); setLoadingHistory(false); return; }

    const productsRes = await supabase.from('products').select('id').eq('supplier_id', user.id);
    console.log('[SDirectOrders.loadDirectOrdersHistory] products query response:', productsRes);
    const myProductIds = (productsRes.data || []).map(p => p.id);
    if (myProductIds.length === 0) {
      setShippingOrders([]); setCompletedOrders([]); setLoadingHistory(false);
      return;
    }

    const ordersRes = await supabase
      .from('requests')
      .select('*, profiles!requests_buyer_id_fkey(full_name, company_name)')
      .in('status', ['shipping', 'arrived', 'delivered'])
      .in('product_ref', myProductIds)
      .order('created_at', { ascending: false });
    console.log('[SDirectOrders.loadDirectOrdersHistory] requests query response:', ordersRes);

    const rows = ordersRes.data || [];
    if (rows.length === 0) {
      setShippingOrders([]); setCompletedOrders([]); setLoadingHistory(false);
      return;
    }

    const refIds = [...new Set(rows.map(r => r.product_ref).filter(Boolean))];
    const productsByIdRes = refIds.length
      ? await supabase.from('products').select('id, name_ar, name_en, name_zh, price_from, currency').in('id', refIds)
      : { data: [], error: null };
    console.log('[SDirectOrders.loadDirectOrdersHistory] product details response:', productsByIdRes);
    const productsById = (productsByIdRes.data || []).reduce((acc, p) => { acc[p.id] = p; return acc; }, {});

    const reqIds = rows.map(r => r.id);
    const paymentsRes = reqIds.length
      ? await supabase.from('payments').select('id, request_id, amount, status, created_at').eq('supplier_id', user.id).in('request_id', reqIds).order('created_at', { ascending: false })
      : { data: [], error: null };
    console.log('[SDirectOrders.loadDirectOrdersHistory] payments query response:', paymentsRes);
    const paymentByRequest = (paymentsRes.data || []).reduce((acc, p) => {
      if (!acc[p.request_id]) acc[p.request_id] = p;
      return acc;
    }, {});

    const enriched = rows.map(r => ({
      ...r,
      product: productsById[r.product_ref] || null,
      payment: paymentByRequest[r.id] || null,
    }));

    setShippingOrders(enriched.filter(r => r.status === 'shipping' || r.status === 'arrived'));
    setCompletedOrders(enriched.filter(r => r.status === 'delivered'));
    setLoadingHistory(false);
  }, []);

  const loadAll = useCallback(async () => {
    setLoadingPending(true);
    setLoadingPaid(true);
    setLoadingHistory(true);
    await Promise.all([
      loadDirectOrders(),
      loadPaidDirectOrders(),
      loadDirectOrdersHistory(),
    ]);
  }, [loadDirectOrders, loadPaidDirectOrders, loadDirectOrdersHistory]);

  /* ── Lifecycle ───────────────────────────────────────────────────── */

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll])
  );

  // 60s tick for pending countdowns.
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  async function onRefresh() {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }

  /* ── Action handlers ─────────────────────────────────────────────── */

  async function confirmDirectOrder(request) {
    if (!request?.id || !request?.buyer_id) return;
    setActioning(prev => ({ ...prev, [request.id]: 'confirming' }));

    const productName = pickProductName(request.product, lang) || request.title_ar || request.title_en || '';

    const updRes = await supabase
      .from('requests')
      .update({ status: 'supplier_confirmed' })
      .eq('id', request.id)
      .select()
      .single();
    console.log('[SDirectOrders.confirmDirectOrder] update response:', updRes);
    if (updRes.error) {
      setActioning(prev => ({ ...prev, [request.id]: null }));
      Alert.alert('', t.errorAction);
      return;
    }

    const notifRes = await supabase.from('notifications').insert({
      user_id: request.buyer_id,
      type: 'supplier_confirmed',
      title_ar: `أكد المورد طلبك — يمكنك الدفع الآن: ${productName}`,
      title_en: `Supplier confirmed — you can pay now: ${productName}`,
      title_zh: `供应商已确认您的订单 — 请付款：${productName}`,
      ref_id: request.id,
      is_read: false,
    }).select().single();
    console.log('[SDirectOrders.confirmDirectOrder] notification response:', notifRes);

    try {
      const r = await fetch(SEND_EMAIL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({
          type: 'direct_order_confirmed',
          data: { recipientUserId: request.buyer_id, productName, quantity: request.quantity },
        }),
      });
      const body = await r.json().catch(() => null);
      console.log('[SDirectOrders.confirmDirectOrder] email response:', { status: r.status, body });
    } catch (emailError) {
      console.error('[SDirectOrders.confirmDirectOrder] email error:', emailError);
    }

    setActioning(prev => ({ ...prev, [request.id]: null }));
    loadDirectOrders();
  }

  function rejectDirectOrder(request) {
    if (!request?.id || !request?.buyer_id) return;
    Alert.alert(
      t.rejectConfirmTitle,
      t.rejectConfirmBody,
      [
        { text: t.cancelBtn, style: 'cancel' },
        { text: t.yesReject, style: 'destructive', onPress: () => doRejectDirectOrder(request) },
      ],
    );
  }

  async function doRejectDirectOrder(request) {
    setActioning(prev => ({ ...prev, [request.id]: 'rejecting' }));

    const productName = pickProductName(request.product, lang) || request.title_ar || request.title_en || '';

    const updRes = await supabase
      .from('requests')
      .update({ status: 'supplier_rejected' })
      .eq('id', request.id)
      .select()
      .single();
    console.log('[SDirectOrders.rejectDirectOrder] update response:', updRes);
    if (updRes.error) {
      setActioning(prev => ({ ...prev, [request.id]: null }));
      Alert.alert('', t.errorAction);
      return;
    }

    const notifRes = await supabase.from('notifications').insert({
      user_id: request.buyer_id,
      type: 'supplier_rejected',
      title_ar: `لم يتمكن المورد من تنفيذ طلبك: ${productName}`,
      title_en: `Supplier could not fulfill your order: ${productName}`,
      title_zh: `供应商无法接受订单：${productName}`,
      ref_id: request.id,
      is_read: false,
    }).select().single();
    console.log('[SDirectOrders.rejectDirectOrder] notification response:', notifRes);

    try {
      const r = await fetch(SEND_EMAIL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({
          type: 'direct_order_rejected',
          data: { recipientUserId: request.buyer_id, productName, quantity: request.quantity },
        }),
      });
      const body = await r.json().catch(() => null);
      console.log('[SDirectOrders.rejectDirectOrder] email response:', { status: r.status, body });
    } catch (emailError) {
      console.error('[SDirectOrders.rejectDirectOrder] email error:', emailError);
    }

    setActioning(prev => ({ ...prev, [request.id]: null }));
    loadDirectOrders();
  }

  async function submitDirectTracking(request) {
    if (!request?.id || !request?.buyer_id) return;
    const num = (trackingInputs[request.id] || '').trim();
    if (!num) {
      Alert.alert('', t.errorTrackingEmpty);
      return;
    }
    const carrier = carrierPicks[request.id] || 'DHL';
    setActioning(prev => ({ ...prev, [request.id]: 'shipping' }));

    const productName = pickProductName(request.product, lang) || request.title_ar || request.title_en || '';
    const deliveryDays = Number(request.product?.spec_lead_time_days || 0);
    const estimatedDelivery = deliveryDays > 0
      ? new Date(Date.now() + (deliveryDays * 24 * 60 * 60 * 1000)).toISOString()
      : null;

    const updRes = await supabase.from('requests').update({
      tracking_number: num,
      shipping_company: carrier,
      status: 'shipping',
      shipping_status: 'shipping',
      ...(estimatedDelivery ? { estimated_delivery: estimatedDelivery } : {}),
    }).eq('id', request.id).select().single();
    console.log('[SDirectOrders.submitDirectTracking] update response:', updRes);
    if (updRes.error) {
      setActioning(prev => ({ ...prev, [request.id]: null }));
      Alert.alert('', t.errorTrackingFailed);
      return;
    }

    const notifRes = await supabase.from('notifications').insert({
      user_id: request.buyer_id,
      type: 'shipped',
      title_ar: `طلبك في الطريق — رقم التتبع: ${num}`,
      title_en: `Your order is on the way — Tracking: ${num}`,
      title_zh: `您的订单已发货 — 跟踪号：${num}`,
      ref_id: request.id,
      is_read: false,
    }).select().single();
    console.log('[SDirectOrders.submitDirectTracking] notification response:', notifRes);

    try {
      const r = await fetch(SEND_EMAIL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({
          type: 'direct_order_shipped',
          data: { recipientUserId: request.buyer_id, productName, trackingNumber: num, shippingCompany: carrier },
        }),
      });
      const body = await r.json().catch(() => null);
      console.log('[SDirectOrders.submitDirectTracking] email response:', { status: r.status, body });
    } catch (emailError) {
      console.error('[SDirectOrders.submitDirectTracking] email error:', emailError);
    }

    setTrackingInputs(prev => ({ ...prev, [request.id]: '' }));
    setActioning(prev => ({ ...prev, [request.id]: null }));
    loadPaidDirectOrders();
    loadDirectOrdersHistory();
  }

  /* ── Sub-renderers ───────────────────────────────────────────────── */

  function renderPendingCard(r) {
    const productName = pickProductName(r.product, lang) || r.title_ar || r.title_en || '';
    const buyerName   = pickBuyerName(r.profiles, isAr ? 'تاجر' : lang === 'zh' ? '采购商' : 'Trader');
    const cd          = fmtCountdown(r.created_at, nowMs, t);
    const acting      = actioning[r.id];
    const disabled    = Boolean(acting) || cd.expired;

    return (
      <View key={r.id} style={[s.card, { borderColor: 'rgba(91,138,240,0.30)', backgroundColor: 'rgba(91,138,240,0.05)' }]}>
        <View style={s.cardTopRow}>
          <View style={s.cardTopLeft}>
            <Text style={[s.badge, { color: C.green, borderColor: 'rgba(45,106,79,0.30)', backgroundColor: 'rgba(45,106,79,0.10)' }]}>{t.badge.direct}</Text>
            <Text style={s.metaTime}>{fmtRelative(r.created_at, lang)}</Text>
          </View>
          <View style={s.cardTopRight}>
            <Text style={s.metaCaption}>{t.window24h}</Text>
            <Text style={[s.countdownLabel, { color: cd.color }]}>{cd.label}</Text>
          </View>
        </View>

        <Text style={s.productName}>{productName}</Text>
        <View style={s.metaRow}>
          <Text style={s.metaText}>{t.buyer}: {buyerName}</Text>
          <Text style={s.metaText}>{t.qty}: {r.quantity || '—'}</Text>
          {r.product?.price_from ? (
            <Text style={[s.metaText, { direction: 'ltr' }]}>{Number(r.product.price_from).toFixed(2)} {r.product.currency || 'USD'} / unit</Text>
          ) : null}
        </View>
        {!!r.description && <Text style={s.descBody}>{r.description}</Text>}

        <View style={s.btnRow}>
          <TouchableOpacity
            style={[s.btnPrimary, disabled && { opacity: 0.5 }]}
            disabled={disabled}
            onPress={() => confirmDirectOrder(r)}
            activeOpacity={0.85}
          >
            {acting === 'confirming'
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.btnPrimaryText}>{t.confirmOrder}</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.btnDanger, disabled && { opacity: 0.5 }]}
            disabled={disabled}
            onPress={() => rejectDirectOrder(r)}
            activeOpacity={0.85}
          >
            {acting === 'rejecting'
              ? <ActivityIndicator color={C.red} size="small" />
              : <Text style={s.btnDangerText}>{t.rejectOrder}</Text>}
          </TouchableOpacity>
        </View>
        {!!r.buyer_id && (
          <TouchableOpacity
            style={s.btnLink}
            onPress={() => navigation.navigate('SInbox', { screen: 'Chat', params: { partnerId: r.buyer_id } })}
            activeOpacity={0.7}
          >
            <Text style={s.btnLinkText}>{t.chatBuyer}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  function renderPaidCard(r) {
    const productName = pickProductName(r.product, lang) || r.title_ar || r.title_en || '';
    const buyerName   = pickBuyerName(r.profiles, isAr ? 'تاجر' : lang === 'zh' ? '采购商' : 'Trader');
    const acting      = actioning[r.id];
    const payment     = r.payment;
    const paymentDate = payment?.created_at || r.updated_at;
    const paymentAmount = payment ? Number(payment.amount || 0) : 0;
    const currency = r.product?.currency || 'USD';
    const trackingValue = trackingInputs[r.id] || '';
    const carrier = carrierPicks[r.id] || 'DHL';

    return (
      <View key={`paid-${r.id}`} style={[s.card, { borderColor: 'rgba(45,106,79,0.30)', backgroundColor: 'rgba(45,106,79,0.04)' }]}>
        <View style={s.cardTopRow}>
          <View style={s.cardTopLeft}>
            <Text style={[s.badge, { color: C.green, borderColor: 'rgba(45,106,79,0.30)', backgroundColor: 'rgba(45,106,79,0.10)' }]}>{t.badge.paid}</Text>
          </View>
          <View style={s.cardTopRight}>
            <Text style={s.metaCaption}>{t.paymentDate}</Text>
            <Text style={s.metaSubVal}>{fmtRelative(paymentDate, lang)}</Text>
            {paymentAmount > 0 && (
              <Text style={[s.amountLine, { direction: 'ltr' }]}>{paymentAmount.toFixed(2)} {currency}</Text>
            )}
          </View>
        </View>

        <Text style={s.productName}>{productName}</Text>
        <View style={s.metaRow}>
          <Text style={s.metaText}>{t.buyer}: {buyerName}</Text>
          <Text style={s.metaText}>{t.qty}: {r.quantity || '—'}</Text>
        </View>

        <Text style={s.fieldLabel}>{t.carrier}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
          {CARRIERS.map(c => {
            const isPicked = carrier === c;
            return (
              <TouchableOpacity
                key={c}
                style={[s.chip, isPicked && s.chipActive]}
                onPress={() => setCarrierPicks(prev => ({ ...prev, [r.id]: c }))}
                activeOpacity={0.8}
              >
                <Text style={[s.chipText, isPicked && s.chipTextActive]}>{c}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={s.fieldLabel}>{t.trackingNum}</Text>
        <TextInput
          style={s.input}
          value={trackingValue}
          onChangeText={(v) => setTrackingInputs(prev => ({ ...prev, [r.id]: v }))}
          placeholder={t.enterTracking}
          placeholderTextColor={C.textDisabled}
          textAlign="left"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TouchableOpacity
          style={[s.btnPrimary, (Boolean(acting) || !trackingValue.trim()) && { opacity: 0.5 }]}
          disabled={Boolean(acting) || !trackingValue.trim()}
          onPress={() => submitDirectTracking(r)}
          activeOpacity={0.85}
        >
          {acting === 'shipping'
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.btnPrimaryText}>{t.sendTracking}</Text>}
        </TouchableOpacity>

        {!!r.buyer_id && (
          <TouchableOpacity
            style={s.btnLink}
            onPress={() => navigation.navigate('SInbox', { screen: 'Chat', params: { partnerId: r.buyer_id } })}
            activeOpacity={0.7}
          >
            <Text style={s.btnLinkText}>{t.chatBuyer}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  function renderActiveCard(r) {
    const productName = pickProductName(r.product, lang) || r.title_ar || r.title_en || '';
    const buyerName   = pickBuyerName(r.profiles, isAr ? 'تاجر' : lang === 'zh' ? '采购商' : 'Trader');
    const isArrived   = r.status === 'arrived';
    const carrier     = r.shipping_company || 'Other';
    const trackingNum = r.tracking_number || '';
    const trackUrl    = trackingNum ? getTrackingUrl(carrier, trackingNum) : null;
    const badgeText   = isArrived ? t.badge.arrived : t.badge.inTransit;
    const badgeColor  = isArrived ? C.blue : C.orange;

    return (
      <View key={`active-${r.id}`} style={[s.card, { borderColor: isArrived ? 'rgba(91,138,240,0.30)' : 'rgba(232,160,32,0.30)', backgroundColor: isArrived ? 'rgba(91,138,240,0.05)' : 'rgba(232,160,32,0.05)' }]}>
        <View style={s.cardTopRow}>
          <View style={s.cardTopLeft}>
            <Text style={[s.badge, { color: badgeColor, borderColor: badgeColor + '55', backgroundColor: 'transparent' }]}>{badgeText}</Text>
            <Text style={s.metaTime}>{fmtRelative(r.created_at, lang)}</Text>
          </View>
        </View>

        <Text style={s.productName}>{productName}</Text>
        <View style={s.metaRow}>
          <Text style={s.metaText}>{t.buyer}: {buyerName}</Text>
          <Text style={s.metaText}>{t.qty}: {r.quantity || '—'}</Text>
        </View>

        {!!trackingNum && (
          <View style={s.trackPanel}>
            <View style={s.trackRow}>
              <Text style={s.trackLabel}>{t.carrier}:</Text>
              <Text style={s.trackVal}>{carrier}</Text>
            </View>
            <View style={s.trackRow}>
              <Text style={s.trackLabel}>{t.trackingNum}:</Text>
              <Text style={[s.trackVal, { fontFamily: F.enSemi }]}>{trackingNum}</Text>
            </View>
            {trackUrl && (
              <TouchableOpacity onPress={() => Linking.openURL(trackUrl)} activeOpacity={0.7}>
                <Text style={s.trackBtnText}>{t.trackBtn}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  }

  function renderCompletedCard(r) {
    const productName = pickProductName(r.product, lang) || r.title_ar || r.title_en || '';
    const buyerName   = pickBuyerName(r.profiles, isAr ? 'تاجر' : lang === 'zh' ? '采购商' : 'Trader');
    const payment     = r.payment;
    const paymentAmount = payment ? Number(payment.amount || 0) : 0;
    const currency = r.product?.currency || 'USD';
    const deliveryDate = r.updated_at || payment?.created_at || r.created_at;

    return (
      <View key={`done-${r.id}`} style={[s.card, { borderColor: 'rgba(45,106,79,0.20)', backgroundColor: 'rgba(45,106,79,0.03)' }]}>
        <View style={s.cardTopRow}>
          <View style={s.cardTopLeft}>
            <Text style={[s.badge, { color: C.green, borderColor: 'rgba(45,106,79,0.28)', backgroundColor: 'rgba(45,106,79,0.10)' }]}>{t.badge.completed}</Text>
          </View>
          <View style={s.cardTopRight}>
            <Text style={s.metaCaption}>{t.deliveryDate}</Text>
            <Text style={s.metaSubVal}>{fmtRelative(deliveryDate, lang)}</Text>
            {paymentAmount > 0 && (
              <Text style={[s.amountLine, { direction: 'ltr' }]}>{paymentAmount.toFixed(2)} {currency}</Text>
            )}
          </View>
        </View>

        <Text style={s.productName}>{productName}</Text>
        <View style={s.metaRow}>
          <Text style={s.metaText}>{t.buyer}: {buyerName}</Text>
          <Text style={s.metaText}>{t.qty}: {r.quantity || '—'}</Text>
        </View>
      </View>
    );
  }

  function renderSection({ title, hint, loading, list, empty, renderer }) {
    return (
      <View style={s.section}>
        <Text style={s.sectionTitle}>{title}</Text>
        <Text style={s.sectionHint}>{hint}</Text>
        {loading ? (
          <View style={s.sectionLoading}>
            <ActivityIndicator color={C.textDisabled} />
          </View>
        ) : list.length === 0 ? (
          <Text style={s.emptyText}>{empty}</Text>
        ) : (
          list.map(renderer)
        )}
      </View>
    );
  }

  /* ── Render ──────────────────────────────────────────────────────── */

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.topBar}>
        <Text style={s.pageTitle}>{t.title}</Text>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.intro}>{t.intro}</Text>

        {renderSection({
          title:  t.secPending,
          hint:   t.secPendingHint,
          loading: loadingPending,
          list:    pendingOrders,
          empty:   t.emptyPending,
          renderer: renderPendingCard,
        })}

        {renderSection({
          title:  t.secPaid,
          hint:   t.secPaidHint,
          loading: loadingPaid,
          list:    paidOrders,
          empty:   t.emptyPaid,
          renderer: renderPaidCard,
        })}

        {renderSection({
          title:  t.secActive,
          hint:   t.secActiveHint,
          loading: loadingHistory,
          list:    shippingOrders,
          empty:   t.emptyActive,
          renderer: renderActiveCard,
        })}

        {renderSection({
          title:  t.secDone,
          hint:   t.secDoneHint,
          loading: loadingHistory,
          list:    completedOrders,
          empty:   t.emptyDone,
          renderer: renderCompletedCard,
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/* Styles                                                              */
/* ─────────────────────────────────────────────────────────────────── */
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bgBase },

  topBar: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: C.bgRaised,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
  },
  pageTitle: { fontFamily: F.arBold, fontSize: 17, color: C.textPrimary, textAlign: 'right' },

  scroll: { padding: 16, paddingBottom: 64, gap: 8 },
  intro: { fontFamily: F.ar, fontSize: 13, color: C.textSecondary, lineHeight: 22, textAlign: 'right', marginBottom: 8 },

  section: { marginTop: 18 },
  sectionTitle: { fontFamily: F.arBold, fontSize: 15, color: C.textPrimary, textAlign: 'right', marginBottom: 4 },
  sectionHint: { fontFamily: F.ar, fontSize: 12, color: C.textSecondary, lineHeight: 20, textAlign: 'right', marginBottom: 12 },
  sectionLoading: { paddingVertical: 16, alignItems: 'center' },
  emptyText: { fontFamily: F.ar, fontSize: 13, color: C.textDisabled, textAlign: 'center', paddingVertical: 22 },

  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  cardTopLeft:  { flex: 1, gap: 4, alignItems: 'flex-start' },
  cardTopRight: { alignItems: 'flex-end', gap: 2 },

  badge: {
    fontFamily: F.arSemi,
    fontSize: 11,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
  },

  metaTime: { fontFamily: F.ar, fontSize: 10, color: C.textDisabled },
  metaCaption: { fontFamily: F.ar, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: C.textDisabled },
  metaSubVal: { fontFamily: F.ar, fontSize: 12, color: C.textPrimary },

  productName: { fontFamily: F.arBold, fontSize: 14, color: C.textPrimary, marginTop: 2, marginBottom: 6, textAlign: 'right' },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8, justifyContent: 'flex-end' },
  metaText: { fontFamily: F.ar, fontSize: 12, color: C.textSecondary },

  amountLine: { fontFamily: F.enSemi, fontSize: 13, color: C.green, marginTop: 2 },

  countdownLabel: { fontFamily: F.enSemi, fontSize: 13 },

  descBody: {
    fontFamily: F.ar,
    fontSize: 12,
    color: C.textSecondary,
    backgroundColor: C.bgRaised,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    textAlign: 'right',
    lineHeight: 20,
  },

  fieldLabel: { fontFamily: F.ar, fontSize: 11, color: C.textSecondary, marginTop: 8, marginBottom: 6, textAlign: 'right' },

  chipRow: { gap: 6, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.borderMuted,
    backgroundColor: C.bgBase,
  },
  chipActive: { borderColor: C.btnPrimary, backgroundColor: C.btnPrimary },
  chipText: { fontFamily: F.enSemi, fontSize: 12, color: C.textSecondary },
  chipTextActive: { color: '#fff' },

  input: {
    fontFamily: F.enSemi,
    fontSize: 14,
    color: C.textPrimary,
    backgroundColor: C.bgBase,
    borderWidth: 1,
    borderColor: C.borderMuted,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    marginBottom: 10,
  },

  btnRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  btnPrimary: {
    flex: 1,
    backgroundColor: C.btnPrimary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  btnPrimaryText: { fontFamily: F.arBold, fontSize: 13, color: '#fff' },
  btnDanger: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderWidth: 1,
    borderColor: 'rgba(224,92,92,0.30)',
  },
  btnDangerText: { fontFamily: F.arBold, fontSize: 13, color: C.red },

  btnLink: {
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  btnLinkText: { fontFamily: F.ar, fontSize: 12, color: C.textSecondary },

  trackPanel: {
    backgroundColor: C.bgRaised,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    borderRadius: 8,
    padding: 12,
    marginTop: 6,
    gap: 6,
  },
  trackRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  trackLabel: { fontFamily: F.ar, fontSize: 12, color: C.textSecondary },
  trackVal: { fontFamily: F.ar, fontSize: 12, color: C.textPrimary, flexShrink: 1, textAlign: 'left' },
  trackBtnText: { fontFamily: F.arSemi, fontSize: 12, color: C.blue, textAlign: 'right', marginTop: 6 },
});
