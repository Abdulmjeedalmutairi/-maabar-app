import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Platform, ActivityIndicator, Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SUPABASE_ANON_KEY } from '../../lib/supabase';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';

const AI_PROXY = 'https://utzalmszfqfcofywfetv.supabase.co/functions/v1/Ai-proxy';

async function callAI(system, messages) {
  const res = await fetch(AI_PROXY, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ system, messages }),
  });
  const data = await res.json().catch(() => ({}));
  return data.content?.[0]?.text || '';
}

function parseJSON(text) {
  console.log('[CalcToolScreen] raw AI response:', text);
  try {
    let cleaned = text
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();
    // Extract the first JSON object or array from the response (strips any preamble text)
    const match = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) cleaned = match[0];
    return JSON.parse(cleaned);
  } catch (e) {
    console.warn('[CalcToolScreen] JSON parse failed:', e.message, '\nraw:', text);
    return null;
  }
}

const fmt = (n) => {
  const num = Number(n) || 0;
  return num === 0 ? '0' : String(Math.round(num));
};

/* ── Sub-components ───────────────────────────────── */

function NInput({ label, value, onChangeText, placeholder, numeric }) {
  return (
    <View style={s.fieldWrap}>
      {!!label && <Text style={s.fieldLabel}>{label}</Text>}
      <TextInput
        style={s.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.textDisabled}
        keyboardType={numeric ? 'numeric' : 'default'}
        textAlign="right"
      />
    </View>
  );
}

