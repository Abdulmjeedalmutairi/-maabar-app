/**
 * CheckoutScreen
 * 4-step checkout flow for direct product orders.
 * Saves to Supabase `requests` table (status: 'open').
 * Shipping info stored as JSON inside the description field.
 *
 * Step 1 — Order Details  (qty, specs, notes)
 * Step 2 — Shipping Info  (city, address, phone)
 * Step 3 — Summary        (review before payment)
 * Step 4 — Payment        (placeholder methods + confirm)
 */
import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { C } from '../../lib/colors';
import { F } from '../../lib/fonts';

/* ─────────────────────────────────────────────────────────────────── */
/* Helpers                                                             */
/* ─────────────────────────────────────────────────────────────────── */

function parseMoq(moq) {
  if (!moq) return 1;
  const n = parseInt(String(moq).replace(/[^\d]/g, ''), 10);
  return isNaN(n) ? 1 : n;
}

function isCommaSep(str) {
  return typeof str === 'string' && str.trim().includes(',');
}

function parseChips(str) {
  return str.split(',').map(s => s.trim()).filter(Boolean);
}

function fmtSar(usd, qty = 1) {
  const total = Number(usd || 0) * 3.75 * qty;
  return total.toLocaleString('ar-SA', { maximumFractionDigits: 2 }) + ' ر.س';
}

/* ─────────────────────────────────────────────────────────────────── */
/* Step indicator                                                       */
/* ─────────────────────────────────────────────────────────────────── */

const STEP_LABELS = ['تفاصيل', 'الشحن', 'مراجعة', 'الدفع'];

