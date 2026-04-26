import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase, SUPABASE_ANON_KEY, SEND_EMAIL_URL } from '../../lib/supabase';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';
import { getLang } from '../../lib/lang';
import { buildOfferDetailRows } from '../../lib/offerFields';
import { resolveOfferNote, readCachedNote } from '../../lib/offerNoteCache';
import {
  formatPriceWithConversion,
  normalizeDisplayCurrency,
  useDisplayCurrency,
} from '../../lib/displayCurrency';

const STATUS_MAP = {
  verified: 'verified', active: 'verified', approved: 'verified',
  draft: 'registered', incomplete: 'registered',
  pending: 'under_review', under_review: 'under_review',
  submitted: 'under_review', review: 'under_review',
  rejected: 'rejected', disabled: 'inactive', inactive: 'inactive', suspended: 'inactive',
};
function buildTrustSignals(profile = {}) {
  const signals = [];
  const status = STATUS_MAP[String(profile?.status || '').trim().toLowerCase()] || 'registered';
  if (status === 'verified') signals.push('maabar_reviewed');
  const tradeLinks = [...(Array.isArray(profile?.trade_links) ? profile.trade_links : []), profile?.trade_link].filter(Boolean);
  if (tradeLinks.length > 0) signals.push('trade_profile_available');
  if (profile?.wechat) signals.push('wechat_available');
  if (profile?.whatsapp) signals.push('whatsapp_available');
  if (Array.isArray(profile?.factory_images) && profile.factory_images.length > 0) signals.push('factory_media_available');
  return signals;
}

