import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Alert, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';
import { getLang } from '../../lib/lang';

const tx = (ar, en) => getLang() === 'ar' ? ar : en;

const VERIFICATION_LABELS = {
  verified:   { ar: 'موثّق',   en: 'Verified' },
  registered: { ar: 'مسجّل',   en: 'Registered' },
};

function verificationLabel(level) {
  const entry = VERIFICATION_LABELS[level];
  if (!entry) return level;
  return getLang() === 'ar' ? entry.ar : entry.en;
}

// If the shortlist row has no verification_level, derive one from the supplier profile.
function deriveVerificationLevel(offer) {
  if (offer?.verification_level) return offer.verification_level;
  const status = offer?.profile?.status;
  if (status === 'verified' || status === 'approved' || status === 'active') return 'verified';
  return 'registered';
}

// Pick the best supplier display name, falling back to the profile columns.
function pickSupplierName(offer) {
  return offer?.supplier_name
    || offer?.profile?.company_name
    || offer?.profile?.full_name
    || null;
}

// Pick the localised supplier_brief when the AI returned per-language variants.
function pickSupplierBrief(brief, lang) {
  if (!brief) return '';
  const all = brief.ai_output?.supplier_brief_all;
  if (all && typeof all === 'object') {
    return all[lang] || all.en || all.ar || brief.supplier_brief || '';
  }
  return brief.supplier_brief || '';
}

const AI_CONFIDENCE_LABELS = {
  high:   { ar: 'ثقة عالية',   en: 'High confidence' },
  medium: { ar: 'ثقة متوسطة',  en: 'Medium confidence' },
  low:    { ar: 'ثقة منخفضة',  en: 'Low confidence' },
};

function aiConfidenceLabel(level) {
  const entry = AI_CONFIDENCE_LABELS[level];
  if (!entry) return level || '';
  return getLang() === 'ar' ? entry.ar : entry.en;
}

const MANAGED_STATUS_LABELS = {
  submitted:       { ar: 'تم التقديم',           en: 'Submitted' },
  admin_review:    { ar: 'قيد المراجعة',         en: 'Under Review' },
  sourcing:        { ar: 'قيد البحث عن موردين',  en: 'Sourcing Suppliers' },
  matching:        { ar: 'قيد المطابقة',          en: 'Matching' },
  shortlist_ready: { ar: 'القائمة جاهزة',        en: 'Shortlist Ready' },
  buyer_review:    { ar: 'بانتظار مراجعتك',      en: 'Awaiting Your Review' },
  buyer_selected:  { ar: 'تم الاختيار',          en: 'Selected' },
  negotiation:     { ar: 'قيد التفاوض',           en: 'Negotiation' },
  completed:       { ar: 'مكتمل',                en: 'Completed' },
};

const MANAGED_STATUS_ORDER = [
  'submitted',
  'admin_review',
  'sourcing',
  'matching',
  'shortlist_ready',
  'buyer_review',
  'buyer_selected',
  'completed',
];

function getManagedStatusLabel(status) {
  const entry = MANAGED_STATUS_LABELS[status];
  if (!entry) return status;
  return getLang() === 'ar' ? entry.ar : entry.en;
}

