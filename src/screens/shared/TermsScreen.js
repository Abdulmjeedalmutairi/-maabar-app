import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getLang } from '../../lib/lang';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';

// ── Constants (copied exactly from web Terms.jsx) ─────────────────────────────
const CR_NUMBER       = '7042243308';
const CONTACT_EMAIL   = 'info@maabar.io';
const WEBSITE_URL     = 'https://maabar.io';
const LAST_UPDATED_ISO = '2026-04-01';

// ── Sections (copied exactly from web Terms.jsx SECTIONS object) ──────────────
const SECTIONS = {
  ar: [
    { title: '1. تعريف المنصة', body: 'مَعبر هي منصة وساطة تجارية إلكترونية تربط التجار السعوديين بالموردين الصينيين. تعمل مَعبر بوصفها وسيطاً تجارياً فقط، وليست طرفاً في أي صفقة تُبرم بين المستخدمين. مسؤولية التحقق من المنتجات وجودتها وشروط التسليم تقع على عاتق الطرفين المتعاقدَين.' },
    { title: '2. شروط التسجيل', body: 'للتاجر: يجب أن يكون مقيماً أو يمارس نشاطاً تجارياً في المملكة العربية السعودية، وأن يُقر بصحة بياناته.\n\nللمورد: يجب أن يكون لديه سجل تجاري ساري، ويخضع لمراجعة وموافقة مَعبر قبل تفعيل حسابه. قد يستغرق الاعتماد 3-5 أيام عمل.\n\nيحق لمَعبر تعليق أي حساب أو إلغاؤه في حال ثبت انتهاك هذه الشروط.' },
    { title: '3. آلية إبرام العقود', body: 'تُبرم الصفقات عبر آلية العرض والقبول: يرفع التاجر طلباً، يُقدّم الموردون عروضهم، يختار التاجر العرض الأنسب ويؤكده. يُعدّ هذا التأكيد عقداً ملزماً بين الطرفين. تحتفظ مَعبر بسجل رقمي لكل عقد مبرم لمدة 3 سنوات.' },
    { title: '4. نظام الدفع المرحلي', body: 'تتيح مَعبر ثلاثة خيارات للدفع:\n• 30٪ مقدماً (الأكثر أماناً): يدفع التاجر 30٪ لبدء التجهيز، والباقي 70٪ قبل الشحن.\n• 50٪ مقدماً (متوازن): يدفع التاجر 50٪، والباقي قبل الشحن مع أولوية في التجهيز.\n• 100٪ مقدماً (أسرع شحن): دفعة واحدة كاملة، والمورد يشحن فوراً.\n\nالدفعة الأولى تُمثّل التزام التاجر وتُمكّن المورد من بدء الإنتاج. الدفعة الثانية تُسدَّد بعد إشعار «الشحنة جاهزة» من المورد.' },
    { title: '5. العمولة', body: 'تأخذ مَعبر 0% عمولة على الصفقة.' },
    { title: '6. حقوق وواجبات التاجر', body: 'الحقوق: الاطلاع على عروض الموردين المعتمدين، المطالبة بالاسترداد في حالات التقصير الثابتة، تقييم الموردين بعد اكتمال الصفقة.\n\nالواجبات: تقديم معلومات دقيقة في الطلبات، الالتزام بالدفع بعد قبول العرض، الإبلاغ عن أي مشكلة خلال 7 أيام من الاستلام.' },
    { title: '7. حقوق وواجبات المورد', body: 'الحقوق: استلام المدفوعات وفق الجدول المتفق عليه، الرد على الشكاوى وتقديم توثيق كافٍ.\n\nالواجبات: الالتزام بمواصفات المنتج والتسليم في المدة المتفق عليها، إشعار التاجر بأي تأخير، وعدم طلب مدفوعات خارج منصة مَعبر.' },
    { title: '8. سياسة المشاكل والإرجاع', body: '1. إذا وصلت البضاعة تالفة أو مختلفة عن الوصف: للتاجر 7 أيام من تاريخ الاستلام لرفع شكوى، مع إرفاق صور أو فيديو يوثّق المشكلة، وتراجع مَعبر الشكوى خلال 3 أيام عمل.\n\n2. إذا لم يشحن المورد بعد استلام الدفعة الثانية: يحق للتاجر رفع شكوى فورية، وتتدخل مَعبر وتوقف حساب المورد مؤقتاً، وتُرجع الدفعة الثانية للتاجر.\n\n3. الدفعة الأولى (30٪ أو 50٪): غير قابلة للاسترداد إذا بدأ المورد التجهيز فعلاً، وقابلة للاسترداد إذا ثبت التقصير من المورد.\n\n4. قرار مَعبر في النزاعات نهائي وملزم للطرفين.' },
    { title: '9. تسوية النزاعات', body: 'تلتزم مَعبر بالبت في النزاعات خلال 7 أيام عمل من استلام الشكوى المكتملة. تعمل مَعبر كطرف محايد وتستند إلى الأدلة المقدمة من الطرفين. قرار مَعبر نهائي وملزم.' },
    { title: '10. الخصوصية وحماية البيانات', body: 'تلتزم مَعبر بنظام حماية البيانات الشخصية السعودي (PDPL). نجمع البيانات الضرورية فقط لتشغيل المنصة ولا نبيعها لأي طرف ثالث. يحق لكل مستخدم طلب الاطلاع على بياناته أو تصحيحها أو حذفها.' },
    { title: '11. الأمن السيبراني', body: 'في حال وقوع اختراق أمني يمس بيانات المستخدمين، تلتزم مَعبر بإشعار المتضررين خلال 3 أيام عمل من اكتشاف الاختراق، وفق متطلبات الهيئة الوطنية للأمن السيبراني.' },
    { title: '12. التعديلات على الشروط', body: 'تحتفظ مَعبر بحق تعديل هذه الشروط في أي وقت. يُشترط إشعار المستخدمين المسجّلين بأي تعديل جوهري قبل أسبوع على الأقل من تاريخ سريانه. استمرار استخدام المنصة بعد التعديل يُعدّ قبولاً ضمنياً.' },
    { title: '13. الاختصاص القضائي', body: 'تخضع هذه الشروط لأنظمة المملكة العربية السعودية. في حال نشوء نزاع لم يُسوَّ وفق آلية مَعبر، يختص القضاء السعودي بالنظر فيه.' },
    { title: '14. حفظ العقود والبيانات', body: 'تحتفظ مَعبر بسجلات العقود والمحادثات والمدفوعات لمدة 3 سنوات من تاريخ إتمام الصفقة أو إنهائها.' },
  ],
  en: [
    { title: '1. Platform Definition', body: 'Maabar is an electronic trade intermediary platform connecting Saudi traders with Chinese suppliers. Maabar acts only as an intermediary and is not a party to any transaction concluded between users. Responsibility for verifying products, quality, and delivery terms remains with the contracting parties.' },
    { title: '2. Registration Terms', body: 'For traders: the user must be resident in, or operating a business in, Saudi Arabia and must confirm that submitted data is accurate.\n\nFor suppliers: the user must hold a valid commercial registration or business license and is subject to Maabar review and approval before account activation. Approval may take 3-5 business days.\n\nMaabar may suspend or terminate any account that violates these terms.' },
    { title: '3. Contract Formation', body: 'Transactions are formed through an offer-and-acceptance model: the trader posts a request, suppliers submit offers, and the trader confirms the selected offer. That confirmation constitutes a binding agreement between the two parties. Maabar retains a digital record of each concluded contract for 3 years.' },
    { title: '4. Staged Payment System', body: 'Maabar offers three payment options:\n• 30% upfront: the trader pays 30% to begin preparation, and the remaining 70% before shipping.\n• 50% upfront: the trader pays 50%, and the remaining balance before shipping with priority preparation.\n• 100% upfront: full payment in one installment, after which the supplier proceeds directly.\n\nThe first installment represents the trader\'s commitment and enables the supplier to begin production. The second installment is paid after a "Shipment Ready" notification from the supplier.' },
    { title: '5. Commission', body: 'Maabar charges 0% commission on the transaction.' },
    { title: '6. Trader Rights and Obligations', body: 'Rights: access approved supplier offers, request refunds in proven cases of supplier default, and rate suppliers after the transaction is completed.\n\nObligations: provide accurate request information, honor payment after accepting an offer, and report any problem within 7 days of receipt.' },
    { title: '7. Supplier Rights and Obligations', body: 'Rights: receive payments according to the agreed schedule, respond to complaints, and provide sufficient documentation.\n\nObligations: deliver products matching the agreed specifications within the agreed timeframe, notify the trader of any delay, and avoid requesting payment outside Maabar.' },
    { title: '8. Issues and Returns Policy', body: '1. If goods arrive damaged or materially different from the description, the trader has 7 days from receipt to file a complaint with supporting photos or video, and Maabar reviews the complaint within 3 business days.\n\n2. If the supplier fails to ship after receiving the second installment, the trader may file an immediate complaint, Maabar may intervene and temporarily suspend the supplier account, and the second installment may be returned to the trader.\n\n3. The first installment (30% or 50%) is not refundable if the supplier has genuinely started preparation, but it may be refundable if supplier default is proven.\n\n4. Maabar\'s decision in disputes is final and binding on both parties.' },
    { title: '9. Dispute Resolution', body: 'Maabar undertakes to review and resolve disputes within 7 business days of receiving a complete complaint. Maabar acts as a neutral party and relies on the evidence submitted by both sides. Its decision is final and binding.' },
    { title: '10. Privacy and Data Protection', body: 'Maabar complies with Saudi Arabia\'s Personal Data Protection Law (PDPL). We collect only the data necessary to operate the platform and do not sell user data to any third party. Users may request access to, correction of, or deletion of their data.' },
    { title: '11. Cybersecurity', body: 'If a security incident affects user data, Maabar undertakes to notify affected users within 3 business days from discovery of the incident, in line with applicable Saudi cybersecurity requirements.' },
    { title: '12. Amendments', body: 'Maabar reserves the right to amend these terms at any time. Registered users must be notified of any material change at least one week before it takes effect. Continued use of the platform after the change constitutes implied acceptance.' },
    { title: '13. Governing Law and Jurisdiction', body: 'These terms are governed by the laws of the Kingdom of Saudi Arabia. If a dispute is not resolved through Maabar\'s mechanism, the Saudi courts shall have jurisdiction.' },
    { title: '14. Record Retention', body: 'Maabar retains records of contracts, communications, and payments for 3 years from the date a transaction is completed or terminated.' },
  ],
  zh: [
    { title: '1. 平台定义', body: 'Maabar 是一个电子贸易中介平台，连接沙特贸易商与中国供应商。Maabar 仅作为中介存在，并非用户之间交易的合同方。产品核验、质量判断以及交付条款的确认责任由交易双方自行承担。' },
    { title: '2. 注册条款', body: '贸易商：用户须在沙特阿拉伯居住或经营业务，并确认所提交资料真实准确。\n\n供应商：用户须持有有效商业登记或营业执照，并在账户激活前接受 Maabar 审核与批准。审核通常需要 3-5 个工作日。\n\n如账户违反本条款，Maabar 可暂停或终止该账户。' },
    { title: '3. 合同成立方式', body: '交易通过"报价—接受"的方式成立：贸易商发布需求，供应商提交报价，贸易商确认所选报价。该确认构成双方之间具有约束力的协议。Maabar 会保留每份已成立合同的数字记录 3 年。' },
    { title: '4. 分阶段付款制度', body: 'Maabar 提供三种付款方式：\n• 30% 预付款：贸易商支付 30% 启动准备，剩余 70% 于发货前支付。\n• 50% 预付款：贸易商支付 50%，余额于发货前支付，并享有优先准备。\n• 100% 一次性付款：全额支付后由供应商直接推进发货。\n\n首付款代表贸易商的交易承诺，并使供应商能够开始生产。第二笔款项在供应商发出"货物就绪"通知后支付。' },
    { title: '5. 平台佣金', body: 'Maabar 对交易收取 0% 佣金。' },
    { title: '6. 贸易商的权利与义务', body: '权利：查看已批准供应商的报价、在供应商违约得到证实时申请退款、在交易完成后评价供应商。\n\n义务：在需求中提供准确信息、接受报价后履行付款义务，并在收货后 7 天内报告问题。' },
    { title: '7. 供应商的权利与义务', body: '权利：按照约定时间表收款、回应投诉并提供充分证明材料。\n\n义务：在约定时间内交付符合规格的产品、如有延迟及时通知贸易商，并不得要求平台外付款。' },
    { title: '8. 问题与退货政策', body: '1. 如货物损坏或与描述存在重大差异，贸易商可在收货后 7 天内提交投诉，并附上照片或视频作为证明，Maabar 将在 3 个工作日内审查。\n\n2. 如供应商在收到第二笔款项后仍未发货，贸易商可立即投诉，Maabar 可介入并暂时暂停该供应商账户，第二笔款项可退还给贸易商。\n\n3. 首付款（30% 或 50%）如供应商已实际开始准备，则通常不予退还；如已证明供应商违约，则可能予以退还。\n\n4. Maabar 在争议中的决定为最终决定，并对双方具有约束力。' },
    { title: '9. 争议解决', body: 'Maabar 承诺在收到完整投诉后的 7 个工作日内完成争议审查与处理。Maabar 作为中立方，根据双方提交的证据作出决定，该决定为最终且具有约束力。' },
    { title: '10. 隐私与数据保护', body: 'Maabar 遵守沙特阿拉伯个人数据保护法（PDPL）。我们仅收集运营平台所需的数据，不会向任何第三方出售用户数据。用户可请求访问、更正或删除其个人数据。' },
    { title: '11. 网络安全', body: '如发生影响用户数据的安全事件，Maabar 承诺自发现之日起 3 个工作日内通知受影响用户，并遵守适用的沙特网络安全要求。' },
    { title: '12. 条款修改', body: 'Maabar 保留随时修改本条款的权利。若变更属于重大修改，注册用户应至少在生效前一周收到通知。用户在修改生效后继续使用平台，即视为默示接受。' },
    { title: '13. 适用法律与管辖', body: '本条款受沙特阿拉伯王国法律管辖。若争议无法通过 Maabar 的机制解决，则由沙特法院管辖。' },
    { title: '14. 记录保存', body: 'Maabar 会自交易完成或终止之日起，保存合同、沟通记录及付款记录 3 年。' },
  ],
};