function Toggle({ label, active, onPress }) {
  return (
    <TouchableOpacity
      style={[s.toggle, active && s.toggleActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[s.toggleText, active && s.toggleTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ResultRow({ label, value }) {
  return (
    <View style={s.resultRow}>
      <Text style={s.resultVal}>{value}</Text>
      <Text style={s.resultLabel}>{label}</Text>
    </View>
  );
}

function DarkCard({ children }) {
  return <View style={s.darkCard}>{children}</View>;
}

function SubmitBtn({ onPress, disabled, loading, label, loadingLabel }) {
  return (
    <TouchableOpacity
      style={[s.submitBtn, disabled && s.submitBtnDisabled]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading
        ? <ActivityIndicator color="#fff" size="small" />
        : <Text style={s.submitBtnText}>{label}</Text>}
    </TouchableOpacity>
  );
}

function ResetBtn({ onPress, label }) {
  return (
    <TouchableOpacity style={s.resetBtn} onPress={onPress} activeOpacity={0.75}>
      <Text style={s.resetBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ── Tab 1: Import Cost ───────────────────────────── */

function Tab1() {
  const [f, setF] = useState({ product: '', qty: '', unitPrice: '', weight: '', shipping: 'sea' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const calc = async () => {
    if (!f.product || !f.qty || !f.unitPrice || !f.weight) return;
    setLoading(true);
    try {
      const text = await callAI(
        `خبير جمارك سعودي. احسب تكلفة الاستيراد وأرجع JSON فقط:
{"product_cost":0,"shipping_cost":0,"customs_duty":0,"customs_duty_pct":0,"vat":0,"clearance":0,"total":0,"unit_landed":0,"notes":""}
بحري: 15-25 ريال/كجم، جوي: 40-60. VAT 15%. تخليص: 500 تحت طن، 1000 فوقه.`,
        [{ role: 'user', content: `المنتج: ${f.product}\nالكمية: ${f.qty}\nسعر الوحدة: ${f.unitPrice}\nالوزن: ${f.weight} كجم\nالشحن: ${f.shipping === 'sea' ? 'بحري' : 'جوي'}` }],
      );
      const res = parseJSON(text);
      if (res) setResult(res);
      else Alert.alert('خطأ', 'تعذّر تحليل النتيجة');
    } catch {
      Alert.alert('خطأ', 'حدث خطأ أثناء الحساب');
    }
    setLoading(false);
  };

  if (result) {
    return (
      <View style={s.tabContent}>
        {[
          ['تكلفة المنتج', `${fmt(result.product_cost)} ريال`],
          ['تكلفة الشحن', `${fmt(result.shipping_cost)} ريال`],
          [`الجمارك (${result.customs_duty_pct}%)`, `${fmt(result.customs_duty)} ريال`],
          ['VAT 15%', `${fmt(result.vat)} ريال`],
          ['تخليص جمركي', `${fmt(result.clearance)} ريال`],
        ].map(([label, value], i) => (
          <ResultRow key={i} label={label} value={value} />
        ))}
        <DarkCard>
          <Text style={s.darkCardSub}>تكلفة الوحدة الحقيقية</Text>
          <Text style={s.darkCardNum}>{fmt(result.unit_landed)} <Text style={s.darkCardUnit}>ريال</Text></Text>
        </DarkCard>
        {!!result.notes && <Text style={s.notes}>{result.notes}</Text>}
        <ResetBtn
          label="حساب جديد"
          onPress={() => { setResult(null); setF({ product: '', qty: '', unitPrice: '', weight: '', shipping: 'sea' }); }}
        />
      </View>
    );
  }

  return (
    <View style={s.tabContent}>
      <NInput label="المنتج" value={f.product} onChangeText={v => setF({ ...f, product: v })} placeholder="مثال: كراسي مكتب" />
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <NInput label="الكمية" value={f.qty} onChangeText={v => setF({ ...f, qty: v })} placeholder="500" numeric />
        </View>
        <View style={{ flex: 1 }}>
          <NInput label="سعر الوحدة (ريال)" value={f.unitPrice} onChangeText={v => setF({ ...f, unitPrice: v })} placeholder="50" numeric />
        </View>
      </View>
      <NInput label="الوزن (كجم)" value={f.weight} onChangeText={v => setF({ ...f, weight: v })} placeholder="200" numeric />
      <View style={s.row}>
        <Toggle label="بحري" active={f.shipping === 'sea'} onPress={() => setF({ ...f, shipping: 'sea' })} />
        <Toggle label="جوي" active={f.shipping === 'air'} onPress={() => setF({ ...f, shipping: 'air' })} />
      </View>
      <SubmitBtn
        onPress={calc}
        disabled={!f.product || !f.qty || !f.unitPrice || !f.weight}
        loading={loading}
        label="احسب التكلفة"
        loadingLabel="جاري الحساب..."
      />
    </View>
  );
}

/* ── Tab 2: Shipping Advice ───────────────────────── */

const URGENCY = ['غير مستعجل', 'متوسط', 'مستعجل جداً'];
const PRODUCT_TYPES = ['إلكترونيات', 'أثاث', 'ملابس', 'مواد بناء', 'غذاء', 'أخرى'];

function Tab2() {
  const [f, setF] = useState({ weight: '', qty: '', unitPrice: '', urgency: 0, productType: 0 });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const calc = async () => {
    if (!f.weight || !f.qty || !f.unitPrice) return;
    setLoading(true);
    try {
      const text = await callAI(
        `خبير لوجستيات شحن من الصين للسعودية. أرجع JSON فقط:
{"recommendation":"sea|air","reason":"سببان بالعربي","sea_cost":0,"sea_days":0,"air_cost":0,"air_days":0,"warning":"","savings":0}`,
        [{ role: 'user', content: `وزن: ${f.weight} كجم\nكمية: ${f.qty}\nسعر الوحدة: ${f.unitPrice}\nاستعجال: ${URGENCY[f.urgency]}\nنوع: ${PRODUCT_TYPES[f.productType]}` }],
      );
      const res = parseJSON(text);
      if (res) setResult(res);
      else Alert.alert('خطأ', 'تعذّر تحليل النتيجة');
    } catch {
      Alert.alert('خطأ', 'حدث خطأ أثناء التحليل');
    }
    setLoading(false);
  };

  if (result) {
    return (
      <View style={s.tabContent}>
        <DarkCard>
          <Text style={s.darkCardSub}>التوصية</Text>
          <Text style={[s.darkCardNum, { fontSize: 20 }]}>
            {result.recommendation === 'sea' ? 'شحن بحري' : 'شحن جوي'}
          </Text>
          <Text style={s.resultReason}>{result.reason}</Text>
        </DarkCard>
        <View style={s.twoCol}>
          {[
            { label: 'بحري', cost: result.sea_cost, days: result.sea_days, active: result.recommendation === 'sea' },
            { label: 'جوي', cost: result.air_cost, days: result.air_days, active: result.recommendation === 'air' },
          ].map((o, i) => (
            <View key={i} style={[s.colCard, o.active && s.colCardActive]}>
              <Text style={[s.colLabel, o.active && s.colLabelActive]}>{o.label}</Text>
              <Text style={s.colCost}>{fmt(o.cost)} <Text style={s.colUnit}>ريال</Text></Text>
              <Text style={s.colDays}>{o.days} يوم</Text>
            </View>
          ))}
        </View>
        {result.savings > 0 && (
          <View style={s.savingsBox}>
            <Text style={s.savingsText}>توفير: {fmt(result.savings)} ريال</Text>
          </View>
        )}
        {!!result.warning && (
          <View style={s.warningBox}>
            <Text style={s.warningText}>{result.warning}</Text>
          </View>
        )}
        <ResetBtn label="حساب جديد" onPress={() => setResult(null)} />
      </View>
    );
  }

  return (
    <View style={s.tabContent}>
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <NInput label="الوزن (كجم)" value={f.weight} onChangeText={v => setF({ ...f, weight: v })} placeholder="200" numeric />
        </View>
        <View style={{ flex: 1 }}>
          <NInput label="الكمية" value={f.qty} onChangeText={v => setF({ ...f, qty: v })} placeholder="500" numeric />
        </View>
      </View>
      <NInput label="سعر الوحدة (ريال)" value={f.unitPrice} onChangeText={v => setF({ ...f, unitPrice: v })} placeholder="50" numeric />
      <View style={s.fieldWrap}>
        <Text style={s.fieldLabel}>مدى الاستعجال</Text>
        <View style={s.toggleGroup}>
          {URGENCY.map((o, i) => (
            <Toggle key={i} label={o} active={f.urgency === i} onPress={() => setF({ ...f, urgency: i })} />
          ))}
        </View>
      </View>
      <View style={s.fieldWrap}>
        <Text style={s.fieldLabel}>نوع المنتج</Text>
        <View style={s.toggleGroup}>
          {PRODUCT_TYPES.map((o, i) => (
            <Toggle key={i} label={o} active={f.productType === i} onPress={() => setF({ ...f, productType: i })} />
          ))}
        </View>
      </View>
      <SubmitBtn
        onPress={calc}
        disabled={!f.weight || !f.qty || !f.unitPrice}
        loading={loading}
        label="احصل على النصيحة"
        loadingLabel="جاري التحليل..."
      />
    </View>
  );
}

/* ── Tab 3: Profit Calculator ─────────────────────── */

const CHANNELS = ['نون', 'متجرك الإلكتروني', 'سوشيال ميديا', 'محل فيزيكل', 'جملة'];
const RETURN_RATES = ['منخفضة (2-5%)', 'متوسطة (5-10%)', 'عالية (+10%)'];

function Tab3() {
  const [f, setF] = useState({ landedCost: '', channel: 0, hasStorage: true, returnRate: 0 });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const calc = async () => {
    if (!f.landedCost) return;
    setLoading(true);
    try {
      const text = await callAI(
        `خبير تجارة إلكترونية سعودي. احسب هامش الربح وأرجع JSON فقط:
{"suggested_price":0,"profit_per_unit":0,"profit_margin_pct":0,"platform_fee_pct":0,"storage_cost":0,"marketing_pct":0,"return_cost":0,"net_profit_per_unit":0,"monthly_profit_estimate":0,"advice":""}`,
        [{ role: 'user', content: `تكلفة الوحدة: ${f.landedCost} ريال\nقناة: ${CHANNELS[f.channel]}\nمخزن: ${f.hasStorage ? 'نعم' : 'لا'}\nمرتجعات: ${RETURN_RATES[f.returnRate]}` }],
      );
      const res = parseJSON(text);
      if (res) setResult(res);
      else Alert.alert('خطأ', 'تعذّر تحليل النتيجة');
    } catch {
      Alert.alert('خطأ', 'حدث خطأ أثناء الحساب');
    }
    setLoading(false);
  };

  const marginColor = result
    ? result.profit_margin_pct > 20 ? '#2D6A4F'
      : result.profit_margin_pct > 10 ? C.textPrimary : C.red
    : C.textPrimary;

  if (result) {
    return (
      <View style={s.tabContent}>
        <DarkCard>
          <Text style={s.darkCardSub}>سعر البيع الموصى به</Text>
          <Text style={[s.darkCardNum, { fontSize: 30 }]}>{fmt(result.suggested_price)} <Text style={s.darkCardUnit}>ريال</Text></Text>
        </DarkCard>
        {[
          ['رسوم المنصة', `${result.platform_fee_pct}%`],
          ['تكلفة التسويق', `${result.marketing_pct}%`],
          ['تكلفة المرتجعات', `${fmt(result.return_cost)} ريال`],
          ['صافي ربح الوحدة', `${fmt(result.net_profit_per_unit)} ريال`],
        ].map(([label, value], i) => (
          <ResultRow key={i} label={label} value={value} />
        ))}
        <View style={s.twoCol}>
          <View style={s.colCard}>
            <Text style={s.colLabel}>هامش الربح</Text>
            <Text style={[s.colCost, { color: marginColor }]}>{result.profit_margin_pct}%</Text>
          </View>
          <View style={s.colCard}>
            <Text style={s.colLabel}>ربح شهري تقريبي</Text>
            <Text style={s.colCost}>{fmt(result.monthly_profit_estimate)} <Text style={s.colUnit}>ريال</Text></Text>
          </View>
        </View>
        {!!result.advice && (
          <View style={s.adviceBox}>
            <Text style={s.adviceText}>{result.advice}</Text>
          </View>
        )}
        <ResetBtn label="حساب جديد" onPress={() => setResult(null)} />
      </View>
    );
  }

  return (
    <View style={s.tabContent}>
      <NInput
        label="تكلفة الوحدة بعد الاستيراد (ريال)"
        value={f.landedCost}
        onChangeText={v => setF({ ...f, landedCost: v })}
        placeholder="من الحاسبة الأولى"
        numeric
      />
      <View style={s.fieldWrap}>
        <Text style={s.fieldLabel}>قناة البيع</Text>
        <View style={s.toggleGroup}>
          {CHANNELS.map((o, i) => (
            <Toggle key={i} label={o} active={f.channel === i} onPress={() => setF({ ...f, channel: i })} />
          ))}
        </View>
      </View>
      <View style={s.fieldWrap}>
        <Text style={s.fieldLabel}>عندك مخزن؟</Text>
        <View style={s.row}>
          <Toggle label="نعم" active={f.hasStorage} onPress={() => setF({ ...f, hasStorage: true })} />
          <Toggle label="لا" active={!f.hasStorage} onPress={() => setF({ ...f, hasStorage: false })} />
        </View>
      </View>
      <View style={s.fieldWrap}>
        <Text style={s.fieldLabel}>نسبة المرتجعات</Text>
        <View style={s.toggleGroup}>
          {RETURN_RATES.map((o, i) => (
            <Toggle key={i} label={o} active={f.returnRate === i} onPress={() => setF({ ...f, returnRate: i })} />
          ))}
        </View>
      </View>
      <SubmitBtn
        onPress={calc}
        disabled={!f.landedCost}
        loading={loading}
        label="احسب الربح"
        loadingLabel="جاري الحساب..."
      />
    </View>
  );
}

/* ── Screen ───────────────────────────────────────── */

const TABS = ['تكلفة الاستيراد', 'نصيحة الشحن', 'حاسبة الربح'];

export default function CalcToolScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.7} hitSlop={8}>
          <Text style={s.backArrow}>{Platform.OS === 'ios' ? '‹' : '←'}</Text>
          <Text style={s.backLabel}>رجوع</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>حاسبة التاجر</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Tab bar */}
      <View style={s.tabBar}>
        {TABS.map((t, i) => (
          <TouchableOpacity
            key={i}
            style={[s.tabItem, activeTab === i && s.tabItemActive]}
            onPress={() => setActiveTab(i)}
            activeOpacity={0.75}
          >
            <Text style={[s.tabText, activeTab === i && s.tabTextActive]}>
              {`0${i + 1} `}{t}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {activeTab === 0 && <Tab1 />}
          {activeTab === 1 && <Tab2 />}
          {activeTab === 2 && <Tab3 />}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ── Styles ───────────────────────────────────────── */
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bgBase },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
    backgroundColor: C.bgBase,
  },
  backBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, width: 60 },
  backArrow:  { fontSize: 22, color: C.textPrimary, fontFamily: F.en, lineHeight: 26 },
  backLabel:  { fontSize: 14, color: C.textPrimary, fontFamily: F.ar },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 15, fontFamily: F.arBold, color: C.textPrimary },

  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
    backgroundColor: C.bgBase,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: { borderBottomColor: C.textPrimary },
  tabText: {
    fontSize: 10,
    fontFamily: F.arSemi,
    color: C.textDisabled,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  tabTextActive: { color: C.textPrimary },

  tabContent: { padding: 16, gap: 14 },

  fieldWrap: { gap: 6 },
  fieldLabel: {
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: C.textDisabled,
    fontFamily: F.ar,
    textAlign: 'right',
  },
  input: {
    borderWidth: 1,
    borderColor: C.borderSubtle,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    fontFamily: F.ar,
    color: C.textPrimary,
    backgroundColor: C.bgMuted,
  },

  row: { flexDirection: 'row', gap: 8 },

  toggleGroup: { gap: 6 },
  toggle: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.borderSubtle,
    alignItems: 'flex-end',
  },
  toggleActive: {
    borderColor: C.borderStrong,
    backgroundColor: C.bgRaised,
  },
  toggleText: { fontFamily: F.ar, fontSize: 13, color: C.textTertiary },
  toggleTextActive: { color: C.textPrimary },

  submitBtn: {
    backgroundColor: C.textPrimary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { fontFamily: F.arBold, fontSize: 14, color: '#fff' },

  resetBtn: {
    borderWidth: 1,
    borderColor: C.borderDefault,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: C.bgRaised,
  },
  resetBtnText: { fontFamily: F.arSemi, fontSize: 13, color: C.textSecondary },

  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
  },
  resultLabel: { fontFamily: F.ar, fontSize: 13, color: C.textSecondary },
  resultVal:   { fontFamily: F.arSemi, fontSize: 13, color: C.textPrimary },

  darkCard: {
    backgroundColor: C.bgSubtle,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.borderDefault,
  },
  darkCardSub:  { fontSize: 10, letterSpacing: 2, color: C.textDisabled, marginBottom: 6, fontFamily: F.ar, textAlign: 'right' },
  darkCardNum:  { fontSize: 28, fontFamily: F.arLight, color: C.textPrimary, textAlign: 'right' },
  darkCardUnit: { fontSize: 12, color: C.textDisabled },

  resultReason: { fontFamily: F.ar, fontSize: 12, color: C.textSecondary, lineHeight: 20, marginTop: 8, textAlign: 'right' },

  twoCol: {
    flexDirection: 'row',
    gap: 1,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.borderSubtle,
  },
  colCard: {
    flex: 1,
    backgroundColor: C.bgSubtle,
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  colCardActive: { backgroundColor: C.bgRaised },
  colLabel:       { fontSize: 11, color: C.textTertiary, fontFamily: F.ar },
  colLabelActive: { color: C.textPrimary },
  colCost:  { fontSize: 18, fontFamily: F.arLight, color: C.textPrimary },
  colUnit:  { fontSize: 10, color: C.textDisabled },
  colDays:  { fontSize: 11, color: C.textDisabled, fontFamily: F.ar },

  savingsBox: {
    backgroundColor: 'rgba(45,106,79,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(45,106,79,0.15)',
    padding: 10,
  },
  savingsText: { fontFamily: F.ar, fontSize: 12, color: '#2D6A4F', textAlign: 'right' },
  warningBox: {
    backgroundColor: 'rgba(224,92,92,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(224,92,92,0.15)',
    padding: 10,
  },
  warningText: { fontFamily: F.ar, fontSize: 12, color: C.red, textAlign: 'right' },
  adviceBox: {
    backgroundColor: C.bgRaised,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.borderDefault,
    padding: 12,
  },
  adviceText: { fontFamily: F.ar, fontSize: 12, color: C.textSecondary, lineHeight: 20, textAlign: 'right' },
  notes: { fontFamily: F.ar, fontSize: 11, color: C.textTertiary, fontStyle: 'italic', textAlign: 'right' },
});
