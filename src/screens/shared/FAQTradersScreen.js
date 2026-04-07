import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getLang } from '../../lib/lang';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';

// ── Q&A content (no web equivalent exists — created for app) ─────────────────
const QA = {
  ar: {
    eyebrow: 'مَعبر · مركز المساعدة',
    title:   'أسئلة التاجر',
    items: [
      {
        q: 'كيف أرفع طلباً جديداً؟',
        a: 'من لوحة التاجر، اضغط «طلب جديد»، أدخل اسم المنتج والكمية والمواصفات والميزانية التقريبية. يُنشر الطلب فوراً للموردين المعتمدين.',
      },
      {
        q: 'كيف يعمل نظام الدفع المرحلي؟',
        a: 'تختار بين 30٪ أو 50٪ أو 100٪ مقدماً. الدفعة الأولى تُفعّل التجهيز، والثانية تُسدَّد بعد إشعار «الشحنة جاهزة» من المورد.',
      },
      {
        q: 'كيف أقارن العروض؟',
        a: 'تظهر عروض الموردين داخل الطلب مع السعر والـ MOQ ومدة التسليم. اضغط على أي عرض للاطلاع على تفاصيله الكاملة.',
      },
      {
        q: 'ماذا يحدث بعد تأكيد عرض؟',
        a: 'يُصبح التأكيد عقداً ملزماً. يبدأ المورد التجهيز بعد الدفعة الأولى، وتتابع حالة الطلب من اللوحة.',
      },
      {
        q: 'البضاعة وصلت تالفة أو مختلفة — ماذا أفعل؟',
        a: 'لديك 7 أيام من تاريخ الاستلام لرفع شكوى مع صور أو فيديو. تراجع مَعبر الشكوى خلال 3 أيام عمل.',
      },
      {
        q: 'متى يمكنني تقييم المورد؟',
        a: 'بعد اكتمال الصفقة وتأكيد الاستلام، تظهر خيار التقييم داخل تفاصيل الطلب.',
      },
    ],
  },
  en: {
    eyebrow: 'Maabar · Help Center',
    title:   'Trader FAQ',
    items: [
      {
        q: 'How do I post a new request?',
        a: 'From the trader dashboard, tap "New Request", then enter the product name, quantity, specifications, and estimated budget. The request is immediately published to approved suppliers.',
      },
      {
        q: 'How does staged payment work?',
        a: 'Choose between 30%, 50%, or 100% upfront. The first installment activates preparation; the second is paid after the supplier sends a "Shipment Ready" notification.',
      },
      {
        q: 'How do I compare offers?',
        a: 'Supplier offers appear inside the request with price, MOQ, and delivery time. Tap any offer to see full details.',
      },
      {
        q: 'What happens after I confirm an offer?',
        a: 'Confirmation becomes a binding agreement. The supplier starts preparation after the first payment, and you track the order from the dashboard.',
      },
      {
        q: 'My goods arrived damaged or different — what do I do?',
        a: 'You have 7 days from receipt to file a complaint with photos or video. Maabar reviews the complaint within 3 business days.',
      },
      {
        q: 'When can I rate the supplier?',
        a: 'After the transaction is complete and receipt is confirmed, the rating option appears inside the request details.',
      },
    ],
  },
  zh: {
    eyebrow: 'Maabar · 帮助中心',
    title:   '贸易商常见问题',
    items: [
      {
        q: '如何发布新的需求？',
        a: '在贸易商控制台点击"新建需求"，填写产品名称、数量、规格和预算。需求将立即发布给已认证的供应商。',
      },
      {
        q: '分阶段付款是如何运作的？',
        a: '可选择 30%、50% 或 100% 预付款。首付款启动供应商准备工作，第二笔款项在收到"货物就绪"通知后支付。',
      },
      {
        q: '如何比较报价？',
        a: '供应商报价显示在需求详情中，包含价格、MOQ 和交期信息。点击任意报价可查看完整详情。',
      },
      {
        q: '确认报价后会发生什么？',
        a: '确认即构成具有约束力的协议。供应商在收到首付款后开始准备，您可在控制台跟踪订单状态。',
      },
      {
        q: '货物到达时受损或与描述不符——该怎么办？',
        a: '您有 7 天时间（自收货起）提交带有照片或视频的投诉，Maabar 将在 3 个工作日内完成审查。',
      },
      {
        q: '何时可以评价供应商？',
        a: '交易完成并确认收货后，需求详情中将出现评价选项。',
      },
    ],
  },
};