// ── UI copy (copied exactly from web Terms.jsx T object) ──────────────────────
const T = {
  ar: {
    eyebrow:       'مَعبر · الشروط والأحكام',
    title:         'الشروط والأحكام',
    intro:         'تم إعداد هذه الصفحة بصياغة عربية مرجعية، مع إبقائها جاهزة لبنية متعددة اللغات داخل الموقع. باستخدام مَعبر فإنك توافق على هذه الشروط والأحكام.',
    referenceNote: 'النسخة العربية هي المرجع الأساسي لهذه الصفحة في الوقت الحالي.',
    updatedLabel:  'آخر تحديث',
    companyLabel:  'السجل التجاري',
    emailLabel:    'البريد الإلكتروني',
    websiteLabel:  'الموقع الإلكتروني',
  },
  en: {
    eyebrow:       'Maabar · Terms & Conditions',
    title:         'Terms & Conditions',
    intro:         'This page is structured for multilingual support while keeping the Arabic legal wording as the primary reference source for now. By using Maabar, you agree to these terms and conditions.',
    referenceNote: 'For now, the Arabic version remains the primary reference of this page.',
    updatedLabel:  'Last updated',
    companyLabel:  'CR Number',
    emailLabel:    'Email',
    websiteLabel:  'Website',
  },
  zh: {
    eyebrow:       'Maabar · 条款与条件',
    title:         '条款与条件',
    intro:         '此页面已按多语言结构准备，但目前仍以阿拉伯语法律文本作为主要参考来源。使用 Maabar 即表示您同意这些条款与条件。',
    referenceNote: '当前页面仍以阿拉伯语版本作为主要参考。',
    updatedLabel:  '最后更新',
    companyLabel:  '商业登记号',
    emailLabel:    '邮箱',
    websiteLabel:  '网站',
  },
};