export default function OffersScreen({ route, navigation }) {
  const { requestId, title, quantity, paymentPct: routePaymentPct } = route.params || {};
  const [offers, setOffers]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [expandedMap, setExpandedMap] = useState({});  // { [offerId]: boolean }
  const [rejectedMap, setRejectedMap] = useState({});  // { [offerId]: true } — flashing "تم الرفض"
  const [noteOverrides, setNoteOverrides] = useState({});   // { [offerId]: translated/cached note }
  const [translatingNotes, setTranslatingNotes] = useState({}); // { [offerId]: true }

  const lang = getLang();
  const isAr = lang === 'ar';
  const { displayCurrency: viewerCurrency, rates: exchangeRates } = useDisplayCurrency();

  // amount is in `currency`; renders "X CCY [≈ Y viewerCurrency]" when they differ.
  function fmtPrice(amount, currency) {
    if (amount == null || amount === '') return '—';
    const num = parseFloat(amount);
    if (!Number.isFinite(num)) return String(amount);
    return formatPriceWithConversion({
      amount: num,
      sourceCurrency: normalizeDisplayCurrency(currency || 'USD'),
      displayCurrency: viewerCurrency,
      rates: exchangeRates,
      lang,
      options: { minimumFractionDigits: 2 },
    });
  }

  function toggleExpanded(offerId) {
    const willExpand = !expandedMap[offerId];
    setExpandedMap(prev => ({ ...prev, [offerId]: !prev[offerId] }));
    if (willExpand) {
      const offer = offers.find(o => o.id === offerId);
      if (offer) ensureTranslatedNote(offer);
    }
  }

  // When a buyer expands an offer whose note_{lang} is missing, fill it in:
  // cache hit → use it instantly; otherwise call Grok once, then cache + render.
  async function ensureTranslatedNote(offer) {
    const existing = offer[`note_${lang}`];
    if (existing && String(existing).trim()) return;
    if (noteOverrides[offer.id]) return;
    if (translatingNotes[offer.id]) return;

    // Fast path: cache hit — avoids the "Translating…" flash
    const cached = await readCachedNote(offer.id, lang);
    if (cached?.text) {
      setNoteOverrides(prev => ({ ...prev, [offer.id]: cached.text }));
      return;
    }

    setTranslatingNotes(prev => ({ ...prev, [offer.id]: true }));
    try {
      const { text } = await resolveOfferNote(offer, lang);
      if (text) setNoteOverrides(prev => ({ ...prev, [offer.id]: text }));
    } finally {
      setTranslatingNotes(prev => {
        const n = { ...prev };
        delete n[offer.id];
        return n;
      });
    }
  }

  useEffect(() => {
    if (!requestId) { setLoading(false); return; }
    loadOffers();
  }, [requestId]);

  async function loadOffers() {
    setLoading(true);

    // Fetch ALL columns so the dynamic details section can show everything
    const { data: offersData, error } = await supabase
      .from('offers')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('loadOffers error:', error.message);
      setOffers([]);
      setLoading(false);
      return;
    }

    const rows = offersData || [];
    if (rows.length === 0) {
      setOffers([]);
      setLoading(false);
      return;
    }

    // Fetch supplier profiles separately (avoids RLS/FK join issues)
    const supplierIds = [...new Set(rows.map(o => o.supplier_id).filter(Boolean))];
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, full_name, company_name, maabar_supplier_id, status, wechat, whatsapp, trade_link, factory_images, reviews_count')
      .in('id', supplierIds);

    const profileMap = (profilesData || []).reduce((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {});

    setOffers(rows.map(o => ({ ...o, profiles: profileMap[o.supplier_id] || null })));
    setLoading(false);
  }

  function handleAccept(offer) {
    const tl = (ar, en, zh) => (lang === 'ar' ? ar : lang === 'zh' ? (zh || en) : en);
    Alert.alert(
      tl('قبول العرض', 'Accept Offer', '接受报价'),
      tl(
        'هل أنت متأكد من قبول هذا العرض؟',
        'Are you sure you want to accept this offer?',
        '您确定要接受该报价吗？',
      ),
      [
        { text: tl('إلغاء', 'Cancel', '取消'), style: 'cancel' },
        {
          text: tl('قبول', 'Accept', '接受'),
          onPress: async () => {
            try {
              const reqTitle = title || '';

              // Fetch other pending offers to notify/reject
              const { data: otherOffers } = await supabase
                .from('offers')
                .select('id, supplier_id')
                .eq('request_id', requestId)
                .eq('status', 'pending')
                .neq('id', offer.id);
              console.log('[OffersScreen] other pending offers:', otherOffers);

              // Accept this offer, close request, reject others
              const { data: aod, error: aoe } = await supabase
                .from('offers').update({ status: 'accepted' }).eq('id', offer.id);
              console.log('[OffersScreen] offer.accepted:', aod, aoe);

              const { data: rqd, error: rqe } = await supabase
                .from('requests').update({ status: 'closed' }).eq('id', requestId);
              console.log('[OffersScreen] request.closed:', rqd, rqe);

              if (otherOffers?.length) {
                const otherIds = otherOffers.map(o => o.id);
                const { data: rejd, error: reje } = await supabase
                  .from('offers').update({ status: 'rejected' }).in('id', otherIds);
                console.log('[OffersScreen] others.rejected:', rejd, reje);
              }

              // Notify + email winning supplier
              await supabase.from('notifications').insert({
                user_id: offer.supplier_id,
                type: 'offer_accepted',
                title_ar: 'تم قبول عرضك',
                title_en: 'Your offer has been accepted',
                title_zh: '您的报价已被接受',
                ref_id: offer.id,
                is_read: false,
              });
              console.log('[OffersScreen] notification sent to winner:', offer.supplier_id);
              try {
                await fetch(SEND_EMAIL_URL, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
                  body: JSON.stringify({ type: 'offer_accepted', data: { recipientUserId: offer.supplier_id, name: 'Supplier', requestTitle: reqTitle } }),
                });
              } catch (e) { console.error('[OffersScreen] offer_accepted email error:', e); }

              // Notify + email rejected suppliers
              if (otherOffers?.length) {
                await Promise.all(otherOffers.map(async o => {
                  await supabase.from('notifications').insert({
                    user_id: o.supplier_id,
                    type: 'offer_rejected',
                    title_ar: `تم اختيار عرض آخر على الطلب: ${reqTitle}`,
                    title_en: `Another offer was selected for: ${reqTitle}`,
                    title_zh: `已选择其他报价: ${reqTitle}`,
                    ref_id: requestId,
                    is_read: false,
                  });
                  console.log('[OffersScreen] notification sent to rejected:', o.supplier_id);
                  try {
                    await fetch(SEND_EMAIL_URL, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
                      body: JSON.stringify({ type: 'offer_rejected', data: { recipientUserId: o.supplier_id, name: 'Supplier', requestTitle: reqTitle } }),
                    });
                  } catch (e) { console.error('[OffersScreen] offer_rejected email error:', e); }
                }));
              }
            } catch (e) {
              console.error('[OffersScreen] handleAccept cascade error:', e);
            }

            // Match the web flow: request is now `closed`, buyer waits for the
            // supplier to confirm readiness. Payment is unlocked later by the
            // request card, not from here.
            Alert.alert(
              tl('تم قبول العرض', 'Offer Accepted', '报价已接受'),
              tl(
                'في انتظار تأكيد المورد. سيفتح خيار الدفع بعد التأكيد.',
                'Waiting for supplier confirmation. Payment will unlock once the supplier confirms.',
                '等待供应商确认。供应商确认后将可付款。',
              ),
              [
                { text: 'OK', onPress: () => navigation.goBack() },
              ],
            );
          },
        },
      ]
    );
  }

  function handleReject(offerId) {
    Alert.alert(
      isAr ? 'رفض العرض' : 'Reject Offer',
      isAr ? 'هل أنت متأكد من رفض هذا العرض؟' : 'Are you sure you want to reject this offer?',
      [
        { text: isAr ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: isAr ? 'تأكيد الرفض' : 'Confirm Reject',
          style: 'destructive',
          onPress: async () => {
            const { data, error } = await supabase.from('offers').update({ status: 'rejected' }).eq('id', offerId);
            console.log('[OffersScreen] handleReject update:', data, error);
            const rejected = offers.find(o => o.id === offerId);
            if (rejected?.supplier_id) {
              const { data: nd, error: ne } = await supabase.from('notifications').insert({
                user_id: rejected.supplier_id,
                type: 'offer_rejected',
                title_ar: `تم رفض عرضك على الطلب: ${title || ''}`,
                title_en: `Your offer was rejected for: ${title || ''}`,
                title_zh: `您的报价已被拒绝: ${title || ''}`,
                ref_id: offerId,
                is_read: false,
              });
              console.log('[OffersScreen] handleReject notification:', nd, ne);
            }
            // Show "تم الرفض" flash on the card
            setRejectedMap(prev => ({ ...prev, [offerId]: true }));
            // After 1.5s remove from list
            setTimeout(() => {
              setOffers(prev => prev.filter(o => o.id !== offerId));
              setRejectedMap(prev => { const n = { ...prev }; delete n[offerId]; return n; });
            }, 1500);
          },
        },
      ]
    );
  }

  function handleChat(supplierId) {
    if (!supplierId) return;
    // Navigate to the Inbox tab → Chat screen, passing the supplier's user ID
    navigation.navigate('Inbox', {
      screen: 'Chat',
      params: { partnerId: supplierId },
    });
  }

  // Render a single detail row
  function DetailRow({ label, value }) {
    return (
      <View style={s.detailRow}>
        <Text style={s.detailLabel}>{label}</Text>
        <Text style={s.detailValue}>{value}</Text>
      </View>
    );
  }

  function renderDetails(offer) {
    const override = noteOverrides[offer.id];
    const isTranslating = !!translatingNotes[offer.id];

    let effective = offer;
    if (override) {
      effective = { ...offer, [`note_${lang}`]: override };
    } else if (isTranslating) {
      const placeholder = isAr
        ? 'جاري الترجمة…'
        : lang === 'zh'
          ? '翻译中…'
          : 'Translating…';
      effective = { ...offer, [`note_${lang}`]: placeholder };
    }

    return buildOfferDetailRows(effective, lang, { fmtPrice })
      .map(({ key, label, value }) => (
        <DetailRow key={key} label={label} value={value} />
      ));
  }

  return (
    <SafeAreaView style={s.safe}>

      {/* Top bar */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={s.back}>← {isAr ? 'رجوع' : 'Back'}</Text>
        </TouchableOpacity>
        <Text style={s.pageTitle} numberOfLines={1}>
          {isAr ? 'العروض' : 'Offers'}
        </Text>
      </View>

      {!!title && <Text style={s.reqTitle}>{title}</Text>}

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color="rgba(0,0,0,0.35)" size="large" />
        </View>
      ) : offers.length === 0 ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyText}>{isAr ? 'لا توجد عروض بعد' : 'No offers yet'}</Text>
          <Text style={s.emptySubText}>{isAr ? 'سيصلك إشعار عند وصول العروض' : 'You\'ll be notified when offers arrive'}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
          {offers.map(offer => {
            const total       = (parseFloat(offer.price) || 0) + (parseFloat(offer.shipping_cost) || 0);
            const status      = offer.status || 'pending';
            const isAccepted  = status === 'accepted';
            const isExpanded  = !!expandedMap[offer.id];
            const isRejecting = !!rejectedMap[offer.id];

            return (
              <View key={offer.id} style={[s.card, isAccepted && s.cardAccepted]}>

                {/* ── Supplier header ── */}
                <View style={s.supplierRow}>
                  <TouchableOpacity
                    style={{ flex: 1 }}
                    activeOpacity={offer.supplier_id ? 0.65 : 1}
                    onPress={() => offer.supplier_id && navigation.navigate('SupplierProfile', { supplierId: offer.supplier_id })}
                  >
                    <Text style={[s.supplierName, offer.supplier_id && { textDecorationLine: 'underline' }]}>
                      {offer.profiles?.company_name || offer.profiles?.full_name || (isAr ? 'مورد' : 'Supplier')}
                    </Text>
                    {!!offer.profiles?.maabar_supplier_id && (
                      <Text style={s.supplierId}>{offer.profiles.maabar_supplier_id}</Text>
                    )}
                  </TouchableOpacity>
                  {isAccepted && (
                    <View style={s.acceptedBadge}>
                      <Text style={s.acceptedText}>✓ {isAr ? 'مقبول' : 'Accepted'}</Text>
                    </View>
                  )}
                </View>

                {/* ── Trust signal badges ── */}
                {(() => {
                  const signals = buildTrustSignals(offer.profiles);
                  if (signals.length === 0) return null;
                  const SIGNAL_LABELS = {
                    maabar_reviewed:        isAr ? '✓ موثّق معبر' : '✓ Maabar Verified',
                    trade_profile_available: isAr ? 'رابط تجاري' : 'Trade Link',
                    wechat_available:       'WeChat',
                    whatsapp_available:     'WhatsApp',
                    factory_media_available: isAr ? 'صور المصنع' : 'Factory Photos',
                  };
                  return (
                    <View style={s.trustRow}>
                      {signals.map(sig => (
                        <View key={sig} style={s.trustBadge}>
                          <Text style={s.trustBadgeText}>{SIGNAL_LABELS[sig] || sig}</Text>
                        </View>
                      ))}
                    </View>
                  );
                })()}

                {/* ── Price summary ── */}
                <View style={s.priceRow}>
                  <View style={s.priceItem}>
                    <Text style={s.priceLabel}>{isAr ? 'سعر الوحدة' : 'Unit Price'}</Text>
                    <Text style={s.priceValue}>{fmtPrice(offer.price, offer.currency)}</Text>
                  </View>
                  <View style={s.priceItem}>
                    <Text style={s.priceLabel}>{isAr ? 'الشحن' : 'Shipping'}</Text>
                    <Text style={s.priceValue}>{fmtPrice(offer.shipping_cost, offer.currency)}</Text>
                  </View>
                </View>

                <View style={s.totalRow}>
                  <Text style={s.totalLabel}>{isAr ? 'الإجمالي التقديري' : 'Est. Total'}</Text>
                  <Text style={s.totalValue}>{fmtPrice(total)}</Text>
                </View>

                {/* ── تفاصيل toggle ── */}
                <TouchableOpacity
                  style={s.detailsToggle}
                  onPress={() => toggleExpanded(offer.id)}
                  activeOpacity={0.7}
                >
                  <Text style={s.detailsToggleText}>
                    {isExpanded
                      ? (isAr ? '▲ إخفاء التفاصيل' : '▲ Hide Details')
                      : (isAr ? '▼ تفاصيل' : '▼ Details')}
                  </Text>
                </TouchableOpacity>

                {/* ── Expanded details: all non-null offer fields ── */}
                {isExpanded && (
                  <View style={s.detailsBox}>
                    {renderDetails(offer)}
                  </View>
                )}

                {/* ── Rejection flash ── */}
                {isRejecting && (
                  <View style={s.rejectedFlash}>
                    <Text style={s.rejectedFlashText}>{isAr ? 'تم الرفض' : 'Rejected'}</Text>
                  </View>
                )}

                {/* ── Actions: only for pending offers ── */}
                {status === 'pending' && !isRejecting && (
                  <View style={s.actions}>
                    <View style={s.actionsTop}>
                      <TouchableOpacity
                        style={s.chatBtn}
                        onPress={() => handleChat(offer.supplier_id)}
                        activeOpacity={0.8}
                      >
                        <Text style={s.chatBtnText}>{isAr ? 'تواصل' : 'Chat'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={s.acceptBtn}
                        onPress={() => handleAccept(offer)}
                        activeOpacity={0.85}
                      >
                        <Text style={s.acceptBtnText}>{isAr ? 'قبول العرض' : 'Accept Offer'}</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      style={s.rejectBtn}
                      onPress={() => handleReject(offer.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={s.rejectBtnText}>{isAr ? 'رفض' : 'Reject'}</Text>
                    </TouchableOpacity>
                  </View>
                )}

              </View>
            );
          })}
        </ScrollView>
      )}
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
  },
  back:      { color: C.textSecondary, fontFamily: F.ar, fontSize: 14 },
  pageTitle: { color: C.textPrimary, fontFamily: F.arBold, fontSize: 17, maxWidth: '70%', textAlign: 'right' },
  reqTitle:  { color: C.textSecondary, fontFamily: F.ar, fontSize: 13, textAlign: 'right', paddingHorizontal: 20, paddingVertical: 10 },

  list: { padding: 16, gap: 12, paddingBottom: 40 },

  card: {
    backgroundColor: C.bgRaised,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: C.borderDefault,
  },
  cardAccepted: { borderColor: C.green },

  supplierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  supplierName: { color: C.textPrimary, fontFamily: F.arBold, fontSize: 16, textAlign: 'right', flex: 1 },
  supplierId:   { color: C.textDisabled, fontFamily: F.en, fontSize: 11, textAlign: 'right', marginBottom: 14 },

  acceptedBadge: { backgroundColor: C.greenSoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  acceptedText:  { color: C.green, fontFamily: F.arSemi, fontSize: 12 },

  trustRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  trustBadge: {
    backgroundColor: C.bgOverlay,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  trustBadgeText: { color: C.textTertiary, fontFamily: F.ar, fontSize: 11 },

  priceRow: { flexDirection: 'row', gap: 12, marginBottom: 10, marginTop: 4 },
  priceItem: {
    flex: 1,
    backgroundColor: C.bgOverlay,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  priceLabel: { color: C.textTertiary, fontFamily: F.ar,      fontSize: 11, marginBottom: 4 },
  priceValue: { color: C.textPrimary,  fontFamily: F.enLight, fontSize: 20, letterSpacing: -0.5 },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: C.borderSubtle,
  },
  totalLabel: { color: C.textSecondary, fontFamily: F.ar,      fontSize: 13 },
  totalValue: { color: C.textPrimary,   fontFamily: F.enLight, fontSize: 24, letterSpacing: -0.5 },

  // Details toggle button
  detailsToggle: {
    marginTop: 10,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    backgroundColor: C.bgOverlay,
  },
  detailsToggleText: { color: C.textSecondary, fontFamily: F.arSemi, fontSize: 12 },

  // Expanded details section
  detailsBox: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
    gap: 12,
  },
  detailLabel: {
    color: C.textTertiary,
    fontFamily: F.ar,
    fontSize: 12,
    flex: 1,
    textAlign: 'right',
  },
  detailValue: {
    color: C.textPrimary,
    fontFamily: F.en,
    fontSize: 13,
    textAlign: 'left',
    flexShrink: 1,
    maxWidth: '55%',
  },

  // Action buttons
  actions:    { flexDirection: 'column', gap: 8, marginTop: 14 },
  actionsTop: { flexDirection: 'row', gap: 10 },
  chatBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.borderDefault,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: C.bgOverlay,
  },
  chatBtnText:   { color: C.textPrimary,    fontFamily: F.arSemi, fontSize: 14 },
  acceptBtn:     { flex: 2, backgroundColor: C.btnPrimary, borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  acceptBtnText: { color: C.btnPrimaryText,  fontFamily: F.arBold, fontSize: 14 },
  rejectBtn:     { alignItems: 'center', paddingVertical: 8 },
  rejectBtnText: { color: 'rgba(180,0,0,0.7)', fontFamily: F.arSemi, fontSize: 13 },

  rejectedFlash: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(180,0,0,0.07)',
    alignItems: 'center',
  },
  rejectedFlashText: { color: 'rgba(180,0,0,0.7)', fontFamily: F.arSemi, fontSize: 13 },

  // Empty state
  emptyCard: {
    margin: 20,
    backgroundColor: C.bgRaised,
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.borderDefault,
  },
  emptyText:    { color: C.textSecondary, fontFamily: F.ar, fontSize: 15, marginBottom: 8 },
  emptySubText: { color: C.textTertiary,  fontFamily: F.ar, fontSize: 13 },
});
