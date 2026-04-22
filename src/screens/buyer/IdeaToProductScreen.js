import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';
import GuestSignupModal from '../../components/GuestSignupModal';

/* ─── AI ──────────────────────────────────── */
const SUPABASE_URL = 'https://utzalmszfqfcofywfetv.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0emFsbXN6ZnFmY29meXdmZXR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NjE4NDAsImV4cCI6MjA4OTIzNzg0MH0.SSqFCeBRhKRIrS8oQasBkTsZxSv7uZGCT9pqfK-YmX8';
const AI_ENDPOINT = `${SUPABASE_URL}/functions/v1/maabar-ai`;

async function callMaabarAI(task, payload) {
  const res = await fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ task, personaName: 'وكيل معبر', payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) throw new Error(data?.error || `AI error ${res.status}`);
  return data;
}

async function getConversationReply({ conversation, userMessage, repName }) {
  const data = await callMaabarAI('product_conversation', {
    language: 'ar',
    conversation,
    userMessage,
    userProfile: { role: 'buyer', representativeName: repName },
  });
  return data.result;
}

async function generateBrief({ conversation }) {
  const userText = conversation
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .join('\n');
  const data = await callMaabarAI('idea_to_product', {
    language: 'ar',
    mode: 'build_product',
    initialIdea: userText,
    questions: [],
    answers: [],
  });
  return data.result;
}

/* ─── Constants ───────────────────────────── */
const SAUDI_NAMES = ['سلمان', 'فيصل', 'تركي', 'نورة', 'الجوهرة', 'ريم'];

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
  { val: 'none',      label: 'لا حاجة' },
  { val: 'preferred', label: 'مفضلة' },
  { val: 'required',  label: 'إلزامية' },
];

function buildDraft(report = {}) {
  return {
    titleAr: report.product_name_ar || report.product_name_en || '',
    quantity: report.moq || '',
    description: report.request_description || report.specs || '',
    category: report.category || 'other',
    budgetPerUnit: '',
    paymentPlan: '30',
    sampleReq: 'preferred',
  };
}

