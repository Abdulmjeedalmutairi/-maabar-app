import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
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

const MANAGED_STATUS_LABELS = {
  submitted:      { ar: 'تم التقديم',           en: 'Submitted' },
  admin_review:   { ar: 'قيد المراجعة',         en: 'Under Review' },
  sourcing:       { ar: 'قيد البحث عن موردين',  en: 'Sourcing Suppliers' },
  matching:       { ar: 'قيد المطابقة',          en: 'Matching' },
  buyer_review:   { ar: 'بانتظار مراجعتك',      en: 'Awaiting Your Review' },
  buyer_selected: { ar: 'تم الاختيار',          en: 'Selected' },
  negotiation:    { ar: 'قيد التفاوض',           en: 'Negotiation' },
  completed:      { ar: 'مكتمل',                en: 'Completed' },
};

const MANAGED_STATUS_ORDER = ['submitted', 'admin_review', 'sourcing', 'matching', 'buyer_review', 'buyer_selected', 'completed'];

function getManagedStatusLabel(status) {
  const entry = MANAGED_STATUS_LABELS[status];
  if (!entry) return status;
  return getLang() === 'ar' ? entry.ar : entry.en;
}

export default function ManagedRequestScreen({ route, navigation }) {
  const { requestId, title } = route.params || {};
  const [offers, setOffers]     = useState([]);
  const [request, setRequest]   = useState(null);
  const [loading, setLoading]   = useState(true);

  const load = useCallback(async () => {
    if (!requestId) { setLoading(false); return; }

    const [{ data: reqData }, { data: offersData }] = await Promise.all([
      supabase.from('requests').select('id, managed_status').eq('id', requestId).single(),
      supabase.from('managed_shortlisted_offers').select('*').eq('request_id', requestId).order('rank', { ascending: true }),
    ]);

    setRequest(reqData || null);
    setOffers(offersData || []);
    setLoading(false);
  }, [requestId]);

  useEffect(() => { load(); }, [load]);

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
            await supabase
              .from('managed_shortlisted_offers')
              .update({ selected_by_buyer: true })
              .eq('id', offer.id);
            await supabase
              .from('requests')
              .update({ managed_status: 'buyer_selected' })
              .eq('id', requestId);
            load();
          },
        },
      ]
    );
  }

  function handleNegotiate(offer) {
    Alert.alert(
      tx('التفاوض', 'Negotiate'),
      tx('سيتم التواصل مع المورد بشأن التفاوض.', 'Maabar will contact the supplier for negotiation.'),
      [{ text: tx('حسناً', 'OK') }]
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
              const done   = i < currentIdx;
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
            const isSelected = !!offer.selected_by_buyer;
            const unitPrice = offer.unit_price
              ? `${(Number(offer.unit_price) * 3.75).toLocaleString('ar-SA', { maximumFractionDigits: 2 })} ${tx('ر.س', 'SAR')}`
              : '—';

            return (
              <View key={offer.id} style={[s.card, isSelected && s.cardSelected]}>
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
                  <Text style={s.supplierName} numberOfLines={1}>
                    {offer.supplier_name || tx('مورد', 'Supplier')}
                  </Text>
                </View>

                {/* Verification level */}
                {!!offer.verification_level && (
                  <Text style={s.verifiedLine}>
                    {verificationLabel(offer.verification_level)}
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

                {/* Actions */}
                {!isSelected && (
                  <View style={s.actions}>
                    <TouchableOpacity
                      style={s.negotiateBtn}
                      onPress={() => handleNegotiate(offer)}
                      activeOpacity={0.8}
                    >
                      <Text style={s.negotiateBtnText}>{tx('تفاوض', 'Negotiate')}</Text>
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
  cardSelected: { borderColor: C.green },

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
  selectedBadge: { backgroundColor: C.greenSoft, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  selectedText:  { color: C.green, fontFamily: F.arSemi, fontSize: 11 },
  supplierName:  { flex: 1, color: C.textPrimary, fontFamily: F.arBold, fontSize: 15, textAlign: 'right' },

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
  priceValue: { color: C.textPrimary, fontFamily: F.enSemi, fontSize: 13 },

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
});
