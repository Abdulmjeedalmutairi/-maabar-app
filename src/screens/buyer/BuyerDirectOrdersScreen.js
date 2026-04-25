/**
 * BuyerDirectOrdersScreen — mobile mirror of the web "Direct Purchase Orders"
 * tab on src/pages/DashboardBuyer.jsx.
 *
 * Shows every request the buyer placed via direct purchase
 * (product_ref IS NOT NULL). Lifecycle states the buyer sees:
 *   • pending_supplier_confirmation — awaiting supplier (read-only)
 *   • supplier_confirmed             — Pay Now button
 *   • supplier_rejected              — declined notice + Browse Products
 *   • paid                           — paid, awaiting prep
 *   • shipping                       — tracking panel + Mark as Arrived
 *   • arrived                        — Confirm Delivery (with confirm prompt)
 *   • delivered                      — Completed badge with delivery date
 *
 * RFQ flows are NOT touched.
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image,
  StyleSheet, ActivityIndicator, RefreshControl, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase, SUPABASE_ANON_KEY, SEND_EMAIL_URL } from '../../lib/supabase';
import { getLang } from '../../lib/lang';
import { getTrackingUrl } from '../../lib/tracking';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';

/* ─────────────────────────────────────────────────────────────────── */
/* Copy                                                                */
/* ─────────────────────────────────────────────────────────────────── */
const COPY = {
  ar: {
    title: 'مشترياتي المباشرة',
    intro: 'الطلبات التي اشتريتها مباشرة من صفحات المنتجات. عند تأكيد المورد، تظهر هنا «ادفع الآن».',
    empty: 'لا توجد مشتريات مباشرة بعد',
    browseProducts: 'تصفح المنتجات',
    chatSupplier: 'تواصل مع المورد',
    viewProduct: 'عرض المنتج',

    badge: {
      pending:   'بانتظار تأكيد المورد',
      confirmed: 'تم التأكيد — ادفع الآن',
      rejected:  'رفض المورد',
      paid:      'تم الدفع — في انتظار التجهيز',
      shipping:  'في الطريق إليك',
      arrived:   'وصلت — أكد الاستلام',
      delivered: 'مكتمل ✓',
    },
    body: {
      pending:   'سيؤكد المورد طلبك خلال 24 ساعة. ستصلك إشعار فور الرد.',
      confirmed: 'أكد المورد جاهزيته لتنفيذ طلبك. أكمل الدفع الكامل ليبدأ بالتجهيز.',
      rejected:  'لم يتمكن المورد من تنفيذ طلبك. يمكنك تصفح موردين آخرين.',
      paid:      'تم استلام دفعتك. المورد سيبدأ التجهيز ويرسل رقم التتبع قريباً.',
      shipping:  'الشحنة في الطريق. تابع رقم التتبع، وأكد الاستلام عند الوصول.',
      arrived:   'وصلت الشحنة. عند فحصها وتأكيد سلامتها، أكد الاستلام لتحرير المبلغ للمورد.',
      delivered: (when) => `تم التسليم بنجاح ${when}. تم تحويل المبلغ للمورد.`,
    },

    buyer: 'المورد',
    qty: 'الكمية',
    total: 'الإجمالي',

    payNow: 'ادفع الآن ←',
    markArrived: 'تم استلام الشحنة',
    confirmDelivery: 'تأكيد الاستلام',
    completedAt: 'مكتمل',

    trackingPanel: 'تتبع الشحنة',
    carrier: 'شركة الشحن',
    trackingNum: 'رقم التتبع',
    trackBtn: 'تتبع الشحنة ↗',

    confirmDeliveryTitle: 'تأكيد استلام البضاعة؟',
    confirmDeliveryBody:  'سيتم تحرير المبلغ للمورد ولا يمكن التراجع.',
    yesConfirm: 'نعم، أكد',
    cancelBtn: 'إلغاء',

    errorAction: 'تعذّر تنفيذ العملية — حاول مرة أخرى',
    errorPay: 'تعذّر تجهيز الدفع — حاول إعادة تحميل الصفحة',
    errorPayPrecondition: 'لا يمكن الدفع قبل تأكيد المورد',
  },
  en: {
    title: 'My Direct Purchases',
    intro: 'Orders you placed directly from product pages. When the supplier confirms, "Pay Now" appears here.',
    empty: 'No direct purchases yet',
    browseProducts: 'Browse Products',
    chatSupplier: 'Chat with Supplier',
    viewProduct: 'View Product',

    badge: {
      pending:   'Awaiting Supplier',
      confirmed: 'Confirmed — Pay Now',
      rejected:  'Supplier Declined',
      paid:      'Paid — Awaiting Preparation',
      shipping:  'On the Way',
      arrived:   'Arrived — Confirm Delivery',
      delivered: 'Completed ✓',
    },
    body: {
      pending:   'The supplier will confirm within 24 hours. You will be notified once they respond.',
      confirmed: 'Supplier confirmed. Pay the full amount to start preparation.',
      rejected:  'The supplier could not fulfill this order. You can browse other suppliers.',
      paid:      'Payment received. The supplier will prepare your order and share tracking shortly.',
      shipping:  'Your shipment is on the way. Track it below and mark it as arrived once it lands.',
      arrived:   'The shipment arrived. After inspection, confirm delivery to release the payment to the supplier.',
      delivered: (when) => `Delivered ${when}. Payout has been released to the supplier.`,
    },

    buyer: 'Supplier',
    qty: 'Qty',
    total: 'Total',

    payNow: 'Pay Now →',
    markArrived: 'Mark as Arrived',
    confirmDelivery: 'Confirm Delivery',
    completedAt: 'Completed',

    trackingPanel: 'Shipment Tracking',
    carrier: 'Carrier',
    trackingNum: 'Tracking #',
    trackBtn: 'Track Shipment ↗',

    confirmDeliveryTitle: 'Confirm delivery?',
    confirmDeliveryBody:  'This will release the payment to the supplier and cannot be undone.',
    yesConfirm: 'Yes, confirm',
    cancelBtn: 'Cancel',

    errorAction: 'Could not perform this action — try again',
    errorPay: 'Could not prepare payment — try refreshing',
    errorPayPrecondition: 'Cannot pay before the supplier confirms',
  },
  zh: {
    title: '我的直接采购',
    intro: '您从产品页面直接下单的采购订单。供应商确认后，此处会出现「立即付款」。',
    empty: '暂无直接采购订单',
    browseProducts: '浏览产品',
    chatSupplier: '联系供应商',
    viewProduct: '查看产品',

    badge: {
      pending:   '等待供应商确认',
      confirmed: '已确认 — 请立即付款',
      rejected:  '供应商已拒绝',
      paid:      '已付款 — 等待备货',
      shipping:  '运输中',
      arrived:   '已到货 — 请确认收货',
      delivered: '已完成 ✓',
    },
    body: {
      pending:   '供应商将在 24 小时内确认订单，回复后您会收到通知。',
      confirmed: '供应商已确认接单。请完成全额付款，供应商将立即开始备货。',
      rejected:  '供应商无法接受此订单。您可以浏览其他供应商。',
      paid:      '已收到您的付款。供应商将开始备货，并尽快提供物流单号。',
      shipping:  '货物正在运送途中。请使用物流单号跟踪，到货后请确认。',
      arrived:   '货物已到达。检查无误后请确认收货，款项将放给供应商。',
      delivered: (when) => `订单已于 ${when} 完成交付，款项已放给供应商。`,
    },

    buyer: '供应商',
    qty: '数量',
    total: '总计',

    payNow: '立即付款 →',
    markArrived: '已收到货物',
    confirmDelivery: '确认收货',
    completedAt: '已完成',

    trackingPanel: '物流跟踪',
    carrier: '承运商',
    trackingNum: '物流单号',
    trackBtn: '查看跟踪 ↗',

    confirmDeliveryTitle: '确认收货？',
    confirmDeliveryBody:  '款项将放给供应商，此操作不可撤销。',
    yesConfirm: '确认收货',
    cancelBtn: '取消',

    errorAction: '无法完成操作 — 请重试',
    errorPay: '无法准备付款 — 请刷新页面后重试',
    errorPayPrecondition: '供应商确认前无法付款',
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

function pickSupplierName(profiles, fallback) {
  return profiles?.company_name || profiles?.full_name || fallback || '';
}

function fmtRelative(dateStr, lang) {
  if (!dateStr) return '—';
  const diffSec = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diffSec < 60) return lang === 'ar' ? 'الآن' : lang === 'zh' ? '刚刚' : 'just now';
  if (diffSec < 3600) {
    const m = Math.floor(diffSec / 60);
    return lang === 'ar' ? `${m} د` : lang === 'zh' ? `${m} 分钟前` : `${m}m ago`;
  }
  if (diffSec < 86400) {
    const h = Math.floor(diffSec / 3600);
    return lang === 'ar' ? `${h} س` : lang === 'zh' ? `${h} 小时前` : `${h}h ago`;
  }
  const d = Math.floor(diffSec / 86400);
  return lang === 'ar' ? `${d} ي` : lang === 'zh' ? `${d} 天前` : `${d}d ago`;
}

function getPrimaryProductImage(product) {
  if (!product) return null;
  const gallery = Array.isArray(product.gallery_images) ? product.gallery_images : [];
  const legacy = product.image_url ? [product.image_url] : [];
  const merged = [...new Set([...gallery, ...legacy].filter(Boolean))];
  return merged[0] || null;
}

const SAR_PER_USD = 3.75;

/* ─────────────────────────────────────────────────────────────────── */
/* Screen                                                              */
/* ─────────────────────────────────────────────────────────────────── */

export default function BuyerDirectOrdersScreen({ navigation }) {
  const lang = getLang();
  const t = COPY[lang] || COPY.ar;

  const [directOrders, setDirectOrders] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [actioning, setActioning]       = useState({});

  /* ── Loader (mirrors web loadMyDirectOrders) ─────────────────────── */
  const loadMyDirectOrders = useCallback(async () => {
    const userRes = await supabase.auth.getUser();
    console.log('[BDirectOrders.loadMyDirectOrders] auth.getUser response:', userRes);
    const user = userRes.data?.user;
    if (!user) { setDirectOrders([]); setLoading(false); return; }

    const ordersRes = await supabase
      .from('requests')
      .select('*')
      .eq('buyer_id', user.id)
      .not('product_ref', 'is', null)
      .order('created_at', { ascending: false });
    console.log('[BDirectOrders.loadMyDirectOrders] requests query response:', ordersRes);

    const refIds = [...new Set((ordersRes.data || []).map(r => r.product_ref).filter(Boolean))];
    if (refIds.length === 0) {
      setDirectOrders(ordersRes.data || []);
      setLoading(false);
      return;
    }

    const productsRes = await supabase
      .from('products')
      .select('id, supplier_id, name_ar, name_en, name_zh, price_from, currency, spec_lead_time_days, gallery_images, image_url')
      .in('id', refIds);
    console.log('[BDirectOrders.loadMyDirectOrders] products query response:', productsRes);

    const supplierIds = [...new Set((productsRes.data || []).map(p => p.supplier_id).filter(Boolean))];
    const profilesRes = supplierIds.length
      ? await supabase.from('profiles').select('id, company_name, full_name, status').in('id', supplierIds)
      : { data: [], error: null };
    console.log('[BDirectOrders.loadMyDirectOrders] profiles query response:', profilesRes);
    const profileById = (profilesRes.data || []).reduce((acc, p) => { acc[p.id] = p; return acc; }, {});

    const productsById = (productsRes.data || []).reduce((acc, p) => {
      acc[p.id] = { ...p, profiles: profileById[p.supplier_id] || null };
      return acc;
    }, {});

    setDirectOrders((ordersRes.data || []).map(r => ({
      ...r,
      product: productsById[r.product_ref] || null,
    })));
    setLoading(false);
  }, []);

  /* ── Lifecycle ───────────────────────────────────────────────────── */
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadMyDirectOrders();
    }, [loadMyDirectOrders])
  );

  async function onRefresh() {
    setRefreshing(true);
    await loadMyDirectOrders();
    setRefreshing(false);
  }

  /* ── payDirectOrder (Step 4 entry — full-payment Moyasar) ───────── */
  function payDirectOrder(request) {
    if (!request?.id || !request?.product) {
      Alert.alert('', t.errorPay);
      return;
    }
    if (request.status !== 'supplier_confirmed') {
      Alert.alert('', t.errorPayPrecondition);
      return;
    }

    const product = request.product;
    const supplierId = product.supplier_id;
    const qty = Number(request.quantity) || 1;
    const unitPriceUsd = Number(product.price_from || 0);
    const totalUsd = unitPriceUsd * qty;
    const amountSAR = parseFloat((totalUsd * SAR_PER_USD).toFixed(2));

    console.log('[BDirectOrders.payDirectOrder] navigating to Payment with:', {
      requestId: request.id,
      supplierId,
      isDirect: true,
      productRef: product.id,
      paymentPct: 100,
      offerPriceUsd: totalUsd,
      amountSAR,
    });

    // type='offer' triggers PaymentScreen's existing "promote request to paid"
    // path; with paymentPct=100, payment_second resolves to 0. Step 4 will add
    // the isDirect branch so direct-purchase rows also get the
    // direct_order_paid_supplier / direct_order_paid_buyer emails and the
    // "Full payment received" notification wording.
    navigation.navigate('Payment', {
      type: 'offer',
      requestId: request.id,
      supplierId,
      paymentPct: 100,
      offerPriceUsd: totalUsd,
      amount: amountSAR,
      isDirect: true,
      productRef: product.id,
    });
  }

  /* ── Mark as Arrived (Step 6) ────────────────────────────────────── */
  async function markDirectOrderArrived(request) {
    if (!request?.id || !request?.product?.supplier_id) {
      Alert.alert('', t.errorAction);
      return;
    }
    setActioning(prev => ({ ...prev, [request.id]: 'marking_arrived' }));

    const supplierId  = request.product.supplier_id;
    const productName = pickProductName(request.product, lang) || request.title_ar || request.title_en || '';

    const updRes = await supabase
      .from('requests')
      .update({ status: 'arrived', shipping_status: 'arrived' })
      .eq('id', request.id)
      .select()
      .single();
    console.log('[BDirectOrders.markDirectOrderArrived] update response:', updRes);
    if (updRes.error) {
      setActioning(prev => ({ ...prev, [request.id]: null }));
      Alert.alert('', t.errorAction);
      return;
    }

    const notifRes = await supabase.from('notifications').insert({
      user_id: supplierId,
      type: 'arrived',
      title_ar: `استلم التاجر الشحنة — ${productName}`,
      title_en: `Buyer marked shipment arrived — ${productName}`,
      title_zh: `买家已收到货物 — ${productName}`,
      ref_id: request.id,
      is_read: false,
    }).select().single();
    console.log('[BDirectOrders.markDirectOrderArrived] notification response:', notifRes);

    try {
      const r = await fetch(SEND_EMAIL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({
          type: 'direct_order_arrived',
          data: { recipientUserId: supplierId, productName, trackingNumber: request.tracking_number || '' },
        }),
      });
      const body = await r.json().catch(() => null);
      console.log('[BDirectOrders.markDirectOrderArrived] email response:', { status: r.status, body });
    } catch (emailError) {
      console.error('[BDirectOrders.markDirectOrderArrived] email error:', emailError);
    }

    setActioning(prev => ({ ...prev, [request.id]: null }));
    loadMyDirectOrders();
  }

  /* ── Confirm Delivery (Step 6) ────────────────────────────────────── */
  function confirmDirectDelivery(request) {
    if (!request?.id || !request?.product?.supplier_id) {
      Alert.alert('', t.errorAction);
      return;
    }
    Alert.alert(
      t.confirmDeliveryTitle,
      t.confirmDeliveryBody,
      [
        { text: t.cancelBtn, style: 'cancel' },
        { text: t.yesConfirm, style: 'destructive', onPress: () => doConfirmDirectDelivery(request) },
      ],
    );
  }

  async function doConfirmDirectDelivery(request) {
    setActioning(prev => ({ ...prev, [request.id]: 'confirming_delivery' }));

    const supplierId   = request.product.supplier_id;
    const supplierName = request.product.profiles?.company_name || request.product.profiles?.full_name || 'Supplier';
    const productName  = pickProductName(request.product, lang) || request.title_ar || request.title_en || '';

    const updRes = await supabase
      .from('requests')
      .update({ status: 'delivered', shipping_status: 'delivered' })
      .eq('id', request.id)
      .select()
      .single();
    console.log('[BDirectOrders.confirmDirectDelivery] update response:', updRes);
    if (updRes.error) {
      setActioning(prev => ({ ...prev, [request.id]: null }));
      Alert.alert('', t.errorAction);
      return;
    }

    const userRes = await supabase.auth.getUser();
    console.log('[BDirectOrders.confirmDirectDelivery] auth.getUser response:', userRes);
    const user = userRes.data?.user;

    const paymentLookupRes = await supabase
      .from('payments')
      .select('id, amount')
      .eq('request_id', request.id)
      .eq('buyer_id', user?.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    console.log('[BDirectOrders.confirmDirectDelivery] payments lookup response:', paymentLookupRes);

    let payoutAmount = 0;
    if (paymentLookupRes.data?.id) {
      payoutAmount = Number(paymentLookupRes.data.amount || 0);
      const payUpdRes = await supabase
        .from('payments')
        .update({ status: 'completed' })
        .eq('id', paymentLookupRes.data.id)
        .select()
        .single();
      console.log('[BDirectOrders.confirmDirectDelivery] payments update response:', payUpdRes);
    }

    const notifRes = await supabase.from('notifications').insert({
      user_id: supplierId,
      type: 'delivery_confirmed',
      title_ar: `أكد التاجر الاستلام — سيتم تحويل المبلغ خلال 24 ساعة (${productName})`,
      title_en: `Buyer confirmed delivery — payout within 24h (${productName})`,
      title_zh: `买家已确认收货 — 24 小时内放款 (${productName})`,
      ref_id: request.id,
      is_read: false,
    }).select().single();
    console.log('[BDirectOrders.confirmDirectDelivery] notification response:', notifRes);

    try {
      const r = await fetch(SEND_EMAIL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({
          type: 'payout_initiated',
          data: { recipientUserId: supplierId, name: supplierName, amount: payoutAmount },
        }),
      });
      const body = await r.json().catch(() => null);
      console.log('[BDirectOrders.confirmDirectDelivery] email response:', { status: r.status, body });
    } catch (emailError) {
      console.error('[BDirectOrders.confirmDirectDelivery] email error:', emailError);
    }

    setActioning(prev => ({ ...prev, [request.id]: null }));
    loadMyDirectOrders();
  }

  /* ── Per-status visual block ─────────────────────────────────────── */
  function getStatusInfo(status, updatedAt) {
    if (status === 'pending_supplier_confirmation') return {
      label: t.badge.pending, body: t.body.pending,
      color: C.orange, bg: 'rgba(232,160,32,0.05)', border: 'rgba(232,160,32,0.30)',
    };
    if (status === 'supplier_confirmed') return {
      label: t.badge.confirmed, body: t.body.confirmed,
      color: C.green, bg: 'rgba(45,106,79,0.06)', border: 'rgba(45,106,79,0.35)',
    };
    if (status === 'supplier_rejected') return {
      label: t.badge.rejected, body: t.body.rejected,
      color: C.red, bg: 'rgba(224,92,92,0.05)', border: 'rgba(224,92,92,0.30)',
    };
    if (status === 'paid') return {
      label: t.badge.paid, body: t.body.paid,
      color: C.green, bg: 'rgba(45,106,79,0.05)', border: 'rgba(45,106,79,0.25)',
    };
    if (status === 'shipping') return {
      label: t.badge.shipping, body: t.body.shipping,
      color: C.orange, bg: 'rgba(232,160,32,0.05)', border: 'rgba(232,160,32,0.30)',
    };
    if (status === 'arrived') return {
      label: t.badge.arrived, body: t.body.arrived,
      color: C.blue, bg: 'rgba(91,138,240,0.05)', border: 'rgba(91,138,240,0.30)',
    };
    if (status === 'delivered') return {
      label: t.badge.delivered, body: t.body.delivered(fmtRelative(updatedAt, lang)),
      color: C.green, bg: 'rgba(45,106,79,0.04)', border: 'rgba(45,106,79,0.25)',
    };
    return {
      label: status, body: '',
      color: C.textDisabled, bg: C.bgSubtle, border: C.borderSubtle,
    };
  }

  /* ── Card ────────────────────────────────────────────────────────── */
  function renderCard(r) {
    const product       = r.product || {};
    const productName   = pickProductName(product, lang);
    const supplierName  = pickSupplierName(product.profiles, lang === 'ar' ? 'مورد' : lang === 'zh' ? '供应商' : 'Supplier');
    const productImage  = getPrimaryProductImage(product);
    const unitPrice     = Number(product.price_from || 0);
    const currency      = product.currency || 'USD';
    const qty           = Number(r.quantity || 0);
    const totalEst      = unitPrice * qty;
    const status        = r.status;
    const info          = getStatusInfo(status, r.updated_at);
    const acting        = actioning[r.id];
    const showTracking  = !!r.tracking_number && ['shipping', 'arrived', 'delivered'].includes(status);

    return (
      <View key={r.id} style={[s.card, { borderColor: info.border, backgroundColor: info.bg }]}>
        {/* Top row: thumbnail + product info */}
        <View style={s.cardTopRow}>
          {productImage && (
            <Image source={{ uri: productImage }} style={s.thumb} />
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={s.badgeRow}>
              <Text style={[s.badge, { color: info.color, borderColor: info.color + '55' }]}>{info.label}</Text>
              <Text style={s.metaTime}>{fmtRelative(r.created_at, lang)}</Text>
            </View>
            <Text style={s.productName}>{productName || (lang === 'ar' ? 'منتج' : 'Product')}</Text>
            <View style={s.metaRow}>
              <Text style={s.metaText}>{t.buyer}: {supplierName}</Text>
              <Text style={s.metaText}>{t.qty}: {qty || '—'}</Text>
              {unitPrice > 0 && (
                <Text style={[s.metaText, { direction: 'ltr' }]}>{unitPrice.toFixed(2)} {currency} / unit</Text>
              )}
              {totalEst > 0 && (
                <Text style={[s.metaText, { direction: 'ltr', fontFamily: F.enSemi, color: C.textPrimary }]}>
                  {t.total}: {totalEst.toFixed(2)} {currency}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Body */}
        {!!info.body && <Text style={s.body}>{info.body}</Text>}

        {/* Tracking panel */}
        {showTracking && (() => {
          const carrier = r.shipping_company || 'Other';
          const trackUrl = getTrackingUrl(carrier, r.tracking_number);
          return (
            <View style={s.trackPanel}>
              <Text style={s.trackPanelTitle}>{t.trackingPanel}</Text>
              <View style={s.trackRow}>
                <Text style={s.trackLabel}>{t.carrier}:</Text>
                <Text style={s.trackVal}>{carrier}</Text>
              </View>
              <View style={s.trackRow}>
                <Text style={s.trackLabel}>{t.trackingNum}:</Text>
                <Text style={[s.trackVal, { fontFamily: F.enSemi }]}>{r.tracking_number}</Text>
              </View>
              <TouchableOpacity onPress={() => Linking.openURL(trackUrl)} activeOpacity={0.7}>
                <Text style={s.trackBtnText}>{t.trackBtn}</Text>
              </TouchableOpacity>
            </View>
          );
        })()}

        {/* CTAs */}
        <View style={s.btnRow}>
          {status === 'supplier_confirmed' && (
            <TouchableOpacity
              style={[s.btnPrimary, !product?.supplier_id && { opacity: 0.5 }]}
              disabled={!product?.supplier_id}
              onPress={() => payDirectOrder(r)}
              activeOpacity={0.85}
            >
              <Text style={s.btnPrimaryText}>{t.payNow}</Text>
            </TouchableOpacity>
          )}
          {status === 'shipping' && (
            <TouchableOpacity
              style={[s.btnPrimary, (Boolean(acting) || !product?.supplier_id) && { opacity: 0.5 }]}
              disabled={Boolean(acting) || !product?.supplier_id}
              onPress={() => markDirectOrderArrived(r)}
              activeOpacity={0.85}
            >
              {acting === 'marking_arrived'
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.btnPrimaryText}>{t.markArrived}</Text>}
            </TouchableOpacity>
          )}
          {status === 'arrived' && (
            <TouchableOpacity
              style={[s.btnSuccess, (Boolean(acting) || !product?.supplier_id) && { opacity: 0.5 }]}
              disabled={Boolean(acting) || !product?.supplier_id}
              onPress={() => confirmDirectDelivery(r)}
              activeOpacity={0.85}
            >
              {acting === 'confirming_delivery'
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.btnPrimaryText}>{t.confirmDelivery}</Text>}
            </TouchableOpacity>
          )}
          {status === 'delivered' && (
            <View style={s.completedBadge}>
              <Text style={s.completedBadgeText}>
                ✓ {t.completedAt} · {fmtRelative(r.updated_at, lang)}
              </Text>
            </View>
          )}
          {status === 'supplier_rejected' && (
            <TouchableOpacity
              style={s.btnOutline}
              onPress={() => navigation.navigate('Home', { screen: 'Products' })}
              activeOpacity={0.85}
            >
              <Text style={s.btnOutlineText}>{t.browseProducts}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Secondary links */}
        <View style={s.linkRow}>
          {!!product?.supplier_id && status !== 'supplier_rejected' && status !== 'delivered' && (
            <TouchableOpacity
              onPress={() => navigation.navigate('Inbox', { screen: 'Chat', params: { partnerId: product.supplier_id } })}
              activeOpacity={0.7}
            >
              <Text style={s.linkText}>{t.chatSupplier}</Text>
            </TouchableOpacity>
          )}
          {!!product?.id && (
            <TouchableOpacity
              onPress={() => navigation.navigate('Home', { screen: 'ProductDetail', params: { productId: product.id } })}
              activeOpacity={0.7}
            >
              <Text style={s.linkText}>{t.viewProduct}</Text>
            </TouchableOpacity>
          )}
        </View>
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

        {loading ? (
          <View style={s.centerBlock}>
            <ActivityIndicator color={C.textDisabled} />
          </View>
        ) : directOrders.length === 0 ? (
          <View style={s.centerBlock}>
            <Text style={s.emptyText}>{t.empty}</Text>
            <TouchableOpacity
              style={s.btnOutline}
              onPress={() => navigation.navigate('Home', { screen: 'Products' })}
              activeOpacity={0.85}
            >
              <Text style={s.btnOutlineText}>{t.browseProducts}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          directOrders.map(renderCard)
        )}
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

  centerBlock: { paddingVertical: 48, alignItems: 'center', gap: 12 },
  emptyText: { fontFamily: F.ar, fontSize: 14, color: C.textDisabled, textAlign: 'center' },

  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },

  cardTopRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: C.bgSubtle,
  },

  badgeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' },
  badge: {
    fontFamily: F.arSemi,
    fontSize: 11,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: C.bgRaised,
    overflow: 'hidden',
  },
  metaTime: { fontFamily: F.ar, fontSize: 10, color: C.textDisabled },

  productName: { fontFamily: F.arBold, fontSize: 15, color: C.textPrimary, marginBottom: 4, textAlign: 'right' },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end' },
  metaText: { fontFamily: F.ar, fontSize: 12, color: C.textSecondary },

  body: {
    fontFamily: F.ar,
    fontSize: 13,
    color: C.textSecondary,
    lineHeight: 22,
    textAlign: 'right',
    marginBottom: 10,
  },

  trackPanel: {
    backgroundColor: C.bgRaised,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    gap: 6,
  },
  trackPanelTitle: { fontFamily: F.arSemi, fontSize: 10, letterSpacing: 1, color: C.textDisabled, textAlign: 'right', textTransform: 'uppercase' },
  trackRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  trackLabel: { fontFamily: F.ar, fontSize: 12, color: C.textSecondary },
  trackVal: { fontFamily: F.ar, fontSize: 12, color: C.textPrimary, flexShrink: 1, textAlign: 'left' },
  trackBtnText: { fontFamily: F.arSemi, fontSize: 12, color: C.blue, textAlign: 'right', marginTop: 4 },

  btnRow: { flexDirection: 'row', gap: 8 },
  btnPrimary: {
    flex: 1,
    backgroundColor: C.btnPrimary,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  btnPrimaryText: { fontFamily: F.arBold, fontSize: 14, color: '#fff' },
  btnSuccess: {
    flex: 1,
    backgroundColor: C.green,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  btnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: C.borderMuted,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  btnOutlineText: { fontFamily: F.ar, fontSize: 13, color: C.textSecondary },

  completedBadge: {
    flex: 1,
    backgroundColor: 'rgba(45,106,79,0.10)',
    borderColor: 'rgba(45,106,79,0.30)',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  completedBadgeText: {
    fontFamily: F.arSemi,
    fontSize: 13,
    color: C.green,
  },

  linkRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 16, marginTop: 10 },
  linkText: { fontFamily: F.ar, fontSize: 12, color: C.textSecondary, textDecorationLine: 'underline' },
});