function formatLastUpdated(lang) {
  const locale = lang === 'ar' ? 'ar-SA' : lang === 'zh' ? 'zh-CN' : 'en-GB';
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(`${LAST_UPDATED_ISO}T00:00:00`));
}

export default function TermsScreen({ navigation }) {
  const lang     = getLang();
  const t        = T[lang]        || T.ar;
  const sections = SECTIONS[lang] || SECTIONS.ar;
  const isAr     = lang === 'ar';
  const bodyFont = isAr ? F.ar   : F.en;
  const boldFont = isAr ? F.arBold : F.enBold;
  const semiFont = isAr ? F.arSemi : F.enSemi;

  const metaItems = [
    { label: t.updatedLabel, value: formatLastUpdated(lang) },
    { label: t.companyLabel, value: CR_NUMBER },
    { label: t.emailLabel,   value: CONTACT_EMAIL },
    { label: t.websiteLabel, value: WEBSITE_URL },
  ];

  return (
    <SafeAreaView style={s.safe}>

      {/* ── Header ── */}
      <View style={[s.header, isAr && s.rowRtl]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} activeOpacity={0.7}>
          <Text style={[s.back, isAr && s.backRtl]}>←</Text>
        </TouchableOpacity>
        <Text style={[s.headerTitle, { fontFamily: semiFont }]}>{t.title}</Text>
        <View style={s.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── Hero ── */}
        <View style={s.hero}>
          <Text style={[s.eyebrow, { fontFamily: bodyFont, textAlign: isAr ? 'right' : 'left' }]}>
            {t.eyebrow}
          </Text>
          <Text style={[s.heroTitle, { fontFamily: boldFont, textAlign: isAr ? 'right' : 'left' }]}>
            {t.title}
          </Text>
          <Text style={[s.intro, { fontFamily: bodyFont, textAlign: isAr ? 'right' : 'left' }]}>
            {t.intro}
          </Text>
          <Text style={[s.referenceNote, { fontFamily: bodyFont, textAlign: isAr ? 'right' : 'left' }]}>
            {t.referenceNote}
          </Text>
        </View>

        {/* ── Meta grid (2×2) ── */}
        <View style={s.metaGrid}>
          {metaItems.map((item, i) => (
            <View key={i} style={s.metaCard}>
              <Text style={[s.metaLabel, { fontFamily: bodyFont }]}>{item.label}</Text>
              <Text style={[s.metaValue, { fontFamily: F.en }]} numberOfLines={2}>
                {item.value}
              </Text>
            </View>
          ))}
        </View>

        {/* ── Sections ── */}
        <View style={s.sections}>
          {sections.map((sec, i) => (
            <View key={i} style={s.sectionCard}>
              <Text style={[s.sectionTitle, { fontFamily: semiFont, textAlign: isAr ? 'right' : 'left' }]}>
                {sec.title}
              </Text>
              <Text style={[s.sectionBody, { fontFamily: bodyFont, textAlign: isAr ? 'right' : 'left' }]}>
                {sec.body}
              </Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bgBase },
  scroll: { paddingBottom: 56 },
  rowRtl: { flexDirection: 'row-reverse' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
    gap: 12,
  },
  back:         { color: C.textSecondary, fontSize: 22 },
  backRtl:      { transform: [{ scaleX: -1 }] },
  headerTitle:  { flex: 1, color: C.textPrimary, fontSize: 16, textAlign: 'center' },
  headerSpacer: { width: 22 },

  // Hero
  hero: {
    backgroundColor: C.bgSubtle,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle,
    padding: 20, paddingTop: 24,
  },
  eyebrow: {
    fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase',
    color: C.textTertiary, marginBottom: 12,
  },
  heroTitle: { fontSize: 30, lineHeight: 36, color: C.textPrimary, marginBottom: 12 },
  intro:     { fontSize: 14, lineHeight: 24, color: C.textSecondary, marginBottom: 10 },
  referenceNote: { fontSize: 12, lineHeight: 20, color: C.textDisabled },

  // Meta 2×2 grid
  metaGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    padding: 12, gap: 8,
  },
  metaCard: {
    width: '48%', flexGrow: 1,
    backgroundColor: C.bgRaised, borderRadius: 18,
    borderWidth: 1, borderColor: C.borderSubtle,
    padding: 16,
  },
  metaLabel: {
    fontSize: 10, letterSpacing: 2, textTransform: 'uppercase',
    color: C.textTertiary, marginBottom: 8,
  },
  metaValue: { fontSize: 13, lineHeight: 20, color: C.textPrimary },

  // Sections
  sections: { padding: 12, paddingTop: 4, gap: 8 },
  sectionCard: {
    backgroundColor: C.bgBase, borderRadius: 20,
    borderWidth: 1, borderColor: C.borderSubtle,
    padding: 20,
  },
  sectionTitle: { fontSize: 16, lineHeight: 24, color: C.textPrimary, marginBottom: 10 },
  sectionBody:  { fontSize: 13, lineHeight: 24, color: C.textSecondary },
});
