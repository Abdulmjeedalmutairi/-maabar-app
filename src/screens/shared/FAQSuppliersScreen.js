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
    title:   'أسئلة المورد',
    items: [
      {
        q: 'كيف أسجّل كمورد؟',
        a: 'اضغط «انضم كمورد» من صفحة الموردين، أدخل بيانات الشركة الأساسية ورابط متجرك (Alibaba / 1688 / الموقع الرسمي)، ثم أكّد بريدك الإلكتروني.',
      },
      {
        q: 'كم يستغرق التحقق؟',
        a: 'بعد تأكيد البريد تدخل مباشرة إلى لوحة المورد. المراجعة الكاملة تستغرق من 3 إلى 5 أيام عمل.',
      },
      {
        q: 'كيف أرى الطلبات وأرد عليها؟',
        a: 'من لوحة المورد، افتح «الطلبات» لرؤية طلبات التجار. اضغط أي طلب لتقديم عرضك مع السعر والـ MOQ ومدة التسليم.',
      },
      {
        q: 'متى أستلم المدفوعات؟',
        a: 'الدفعة الأولى تصلك بعد قبول التاجر للعرض وسداده. الدفعة الثانية بعد إرسالك إشعار «الشحنة جاهزة».',
      },
      {
        q: 'ماذا يعني وضع «قيد المراجعة»؟',
        a: 'يعني أن فريق مَعبر يراجع بياناتك. ستتلقى إشعاراً فور الموافقة أو طلب توضيح.',
      },
      {
        q: 'هل يمكنني طلب دفع خارج مَعبر؟',
        a: 'لا. تشترط الشروط أن تتم جميع المدفوعات عبر المنصة لضمان حماية الطرفين.',
      },
    ],
  },
  en: {
    eyebrow: 'Maabar · Help Center',
    title:   'Supplier FAQ',
    items: [
      {
        q: 'How do I register as a supplier?',
        a: 'Tap "Join as Supplier" from the supplier page, enter your basic company details and a trade link (Alibaba / 1688 / your official website), then confirm your email.',
      },
      {
        q: 'How long does verification take?',
        a: 'After confirming your email you enter the supplier dashboard immediately. Full review takes 3 to 5 business days.',
      },
      {
        q: 'How do I see requests and respond?',
        a: 'From the supplier dashboard, open "Requests" to see trader requests. Tap any request to submit your offer with price, MOQ, and lead time.',
      },
      {
        q: 'When do I receive payments?',
        a: 'The first installment arrives after the trader accepts your offer and pays. The second installment arrives after you send a "Shipment Ready" notification.',
      },
      {
        q: 'What does "Under Review" status mean?',
        a: 'It means the Maabar team is reviewing your information. You will receive a notification once approved or if clarification is needed.',
      },
      {
        q: 'Can I request payment outside Maabar?',
        a: 'No. Terms require all payments to flow through the platform to protect both parties.',
      },
    ],
  },
  zh: {
    eyebrow: 'Maabar · 帮助中心',
    title:   '供应商常见问题',
    items: [
      {
        q: '如何注册成为供应商？',
        a: '在供应商页面点击"免费加入供应商"，填写公司基础信息和店铺链接（Alibaba / 1688 / 官网），然后确认邮箱。',
      },
      {
        q: '认证需要多长时间？',
        a: '邮箱确认后可立即进入供应商控制台。完整审核通常需要 3 至 5 个工作日。',
      },
      {
        q: '如何查看询价并回复？',
        a: '在供应商控制台打开"询盘"，可查看买家需求。点击任意询价，填写价格、MOQ 和交期后提交报价。',
      },
      {
        q: '我何时收到款项？',
        a: '首付款在买家接受报价并付款后到账；第二笔款项在您发出"货物就绪"通知后支付。',
      },
      {
        q: '"审核中"状态是什么意思？',
        a: '表示 Maabar 团队正在审核您的资料。审核通过或需要补充信息时，您将收到通知。',
      },
      {
        q: '可以要求平台外付款吗？',
        a: '不可以。条款要求所有款项通过平台流转，以保护双方利益。',
      },
    ],
  },
};

export default function FAQSuppliersScreen({ navigation }) {
  const lang = getLang();
  const d    = QA[lang] || QA.ar;
  const isAr = lang === 'ar';
  const bodyFont = isAr ? F.ar   : F.en;
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

  eyebrow: {
    fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase',
    color: C.textTertiary, marginBottom: 16, paddingHorizontal: 4,
  },

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
