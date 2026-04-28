import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal, TextInput,
  StyleSheet, ActivityIndicator, Alert, Linking, Platform,
  KeyboardAvoidingView, Keyboard, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase, SUPABASE_ANON_KEY, SEND_EMAIL_URL } from '../../lib/supabase';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';
import { getLang } from '../../lib/lang';

const tx = (ar, en) => getLang() === 'ar' ? ar : en;

const STATUS_AR = { open: 'مرفوع', offers_received: 'عروض وصلت', closed: 'عرض مقبول', supplier_confirmed: 'المورد جاهز', paid: 'تم الدفع', ready_to_ship: 'الشحنة جاهزة', shipping: 'قيد الشحن', arrived: 'وصل السعودية', delivered: 'تم التسليم' };
const STATUS_EN = { open: 'Posted', offers_received: 'Offers In', closed: 'Accepted', supplier_confirmed: 'Supplier Ready', paid: 'Paid', ready_to_ship: 'Ready to Ship', shipping: 'Shipping', arrived: 'Arrived', delivered: 'Delivered' };
const STATUS_COLOR = {
  open: C.blue, offers_received: C.green, closed: C.green,
  supplier_confirmed: C.green, paid: C.green, ready_to_ship: C.orange,
  shipping: C.orange, arrived: C.green, delivered: C.green,
};

function getTrackingUrl(company, num) {
  const urls = { DHL: `https://www.dhl.com/track?tracking-id=${num}`, FedEx: `https://www.fedex.com/tracking?tracknumbers=${num}`, Aramex: `https://www.aramex.com/track/${num}`, UPS: `https://www.ups.com/track?tracknum=${num}`, SMSA: `https://www.smsaexpress.com/track?awbno=${num}` };
  return urls[company] || `https://t.17track.net/en#nums=${num}`;
}

/* ── StatusTimeline ─────────────────────────────────────────── */
const TIMELINE_STEPS = [
  { key: 'posted',    ar: 'رفع الطلب',     en: 'Posted'     },
  { key: 'accepted',  ar: 'قبول العرض',    en: 'Accepted'   },
  { key: 'paid',      ar: 'الدفعة الأولى', en: '1st Pay'    },
  { key: 'producing', ar: 'الإنتاج',       en: 'Production' },
  { key: 'shipping',  ar: 'الشحن',         en: 'Shipping'   },
  { key: 'received',  ar: 'الاستلام',      en: 'Received'   },
];

function timelineIndex(status, shippingStatus) {
  // Only advance to shipping/received when shipping_status is explicitly set to a known value
  if (shippingStatus === 'delivered') return 5;
  if (shippingStatus === 'arrived' || shippingStatus === 'shipped') return 4;
  const map = { open: 0, offers_received: 0, closed: 1, paid: 2, supplier_confirmed: 3, ready_to_ship: 3, shipping: 4, arrived: 4, delivered: 5 };
  return map[status] ?? 0;
}