export default function FAQTradersScreen({ navigation }) {
  const lang = getLang();
  const d    = QA[lang] || QA.ar;
  const isAr = lang === 'ar';
  const bodyFont = isAr ? F.ar   : F.en;
  const boldFont = isAr ? F.arBold : F.enBold;
  const semiFont = isAr ? F.arSemi : F.enSemi;

  const [open, setOpen] = useState(null);
  const toggle = (i) => setOpen(prev => (prev === i ? null : i));

  return (
    <SafeAreaView style={s.safe}>

      {/* ── Header ── */}
      <View style={[s.header, isAr && s.rowRtl]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} activeOpacity={0.7}>
          <Text style={[s.back, isAr && s.backRtl]}>←</Text>
        </TouchableOpacity>
        <Text style={[s.headerTitle, { fontFamily: semiFont }]}>{d.title}</Text>
        <View style={s.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── Eyebrow ── */}
        <Text style={[s.eyebrow, { fontFamily: bodyFont, textAlign: isAr ? 'right' : 'left' }]}>
          {d.eyebrow}
        </Text>

        {/* ── Accordion items ── */}
        {d.items.map((item, i) => (
          <TouchableOpacity
            key={i}
            style={[s.item, open === i && s.itemOpen]}
            onPress={() => toggle(i)}
            activeOpacity={0.85}
          >
            <View style={[s.itemHeader, isAr && s.rowRtl]}>
              <Text style={[s.question, { fontFamily: semiFont, textAlign: isAr ? 'right' : 'left', flex: 1 }]}>
                {item.q}
              </Text>
              <Text style={[s.chevron, open === i && s.chevronOpen]}>›</Text>
            </View>
            {open === i && (
              <Text style={[s.answer, { fontFamily: bodyFont, textAlign: isAr ? 'right' : 'left' }]}>
                {item.a}
              </Text>
            )}
          </TouchableOpacity>
        ))}

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bgBase },
  scroll: { padding: 16, paddingBottom: 48 },
  rowRtl: { flexDirection: 'row-reverse' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
    gap: 12,
  },
  back:        { color: C.textSecondary, fontSize: 22 },
  backRtl:     { transform: [{ scaleX: -1 }] },
  headerTitle: { flex: 1, color: C.textPrimary, fontSize: 16, textAlign: 'center' },
  headerSpacer:{ width: 22 },

  // Eyebrow
  eyebrow: {
    fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase',
    color: C.textTertiary, marginBottom: 16, paddingHorizontal: 4,
  },

  // Accordion
  item: {
    backgroundColor: C.bgRaised, borderRadius: 16,
    borderWidth: 1, borderColor: C.borderDefault,
    marginBottom: 8, padding: 18,
  },
  itemOpen: { borderColor: C.borderStrong },
  itemHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  question: { fontSize: 14, color: C.textPrimary, lineHeight: 22 },
  chevron: {
    color: C.textDisabled, fontSize: 20, lineHeight: 22,
    marginTop: 1, flexShrink: 0,
  },
  chevronOpen: {
    transform: [{ rotate: '90deg' }],
    color: C.textSecondary,
  },
  answer: {
    fontSize: 13, lineHeight: 22, color: C.textSecondary,
    marginTop: 14, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: C.borderSubtle,
  },
});