/* ─── Screen ──────────────────────────────── */
export default function IdeaToProductScreen({ navigation }) {
  const repName = useRef(SAUDI_NAMES[Math.floor(Math.random() * SAUDI_NAMES.length)]).current;
  const scrollRef = useRef(null);

  const initialMessages = [
    { id: 1, role: 'assistant', content: `مرحبا، معك ${repName} من معبر.` },
    { id: 2, role: 'assistant', content: 'كيف أقدر أساعدك؟ أخبرني عن فكرة منتجك.' },
  ];

  const [phase, setPhase] = useState('chat'); // chat | generating | report
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [report, setReport] = useState(null);
  const [draft, setDraft] = useState(buildDraft());
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showSignup, setShowSignup] = useState(false);

  // Auto-scroll whenever content changes
  const scrollToEnd = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };
  useEffect(scrollToEnd, [messages, isTyping, phase]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isTyping || phase !== 'chat') return;

    const conversationForAI = messages.map(m => ({ role: m.role, content: m.content }));
    const withUser = [...messages, { id: Date.now(), role: 'user', content: text }];
    setInput('');
    setMessages(withUser);
    setIsTyping(true);
    setFormError('');

    try {
      const reply = await getConversationReply({
        conversation: conversationForAI,
        userMessage: text,
        repName,
      });

      // Strip any stray Chinese characters that may bleed in when lang='ar'
      const replyText = String(reply?.reply || 'حدث خطأ، حاول مرة أخرى.')
        .replace(/[\u3400-\u9FFF]+/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();

      const withReply = [...withUser, { id: Date.now() + 1, role: 'assistant', content: replyText }];
      setMessages(withReply);

      const readyForBrief =
        reply?.enoughInfo || ['brief_ready', 'supplier_ready'].includes(reply?.nextStep);

      if (readyForBrief) {
        setIsTyping(false);
        setPhase('generating');
        try {
          const result = await generateBrief({ conversation: withReply });
          const newDraft = buildDraft(result);
          setReport(result);
          setDraft(newDraft);
          setMessages(prev => [
            ...prev,
            {
              id: Date.now() + 2,
              role: 'assistant',
              content: 'جهزت لك التقرير. راجعه وإذا مناسب أرسله لموردين مختصين.',
            },
          ]);
          setPhase('report');
        } catch {
          setMessages(prev => [
            ...prev,
            { id: Date.now() + 2, role: 'assistant', content: 'حدث خطأ أثناء إعداد التقرير، حاول مرة أخرى.' },
          ]);
          setPhase('chat');
        }
      } else {
        setIsTyping(false);
      }
    } catch {
      setMessages(prev => [
        ...prev,
        { id: Date.now() + 1, role: 'assistant', content: 'حدث خطأ، حاول مرة أخرى.' },
      ]);
      setIsTyping(false);
    }
  };

  const handleSubmit = async () => {
    if (!draft.titleAr || !String(draft.quantity).trim()) {
      setFormError('يرجى تعبئة اسم المنتج والكمية.');
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setShowSignup(true);
      return;
    }
    await doInsert(user.id);
  };

  const doInsert = async (userId) => {
    setSubmitting(true);
    setFormError('');
    const { error } = await supabase.from('requests').insert({
      buyer_id:           userId,
      title_ar:           draft.titleAr,
      title_en:           draft.titleAr,
      title_zh:           draft.titleAr,
      quantity:           String(draft.quantity),
      description:        draft.description || '',
      category:           draft.category || 'other',
      status:             'open',
      budget_per_unit:    draft.budgetPerUnit ? parseFloat(draft.budgetPerUnit) : null,
      payment_plan:       draft.paymentPlan ? parseInt(draft.paymentPlan, 10) : null,
      sample_requirement: draft.sampleReq || null,
      sourcing_mode:      'idea',
    });
    setSubmitting(false);
    if (error) { setFormError('حدث خطأ، حاول مرة أخرى.'); return; }
    try { navigation.navigate('Requests'); } catch {}
    // If guest: RootNavigator switches to BuyerTabs automatically after signup
  };

  const handleSignupSuccess = async (user) => {
    setShowSignup(false);
    await doInsert(user.id);
  };

  const setDraftField = (field, val) => setDraft(prev => ({ ...prev, [field]: val }));

  return (
    <SafeAreaView style={s.safe}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={s.closeBtn}>
          <Text style={s.closeBtnText}>✕</Text>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>اصنع فكرتك</Text>
          <Text style={s.headerSub}>وكيل معبر يحوّل فكرتك إلى طلب تصنيع</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={s.messages}
          contentContainerStyle={s.messagesContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map(m => (
            <ChatBubble key={m.id} role={m.role} content={m.content} />
          ))}

          {isTyping && <TypingIndicator />}

          {phase === 'generating' && (
            <View style={s.generatingBox}>
              <ActivityIndicator color={C.accent} size="small" style={{ marginBottom: 8 }} />
              <Text style={s.generatingText}>أرتب فكرتك وأبني لك brief احترافي...</Text>
            </View>
          )}

          {phase === 'report' && report && (
            <ReviewForm
              report={report}
              draft={draft}
              set={setDraftField}
              error={formError}
              submitting={submitting}
              onSubmit={handleSubmit}
            />
          )}
        </ScrollView>

        {/* Input bar (chat phase only) */}
        {phase === 'chat' && (
          <View style={s.inputBar}>
            <TextInput
              style={s.textInput}
              value={input}
              onChangeText={setInput}
              placeholder="اكتب رسالتك هنا..."
              placeholderTextColor={C.textDisabled}
              multiline
              maxLength={500}
              textAlign="right"
              textAlignVertical="center"
              onSubmitEditing={handleSend}
            />
            <TouchableOpacity
              style={[s.sendBtn, (!input.trim() || isTyping) && s.sendBtnOff]}
              onPress={handleSend}
              disabled={!input.trim() || isTyping}
              activeOpacity={0.8}
            >
              <Text style={s.sendBtnText}>إرسال</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      <GuestSignupModal
        visible={showSignup}
        onClose={() => setShowSignup(false)}
        onSuccess={handleSignupSuccess}
        navigation={navigation}
      />
    </SafeAreaView>
  );
}

/* ─── Chat Bubble ─────────────────────────── */
function ChatBubble({ role, content }) {
  const isUser = role === 'user';
  return (
    <View style={[s.bubble, isUser ? s.bubbleUser : s.bubbleAI]}>
      <Text style={[s.bubbleText, isUser ? s.bubbleTextUser : s.bubbleTextAI]}>
        {content}
      </Text>
    </View>
  );
}

function TypingIndicator() {
  return (
    <View style={[s.bubble, s.bubbleAI]}>
      <Text style={[s.bubbleText, s.bubbleTextAI]}>• • •</Text>
    </View>
  );
}

/* ─── Review Form ─────────────────────────── */
function ReviewForm({ report, draft, set, error, submitting, onSubmit }) {
  return (
    <View style={s.reviewBox}>
      <Text style={s.reviewTitle}>راجع الطلب قبل الإرسال</Text>
      <Text style={s.reviewHint}>
        هذا هو الطلب الذي سيصل للموردين. عدّل فقط ما يلزم ثم أرسله.
      </Text>

      {/* Report summary card */}
      {(report.factory_type || report.city || report.moq || report.timeline) && (
        <View style={s.reportCard}>
          {report.factory_type && <ReportRow label="نوع المصنع" value={report.factory_type} />}
          {report.city         && <ReportRow label="المدينة"     value={report.city} />}
          {report.moq          && <ReportRow label="MOQ"          value={report.moq} />}
          {report.timeline     && <ReportRow label="مدة التصنيع"  value={report.timeline} />}
        </View>
      )}

      {/* Editable fields */}
      <FormField label="اسم المنتج *" value={draft.titleAr}
        onChangeText={v => set('titleAr', v)} />
      <FormField label="الكمية المطلوبة *" value={draft.quantity}
        onChangeText={v => set('quantity', v)} keyboardType="numeric" />
      <FormField label="الميزانية للوحدة (اختياري)" value={draft.budgetPerUnit}
        onChangeText={v => set('budgetPerUnit', v)} keyboardType="numeric" />
      <FormField label="تفاصيل الطلب" value={draft.description}
        onChangeText={v => set('description', v)} multiline numberOfLines={4}
        style={{ minHeight: 90 }} />

      <ChipRow
        label="التصنيف"
        options={CATEGORIES}
        selected={draft.category}
        onSelect={v => set('category', v)}
      />
      <ChipRow
        label="خطة الدفع"
        options={PAYMENT_PLANS}
        selected={draft.paymentPlan}
        onSelect={v => set('paymentPlan', v)}
      />
      <ChipRow
        label="متطلبات العينة"
        options={SAMPLE_REQS}
        selected={draft.sampleReq}
        onSelect={v => set('sampleReq', v)}
      />

      {!!error && <Text style={s.errorText}>{error}</Text>}

      <TouchableOpacity
        style={[s.submitBtn, submitting && { opacity: 0.6 }]}
        onPress={onSubmit}
        disabled={submitting}
        activeOpacity={0.85}
      >
        {submitting
          ? <ActivityIndicator color={C.btnPrimaryText} />
          : <Text style={s.submitBtnText}>إرسال لموردين مختصين</Text>}
      </TouchableOpacity>
    </View>
  );
}

function ReportRow({ label, value }) {
  return (
    <View style={s.reportRow}>
      <Text style={s.reportValue}>{value}</Text>
      <Text style={s.reportLabel}>{label}</Text>
    </View>
  );
}

function FormField({ label, style, ...props }) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={[s.fieldInput, style]}
        placeholderTextColor={C.textDisabled}
        textAlign="right"
        textAlignVertical={props.multiline ? 'top' : 'center'}
        color={C.textPrimary}
        {...props}
      />
    </View>
  );
}