function StatusTimeline({ status, shippingStatus }) {
  const lang    = getLang();
  const current = timelineIndex(status, shippingStatus);
  return (
    <View style={{ marginBottom: 20 }}>
      <View style={{ flexDirection: lang === 'ar' ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
        {TIMELINE_STEPS.map((step, i) => {
          const done   = i < current;
          const active = i === current;
          const isLast = i === TIMELINE_STEPS.length - 1;
          return (
            <React.Fragment key={step.key}>
              <View style={{ alignItems: 'center', minWidth: 36 }}>
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
                  maxWidth: 40, lineHeight: 11,
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

/* ── PaymentBadge ───────────────────────────────────────────── */
function PaymentBadge({ label, amount, currency, badgeState }) {
  const colors = {
    paid:    { bg: 'rgba(90,154,114,0.07)', border: 'rgba(90,154,114,0.3)',  text: '#5a9a72' },
    due:     { bg: 'rgba(180,120,30,0.07)', border: 'rgba(180,120,30,0.3)',  text: '#b4781e' },
    pending: { bg: C.bgOverlay,             border: C.borderSubtle,           text: C.textDisabled },
  };
  const c = colors[badgeState] || colors.pending;
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: c.border, backgroundColor: c.bg, minWidth: 110 }}>
      <Text style={{ fontSize: 9, letterSpacing: 0.8, color: c.text, marginBottom: 3, fontFamily: F.arSemi }}>{label}</Text>
      <Text style={{ fontSize: 15, color: c.text, fontFamily: F.num }}>
        {amount > 0 ? Number(amount).toFixed(0) : '—'}
        <Text style={{ fontSize: 9, color: C.textDisabled }}> {currency}</Text>
      </Text>
      {badgeState === 'paid'    && <Text style={{ fontSize: 9, color: c.text, marginTop: 2, fontFamily: F.ar }}>✓ مدفوع</Text>}
      {badgeState === 'due'     && <Text style={{ fontSize: 9, color: c.text, marginTop: 2, fontFamily: F.ar }}>مطلوبة الآن</Text>}
      {badgeState === 'pending' && <Text style={{ fontSize: 9, color: C.textDisabled, marginTop: 2, fontFamily: F.ar }}>بعد الشحن</Text>}
    </View>
  );
}

/* ── Screen ─────────────────────────────────────────────────── */
export default function OrderDetailScreen({ navigation, route }) {
  const { requestId } = route.params || {};

  const [request, setRequest]     = useState(null);
  const [offer, setOffer]         = useState(null);
  const [userId, setUserId]       = useState(null);
  const [loading, setLoading]     = useState(true);

  const [reviewModal, setReviewModal]         = useState(false);
  const [reviewRating, setReviewRating]       = useState(0);
  const [reviewComment, setReviewComment]     = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) { setLoading(false); return; }
    setUserId(user.id);

    const { data: req, error: reqErr } = await supabase
      .from('requests')
      .select('*')
      .eq('id', requestId)
      .single();
    if (reqErr || !req) { setLoading(false); return; }
    setRequest(req);

    const { data: offerData } = await supabase
      .from('offers')
      .select('*, profiles(company_name, full_name, verified, maabar_supplier_id, rating, reviews_count)')
      .eq('request_id', requestId)
      .eq('status', 'accepted')
      .maybeSingle();
    setOffer(offerData || null);
    setLoading(false);
  }, [requestId]);

  useEffect(() => {
    load();
    const channel = supabase.channel(`order-detail-${requestId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'requests', filter: `id=eq.${requestId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, requestId]);

  /* ── Action handlers ────────────────────────────────────── */
  async function handleCancelRequest() {
    if (!request) return;
    Alert.alert(
      tx('إلغاء الطلب', 'Cancel Request'),
      tx('هل أنت متأكد من إلغاء هذا الطلب؟ الطلبات التي تم الدفع عليها لا يمكن ردّ مبالغها.', 'Are you sure you want to cancel? Paid orders are non-refundable.'),
      [
        { text: tx('لا', 'No'), style: 'cancel' },
        {
          text: tx('نعم، إلغاء', 'Yes, Cancel'), style: 'destructive',
          onPress: async () => {
            await supabase.from('requests').update({ status: 'open' }).eq('id', requestId);
            if (offer) {
              const nameAr = request.title_ar || request.title_en || '';
              const nameEn = request.title_en || request.title_ar || '';
              await supabase.from('offers').update({ status: 'rejected' }).eq('id', offer.id);
              await supabase.from('notifications').insert({ user_id: offer.supplier_id, type: 'request_cancelled', title_ar: `قام التاجر بإلغاء الطلب: ${nameAr}`, title_en: `The trader has cancelled the request: ${nameEn}`, ref_id: requestId, is_read: false });
              if (userId) await supabase.from('messages').insert({
                sender_id: userId,
                receiver_id: offer.supplier_id,
                content: JSON.stringify({
                  ar: `قام التاجر بإلغاء الطلب: ${nameAr}`,
                  en: `The trader has cancelled the request: ${nameEn}`,
                  zh: `采购商已取消请求: ${nameEn}`,
                }),
                message_type: 'system',
                is_read: false,
              });
            }
            navigation.goBack();
          },
        },
      ]
    );
  }

  async function handleMarkArrived() {
    if (!request) return;
    Alert.alert(
      tx('تأكيد الوصول', 'Confirm Arrival'),
      tx('هل وصلت البضاعة إلى السعودية؟', 'Has the shipment arrived in Saudi Arabia?'),
      [
        { text: tx('إلغاء', 'Cancel'), style: 'cancel' },
        {
          text: tx('نعم، وصل', 'Yes, Arrived'),
          onPress: async () => {
            await supabase.from('requests').update({ status: 'arrived', shipping_status: 'arrived' }).eq('id', requestId);
            load();
          },
        },
      ]
    );
  }

  async function handleConfirmDelivery() {
    if (!request) return;
    Alert.alert(
      tx('تأكيد الاستلام', 'Confirm Delivery'),
      tx('هل استلمت البضاعة كما هو متفق عليه؟', 'Did you receive the goods as agreed?'),
      [
        { text: tx('إلغاء', 'Cancel'), style: 'cancel' },
        {
          text: tx('نعم، تأكيد', 'Yes, Confirm'),
          onPress: async () => {
            const supplierName = offer?.profiles?.company_name || offer?.profiles?.full_name || 'Supplier';
            await supabase.from('requests').update({ status: 'delivered', shipping_status: 'delivered' }).eq('id', requestId);
            const { data: paymentData } = await supabase.from('payments').select('id, amount').eq('request_id', requestId).eq('buyer_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle();
            if (paymentData) await supabase.from('payments').update({ status: 'completed' }).eq('id', paymentData.id);
            if (offer?.supplier_id) {
              await supabase.from('notifications').insert({ user_id: offer.supplier_id, type: 'delivery_confirmed', title_ar: 'التاجر أكد الاستلام — سيتم تحويل المبلغ خلال 24 ساعة', title_en: 'Buyer confirmed delivery — payout will be processed within 24h', ref_id: requestId, is_read: false });
              try {
                await fetch(SEND_EMAIL_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_ANON_KEY}` }, body: JSON.stringify({ type: 'payout_initiated', data: { recipientUserId: offer.supplier_id, name: supplierName, amount: paymentData?.amount || 0 } }) });
              } catch (e) { console.error('[OrderDetail] payout email error:', e); }
            }
            load();
            setReviewRating(0); setReviewComment('');
            setReviewModal(true);
          },
        },
      ]
    );
  }

  async function submitReview() {
    if (!reviewRating || !userId || !offer?.supplier_id) return;
    setSubmittingReview(true);
    const { data: existing } = await supabase.from('reviews').select('id').eq('supplier_id', offer.supplier_id).eq('buyer_id', userId).eq('request_id', requestId).maybeSingle();
    if (!existing) {
      await supabase.from('reviews').insert({ supplier_id: offer.supplier_id, buyer_id: userId, request_id: requestId, rating: reviewRating, comment: reviewComment || '' });
      const { data: reviews } = await supabase.from('reviews').select('rating').eq('supplier_id', offer.supplier_id);
      if (reviews?.length > 0) {
        const avg = reviews.reduce((sum, rv) => sum + rv.rating, 0) / reviews.length;
        await supabase.from('profiles').update({ rating: avg, reviews_count: reviews.length }).eq('id', offer.supplier_id);
      }
    }
    setSubmittingReview(false);
    setReviewModal(false);
    Alert.alert(tx('شكراً', 'Thank You'), tx('تم إرسال تقييمك بنجاح', 'Your review was submitted successfully'));
  }

  /* ── Derived values ─────────────────────────────────────── */
  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}><ActivityIndicator color={C.textDisabled} size="large" /></View>
      </SafeAreaView>
    );
  }

  if (!request) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Text style={s.back}>{tx('← رجوع', '← Back')}</Text>
          </TouchableOpacity>
        </View>
        <View style={s.center}><Text style={s.emptyText}>{tx('لم يُعثر على الطلب', 'Request not found')}</Text></View>
      </SafeAreaView>
    );
  }

  const lang          = getLang();
  const isAr          = lang === 'ar';
  const status        = request.status;
  const statusLabel   = isAr ? (STATUS_AR[status] || status) : (STATUS_EN[status] || status);
  const statusColor   = STATUS_COLOR[status] || C.blue;
  const title         = isAr ? (request.title_ar || request.title_en) : (request.title_en || request.title_ar);
  const supplierName  = offer?.profiles?.company_name || offer?.profiles?.full_name;
  const verified      = !!offer?.profiles?.verified;

  const subtotal   = (offer?.price || 0) * (Number(request.quantity) || 1);
  const shipping   = parseFloat(offer?.shipping_cost) || 0;
  const total      = subtotal + shipping;
  const pct        = request.payment_pct > 0 ? request.payment_pct : 30;
  const firstAmt   = request.amount > 0 ? request.amount : parseFloat((total * pct / 100).toFixed(2));
  const secondAmt  = request.payment_second > 0 ? request.payment_second : parseFloat((total * (100 - pct) / 100).toFixed(2));
  const currency   = offer?.currency || 'USD';

  const isPaidFirst  = ['paid', 'ready_to_ship', 'shipping', 'arrived', 'delivered'].includes(status);
  const isPaidSecond = ['shipping', 'arrived', 'delivered'].includes(status) || !!request.payment_second_paid;
  const isDueSecond  = status === 'ready_to_ship';

  const showPayPlan  = ['closed', 'supplier_confirmed', 'paid', 'ready_to_ship', 'shipping', 'arrived', 'delivered'].includes(status);
  const showChat     = !!offer?.supplier_id && ['supplier_confirmed', 'paid', 'ready_to_ship', 'shipping', 'arrived'].includes(status);
  const showCancel   = ['closed', 'supplier_confirmed'].includes(status);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={s.backBtn}>
          <Text style={s.back}>{tx('← رجوع', '← Back')}</Text>
        </TouchableOpacity>
        <Text style={s.pageTitle}>{tx('تفاصيل الطلب', 'Order Detail')}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Title + status */}
        <View style={s.titleRow}>
          <View style={[s.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[s.statusBadgeText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
          <Text style={s.reqTitle} numberOfLines={3}>{title}</Text>
        </View>

        {/* Quantity + date chips */}
        <View style={s.chipsRow}>
          <View style={s.chip}><Text style={s.chipText}>{tx('الكمية', 'Qty')}: {request.quantity || '—'}</Text></View>
          <View style={s.chip}><Text style={[s.chipText, { fontFamily: F.en }]}>{new Date(request.created_at).toLocaleDateString(isAr ? 'ar-SA-u-nu-latn' : 'en-US', { month: 'short', day: 'numeric' })}</Text></View>
        </View>

        {/* Timeline */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>{tx('مسار الطلب', 'Order Timeline')}</Text>
          <StatusTimeline status={status} shippingStatus={request.shipping_status} />
        </View>

        {/* Supplier card */}
        {!!supplierName && (
          <View style={s.supplierCard}>
            <View style={s.supplierRow}>
              {verified && <Text style={s.verifiedDot}>✓ </Text>}
              <Text style={s.supplierName}>{supplierName}</Text>
              {offer?.profiles?.maabar_supplier_id && <Text style={s.supplierId}> · {offer.profiles.maabar_supplier_id}</Text>}
            </View>
            {offer?.profiles?.rating > 0 && (
              <Text style={s.supplierRating}>★ {Number(offer.profiles.rating).toFixed(1)} ({offer.profiles.reviews_count || 0} {tx('تقييم', 'reviews')})</Text>
            )}
            {offer?.delivery_time && (
              <Text style={s.supplierMeta}>{tx('مدة التجهيز:', 'Lead time:')} {offer.delivery_time}</Text>
            )}
          </View>
        )}

        {/* Payment plan */}
        {showPayPlan && offer && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>{tx('خطة الدفع', 'Payment Plan')}</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <PaymentBadge label={`دفعة أولى · ${pct}%`}        amount={firstAmt}  currency={currency} badgeState={isPaidFirst ? 'paid' : 'pending'} />
              <PaymentBadge label={`دفعة ثانية · ${100 - pct}%`} amount={secondAmt} currency={currency} badgeState={isPaidSecond ? 'paid' : isDueSecond ? 'due' : 'pending'} />
            </View>
          </View>
        )}

        {/* Tracking */}
        {!!request.tracking_number && (
          <View style={s.trackBox}>
            <View style={s.trackRow}>
              <TouchableOpacity onPress={() => Linking.openURL(getTrackingUrl(request.shipping_company, request.tracking_number)).catch(() => {})} activeOpacity={0.8}>
                <Text style={s.trackLink}>{tx('تتبع ←', 'Track →')}</Text>
              </TouchableOpacity>
              <Text style={s.trackText} numberOfLines={2}>
                {request.shipping_company ? `${request.shipping_company} · ` : ''}
                {tx('رقم التتبع: ', 'Tracking: ')}
                <Text style={s.trackNum}>{request.tracking_number}</Text>
              </Text>
            </View>
            {!!request.estimated_delivery && (
              <Text style={s.trackETA}>{tx('التسليم المتوقع: ', 'Expected delivery: ')}{new Date(request.estimated_delivery).toLocaleDateString(isAr ? 'ar-SA-u-nu-latn' : 'en-US')}</Text>
            )}
          </View>
        )}

        {/* ── Status-driven action buttons ─────────────────── */}

        {/* Pay first installment */}
        {['closed', 'supplier_confirmed'].includes(status) && offer && (
          <TouchableOpacity
            style={s.payBtn}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Payment', {
              amount: firstAmt * 3.75,
              type: 'checkout',
              requestId,
              requestData: request,
              supplierId: offer.supplier_id,
              offerPriceUsd: total,
              paymentPct: pct,
            })}
          >
            <Text style={s.payBtnText}>{tx(`ادفع الدفعة الأولى — ${firstAmt.toFixed(0)} ${currency}`, `Pay 1st Installment — ${firstAmt.toFixed(0)} ${currency}`)}</Text>
          </TouchableOpacity>
        )}

        {/* Pay second installment */}
        {status === 'ready_to_ship' && (
          <TouchableOpacity
            style={s.payBtn}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Payment', {
              amount: secondAmt * 3.75,
              type: 'second_installment',
              requestId,
              supplierId: offer?.supplier_id,
              offerPriceUsd: secondAmt,
            })}
          >
            <Text style={s.payBtnText}>{tx(`ادفع الدفعة الثانية${secondAmt > 0 ? ` — ${secondAmt.toFixed(0)}` : ''}`, `Pay 2nd Installment${secondAmt > 0 ? ` — ${secondAmt.toFixed(0)}` : ''}`)}</Text>
          </TouchableOpacity>
        )}

        {/* Mark as arrived */}
        {status === 'shipping' && (
          <TouchableOpacity style={s.payBtn} activeOpacity={0.85} onPress={handleMarkArrived}>
            <Text style={s.payBtnText}>{tx('أكد الوصول إلى السعودية', 'Mark as Arrived in KSA')}</Text>
          </TouchableOpacity>
        )}

        {/* Confirm delivery */}
        {status === 'arrived' && (
          <TouchableOpacity style={s.payBtn} activeOpacity={0.85} onPress={handleConfirmDelivery}>
            <Text style={s.payBtnText}>{tx('أكد الاستلام', 'Confirm Delivery')}</Text>
          </TouchableOpacity>
        )}

        {/* Delivered: rate + support */}
        {status === 'delivered' && (
          <View style={{ gap: 8 }}>
            {offer?.supplier_id && (
              <TouchableOpacity
                style={s.payBtn}
                activeOpacity={0.85}
                onPress={() => { setReviewRating(0); setReviewComment(''); setReviewModal(true); }}
              >
                <Text style={s.payBtnText}>{tx('قيّم المورد', 'Rate Supplier')}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={s.reportBtn}
              activeOpacity={0.8}
              onPress={() => Linking.openURL('mailto:support@maabar.io').catch(() => {})}
            >
              <Text style={s.reportBtnText}>{tx('تواصل مع الدعم', 'Contact Support')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Chat with supplier */}
        {showChat && (
          <TouchableOpacity
            style={s.chatBtn}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Inbox', { screen: 'Chat', params: { partnerId: offer.supplier_id } })}
          >
            <Text style={s.chatBtnText}>{tx('تواصل مع المورد', 'Chat with Supplier')}</Text>
          </TouchableOpacity>
        )}

        {/* Cancel request */}
        {showCancel && (
          <TouchableOpacity style={s.cancelBtn} activeOpacity={0.85} onPress={handleCancelRequest}>
            <Text style={s.cancelBtnText}>{tx('إلغاء الطلب', 'Cancel Request')}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Review modal */}
      <Modal visible={reviewModal} transparent animationType="slide" onRequestClose={() => setReviewModal(false)}>
        <View style={s.reviewOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={Keyboard.dismiss} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.reviewSheet}>
            <View style={s.reviewHandle} />
            <Text style={s.reviewTitle}>{tx('قيّم المورد', 'Rate Supplier')}</Text>
            <Text style={s.reviewSub}>{supplierName || ''}</Text>
            <View style={s.starsRow}>
              {[1, 2, 3, 4, 5].map(star => (
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
            <TouchableOpacity
              style={[s.payBtn, (!reviewRating || submittingReview) && { opacity: 0.5 }]}
              onPress={submitReview}
              disabled={!reviewRating || submittingReview}
              activeOpacity={0.85}
            >
              {submittingReview
                ? <ActivityIndicator color={C.btnPrimaryText} />
                : <Text style={s.payBtnText}>{tx('إرسال التقييم', 'Submit Review')}</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setReviewModal(false)} activeOpacity={0.7} style={{ alignItems: 'center', marginTop: 12 }}>
              <Text style={{ color: C.textDisabled, fontFamily: F.ar, fontSize: 13 }}>{tx('تخطي', 'Skip')}</Text>
            </TouchableOpacity>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bgBase },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
    backgroundColor: C.bgBase,
  },
  backBtn:   { width: 60 },
  back:      { color: C.textSecondary, fontFamily: F.ar, fontSize: 14 },
  pageTitle: { color: C.textPrimary, fontFamily: F.arBold, fontSize: 17 },

  scroll: { padding: 20, paddingBottom: 48, gap: 16 },

  titleRow: { gap: 10 },
  statusBadge:     { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, alignSelf: 'flex-end' },
  statusBadgeText: { fontSize: 11, fontFamily: F.arSemi },
  reqTitle:        { fontSize: 18, fontFamily: F.arBold, color: C.textPrimary, textAlign: 'right', lineHeight: 28 },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' },
  chip:     { backgroundColor: C.bgHover, borderRadius: 20, borderWidth: 1, borderColor: C.borderSubtle, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { fontSize: 11, color: C.textSecondary, fontFamily: F.ar },

  section:      { gap: 10 },
  sectionLabel: { fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: C.textDisabled, fontFamily: F.ar, textAlign: 'right' },

  supplierCard: {
    backgroundColor: C.bgRaised,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.borderDefault,
    padding: 14,
    gap: 4,
  },
  supplierRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  verifiedDot:   { fontSize: 11, color: '#5a9a72', fontFamily: F.en },
  supplierName:  { fontSize: 15, fontFamily: F.arBold, color: C.textPrimary },
  supplierId:    { fontSize: 11, color: C.textDisabled, fontFamily: F.en },
  supplierRating:{ fontSize: 12, color: C.textTertiary, fontFamily: F.en, textAlign: 'right' },
  supplierMeta:  { fontSize: 12, color: C.textTertiary, fontFamily: F.ar, textAlign: 'right' },

  trackBox: { backgroundColor: C.bgOverlay, borderRadius: 12, borderWidth: 1, borderColor: C.borderSubtle, padding: 12 },
  trackRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  trackText:{ flex: 1, fontSize: 12, color: C.textSecondary, fontFamily: F.ar, textAlign: 'right' },
  trackNum: { color: C.textPrimary, fontFamily: F.enSemi },
  trackLink:{ fontSize: 11, color: C.textTertiary, fontFamily: F.en, letterSpacing: 0.5 },
  trackETA: { fontSize: 11, color: C.textTertiary, fontFamily: F.ar, textAlign: 'right', marginTop: 6 },

  payBtn:        { backgroundColor: C.btnPrimary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  payBtnText:    { color: C.btnPrimaryText, fontFamily: F.arBold, fontSize: 15 },
  cancelBtn:     { borderWidth: 1, borderColor: 'rgba(224,92,92,0.25)', borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  cancelBtnText: { color: C.red, fontFamily: F.arSemi, fontSize: 14 },
  chatBtn:       { backgroundColor: C.bgHover, borderRadius: 14, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: C.borderDefault },
  chatBtnText:   { color: C.textPrimary, fontFamily: F.arSemi, fontSize: 14 },
  reportBtn:     { backgroundColor: C.bgHover, borderRadius: 14, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: C.borderDefault },
  reportBtnText: { color: C.textSecondary, fontFamily: F.ar, fontSize: 14 },
  emptyText:     { color: C.textSecondary, fontFamily: F.ar, fontSize: 15 },

  reviewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  reviewSheet:   { backgroundColor: C.bgBase, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  reviewHandle:  { width: 40, height: 4, backgroundColor: C.borderDefault, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  reviewTitle:   { fontFamily: F.arBold, fontSize: 18, color: C.textPrimary, textAlign: 'center', marginBottom: 4 },
  reviewSub:     { fontFamily: F.ar, fontSize: 13, color: C.textTertiary, textAlign: 'center', marginBottom: 20 },
  starsRow:      { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 20 },
  star:          { fontSize: 36, color: C.borderDefault },
  starFilled:    { color: '#e8a020' },
  reviewInput:   { backgroundColor: C.bgRaised, borderRadius: 12, borderWidth: 1, borderColor: C.borderMuted, paddingHorizontal: 14, paddingVertical: 11, fontFamily: F.ar, fontSize: 14, color: C.textPrimary, textAlign: 'right', minHeight: 80, marginBottom: 16 },
});