export default function ManagedRequestScreen({ route, navigation }) {
  const { requestId, title } = route.params || {};
  const [userId, setUserId]     = useState(null);
  const [offers, setOffers]     = useState([]);
  const [request, setRequest]   = useState(null);
  const [brief, setBrief]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [busy, setBusy]         = useState(false);
  const [negotiateFor, setNegotiateFor] = useState(null); // shortlist offer being negotiated
  const [negotiateReason, setNegotiateReason] = useState('');

  const load = useCallback(async () => {
    if (!requestId) { setLoading(false); return; }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) setUserId(user.id);

    const [{ data: reqData }, { data: offersData }, { data: briefData }] = await Promise.all([
      supabase
        .from('requests')
        .select('id, title_ar, title_en, quantity, payment_pct, managed_status, managed_research_requested_count, sourcing_mode, status')
        .eq('id', requestId)
        .single(),
      supabase
        .from('managed_shortlisted_offers')
        .select('*')
        .eq('request_id', requestId)
        .order('rank', { ascending: true }),
      supabase
        .from('managed_request_briefs')
        .select('cleaned_description, supplier_brief, ai_confidence, ai_output, ai_status')
        .eq('request_id', requestId)
        .maybeSingle(),
    ]);

    // Enrich shortlist rows with supplier profile (company_name, status, …).
    const rawOffers   = offersData || [];
    const supplierIds = [...new Set(rawOffers.map(o => o.supplier_id).filter(Boolean))];
    let profileMap    = {};
    if (supplierIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name, company_name, status, maabar_supplier_id')
        .in('id', supplierIds);
      profileMap = (profs || []).reduce((acc, p) => { acc[p.id] = p; return acc; }, {});
    }
    const offersWithProfile = rawOffers.map(o => ({ ...o, profile: profileMap[o.supplier_id] || null }));

    setRequest(reqData || null);
    setOffers(offersWithProfile);
    setBrief(briefData || null);
    setLoading(false);
  }, [requestId]);

  useEffect(() => { load(); }, [load]);

  /* ── Feedback logging (mirrors web recordManagedShortlistAction) ── */
  async function recordManagedShortlistAction({ shortlistOffer = null, action, reason = null }) {
    if (!userId || !request?.id) return;
    await supabase.from('managed_shortlist_feedback').insert({
      request_id: request.id,
      buyer_id: userId,
      shortlist_offer_id: shortlistOffer?.id || null,
      action,
      reason,
    });
  }

  /* ── Ensure buyer-visible `offers` row exists (mirrors web helper) ── */
  async function ensureBuyerVisibleOfferForShortlist(shortlistOffer) {
    const now = new Date().toISOString();
    const shippingDays = shortlistOffer.shipping_time_days;
    const shippingMethodText = shippingDays ? `${shippingDays} shipping days` : null;
    const negotiationNote    = shippingDays ? `shipping_time_days:${shippingDays}` : null;

    if (shortlistOffer.offer_id) {
      const updates = {
        managed_visibility: 'buyer_visible',
        status: 'accepted',
        shortlisted_at: now,
      };
      if (shortlistOffer.unit_price != null)            updates.price         = shortlistOffer.unit_price;
      if (shortlistOffer.moq)                            updates.moq           = shortlistOffer.moq;
      if (shortlistOffer.production_time_days != null)   updates.delivery_days = shortlistOffer.production_time_days;
      if (shippingMethodText) {
        updates.shipping_method = shippingMethodText;
        updates.negotiation_note = negotiationNote;
      }
      const { data, error } = await supabase
        .from('offers')
        .update(updates)
        .eq('id', shortlistOffer.offer_id)
        .select()
        .maybeSingle();
      if (error) throw error;
      return data;
    }

    const { data: matchRow } = await supabase
      .from('managed_supplier_matches')
      .select('id')
      .eq('request_id', shortlistOffer.request_id)
      .eq('supplier_id', shortlistOffer.supplier_id)
      .maybeSingle();

    const { data: inserted, error: insertError } = await supabase
      .from('offers')
      .insert({
        request_id:         shortlistOffer.request_id,
        supplier_id:        shortlistOffer.supplier_id,
        price:              shortlistOffer.unit_price,
        shipping_cost:      0,
        shipping_method:    shippingMethodText,
        moq:                shortlistOffer.moq,
        delivery_days:      shortlistOffer.production_time_days,
        note:               shortlistOffer.selection_reason || shortlistOffer.maabar_notes || null,
        status:             'accepted',
        managed_match_id:   matchRow?.id || null,
        managed_visibility: 'buyer_visible',
        shortlisted_at:     now,
        negotiation_note:   negotiationNote,
      })
      .select()
      .maybeSingle();
    if (insertError) throw insertError;

    if (inserted?.id) {
      await supabase
        .from('managed_shortlisted_offers')
        .update({ offer_id: inserted.id })
        .eq('id', shortlistOffer.id);
    }
    return inserted;
  }

  /* ── Choose flow (mirrors web chooseManagedOffer) ── */
  function handleChoose(offer) {
    Alert.alert(
      tx('اختيار المورد', 'Choose Supplier'),
      tx(
        `هل تريد اختيار ${offer.supplier_name || 'هذا المورد'}؟`,
        `Choose ${offer.supplier_name || 'this supplier'}?`
      ),
      [
        { text: tx('إلغاء', 'Cancel'), style: 'cancel' },
        {
          text: tx('تأكيد', 'Confirm'),
          onPress: async () => {
            if (!request) return;
            setBusy(true);
            try {
              await recordManagedShortlistAction({ shortlistOffer: offer, action: 'choose_offer' });

              await supabase
                .from('managed_shortlisted_offers')
                .update({
                  selected_by_buyer: true,
                  buyer_selected_at: new Date().toISOString(),
                  status: 'selected_by_buyer',
                })
                .eq('id', offer.id);

              await supabase
                .from('managed_shortlisted_offers')
                .update({ selected_by_buyer: false })
                .eq('request_id', request.id)
                .neq('id', offer.id);

              let realOffer = null;
              try {
                realOffer = await ensureBuyerVisibleOfferForShortlist(offer);
              } catch (err) {
                console.error('ensureBuyerVisibleOfferForShortlist error:', err);
              }

              if (!realOffer) {
                Alert.alert(
                  tx('تعذر المتابعة', 'Unable to continue'),
                  tx('تعذر فتح صفحة الدفع الآن', 'Unable to open checkout right now'),
                );
                await load();
                return;
              }

              // Managed accept lands on `closed` so the supplier still
              // confirms readiness before payment — same waiting state the
              // direct-offer accept flow uses.
              await supabase
                .from('requests')
                .update({
                  managed_status: 'buyer_selected',
                  managed_last_buyer_action: 'choose_offer',
                  status: 'closed',
                })
                .eq('id', request.id);

              // Notify the chosen supplier so they can confirm readiness.
              if (realOffer.supplier_id) {
                try {
                  await supabase.from('notifications').insert({
                    user_id: realOffer.supplier_id,
                    type: 'managed_offer_accepted',
                    title_ar: 'تم قبول عرضك المُدار — أكّد جاهزيتك',
                    title_en: 'Your managed offer was accepted — confirm readiness',
                    title_zh: '您的托管报价已被接受 — 请确认就绪',
                    ref_id: request.id,
                    is_read: false,
                  });
                } catch (e) { console.error('[ManagedRequest] notify supplier error:', e); }
              }

              await load();
              Alert.alert(
                tx('تم قبول العرض', 'Offer Accepted', '报价已接受'),
                tx(
                  'في انتظار تأكيد المورد. سيفتح خيار الدفع بعد التأكيد.',
                  'Waiting for the supplier to confirm readiness. Payment will unlock once confirmed.',
                  '等待供应商确认就绪。确认后将可付款。',
                ),
                [{ text: 'OK', onPress: () => navigation.goBack() }],
              );
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  }

  /* ── Negotiate flow (mirrors web requestManagedNegotiation) ── */
  function openNegotiate(offer) {
    setNegotiateReason('');
    setNegotiateFor(offer);
  }

  async function submitNegotiate() {
    if (!negotiateFor || !request) return;
    const reason = negotiateReason.trim();
    if (!reason) {
      Alert.alert(tx('سبب مطلوب', 'Reason required'), tx('يرجى إدخال سبب التفاوض.', 'Please enter a negotiation reason.'));
      return;
    }
    setBusy(true);
    try {
      await recordManagedShortlistAction({ shortlistOffer: negotiateFor, action: 'request_negotiation', reason });
      await supabase
        .from('requests')
        .update({ managed_status: 'sourcing', managed_last_buyer_action: 'request_negotiation' })
        .eq('id', request.id);
      setNegotiateFor(null);
      setNegotiateReason('');
      await load();
      Alert.alert(
        tx('تم الإرسال', 'Sent'),
        tx('سيتواصل معبر مع المورد بشأن التفاوض.', 'Maabar will contact the supplier about the negotiation.'),
      );
    } finally {
      setBusy(false);
    }
  }

  /* ── Reject flow (mirrors web rejectManagedOffer) ── */
  function handleReject(offer) {
    Alert.alert(
      tx('رفض العرض', 'Reject Offer'),
      tx('هل تريد رفض هذا العرض؟', 'Reject this offer?'),
      [
        { text: tx('إلغاء', 'Cancel'), style: 'cancel' },
        {
          text: tx('رفض', 'Reject'),
          style: 'destructive',
          onPress: async () => {
            if (!request) return;
            setBusy(true);
            try {
              await recordManagedShortlistAction({ shortlistOffer: offer, action: 'not_suitable' });
              await supabase
                .from('managed_shortlisted_offers')
                .update({ status: 'dismissed' })
                .eq('id', offer.id);
              await supabase
                .from('requests')
                .update({ managed_last_buyer_action: 'not_suitable' })
                .eq('id', request.id);
              await load();
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  }

  /* ── Restart search flow (mirrors web restartManagedSearch) ── */
  function handleRestartSearch() {
    Alert.alert(
      tx('إعادة البحث', 'Restart Search'),
      tx('هل تريد إعادة البحث عن موردين؟', 'Do you want to restart supplier search?'),
      [
        { text: tx('إلغاء', 'Cancel'), style: 'cancel' },
        {
          text: tx('نعم، إعادة', 'Yes, Restart'),
          onPress: async () => {
            if (!request) return;
            setBusy(true);
            try {
              await recordManagedShortlistAction({ action: 'restart_search' });
              await supabase
                .from('requests')
                .update({
                  managed_status: 'sourcing',
                  managed_last_buyer_action: 'restart_search',
                  managed_research_requested_count: (request.managed_research_requested_count || 0) + 1,
                })
                .eq('id', request.id);
              await load();
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={s.back}>{tx('← رجوع', '← Back')}</Text>
        </TouchableOpacity>
        <Text style={s.title}>{tx('العروض المختارة', 'Selected Offers')}</Text>
        <View style={{ width: 60 }} />
      </View>

      {!!title && <Text style={s.subtitle} numberOfLines={2}>{title}</Text>}

      <View style={s.banner}>
        <Text style={s.bannerText}>
          {tx('مَعبر اختار لك أفضل 3 موردين. اختر وتفاوض مباشرة.', 'Maabar selected the top 3 suppliers for you. Choose and negotiate directly.')}
        </Text>
      </View>

      {/* Pipeline status */}
      {!!request?.managed_status && (
        <View style={s.pipelineBox}>
          <View style={s.pipelineRow}>
            {MANAGED_STATUS_ORDER.map((step, i) => {
              const currentIdx = MANAGED_STATUS_ORDER.indexOf(request.managed_status);
              const done   = currentIdx >= 0 && i < currentIdx;
              const active = i === currentIdx;
              const isLast = i === MANAGED_STATUS_ORDER.length - 1;
              return (
                <React.Fragment key={step}>
                  <View style={s.pipelineStep}>
                    <View style={[s.pipelineDot,
                      done   && s.pipelineDotDone,
                      active && s.pipelineDotActive,
                    ]} />
                    {active && (
                      <Text style={s.pipelineStepLabel} numberOfLines={2}>
                        {getManagedStatusLabel(step)}
                      </Text>
                    )}
                  </View>
                  {!isLast && (
                    <View style={[s.pipelineLine, done && s.pipelineLineDone]} />
                  )}
                </React.Fragment>
              );
            })}
          </View>
          <Text style={s.pipelineStatusText}>
            {tx('المرحلة الحالية: ', 'Current stage: ')}
            <Text style={s.pipelineStatusValue}>{getManagedStatusLabel(request.managed_status)}</Text>
          </Text>
        </View>
      )}

      {/* Brief card — what Maabar extracted from the request */}
      {(() => {
        if (!brief) return null;
        const lang            = getLang();
        const cleaned         = (brief.cleaned_description || '').trim();
        const supplierBriefTx = (pickSupplierBrief(brief, lang) || '').trim();
        const confidence      = brief.ai_confidence;
        if (!cleaned && !supplierBriefTx && !confidence) return null;

        return (
          <View style={s.briefBox}>
            <View style={s.briefHeader}>
              <Text style={s.briefTitle}>{tx('ملخّص معبر لطلبك', 'Maabar’s brief for your request')}</Text>
              {!!confidence && (
                <View style={[s.briefConfidence, confidence === 'high' && s.briefConfidenceHigh, confidence === 'low' && s.briefConfidenceLow]}>
                  <Text style={[s.briefConfidenceText, confidence === 'high' && s.briefConfidenceTextHigh, confidence === 'low' && s.briefConfidenceTextLow]}>
                    {aiConfidenceLabel(confidence)}
                  </Text>
                </View>
              )}
            </View>

            {!!cleaned && (
              <View style={s.briefSection}>
                <Text style={s.briefSectionLabel}>{tx('طلبك بصيغة مهنية:', 'Your request, cleaned up:')}</Text>
                <Text style={s.briefSectionBody}>{cleaned}</Text>
              </View>
            )}

            {!!supplierBriefTx && (
              <View style={s.briefSection}>
                <Text style={s.briefSectionLabel}>{tx('ما يراه المورد:', 'What suppliers see:')}</Text>
                <Text style={s.briefSectionBody}>{supplierBriefTx}</Text>
              </View>
            )}
          </View>
        );
      })()}

      {/* Restart search — always available on the managed page */}
      {!loading && !!request && (
        <View style={s.topActions}>
          <TouchableOpacity
            style={s.restartBtn}
            onPress={handleRestartSearch}
            activeOpacity={0.8}
            disabled={busy}
          >
            <Text style={s.restartBtnText}>{tx('إعادة البحث', 'Restart Search')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {loading ? (
        <View style={s.center}><ActivityIndicator color={C.textDisabled} size="large" /></View>
      ) : offers.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyText}>{tx('القائمة المختصرة غير جاهزة بعد', 'Shortlist not ready yet')}</Text>
          <Text style={s.emptySubText}>{tx('سيتم إشعارك عند اكتمالها', 'You will be notified when it\'s ready')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
          {offers.map((offer, idx) => {
            const isSelected   = !!offer.selected_by_buyer;
            const isDismissed  = offer.status === 'dismissed';
            const currency     = offer.currency || 'USD';
            const unitPrice    = offer.unit_price != null
              ? `${((v) => v % 1 === 0 ? String(v) : v.toFixed(2))(Number(offer.unit_price))} ${currency}`
              : '—';
            const supplierName = pickSupplierName(offer);
            const verification = deriveVerificationLevel(offer);

            return (
              <View key={offer.id} style={[s.card, isSelected && s.cardSelected, isDismissed && s.cardDismissed]}>
                {/* Rank badge */}
                <View style={s.rankRow}>
                  <View style={s.rankBadge}>
                    <Text style={s.rankText}>#{idx + 1}</Text>
                  </View>
                  {isSelected && (
                    <View style={s.selectedBadge}>
                      <Text style={s.selectedText}>✓ {tx('مختار', 'Selected')}</Text>
                    </View>
                  )}
                  {isDismissed && (
                    <View style={s.dismissedBadge}>
                      <Text style={s.dismissedText}>{tx('مرفوض', 'Rejected')}</Text>
                    </View>
                  )}
                  <Text style={s.supplierName} numberOfLines={1}>
                    {supplierName || tx('مورد', 'Supplier')}
                    {offer.profile?.maabar_supplier_id ? ` · ${offer.profile.maabar_supplier_id}` : ''}
                  </Text>
                </View>

                {/* Verification level */}
                {!!verification && (
                  <Text style={s.verifiedLine}>
                    {verificationLabel(verification)}
                  </Text>
                )}

                {/* Pricing row */}
                <View style={s.priceRow}>
                  <View style={s.priceItem}>
                    <Text style={s.priceLabel}>{tx('سعر الوحدة', 'Unit Price')}</Text>
                    <Text style={s.priceValue}>{unitPrice}</Text>
                  </View>
                  {!!offer.moq && (
                    <View style={s.priceItem}>
                      <Text style={s.priceLabel}>{tx('الحد الأدنى', 'MOQ')}</Text>
                      <Text style={s.priceValue}>{offer.moq} {tx('وحدة', 'units')}</Text>
                    </View>
                  )}
                  {!!offer.production_time_days && (
                    <View style={s.priceItem}>
                      <Text style={s.priceLabel}>{tx('مدة التجهيز', 'Lead time')}</Text>
                      <Text style={s.priceValue}>{offer.production_time_days} {tx('يوم', 'd')}</Text>
                    </View>
                  )}
                </View>

                {/* Selection reason */}
                {!!offer.selection_reason && (
                  <View style={s.reasonBox}>
                    <Text style={s.reasonLabel}>{tx('سبب الاختيار:', 'Why selected:')}</Text>
                    <Text style={s.reasonText}>{offer.selection_reason}</Text>
                  </View>
                )}

                {/* Actions — hidden when selected or dismissed */}
                {!isSelected && !isDismissed && (
                  <View style={s.actions}>
                    <TouchableOpacity
                      style={s.negotiateBtn}
                      onPress={() => openNegotiate(offer)}
                      activeOpacity={0.8}
                      disabled={busy}
                    >
                      <Text style={s.negotiateBtnText}>{tx('تفاوض', 'Negotiate')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.rejectBtn}
                      onPress={() => handleReject(offer)}
                      activeOpacity={0.8}
                      disabled={busy}
                    >
                      <Text style={s.rejectBtnText}>{tx('رفض', 'Reject')}</Text>
                    </TouchableOpacity>
                    {!!offer.supplier_id && (
                      <TouchableOpacity
                        style={s.chatBtn}
                        onPress={() => navigation.navigate('Inbox', { screen: 'Chat', params: { partnerId: offer.supplier_id } })}
                        activeOpacity={0.8}
                      >
                        <Text style={s.chatBtnText}>{tx('تواصل', 'Chat')}</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={s.chooseBtn}
                      onPress={() => handleChoose(offer)}
                      activeOpacity={0.85}
                      disabled={busy}
                    >
                      <Text style={s.chooseBtnText}>{tx('اختر هذا المورد', 'Choose')}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Negotiation reason modal */}
      <Modal visible={!!negotiateFor} transparent animationType="slide" onRequestClose={() => setNegotiateFor(null)}>
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>{tx('طلب التفاوض', 'Request Negotiation')}</Text>
            <Text style={s.modalSub}>
              {tx('أخبر معبر بما تريد التفاوض عليه (السعر، الشروط، …).', 'Tell Maabar what you want to negotiate (price, terms, …).')}
            </Text>
            <TextInput
              style={s.modalInput}
              placeholder={tx('سبب التفاوض', 'Negotiation reason')}
              placeholderTextColor={C.textDisabled}
              value={negotiateReason}
              onChangeText={setNegotiateReason}
              multiline
              numberOfLines={4}
              textAlign={getLang() === 'ar' ? 'right' : 'left'}
            />
            <TouchableOpacity
              style={[s.modalSubmit, busy && { opacity: 0.6 }]}
              onPress={submitNegotiate}
              disabled={busy}
              activeOpacity={0.85}
            >
              {busy ? <ActivityIndicator color={C.btnPrimaryText} /> : <Text style={s.modalSubmitText}>{tx('إرسال', 'Send')}</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setNegotiateFor(null)}
              activeOpacity={0.7}
              style={{ alignItems: 'center', marginTop: 12 }}
              disabled={busy}
            >
              <Text style={{ color: C.textDisabled, fontFamily: F.ar, fontSize: 13 }}>{tx('إلغاء', 'Cancel')}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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
  },
  back:  { color: C.textSecondary, fontFamily: F.ar, fontSize: 14 },
  title: { color: C.textPrimary, fontFamily: F.arBold, fontSize: 17 },
  subtitle: {
    color: C.textSecondary, fontFamily: F.ar, fontSize: 13,
    textAlign: 'right', paddingHorizontal: 20, paddingVertical: 8,
  },

  banner: {
    backgroundColor: C.bgHover,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  bannerText: { color: C.textTertiary, fontFamily: F.ar, fontSize: 12, textAlign: 'right', lineHeight: 18 },

  list: { padding: 16, paddingBottom: 40 },

  pipelineBox: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
    backgroundColor: C.bgBase,
  },
  pipelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  pipelineStep: { alignItems: 'center', minWidth: 20 },
  pipelineDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: C.bgRaised,
    borderWidth: 1.5,
    borderColor: C.borderDefault,
  },
  pipelineDotDone:   { backgroundColor: '#5a9a72', borderColor: '#5a9a72' },
  pipelineDotActive: { backgroundColor: C.textPrimary, borderColor: C.textPrimary },
  pipelineLine: { flex: 1, height: 1.5, marginTop: 3, backgroundColor: C.borderSubtle },
  pipelineLineDone: { backgroundColor: '#5a9a72' },
  pipelineStepLabel: {
    fontSize: 8, textAlign: 'center', marginTop: 3,
    color: C.textPrimary, fontFamily: F.ar,
    fontWeight: '600', maxWidth: 44, lineHeight: 11,
  },
  pipelineStatusText: {
    fontSize: 12, color: C.textSecondary, fontFamily: F.ar,
    textAlign: 'right',
  },
  pipelineStatusValue: {
    color: C.textPrimary, fontFamily: F.arSemi,
  },

  topActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  restartBtn: {
    borderWidth: 1,
    borderColor: C.borderDefault,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: C.bgRaised,
  },
  restartBtnText: { color: C.textSecondary, fontFamily: F.ar, fontSize: 12 },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText:    { color: C.textSecondary, fontFamily: F.ar, fontSize: 15, marginBottom: 8 },
  emptySubText: { color: C.textTertiary, fontFamily: F.ar, fontSize: 13 },

  card: {
    backgroundColor: C.bgRaised,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.borderDefault,
    padding: 16,
    marginBottom: 14,
  },
  cardSelected:  { borderColor: C.green },
  cardDismissed: { opacity: 0.55 },

  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  rankBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.bgOverlay, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.borderDefault,
  },
  rankText: { color: C.textSecondary, fontFamily: F.enSemi, fontSize: 12 },
  selectedBadge:  { backgroundColor: C.greenSoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  selectedText:   { color: C.green, fontFamily: F.arSemi, fontSize: 11 },
  dismissedBadge: { backgroundColor: C.bgOverlay, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: C.borderDefault },
  dismissedText:  { color: C.textTertiary, fontFamily: F.arSemi, fontSize: 11 },
  supplierName:   { flex: 1, color: C.textPrimary, fontFamily: F.arBold, fontSize: 15, textAlign: 'right' },

  verifiedLine: { color: C.textTertiary, fontFamily: F.ar, fontSize: 11, textAlign: 'right', marginBottom: 12 },

  priceRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  priceItem: {
    flex: 1,
    backgroundColor: C.bgOverlay,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  priceLabel: { color: C.textTertiary, fontFamily: F.ar, fontSize: 10, marginBottom: 3 },
  priceValue: { color: C.textPrimary, fontFamily: F.numSemi, fontSize: 13 },

  reasonBox: {
    backgroundColor: C.bgOverlay,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  reasonLabel: { color: C.textTertiary, fontFamily: F.arSemi, fontSize: 11, textAlign: 'right', marginBottom: 3 },
  reasonText:  { color: C.textSecondary, fontFamily: F.ar, fontSize: 13, textAlign: 'right', lineHeight: 18 },

  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  negotiateBtn: {
    borderWidth: 1,
    borderColor: C.borderDefault,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  negotiateBtnText: { color: C.textSecondary, fontFamily: F.ar, fontSize: 13 },
  rejectBtn: {
    borderWidth: 1,
    borderColor: C.borderDefault,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  rejectBtnText: { color: C.red || '#b4401e', fontFamily: F.ar, fontSize: 13 },
  chatBtn: {
    borderWidth: 1,
    borderColor: C.borderDefault,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chatBtnText: { color: C.textPrimary, fontFamily: F.arSemi, fontSize: 13 },
  chooseBtn: {
    flex: 1,
    backgroundColor: C.btnPrimary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  chooseBtnText: { color: C.btnPrimaryText, fontFamily: F.arBold, fontSize: 14 },

  /* Negotiation modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: C.bgBase,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalHandle: {
    width: 40, height: 4,
    backgroundColor: C.borderDefault,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: { color: C.textPrimary, fontFamily: F.arBold, fontSize: 16, textAlign: 'right', marginBottom: 6 },
  modalSub:   { color: C.textTertiary, fontFamily: F.ar, fontSize: 12, textAlign: 'right', lineHeight: 18, marginBottom: 14 },
  modalInput: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: C.borderDefault,
    borderRadius: 12,
    padding: 12,
    color: C.textPrimary,
    fontFamily: F.ar,
    fontSize: 14,
    backgroundColor: C.bgRaised,
    marginBottom: 16,
    textAlignVertical: 'top',
  },
  modalSubmit: {
    backgroundColor: C.btnPrimary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalSubmitText: { color: C.btnPrimaryText, fontFamily: F.arBold, fontSize: 14 },

  /* Brief card */
  briefBox: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: C.bgRaised,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.borderDefault,
    padding: 14,
  },
  briefHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  briefTitle: { color: C.textPrimary, fontFamily: F.arBold, fontSize: 14, flex: 1, textAlign: 'right' },
  briefConfidence: {
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: C.bgOverlay,
    borderWidth: 1, borderColor: C.borderSubtle,
  },
  briefConfidenceHigh: { backgroundColor: C.greenSoft, borderColor: 'rgba(45,106,79,0.25)' },
  briefConfidenceLow:  { backgroundColor: 'rgba(224,92,92,0.08)', borderColor: 'rgba(224,92,92,0.25)' },
  briefConfidenceText:     { color: C.textSecondary, fontFamily: F.arSemi, fontSize: 11 },
  briefConfidenceTextHigh: { color: C.green },
  briefConfidenceTextLow:  { color: C.red || '#e05c5c' },
  briefSection: { marginTop: 8 },
  briefSectionLabel: { color: C.textTertiary, fontFamily: F.arSemi, fontSize: 11, textAlign: 'right', marginBottom: 4 },
  briefSectionBody:  { color: C.textSecondary, fontFamily: F.ar, fontSize: 13, textAlign: 'right', lineHeight: 20 },
});