function ChipRow({ label, options, selected, onSelect }) {
  return (
    <View style={s.chipSection}>
      <Text style={s.chipLabel}>{label}</Text>
      <View style={s.chipRow}>
        {options.map(opt => (
          <TouchableOpacity
            key={opt.val}
            style={[s.chip, selected === opt.val && s.chipActive]}
            onPress={() => onSelect(opt.val)}
            activeOpacity={0.8}
          >
            <Text style={[s.chipText, selected === opt.val && s.chipTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

/* ─── Styles ──────────────────────────────── */
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bgBase },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
  },
  closeBtn: {
    width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { color: C.textSecondary, fontSize: 18 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: {
    color: C.textPrimary, fontFamily: F.arBold, fontSize: 16,
  },
  headerSub: {
    color: C.textSecondary, fontFamily: F.ar, fontSize: 11, marginTop: 2, textAlign: 'center',
  },

  messages: { flex: 1 },
  messagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 12,
  },

  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: C.btnPrimary,
    borderBottomRightRadius: 4,
  },
  bubbleAI: {
    alignSelf: 'flex-start',
    backgroundColor: C.bgRaised,
    borderWidth: 1,
    borderColor: C.borderDefault,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontFamily: F.ar,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'right',
  },
  bubbleTextUser: { color: C.btnPrimaryText },
  bubbleTextAI:  { color: C.textPrimary },

  generatingBox: {
    alignSelf: 'flex-start',
    backgroundColor: C.bgRaised,
    borderWidth: 1,
    borderColor: C.borderDefault,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  generatingText: {
    color: C.textSecondary, fontFamily: F.ar, fontSize: 13,
  },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: C.borderSubtle,
    gap: 10,
    backgroundColor: C.bgBase,
  },
  textInput: {
    flex: 1,
    backgroundColor: C.bgRaised,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.borderMuted,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: F.ar,
    fontSize: 14,
    color: C.textPrimary,
    maxHeight: 100,
    textAlign: 'right',
  },
  sendBtn: {
    backgroundColor: C.btnPrimary,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnOff: { opacity: 0.35 },
  sendBtnText: {
    color: C.btnPrimaryText, fontFamily: F.arBold, fontSize: 13,
  },

  /* Review Form */
  reviewBox: {
    marginTop: 8,
    backgroundColor: C.bgRaised,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.borderDefault,
    padding: 18,
  },
  reviewTitle: {
    color: C.textPrimary, fontFamily: F.arBold, fontSize: 16,
    textAlign: 'right', marginBottom: 6,
  },
  reviewHint: {
    color: C.textSecondary, fontFamily: F.ar, fontSize: 12,
    lineHeight: 20, textAlign: 'right', marginBottom: 16,
  },

  reportCard: {
    backgroundColor: C.bgBase,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    padding: 14,
    marginBottom: 18,
  },
  reportRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
  },
  reportLabel: {
    color: C.textSecondary, fontFamily: F.ar, fontSize: 12,
  },
  reportValue: {
    color: C.textPrimary, fontFamily: F.arSemi, fontSize: 13, textAlign: 'right', flex: 1, marginLeft: 12,
  },

  fieldWrap: { marginBottom: 14 },
  fieldLabel: {
    color: C.textSecondary, fontFamily: F.ar, fontSize: 11,
    textAlign: 'right', marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: C.bgBase,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.borderMuted,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: F.ar,
    fontSize: 14,
    color: C.textPrimary,
    textAlign: 'right',
  },

  chipSection: { marginBottom: 14 },
  chipLabel: {
    color: C.textSecondary, fontFamily: F.ar, fontSize: 11,
    textAlign: 'right', marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-end',
  },
  chip: {
    borderWidth: 1,
    borderColor: C.borderDefault,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: C.bgBase,
  },
  chipActive: {
    borderColor: C.btnPrimary,
    backgroundColor: C.btnPrimary,
  },
  chipText: {
    color: C.textSecondary, fontFamily: F.ar, fontSize: 13,
  },
  chipTextActive: {
    color: C.btnPrimaryText, fontFamily: F.arSemi,
  },

  errorText: {
    color: C.red, fontFamily: F.ar, fontSize: 13,
    textAlign: 'right', marginBottom: 10,
  },
  submitBtn: {
    backgroundColor: C.btnPrimary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnText: {
    color: C.btnPrimaryText, fontFamily: F.arBold, fontSize: 16,
  },
});
