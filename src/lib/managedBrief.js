// Mobile port of web/src/lib/managedSourcing.js — generates an AI brief via
// the maabar-ai edge function and builds the row shape for
// managed_request_briefs. Kept in sync with the web helper so a managed
// request created from either client lands with the same brief shape.

import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase';

const AI_ENDPOINT = `${SUPABASE_URL}/functions/v1/maabar-ai`;

function pickByLang(record, field, lang) {
  if (!record) return '';
  return record[`${field}_${lang}`] || record[`${field}_en`] || record[`${field}_ar`] || record[field] || '';
}

function buildHeuristicBrief({ request, lang, aiStatus = 'ready' }) {
  const description = request?.description || '';
  const category = request?.category || 'other';

  const extractedSpecs = [];
  if (description.includes('كجم') || description.includes('kg')) extractedSpecs.push({ key: 'weight', value: null, unit: 'kg', confidence: 'low' });
  if (description.includes('لون') || description.includes('color')) extractedSpecs.push({ key: 'color', value: null, unit: null, confidence: 'low' });
  if (description.includes('مقاس') || description.includes('size')) extractedSpecs.push({ key: 'size', value: null, unit: null, confidence: 'low' });
  if (description.includes('مادة') || description.includes('material')) extractedSpecs.push({ key: 'material', value: null, unit: null, confidence: 'low' });

  const priority = request?.response_deadline ? 'urgent' : 'normal';
  const aiConfidence = description.length > 50 ? 'high' : description.length > 20 ? 'medium' : 'low';

  const briefBody = String(description).trim().substring(0, 200);
  const supplierBriefAll = {
    ar: `طلب ${category} من خلال معبر. ${briefBody}`,
    en: `Request for ${category} through Maabar. ${briefBody}`,
    zh: `通过 Maabar 采购 ${category}。${briefBody}`,
  };

  return {
    ai_status: aiStatus,
    priority,
    extracted_specs: extractedSpecs,
    cleaned_description: String(description).trim(),
    category,
    ai_confidence: aiConfidence,
    supplier_brief: supplierBriefAll[lang] || supplierBriefAll.en,
    admin_follow_up_question: null,
    admin_internal_notes: null,
    ai_output: {
      generated_at: new Date().toISOString(),
      model: 'heuristic-fallback',
      prompt_version: 'managed_brief.v1',
      supplier_brief_all: supplierBriefAll,
    },
  };
}

function mergePriority(buyerPriority, aiPriority) {
  if (buyerPriority === 'urgent') return 'urgent';
  return aiPriority === 'urgent' ? 'urgent' : 'normal';
}

export async function generateManagedBriefWithAI({ request, lang = 'ar' }) {
  const payload = {
    language: lang,
    title: pickByLang(request, 'title', lang),
    description: pickByLang(request, 'description', lang) || request?.description || '',
    category: request?.category || 'other',
    quantity: request?.quantity ?? null,
    budget: request?.budget_per_unit ?? null,
    budget_currency: request?.budget_currency || null,
    response_deadline: request?.response_deadline || null,
  };

  try {
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ task: 'managed_brief', payload }),
    });
    if (!res.ok) throw new Error(`maabar-ai managed_brief ${res.status}`);
    const data = await res.json();
    const result = data?.result;
    if (!result || typeof result !== 'object') throw new Error('empty result');

    const supplierBriefAll = (result.supplier_brief && typeof result.supplier_brief === 'object')
      ? result.supplier_brief
      : null;
    const supplierBriefText = supplierBriefAll
      ? (supplierBriefAll[lang] || supplierBriefAll.en || supplierBriefAll.ar || '')
      : (typeof result.supplier_brief === 'string' ? result.supplier_brief : '');

    const aiPriority = result.priority === 'urgent' ? 'urgent' : 'normal';
    const priority = mergePriority(request?.managed_priority, aiPriority);

    return {
      ai_status: 'ready',
      priority,
      extracted_specs: Array.isArray(result.extracted_specs) ? result.extracted_specs : [],
      cleaned_description: typeof result.cleaned_description === 'string' ? result.cleaned_description : String(request?.description || '').trim(),
      category: result.category || request?.category || 'other',
      ai_confidence: ['high', 'medium', 'low'].includes(result.ai_confidence) ? result.ai_confidence : 'medium',
      supplier_brief: supplierBriefText || String(request?.description || '').trim(),
      admin_follow_up_question: typeof result.admin_follow_up_question === 'string' ? result.admin_follow_up_question : null,
      admin_internal_notes: typeof result.admin_internal_notes === 'string' ? result.admin_internal_notes : null,
      ai_output: {
        generated_at: new Date().toISOString(),
        model: 'maabar-ai',
        prompt_version: 'managed_brief.v1',
        supplier_brief_all: supplierBriefAll,
      },
    };
  } catch (error) {
    console.error('generateManagedBriefWithAI error:', error);
    return buildHeuristicBrief({ request, lang, aiStatus: 'failed' });
  }
}

export function buildManagedBriefRow({ requestId, buyerId, brief }) {
  if (!brief) return null;
  return {
    request_id: requestId,
    buyer_id: buyerId,
    ai_status: brief.ai_status || 'ready',
    admin_review_status: 'pending',
    supplier_brief: brief.supplier_brief || brief.cleaned_description || '',
    admin_internal_notes: brief.admin_internal_notes ?? null,
    admin_follow_up_question: brief.admin_follow_up_question ?? null,
    priority: brief.priority || 'normal',
    extracted_specs: brief.extracted_specs || [],
    cleaned_description: brief.cleaned_description || '',
    category: brief.category || 'other',
    ai_confidence: brief.ai_confidence || 'medium',
    ai_output: brief.ai_output || {},
  };
}

// Ensures a managed request has a brief and advances managed_status to
// admin_review. Call from buyer-side creation paths (NewRequest, inline modal,
// IdeaToProduct). Swallows errors — the request itself has already been
// inserted by the caller.
export async function setupManagedRequest({ requestId, buyerId, requestPayload, lang = 'ar' }) {
  try {
    const brief = await generateManagedBriefWithAI({ request: requestPayload, lang });
    const row = buildManagedBriefRow({ requestId, buyerId, brief });
    if (row) {
      await supabase.from('managed_request_briefs').upsert(row, { onConflict: 'request_id' });
    }
    await supabase.from('requests').update({
      managed_status: 'admin_review',
      managed_priority: brief.priority || 'normal',
      managed_ai_ready_at: new Date().toISOString(),
    }).eq('id', requestId);
  } catch (err) {
    console.error('[managedBrief] setupManagedRequest error:', err);
  }
}