function StepIndicator({ current }) {
  return (
    <View style={si.row}>
      {STEP_LABELS.map((label, i) => {
        const num     = i + 1;
        const done    = num < current;
        const active  = num === current;
        return (
          <View key={num} style={si.item}>
            {/* connector line before (skip first) */}
            {i > 0 && (
              <View style={[si.line, done && si.lineDone]} />
            )}
            <View style={[si.circle, active && si.circleActive, done && si.circleDone]}>
              <Text style={[si.circleText, (active || done) && si.circleTextActive]}>
                {done ? '✓' : num}
              </Text>
            </View>
            <Text style={[si.label, active && si.labelActive]}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const si = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: C.bgRaised,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  line: {
    position: 'absolute',
    top: 13,
    right: '50%',
    left: -('50%'),
    width: '100%',
    height: 1,
    backgroundColor: C.borderMuted,
    zIndex: 0,
  },
  lineDone: { backgroundColor: C.btnPrimary },
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.borderDefault,
    backgroundColor: C.bgBase,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  circleActive: {
    borderColor: C.btnPrimary,
    backgroundColor: C.btnPrimary,
  },
  circleDone: {
    borderColor: C.btnPrimary,
    backgroundColor: C.btnPrimary,
  },
  circleText: {
    fontFamily: F.enSemi,
    fontSize: 12,
    color: C.textSecondary,
  },
  circleTextActive: { color: '#fff' },
  label: {
    marginTop: 5,
    fontFamily: F.ar,
    fontSize: 10,
    color: C.textSecondary,
    textAlign: 'center',
  },
  labelActive: { color: C.textPrimary, fontFamily: F.arSemi },
});

/* ─────────────────────────────────────────────────────────────────── */
/* Reusable sub-components                                             */
/* ─────────────────────────────────────────────────────────────────── */

function SectionCard({ title, children }) {
  return (
    <View style={s.card}>
      {!!title && <Text style={s.cardTitle}>{title}</Text>}
      {children}
    </View>
  );
}

function FieldLabel({ text, required }) {
  return (
    <Text style={s.fieldLabel}>
      {text}{required && <Text style={{ color: C.red }}> *</Text>}
    </Text>
  );
}

function Input({ label, required, ...props }) {
  return (
    <View style={s.fieldWrap}>
      <FieldLabel text={label} required={required} />
      <TextInput
        style={[s.input, props.multiline && s.inputMulti]}
        placeholderTextColor={C.textDisabled}
        textAlign="right"
        textAlignVertical={props.multiline ? 'top' : 'center'}
        {...props}
      />
    </View>
  );
}

function ChipSelector({ label, required, chips, selected, onSelect }) {
  return (
    <View style={s.fieldWrap}>
      <FieldLabel text={label} required={required} />
      <View style={s.chipRow}>
        {chips.map(chip => (
          <TouchableOpacity
            key={chip}
            style={[s.chip, selected === chip && s.chipActive]}
            onPress={() => onSelect(selected === chip ? '' : chip)}
            activeOpacity={0.8}
          >
            <Text style={[s.chipText, selected === chip && s.chipTextActive]}>{chip}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function SummaryRow({ label, value, large, muted }) {
  return (
    <View style={s.summaryRow}>
      <Text style={[s.summaryVal, large && s.summaryValLarge, muted && { color: C.textSecondary }]}>
        {value}
      </Text>
      <Text style={[s.summaryLabel, muted && { color: C.textSecondary }]}>{label}</Text>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/* Main screen                                                         */
/* ─────────────────────────────────────────────────────────────────── */

export default function CheckoutScreen({ navigation, route }) {
  const product = route.params?.product || {};
  const productId      = product.id;
  const productNameAr  = product.name_ar  || '';
  const productNameEn  = product.name_en  || '';
  const productNameZh  = product.name_zh  || '';
  const priceUsd       = product.price_from ?? null;
  const moq            = product.moq       ?? 1;
  const category       = product.category  || 'other';
  const specColors     = product.spec_color_options || '';
  const specDimensions = product.spec_dimensions    || '';

  const moqNum  = parseMoq(moq);
  const hasPrice = priceUsd != null && Number(priceUsd) > 0;

  const colorChips = isCommaSep(specColors) ? parseChips(specColors) : null;
  const dimChips   = isCommaSep(specDimensions) ? parseChips(specDimensions) : null;

  /* ── State ── */
  const [step, setStep] = useState(1);

  // Step 1
  const [quantity,         setQuantity]         = useState(String(moqNum));
  const [selectedColor,    setSelectedColor]     = useState('');
  const [customColor,      setCustomColor]       = useState('');
  const [selectedDim,      setSelectedDim]       = useState('');
  const [customDim,        setCustomDim]         = useState('');
  const [notes,            setNotes]             = useState('');

  // Step 2
  const [city,    setCity]    = useState('');
  const [address, setAddress] = useState('');
  const [phone,   setPhone]   = useState('');

  // Step 4
  const [payMethod,   setPayMethod]   = useState('mada');
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState(false);

  /* ── Derived ── */
  const qty       = parseInt(quantity, 10) || 0;
  const belowMoq  = qty > 0 && qty < moqNum;
  const productName = productNameAr || productNameEn || '';

  const specColorVal = colorChips
    ? selectedColor
    : customColor.trim() || (specColors || '');
  const specDimVal = dimChips
    ? selectedDim
    : customDim.trim() || (specDimensions || '');

  /* ── Validation ── */
  function validateStep1() {
    if (!quantity.trim() || qty < 1) {
      setError('يرجى إدخال الكمية.'); return false;
    }
    if (qty < moqNum) {
      setError(`الحد الأدنى للطلب هو ${moqNum} وحدة.`); return false;
    }
    return true;
  }

  function validateStep2() {
    if (!city.trim())    { setError('يرجى إدخال المدينة.'); return false; }
    if (!address.trim()) { setError('يرجى إدخال العنوان.'); return false; }
    if (!phone.trim())   { setError('يرجى إدخال رقم الهاتف.'); return false; }
    return true;
  }

  function handleNext() {
    setError('');
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    if (step < 4) setStep(s => s + 1);
  }

  function handleBack() {
    setError('');
    if (step > 1) setStep(s => s - 1);
    else navigation.goBack();
  }

  /* ── Submit ── */
  async function handleConfirm() {
    setError('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigation.navigate('Login'); return; }

    setSubmitting(true);

    const description = JSON.stringify({
      checkout:   true,
      product_id: productId,
      specs:      { color: specColorVal, dimensions: specDimVal },
      notes:      notes.trim(),
      shipping:   { city: city.trim(), address: address.trim(), phone: phone.trim() },
    });

    const { error: dbErr } = await supabase.from('requests').insert({
      buyer_id:        user.id,
      title_ar:        productNameAr || productNameEn || '',
      title_en:        productNameEn || productNameAr || '',
      title_zh:        productNameZh || productNameEn || '',
      description,
      quantity:        String(qty),
      category:        category || 'other',
      budget_per_unit: hasPrice ? Number(priceUsd) : null,
      status:          'open',
      sourcing_mode:   'direct',
    });

    setSubmitting(false);
    if (dbErr) { setError('حدث خطأ، حاول مرة أخرى.'); return; }
    setSuccess(true);
  }

  /* ── Success screen ── */
  if (success) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.successWrap}>
          <View style={s.successCircle}>
            <Text style={s.successCheck}>✓</Text>
          </View>
          <Text style={s.successTitle}>تم استلام طلبك</Text>
          <Text style={s.successSub}>
            سيتواصل معك المورد قريباً لتأكيد التفاصيل والترتيب.
          </Text>
          <TouchableOpacity
            style={s.successBtn}
            onPress={() => navigation.navigate('Requests')}
            activeOpacity={0.85}
          >
            <Text style={s.successBtnText}>عرض طلباتي</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.successSecondary}
            onPress={() => navigation.navigate('BuyerHome')}
            activeOpacity={0.75}
          >
            <Text style={s.successSecondaryText}>العودة للرئيسية</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  /* ── Step renders ── */
  function renderStep1() {
    return (
      <>
        <SectionCard title="تفاصيل الطلب">
          {/* Product name — read-only */}
          <View style={s.fieldWrap}>
            <FieldLabel text="المنتج" />
            <View style={s.readonlyInput}>
              <Text style={s.readonlyText}>{productName || '—'}</Text>
            </View>
          </View>

          {/* Quantity */}
          <View style={s.fieldWrap}>
            <FieldLabel text="الكمية" required />
            <TextInput
              style={[s.input, belowMoq && s.inputWarn]}
              value={quantity}
              onChangeText={v => { setQuantity(v); setError(''); }}
              keyboardType="numeric"
              placeholderTextColor={C.textDisabled}
              textAlign="right"
            />
            {belowMoq && (
              <Text style={s.warnText}>
                الحد الأدنى للطلب {moqNum} وحدة
              </Text>
            )}
            {moqNum > 1 && !belowMoq && (
              <Text style={s.hintText}>الحد الأدنى: {moqNum} وحدة</Text>
            )}
          </View>

          {/* Color / variant spec */}
          {!!specColors && (
            colorChips ? (
              <ChipSelector
                label="اللون / الخيار"
                chips={colorChips}
                selected={selectedColor}
                onSelect={setSelectedColor}
              />
            ) : (
              <Input
                label="اللون / الخيار"
                value={customColor}
                onChangeText={setCustomColor}
                placeholder={specColors}
              />
            )
          )}

          {/* Dimensions spec */}
          {!!specDimensions && (
            dimChips ? (
              <ChipSelector
                label="المقاس / الأبعاد"
                chips={dimChips}
                selected={selectedDim}
                onSelect={setSelectedDim}
              />
            ) : (
              <Input
                label="المقاس / الأبعاد"
                value={customDim}
                onChangeText={setCustomDim}
                placeholder={specDimensions}
              />
            )
          )}
        </SectionCard>

        <SectionCard title="">
          <Input
            label="ملاحظات إضافية (اختياري)"
            value={notes}
            onChangeText={setNotes}
            placeholder="أي تفاصيل أو متطلبات خاصة..."
            multiline
            numberOfLines={3}
          />
        </SectionCard>
      </>
    );
  }

  function renderStep2() {
    return (
      <SectionCard title="بيانات الشحن">
        <Input
          label="المدينة"
          required
          value={city}
          onChangeText={setCity}
          placeholder="مثال: الرياض"
        />
        <Input
          label="العنوان"
          required
          value={address}
          onChangeText={setAddress}
          placeholder="الحي، الشارع، رقم المبنى..."
          multiline
          numberOfLines={2}
        />
        <Input
          label="رقم الهاتف"
          required
          value={phone}
          onChangeText={setPhone}
          placeholder="+966 5X XXX XXXX"
          keyboardType="phone-pad"
        />
      </SectionCard>
    );
  }

  function renderStep3() {
    const unitPriceLine = hasPrice ? fmtSar(priceUsd) : 'السعر عند الطلب';
    const totalLine     = hasPrice && qty > 0 ? fmtSar(priceUsd, qty) : '—';

    return (
      <>
        <SectionCard title="ملخص الطلب">
          <SummaryRow label="المنتج"   value={productName || '—'} />
          <View style={s.divider} />
          <SummaryRow label="الكمية"   value={`${qty} وحدة`} />
          {!!specColorVal && <SummaryRow label="اللون / الخيار"  value={specColorVal} />}
          {!!specDimVal   && <SummaryRow label="المقاس / الأبعاد" value={specDimVal} />}
          {!!notes.trim() && <SummaryRow label="ملاحظات"          value={notes.trim()} />}
        </SectionCard>

        <SectionCard title="التسعير">
          <SummaryRow label="سعر الوحدة"  value={unitPriceLine} />
          <SummaryRow label="الكمية"       value={`× ${qty}`} />
          <View style={s.divider} />
          <SummaryRow label="الشحن"        value="سيتم التحديد لاحقاً" muted />
          <View style={s.divider} />
          <SummaryRow label="الإجمالي التقديري" value={totalLine} large />
        </SectionCard>

        <SectionCard title="بيانات الشحن">
          <SummaryRow label="المدينة"  value={city} />
          <SummaryRow label="العنوان"  value={address} />
          <SummaryRow label="الهاتف"   value={phone} />
        </SectionCard>
      </>
    );
  }

  function renderStep4() {
    const methods = [
      { id: 'mada',     label: 'مدى',       sub: 'بطاقة مدى السعودية' },
      { id: 'visa',     label: 'Visa',       sub: 'بطاقة ائتمانية' },
      { id: 'applepay', label: 'Apple Pay',  sub: 'الدفع بـ Apple Pay' },
    ];

    return (
      <>
        <SectionCard title="اختر طريقة الدفع">
          {methods.map(m => (
            <TouchableOpacity
              key={m.id}
              style={[s.payRow, payMethod === m.id && s.payRowActive]}
              onPress={() => setPayMethod(m.id)}
              activeOpacity={0.8}
            >
              <View style={[s.payRadio, payMethod === m.id && s.payRadioActive]}>
                {payMethod === m.id && <View style={s.payRadioDot} />}
              </View>
              <View style={s.payLabels}>
                <Text style={[s.payLabel, { fontFamily: m.id === 'visa' || m.id === 'applepay' ? F.enSemi : F.arSemi }]}>
                  {m.label}
                </Text>
                <Text style={s.paySub}>{m.sub}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </SectionCard>

        <View style={s.payNotice}>
          <Text style={s.payNoticeText}>
            ادفع بأمان عبر بطاقة مدى أو فيزا. ستُحفظ تفاصيل طلبك عند إتمام الدفع.
          </Text>
        </View>
      </>
    );
  }

  /* ── Render ── */
  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top bar */}
        <View style={s.topBar}>
          <TouchableOpacity onPress={handleBack} hitSlop={10}>
            <Text style={s.backText}>← رجوع</Text>
          </TouchableOpacity>
          <Text style={s.pageTitle}>إتمام الطلب</Text>
          <View style={{ width: 56 }} />
        </View>

        {/* Step indicator */}
        <StepIndicator current={step} />

        {/* Scrollable content */}
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}

          {!!error && <Text style={s.error}>{error}</Text>}
        </ScrollView>

        {/* Footer CTA */}
        <View style={s.footer}>
          {step < 4 ? (
            <TouchableOpacity style={s.ctaBtn} onPress={handleNext} activeOpacity={0.85}>
              <Text style={s.ctaBtnText}>التالي ←</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={s.ctaBtn}
              onPress={() => {
                const amountSAR = hasPrice && qty > 0
                  ? Number(priceUsd) * 3.75 * qty
                  : 0;
                const description = JSON.stringify({
                  checkout: true,
                  product_id: productId,
                  specs: { color: specColorVal, dimensions: specDimVal },
                  notes: notes.trim(),
                  shipping: { city: city.trim(), address: address.trim(), phone: phone.trim() },
                });
                navigation.navigate('Payment', {
                  amount: amountSAR,
                  type: 'checkout',
                  requestData: {
                    title_ar: productNameAr || productNameEn || '',
                    title_en: productNameEn || productNameAr || '',
                    title_zh: productNameZh || productNameEn || '',
                    description,
                    quantity: String(qty),
                    category: category || 'other',
                    budget_per_unit: hasPrice ? Number(priceUsd) : null,
                    sourcing_mode: 'direct',
                  },
                });
              }}
              activeOpacity={0.85}
            >
              <Text style={s.ctaBtnText}>الدفع الآن</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/* Styles                                                              */
/* ─────────────────────────────────────────────────────────────────── */
const s = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: C.bgBase },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: C.bgRaised,
    borderBottomWidth: 1,
    borderBottomColor: C.borderSubtle,
  },
  pageTitle: { fontFamily: F.arBold, fontSize: 17, color: C.textPrimary },
  backText:  { fontFamily: F.ar, fontSize: 14, color: C.textSecondary },

  scroll: { padding: 16, paddingBottom: 32, gap: 12 },

  /* Cards */
  card: {
    backgroundColor: C.bgRaised,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.borderMuted,
    padding: 16,
    gap: 4,
  },
  cardTitle: {
    fontFamily: F.arSemi,
    fontSize: 14,
    color: C.textPrimary,
    textAlign: 'right',
    marginBottom: 12,
  },

  /* Fields */
  fieldWrap:  { marginBottom: 14 },
  fieldLabel: {
    fontFamily: F.ar,
    fontSize: 12,
    color: C.textSecondary,
    textAlign: 'right',
    marginBottom: 6,
  },
  input: {
    backgroundColor: C.bgBase,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.borderMuted,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontFamily: F.ar,
    fontSize: 15,
    color: C.textPrimary,
    textAlign: 'right',
  },
  inputMulti: { minHeight: 76, textAlignVertical: 'top', paddingTop: 11 },
  inputWarn:  { borderColor: C.orange },

  readonlyInput: {
    backgroundColor: C.bgSubtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.borderMuted,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  readonlyText: {
    fontFamily: F.arSemi,
    fontSize: 15,
    color: C.textPrimary,
    textAlign: 'right',
  },

  hintText: {
    fontFamily: F.ar,
    fontSize: 11,
    color: C.textTertiary,
    textAlign: 'right',
    marginTop: 4,
  },
  warnText: {
    fontFamily: F.ar,
    fontSize: 11,
    color: C.orange,
    textAlign: 'right',
    marginTop: 4,
  },

  /* Chips */
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-end',
    marginTop: 2,
  },
  chip: {
    borderWidth: 1,
    borderColor: C.borderDefault,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: C.bgBase,
  },
  chipActive:     { borderColor: C.btnPrimary, backgroundColor: C.btnPrimary },
  chipText:       { fontFamily: F.ar, fontSize: 13, color: C.textSecondary },
  chipTextActive: { fontFamily: F.arSemi, color: C.btnPrimaryText },

  /* Summary rows */
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  summaryLabel: {
    fontFamily: F.ar,
    fontSize: 13,
    color: C.textPrimary,
  },
  summaryVal: {
    fontFamily: F.enSemi,
    fontSize: 14,
    color: C.textPrimary,
    textAlign: 'left',
    flexShrink: 1,
    marginLeft: 8,
  },
  summaryValLarge: {
    fontFamily: F.enSemi,
    fontSize: 18,
    color: C.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: C.borderSubtle,
    marginVertical: 6,
  },

  /* Payment methods */
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  payRowActive: { backgroundColor: C.bgSubtle },
  payRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  payRadioActive: { borderColor: C.btnPrimary },
  payRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.btnPrimary,
  },
  payLabels: { flex: 1, alignItems: 'flex-end' },
  payLabel:  { fontSize: 15, color: C.textPrimary },
  paySub:    { fontFamily: F.ar, fontSize: 12, color: C.textSecondary, marginTop: 1 },

  payNotice: {
    backgroundColor: C.bgRaised,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.borderMuted,
    padding: 14,
  },
  payNoticeText: {
    fontFamily: F.ar,
    fontSize: 12,
    color: C.textSecondary,
    textAlign: 'right',
    lineHeight: 20,
  },

  /* Error */
  error: {
    fontFamily: F.ar,
    fontSize: 13,
    color: C.red,
    textAlign: 'right',
    marginTop: 4,
    paddingHorizontal: 4,
  },

  /* Footer */
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    backgroundColor: C.bgRaised,
    borderTopWidth: 1,
    borderTopColor: C.borderSubtle,
  },
  ctaBtn: {
    backgroundColor: C.btnPrimary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaBtnText: {
    fontFamily: F.arBold,
    fontSize: 16,
    color: C.btnPrimaryText,
  },

  /* Success */
  successWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  successCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successCheck: {
    fontFamily: F.enSemi,
    fontSize: 28,
    color: C.green,
  },
  successTitle: {
    fontFamily: F.arBold,
    fontSize: 22,
    color: C.textPrimary,
    marginBottom: 10,
    textAlign: 'center',
  },
  successSub: {
    fontFamily: F.ar,
    fontSize: 14,
    color: C.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  successBtn: {
    backgroundColor: C.btnPrimary,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 40,
    marginBottom: 12,
    width: '100%',
    alignItems: 'center',
  },
  successBtnText: {
    fontFamily: F.arBold,
    fontSize: 16,
    color: C.btnPrimaryText,
  },
  successSecondary: { paddingVertical: 10 },
  successSecondaryText: {
    fontFamily: F.ar,
    fontSize: 14,
    color: C.textSecondary,
    textAlign: 'center',
  },
});
